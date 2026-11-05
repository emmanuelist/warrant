import { type ReactNode, useEffect, useState } from "react";

import { type Board, nep141, type Offer, positionId, registration, type Series } from "../lib/chain";
import { config } from "../lib/config";
import { account as short, count, parse, units, utc } from "../lib/format";
import { type Call, onIntents, onOptions, TGAS } from "../lib/wallet";
import { AmountField, Choice, Field, inputClass, isAccountId, Submit, wholeCount } from "./form";
import { Amount } from "./parts";
import { Review } from "./Review";

interface FormProps {
  board: Board;
  viewer: string | null;
  blocked: string | null;
  busy: boolean;
  /** The exact calls the review panel showed. */
  onSubmit: (calls: Call[]) => void;
}

/** 0.05 NEAR kept back from a NEAR deposit for gas and storage. */
const NEAR_RESERVE = 50_000_000_000_000_000_000_000n;

function Summary({ children }: { children: ReactNode }) {
  return <p className="min-h-[3em] text-ui leading-relaxed text-iron-2">{children}</p>;
}

/** Fungible tokens this board knows (allowlisted or used by a series). */
function fungibleTokens(board: Board): string[] {
  return Object.keys(board.tokens).filter((id) => nep141(id));
}

function TokenSelect({ board, value, onChange, ids }: { board: Board; value: string; onChange: (id: string) => void; ids: string[] }) {
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {ids.map((id) => (
        <option key={id} value={id}>
          {board.tokens[id]?.symbol ?? id}
        </option>
      ))}
    </select>
  );
}

function amountState(text: string, decimals: number | null | undefined, balance: bigint | null) {
  const amount = decimals != null ? parse(text, decimals) : null;
  const over = amount !== null && balance !== null && amount > balance;
  const valid = amount !== null && amount > 0n && !over;
  return { amount, over, valid, invalid: text.trim() !== "" && !valid };
}

type Registration = { status: "checking" } | { status: "error"; message: string } | { status: "ready"; deposit: bigint | null };

/**
 * NEP-145 registration of `account` on `contract`, read when the token or account changes, so the
 * review shows the storage deposit (or its absence) before anything is signed.
 */
function useRegistration(contract: string, account: string | null, needed: boolean): Registration {
  const key = needed && account && contract ? `${contract}:${account}` : null;
  const [state, setState] = useState<{ key: string; value: Registration } | null>(null);
  useEffect(() => {
    if (!key || !account) return;
    let live = true;
    registration(contract, account).then(
      (result) => live && setState({ key, value: { status: "ready", deposit: result?.deposit ?? null } }),
      (error: unknown) => live && setState({ key, value: { status: "error", message: error instanceof Error ? error.message : String(error) } }),
    );
    return () => {
      live = false;
    };
  }, [key, contract, account]);
  if (!key) return { status: "ready", deposit: null };
  return state?.key === key ? state.value : { status: "checking" };
}

const storageDeposit = (contract: string, account: string, deposit: bigint, gas: bigint): Call => ({
  receiverId: contract,
  method: "storage_deposit",
  args: { account_id: account, registration_only: true },
  deposit,
  gas,
});

function registrationNote(reg: Registration, contract: string): { pending: ReactNode; blocked: string | null } {
  if (reg.status === "checking") return { pending: `Checking whether this account is registered on ${contract}…`, blocked: "Checking registration…" };
  if (reg.status === "error") return { pending: null, blocked: `Couldn't read ${contract}'s storage registration: ${reg.message}` };
  return { pending: null, blocked: null };
}

