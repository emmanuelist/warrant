import { Fragment, lazy, type ReactNode, Suspense, use, useState } from "react";

import type { Token } from "../lib/chain";
import { chainNow } from "../lib/clock";
import { config } from "../lib/config";
import { isEvmAccount } from "../lib/evm";
import { account as short, units, utc } from "../lib/format";
import type { UnsignedIntent } from "../lib/oneclick";
import { ViewerContext } from "../lib/viewer";
import { type Call, signer, transactionsFor } from "../lib/wallet";

const NEAR: Token = { id: "near", symbol: "NEAR", decimals: 24 };

/** An EVM wallet's review (D-030), loaded only when an EVM account signs. */
const SignedReview = lazy(() => import("./SignedReview").then((m) => ({ default: m.SignedReview })));

/** The contract's role in Warrant, so a receiver reads as more than an address (Safe's "Dai" chip). */
function role(receiver: string, tokens: Record<string, Token>): { text: string; symbol: boolean } | null {
  if (receiver === config.intentsContract) return { text: "NEAR Intents", symbol: false };
  if (receiver === config.optionsContract) return { text: "Warrant", symbol: false };
  const symbol = tokens[`nep141:${receiver}`]?.symbol;
  return symbol ? { text: symbol, symbol: true } : null;
}

const attached = (yocto: bigint) => (yocto === 1n ? "1 yocto" : `${units(yocto, NEAR).short} NEAR`);

/** "in 7 days", "in 3 hours", "in 25 minutes": an expiry's distance, for reading beside its UTC time. */
function inTime(ms: number): string {
  if (ms <= 0) return "already passed";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 120) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(ms / 3_600_000);
  return hours < 48 ? `in ${hours} hours` : `in ${Math.round(ms / 86_400_000)} days`;
}

interface Row {
  key: string;
  /** The value as read: a token amount with its symbol, a time in UTC, a count of options. */
  text: string;
  /** The value exactly as signed, when the reading differs from it. */
  raw?: string;
}

/**
 * Warrant's `msg` (the action an Intents transfer carries) as the action it encodes: amounts in
 * their tokens, the expiry in UTC and from now. The JSON view keeps every raw value.
 */
export function decodeMsg(text: string, tokens: Record<string, Token>, hints: Record<string, Token | undefined> = {}): Row[] | null {
  let msg: unknown;
  try {
    msg = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof msg !== "object" || msg === null || Array.isArray(msg)) return null;
  const fields = msg as Record<string, unknown>;
  const amount = (raw: string, tokenId: unknown) => {
    const token = typeof tokenId === "string" ? tokens[tokenId] : undefined;
    return token?.decimals != null ? `${units(raw, token).short} ${token.symbol}` : raw;
  };
  return Object.entries(fields).map(([key, value]) => {
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    switch (key) {
      case "underlying":
      case "quote":
        return { key, text: `${tokens[raw]?.symbol ?? raw} · ${raw}` };
      case "underlying_per_option":
        return { key, text: amount(raw, fields.underlying), raw };
      case "strike_per_option":
        return { key, text: amount(raw, fields.quote), raw };
      case "expiry_ns": {
        const ms = Number(BigInt(raw) / 1_000_000n);
        return { key, text: `${utc(raw)} · ${inTime(ms - chainNow())}`, raw };
      }
      case "amount":
        return { key, text: `${raw} option${raw === "1" ? "" : "s"}`, raw };
      default: {
        const hint = hints[key];
        return hint?.decimals != null ? { key, text: `${units(raw, hint).short} ${hint.symbol}`, raw } : { key, text: raw };
      }
    }
  });
}

/** Each argument exactly as signed, with a readable amount beside it where the token is known. */
function lines(receiver: string, args: Record<string, unknown>, tokens: Record<string, Token>, hints: Record<string, Token | undefined>) {
  const tokenId = typeof args.token_id === "string" ? args.token_id : typeof args.token === "string" ? `nep141:${args.token}` : `nep141:${receiver}`;
  return Object.entries(args).map(([key, value]) => {
    const text = typeof value === "string" ? (value === "" ? '""' : value) : JSON.stringify(value);
    const token = typeof value === "string" ? (key === "amount" ? tokens[tokenId] : hints[key]) : undefined;
    const decoded = key === "msg" && typeof value === "string" ? decodeMsg(value, tokens) : null;
    return { key, text, hint: token?.decimals != null ? `${units(value as string, token).short} ${token.symbol}` : null, decoded };
  });
}

