import { config } from "./config";
import { chainTimeMs, view, viewAccount } from "./rpc";

export type Kind = "call" | "put";

/** `get_series` / `get_series_list` (docs/SPEC.md "Views"). u128/u64 arrive as strings. */
export interface Series {
  series_id: string;
  token_id: string;
  writer: string;
  kind: Kind;
  underlying: string;
  quote: string;
  underlying_per_option: string;
  strike_per_option: string;
  expiry_ns: string;
  collateral_token: string;
  collateral_per_option: string;
  payment_token: string;
  payment_per_option: string;
  long_supply: string;
  collateral_held: string;
  proceeds_held: string;
  exercised: string;
  reclaimed: boolean;
  expired: boolean;
}

export interface Offer {
  offer_id: string;
  series_id: string;
  seller: string;
  remaining: string;
  price_per_option: string;
  price_token: string;
}

interface ConfigView {
  owner_id: string;
  intents_id: string;
  allowed_tokens: { token_id: string; min_amount: string }[];
}

export interface Token {
  id: string;
  symbol: string;
  /** `null` when the token's metadata could not be read: show raw base units. */
  decimals: number | null;
}

export interface Board {
  /** The Intents contract this options contract settles through (`get_config`). */
  intentsId: string;
  series: Series[];
  offers: Offer[];
  tokens: Record<string, Token>;
  allowed: { token_id: string; min_amount: string }[];
  /** This contract's balance of each token inside Intents. */
  contractInIntents: Record<string, bigint>;
  /** What the contract owes per token: collateral plus unwithdrawn proceeds. */
  obligations: Record<string, bigint>;
  viewer: Viewer | null;
  chainTimeMs: number;
}

export interface Viewer {
  account: string;
  /** Longs in this contract's ledger, by series token ID: the ones that can be exercised. */
  longs: Record<string, bigint>;
  /** Balances inside Intents: tokens by ID, positions as `nep245:<this contract>:<series>`. */
  inIntents: Record<string, bigint>;
  /** Payouts whose transfer failed, claimable with `retry_payout` (`get_owed`). */
  owed: Record<string, bigint>;
  wallet: {
    /** Spendable NEAR (balance minus storage), or `null` if the account doesn't exist yet. */
    near: bigint | null;
    /** NEP-141 balances held outside Intents, by token ID. */
    tokens: Record<string, bigint>;
  };
}

/** Storage costs 1e19 yoctoNEAR per byte (docs/CONTEXT.md, "Protocol constants"). */
const YOCTO_PER_BYTE = 10_000_000_000_000_000_000n;

/** The token contract behind an Intents token ID, for `nep141:` tokens only. */
export function nep141(tokenId: string): string | null {
  return tokenId.startsWith("nep141:") ? tokenId.slice("nep141:".length) : null;
}

/** A series' position as an Intents asset (SPEC.md "Positions"). */
export function positionId(seriesTokenId: string): string {
  return `nep245:${config.optionsContract}:${seriesTokenId}`;
}

const PAGE = 100;

async function all<T>(method: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const page = await view<T[]>(config.optionsContract, method, {
      from_index: String(from),
      limit: String(PAGE),
    });
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

async function tokenOf(id: string): Promise<Token> {
  const contract = nep141(id);
  if (!contract) return { id, symbol: id, decimals: null };
  try {
    const meta = await view<{ symbol: string; decimals: number }>(contract, "ft_metadata");
    return { id, symbol: meta.symbol, decimals: meta.decimals };
  } catch {
    return { id, symbol: id, decimals: null };
  }
}

async function balancesIn(intents: string, account: string, tokenIds: string[]): Promise<Record<string, bigint>> {
  if (tokenIds.length === 0) return {};
  const amounts = await view<string[]>(intents, "mt_batch_balance_of", {
    account_id: account,
    token_ids: tokenIds,
  });
  return Object.fromEntries(tokenIds.map((id, i) => [id, BigInt(amounts[i] ?? "0")]));
}

const add = (map: Record<string, bigint>, key: string, amount: bigint) => {
  map[key] = (map[key] ?? 0n) + amount;
};

/** Everything the board renders, read from chain in one pass. */
export async function loadBoard(viewerAccount: string | null): Promise<Board> {
  const options = config.optionsContract;
  const [configView, series, offers, now] = await Promise.all([
    view<ConfigView>(options, "get_config"),
    all<Series>("get_series_list"),
    all<Offer>("get_offers"),
    chainTimeMs(),
  ]);
  const intents = configView.intents_id;

  const tokenIds = [
    ...new Set([
      ...configView.allowed_tokens.map((t) => t.token_id),
      ...series.flatMap((s) => [s.underlying, s.quote]),
    ]),
  ];
  const tokenList = await Promise.all(tokenIds.map(tokenOf));
  const tokens = Object.fromEntries(tokenList.map((t) => [t.id, t]));

  const obligations: Record<string, bigint> = {};
  for (const s of series) {
    add(obligations, s.collateral_token, BigInt(s.collateral_held));
    add(obligations, s.payment_token, BigInt(s.proceeds_held));
  }
  const contractInIntents = await balancesIn(intents, options, tokenIds);

  let viewer: Viewer | null = null;
  if (viewerAccount) {
    const ids = series.map((s) => s.token_id);
    const fungible = tokenIds.filter((id) => nep141(id));
    const [longs, inIntents, owed, account, held] = await Promise.all([
      ids.length
        ? view<string[]>(options, "mt_batch_balance_of", { account_id: viewerAccount, token_ids: ids })
        : Promise.resolve([] as string[]),
      balancesIn(intents, viewerAccount, [...tokenIds, ...ids.map(positionId)]),
      Promise.all(tokenIds.map((id) => view<string>(options, "get_owed", { account_id: viewerAccount, token_id: id }))),
      viewAccount(viewerAccount),
      Promise.all(
        fungible.map((id) => view<string>(nep141(id) ?? "", "ft_balance_of", { account_id: viewerAccount }).catch(() => "0")),
      ),
    ]);
    viewer = {
      account: viewerAccount,
      longs: Object.fromEntries(ids.map((id, i) => [id, BigInt(longs[i] ?? "0")])),
      inIntents,
      owed: Object.fromEntries(tokenIds.map((id, i) => [id, BigInt(owed[i] ?? "0")])),
      wallet: {
        near: account ? BigInt(account.amount) - BigInt(account.storage_usage) * YOCTO_PER_BYTE : null,
        tokens: Object.fromEntries(fungible.map((id, i) => [id, BigInt(held[i] ?? "0")])),
      },
    };
  }

  return {
    intentsId: intents,
    series,
    offers,
    tokens,
    allowed: configView.allowed_tokens,
    contractInIntents,
    obligations,
    viewer,
    chainTimeMs: now,
  };
}

/**
 * NEP-145: the `storage_deposit` call that registers `account` on a token, or `null` if it already
 * is. Withdrawals out of Intents and wrapping NEAR both need the receiver registered first.
 */
export async function registration(contract: string, account: string): Promise<{ contract: string; deposit: bigint } | null> {
  const [balance, bounds] = await Promise.all([
    view<{ total: string } | null>(contract, "storage_balance_of", { account_id: account }),
    view<{ min: string }>(contract, "storage_balance_bounds"),
  ]);
  return balance ? null : { contract, deposit: BigInt(bounds.min) };
}