/** NEAR wallet → Intents. NEAR is wrapped and deposited in one transaction. */
export function DepositFromWallet({ board, viewer, blocked, busy, onSubmit, token: initial, amount: shortfall }: FormProps & { token: string; amount?: bigint }) {
  const ids = board.allowed.map((a) => a.token_id).filter((id) => nep141(id));
  const [tokenId, setTokenId] = useState(ids.includes(initial) ? initial : (ids[0] ?? ""));
  // A top-up arrives with the shortfall filled in, exactly, in the token's own units.
  const [text, setText] = useState(() => (shortfall ? units(shortfall, board.tokens[initial]).full.replace(/,/g, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : ""));
  const contract = nep141(tokenId) ?? "";
  const isWrap = contract === config.wrapContract;
  const wrapped = board.viewer?.wallet.tokens[tokenId] ?? null;
  const [payWith, setPayWith] = useState<"near" | "token">("near");
  const fromNear = isWrap && payWith === "near";
  const near = board.viewer?.wallet.near ?? null;
  const balance = fromNear ? (near === null ? null : near > NEAR_RESERVE ? near - NEAR_RESERVE : 0n) : wrapped;
  const token = board.tokens[tokenId];
  const { amount, over, valid, invalid } = amountState(text, token?.decimals, balance);
  const reg = useRegistration(contract, viewer, fromNear);
  const note = registrationNote(reg, contract);

  const calls: Call[] | null =
    valid && viewer && amount !== null && reg.status === "ready"
      ? [
          ...(fromNear && reg.deposit !== null ? [storageDeposit(contract, viewer, reg.deposit, 20n * TGAS)] : []),
          ...(fromNear ? [{ receiverId: contract, method: "near_deposit", args: {}, deposit: amount, gas: 20n * TGAS }] : []),
          { receiverId: contract, method: "ft_transfer_call", args: { receiver_id: config.intentsContract, amount: amount.toString(), msg: "" } },
        ]
      : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (calls) onSubmit(calls);
      }}
    >
      <Field label="Token">
        <TokenSelect board={board} value={tokenId} onChange={setTokenId} ids={ids} />
      </Field>
      {isWrap && (wrapped ?? 0n) > 0n && (
        <Choice
          name="Pay with"
          value={payWith}
          onChange={setPayWith}
          options={[
            { value: "near", label: "NEAR · wrap first" },
            { value: "token", label: `${token?.symbol ?? "wNEAR"} in wallet` },
          ]}
        />
      )}
      <AmountField
        label="Amount"
        unit={fromNear ? "NEAR" : (token?.symbol ?? "units")}
        value={text}
        onChange={setText}
        balance={balance}
        token={token}
        invalid={invalid}
        balanceLabel={fromNear ? "spendable" : "in wallet"}
      />
      <Summary>
        {over ? (
          "More than your wallet holds."
        ) : amount && valid ? (
          fromNear ? (
            <>
              Wraps <Amount raw={amount} token={token} unit={false} /> NEAR into {token?.symbol} and deposits it to your Intents
              balance in one transaction.
            </>
          ) : (
            <>
              Deposits <Amount raw={amount} token={token} /> from your wallet to your Intents balance.
            </>
          )
        ) : (
          "Your Intents balance is what you write, buy and exercise with. It stays yours until you use it."
        )}
      </Summary>
      <Submit
        blocked={blocked ?? (valid ? note.blocked : "Enter an amount.")}
        busy={busy}
        review={valid && <Review calls={calls} tokens={board.tokens} pending={note.pending} />}
      >
        Deposit
      </Submit>
    </form>
  );
}

/** Intents → NEAR wallet (`ft_withdraw`), registering the receiver on the token first if needed. */
export function WithdrawToWallet({ board, viewer, blocked, busy, onSubmit, token: initial }: FormProps & { token: string }) {
  const ids = fungibleTokens(board);
  const [tokenId, setTokenId] = useState(ids.includes(initial) ? initial : (ids[0] ?? ""));
  const [text, setText] = useState("");
  const [unwrap, setUnwrap] = useState(true);
  const contract = nep141(tokenId) ?? "";
  const isWrap = contract === config.wrapContract;
  const token = board.tokens[tokenId];
  const balance = board.viewer?.inIntents[tokenId] ?? null;
  const { amount, over, valid, invalid } = amountState(text, token?.decimals, balance);
  const reg = useRegistration(contract, viewer, true);
  const note = registrationNote(reg, contract);

  const calls: Call[] | null =
    valid && viewer && amount !== null && reg.status === "ready"
      ? [
          ...(reg.deposit !== null ? [storageDeposit(contract, viewer, reg.deposit, 30n * TGAS)] : []),
          onIntents("ft_withdraw", { token: contract, receiver_id: viewer, amount: amount.toString(), memo: null, msg: null }),
          ...(isWrap && unwrap ? [{ receiverId: contract, method: "near_withdraw", args: { amount: amount.toString() }, gas: 30n * TGAS }] : []),
        ]
      : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (calls) onSubmit(calls);
      }}
    >
      <Field label="Token">
        <TokenSelect board={board} value={tokenId} onChange={setTokenId} ids={ids} />
      </Field>
      <AmountField label="Amount" unit={token?.symbol ?? "units"} value={text} onChange={setText} balance={balance} token={token} invalid={invalid} balanceLabel="inside Intents" />
      {isWrap && (
        <label className="flex items-center gap-2 text-ui">
          <input type="checkbox" checked={unwrap} onChange={(e) => setUnwrap(e.target.checked)} className="h-4 w-4 accent-[var(--color-iron)]" />
          Unwrap to NEAR on arrival
        </label>
      )}
      <Summary>
        {over ? (
          "More than you hold inside Intents."
        ) : amount && valid ? (
          <>
            Sends <Amount raw={amount} token={token} /> from your Intents balance to <span className="fig text-iron">{viewer ? short(viewer) : "your wallet"}</span>
            {isWrap && unwrap ? ", then unwraps it to NEAR" : ""}. Anything a series has locked stays locked; only your own balance moves.
          </>
        ) : (
          "Only your own Intents balance can be withdrawn. Collateral in a live series stays inside Intents until expiry."
        )}
      </Summary>
      <Submit
        blocked={blocked ?? (valid ? note.blocked : "Enter an amount.")}
        busy={busy}
        review={valid && <Review calls={calls} tokens={board.tokens} pending={note.pending} />}
      >
        Withdraw to wallet
      </Submit>
    </form>
  );
}