export type View = "decoded" | "json";

export function ViewToggle({ view, onView }: { view: View; onView: (view: View) => void }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Show as">
      {(["decoded", "json"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onView(v)}
          className="plate-label rounded-full px-1.5 py-0.5 text-micro text-iron-2 hover:text-iron aria-pressed:bg-iron aria-pressed:text-board"
        >
          {v === "decoded" ? "Decoded" : "JSON"}
        </button>
      ))}
    </div>
  );
}

export const roleChip = "plate-label rounded-md bg-iron px-1 py-px text-micro text-board";

/** Identifiers and JSON wrap after their punctuation ("tusdc." / "sandbox"), never mid-word. */
export function Wrapped({ text }: { text: string }) {
  return (
    <>
      {text.split(/(?<=[.,:_/])/).map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
    </>
  );
}

/**
 * "What you'll sign" (DESIGN.md "References": Safe{Wallet}): every transaction this sheet will send,
 * decoded, with a raw JSON view of exactly what goes to the wallet. Don't trust the UI: read the call.
 */
export function Review({
  calls,
  tokens,
  pending,
  hints = {},
  inert,
}: {
  calls: Call[] | null;
  tokens: Record<string, Token>;
  pending?: ReactNode;
  /** Arguments whose amounts are in a known token, beyond `amount` (e.g. a listing's price). */
  hints?: Record<string, Token | undefined>;
  /** Why this can't be sent yet: the panel stays in place, dimmed, instead of disappearing. */
  inert?: string;
}) {
  const viewer = use(ViewerContext);
  const [view, setView] = useState<View>("decoded");
  if (pending) {
    return <p className="rounded-xl bg-bed px-3.5 py-3 text-meta text-iron-2">{pending}</p>;
  }
  if (!calls || calls.length === 0) return null;
  if (viewer && isEvmAccount(viewer)) {
    return (
      <Suspense fallback={<p className="rounded-xl bg-bed px-3.5 py-3 text-meta text-iron-2">Preparing the message to sign…</p>}>
        <SignedReview calls={calls} signer={viewer} tokens={tokens} hints={hints} inert={inert} view={view} onView={setView} />
      </Suspense>
    );
  }
  const transactions = transactionsFor(calls);
  const actions = transactions.reduce((n, tx) => n + tx.actions.length, 0);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <section className="rounded-xl bg-bed px-3.5 py-3" aria-label="What you'll sign" aria-disabled={inert ? true : undefined}>
      {inert && <p className="mb-2 text-meta text-iron">{inert}</p>}
      <header className={inert ? "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 opacity-55" : "flex flex-wrap items-center justify-between gap-x-3 gap-y-1"}>
        <p className="plate-label text-label text-iron-2">
          What you'll sign · {plural(transactions.length, "transaction")}
          {actions > transactions.length && ` · ${plural(actions, "action")}`}
        </p>
        <ViewToggle view={view} onView={setView} />
      </header>
      {view === "decoded" ? (
        <ol className={inert ? "mt-2.5 flex flex-col gap-3 opacity-55" : "mt-2.5 flex flex-col gap-3"}>
          {transactions.map((tx, i) => {
            const label = role(tx.receiverId, tokens);
            return (
              <li key={`${tx.receiverId}-${i}`}>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="fig text-meta [overflow-wrap:anywhere]">
                    <Wrapped text={tx.receiverId} />
                  </span>
                  {label && (
                    <span className={label.symbol ? "fig rounded-md bg-iron px-1 py-px text-micro text-board" : roleChip}>
                      {label.text}
                    </span>
                  )}
                </p>
                <ol className="mt-1.5 flex flex-col gap-2 border-l-2 border-rule pl-3">
                  {tx.actions.map((action, j) => (
                    <li key={`${action.method}-${j}`}>
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="fig text-meta text-iron">{action.method}</span>
                        <span className="fig text-label text-iron-2">{attached(action.deposit)}</span>
                      </p>
                      {Object.keys(action.args).length > 0 && (
                        <dl className="mt-0.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-label">
                          {lines(tx.receiverId, action.args as Record<string, unknown>, tokens, hints).map((line) => (
                            <Fragment key={line.key}>
                              <dt className="fig text-iron-2">{line.key}</dt>
                              <dd className="fig [overflow-wrap:anywhere]">
                                {line.decoded ? (
                                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-l border-rule pl-2.5">
                                    {line.decoded.map((row) => (
                                      <Fragment key={row.key}>
                                        <dt className="text-iron-2">{row.key}</dt>
                                        <dd title={row.raw}>
                                          <Wrapped text={row.text} />
                                        </dd>
                                      </Fragment>
                                    ))}
                                  </dl>
                                ) : (
                                  <Wrapped text={line.text} />
                                )}
                                {line.hint && <span className="text-iron-2"> · {line.hint}</span>}
                              </dd>
                            </Fragment>
                          ))}
                        </dl>
                      )}
                    </li>
                  ))}
                </ol>
              </li>
            );
          })}
        </ol>
      ) : (
        <pre className="fig mt-2.5 max-h-60 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] text-label leading-snug">
          {JSON.stringify(transactions, (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value), 2)}
        </pre>
      )}
      <p className="mt-2.5 text-label text-iron-2">
        {signer === "devnet"
          ? "Signed in this tab with the devnet key, exactly as listed."
          : "Your wallet shows the same receivers and methods. If anything differs, don't sign."}
      </p>
    </section>
  );
}