/** A transfer between two Intents balances: tokens or positions, no withdrawal involved. */
export function SendInIntents({ board, viewer, blocked, busy, onSubmit, tokenId }: FormProps & { tokenId: string }) {
  const series = board.series.find((s) => positionId(s.token_id) === tokenId);
  const token = series ? undefined : board.tokens[tokenId];
  const balance = board.viewer?.inIntents[tokenId] ?? null;
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const amount = series ? wholeCount(text) : token?.decimals != null ? parse(text, token.decimals) : null;
  const over = amount !== null && balance !== null && amount > balance;
  const recipient = to.trim();
  const recipientOk = isAccountId(recipient) && recipient !== viewer;
  const valid = amount !== null && amount > 0n && !over && recipientOk;
  const what = series ? `long${amount === 1n ? "" : "s"} of series #${series.series_id}` : (token?.symbol ?? tokenId);
  const calls: Call[] | null =
    valid && amount !== null
      ? [onIntents("mt_transfer", { receiver_id: recipient, token_id: tokenId, amount: amount.toString(), approval: null, memo: null })]
      : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (calls) onSubmit(calls);
      }}
    >
      <Field label="To (NEAR account)" hint={recipient && !recipientOk ? (recipient === viewer ? "That's you." : "Not a valid NEAR account ID.") : undefined}>
        <input className={inputClass} value={to} onChange={(e) => setTo(e.target.value.toLowerCase())} placeholder="account.near" autoComplete="off" spellCheck={false} aria-invalid={recipient !== "" && !recipientOk} />
      </Field>
      {series ? (
        <Field label="Longs">
          <input className={inputClass} inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={text !== "" && (!amount || over)} />
        </Field>
      ) : (
        <AmountField label="Amount" unit={token?.symbol ?? "units"} value={text} onChange={setText} balance={balance} token={token} invalid={text !== "" && (!amount || over)} balanceLabel="inside Intents" />
      )}
      <Summary>
        {over ? (
          "More than you hold inside Intents."
        ) : valid && amount ? (
          <>
            Moves {series ? count(amount) : <Amount raw={amount} token={token} unit={false} />} {what} to{" "}
            <span className="fig text-iron">{short(recipient)}</span> inside Intents: no withdrawal, no bridge, final in one
            transaction. {series ? "They can move it back to Warrant to exercise before expiry." : "Transfers can't be reversed; check the account."}
          </>
        ) : series ? (
          `Inside Intents a long is an asset like any other. You hold ${count(balance ?? 0n)} there.`
        ) : (
          "Moves part of your Intents balance to another account's, inside Intents."
        )}
      </Summary>
      <Submit blocked={blocked ?? (valid ? null : "Enter a recipient and an amount.")} busy={busy} review={<Review calls={calls} tokens={board.tokens} />}>
        Send inside Intents
      </Submit>
    </form>
  );
}