interface IntentsMessage {
  signer_id?: string;
  deadline?: string;
  intents?: { intent: string; receiver_id?: string; tokens?: Record<string, string> }[];
}

/**
 * The cross-chain withdrawal's NEP-413 message, decoded before the wallet signs it: what moves,
 * to whom inside Intents, and until when the signature is valid.
 */
export function MessageReview({ intent, tokens, destination }: { intent: UnsignedIntent; tokens: Record<string, Token>; destination: string }) {
  const [view, setView] = useState<View>("decoded");
  const erc191 = intent.standard === "erc191";
  let message: IntentsMessage & { verifying_contract?: string } = {};
  try {
    message = JSON.parse(erc191 ? intent.payload : intent.payload.message) as typeof message;
  } catch {
    // Shown raw below; the decoded view simply has nothing to list.
  }
  const recipient = erc191 ? (message.verifying_contract ?? config.intentsContract) : intent.payload.recipient;
  return (
    <section className="rounded-xl bg-bed px-3.5 py-3" aria-label="What you'll sign">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="plate-label text-label text-iron-2">What you'll sign · a message ({erc191 ? "ERC-191" : "NEP-413"}), not a transaction</p>
        <ViewToggle view={view} onView={setView} />
      </header>
      {view === "decoded" ? (
        <dl className="mt-2.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-label">
          <dt className="fig text-iron-2">{erc191 ? "verifying_contract" : "recipient"}</dt>
          <dd className="fig flex flex-wrap items-center gap-2">
            {recipient} <span className={roleChip}>NEAR Intents</span>
          </dd>
          <dt className="fig text-iron-2">signer_id</dt>
          <dd className="fig [overflow-wrap:anywhere]">{message.signer_id && <Wrapped text={message.signer_id} />}</dd>
          <dt className="fig text-iron-2">deadline</dt>
          <dd className="fig">{message.deadline}</dd>
          {(message.intents ?? []).map((item, i) => (
            <Fragment key={`${item.intent}-${i}`}>
              <dt className="fig text-iron-2">intent</dt>
              <dd className="fig">
                <span className="text-iron">{item.intent}</span>
                {item.receiver_id && (
                  <span className="block [overflow-wrap:anywhere]">
                    to {short(item.receiver_id)} <span className="text-iron-2">· 1Click's deposit account for {destination}</span>
                  </span>
                )}
                {Object.entries(item.tokens ?? {}).map(([id, amount]) => {
                  const token = tokens[id];
                  return (
                    <span key={id} className="block [overflow-wrap:anywhere]">
                      {amount}
                      <span className="text-iron-2"> · {token?.decimals != null ? `${units(amount, token).short} ${token.symbol}` : id}</span>
                    </span>
                  );
                })}
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <pre className="fig mt-2.5 max-h-60 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] text-label leading-snug">{JSON.stringify(intent, null, 2)}</pre>
      )}
      <p className="mt-2.5 text-label text-iron-2">
        {erc191 ? (
          "Your wallet shows this exact message as text. 1Click sends it to NEAR Intents; your 0x account needs no key registration."
        ) : (
          <>
            Your wallet shows this exact message. The first time, if Intents doesn't know your wallet's key, it also asks for one
            transaction: <span className="fig">add_public_key</span> on {recipient}.
          </>
        )}
      </p>
    </section>
  );
}