/** Longs between Warrant's ledger (exercisable) and the holder's Intents balance (movable). */
export function MovePosition({ board, viewer, blocked, busy, onSubmit, series, direction }: FormProps & { series: Series; direction: "in" | "out" }) {
  const ledger = board.viewer?.longs[series.token_id] ?? 0n;
  const inIntents = board.viewer?.inIntents[positionId(series.token_id)] ?? 0n;
  const balance = direction === "in" ? ledger : inIntents;
  const [text, setText] = useState(balance > 0n ? balance.toString() : "1");
  const amount = wholeCount(text);
  const over = amount !== null && amount > balance;
  const valid = amount !== null && !over;
  const calls: Call[] | null =
    valid && viewer && amount !== null
      ? direction === "in"
        ? [onOptions("mt_transfer_call", { receiver_id: config.intentsContract, token_id: series.token_id, amount: amount.toString(), approval: null, memo: null, msg: "" })]
        : [onIntents("mt_withdraw", { token: config.optionsContract, receiver_id: viewer, token_ids: [series.token_id], amounts: [amount.toString()], memo: null, msg: null })]
      : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (calls) onSubmit(calls);
      }}
    >
      <dl className="grid grid-cols-2 gap-3 border-b border-rule pb-4 text-ui">
        <div>
          <dt className="plate-label text-label text-iron-2">In Warrant's ledger</dt>
          <dd className="fig mt-1">{count(ledger)}</dd>
        </div>
        <div>
          <dt className="plate-label text-label text-iron-2">Inside Intents</dt>
          <dd className="fig mt-1">{count(inIntents)}</dd>
        </div>
      </dl>
      <Field label="Longs">
        <input className={inputClass} inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={text !== "" && !valid} />
      </Field>
      <Summary>
        {over ? (
          `You hold ${count(balance)} ${direction === "in" ? "in the ledger" : "inside Intents"}.`
        ) : direction === "in" ? (
          <>
            Deposits them into your Intents balance as <span className="fig text-iron">{positionId(series.token_id)}</span>. There
            they move like any Intents asset. Move them back to exercise before {utc(series.expiry_ns)}.
          </>
        ) : (
          <>Withdraws them from Intents into Warrant's ledger, where they can be exercised until {utc(series.expiry_ns)}.</>
        )}
      </Summary>
      <Submit blocked={blocked ?? (valid ? null : "Enter how many longs.")} busy={busy} review={<Review calls={calls} tokens={board.tokens} />}>
        {direction === "in" ? "Move into Intents" : "Move back to Warrant"}
      </Submit>
    </form>
  );
}

export function CancelOffer({ board, blocked, busy, onSubmit, offer }: FormProps & { offer: Offer }) {
  const series = board.series.find((s) => s.series_id === offer.series_id);
  const calls = [onOptions("cancel_offer", { offer_id: offer.offer_id })];
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(calls);
      }}
    >
      <Summary>
        Closes offer {offer.offer_id} on series #{offer.series_id}
        {series ? ` (${series.kind})` : ""} and returns its <span className="fig text-iron">{count(offer.remaining)}</span> unsold
        long{offer.remaining === "1" ? "" : "s"} at <Amount raw={offer.price_per_option} token={board.tokens[offer.price_token]} /> to your ledger.
      </Summary>
      <Submit blocked={blocked} busy={busy} review={<Review calls={calls} tokens={board.tokens} />}>
        Cancel offer
      </Submit>
    </form>
  );
}

export function RetryPayout({ board, viewer, blocked, busy, onSubmit, tokenId }: FormProps & { tokenId: string }) {
  const owed = board.viewer?.owed[tokenId] ?? 0n;
  const calls = [onOptions("retry_payout", { token_id: tokenId })];
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(calls);
      }}
    >
      <Summary>
        Warrant owes {viewer ? <span className="fig text-iron">{short(viewer)}</span> : "you"}{" "}
        <Amount raw={owed} token={board.tokens[tokenId]} />: an earlier transfer failed, so the contract recorded the debt instead of
        losing it. This sends it to your Intents balance.
      </Summary>
      <Submit blocked={blocked ?? (owed > 0n ? null : "Nothing is owed.")} busy={busy} review={<Review calls={calls} tokens={board.tokens} />}>
        Retry payout
      </Submit>
    </form>
  );
}
