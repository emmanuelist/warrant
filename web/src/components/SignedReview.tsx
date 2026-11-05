import { Fragment } from "react";

import type { Token } from "../lib/chain";
import { config } from "../lib/config";
import { units } from "../lib/format";
import { DEADLINE_MS, type Intent, intentOf } from "../lib/signedIntents";
import type { Call } from "../lib/wallet";
import { decodeMsg, roleChip, type View, ViewToggle, Wrapped } from "./Review";

/** One intent's fields as signed; token amounts read in their token, Warrant's `msg` decoded. */
function intentRows(intent: Intent, tokens: Record<string, Token>, hints: Record<string, Token | undefined>) {
  return Object.entries(intent)
    .filter(([key]) => key !== "intent")
    .map(([key, value]) => {
      const text = typeof value === "string" ? (value === "" ? '""' : value) : JSON.stringify(value);
      if (key === "tokens" && typeof value === "object" && value !== null) {
        // One line per token: the reading first, then exactly what is signed (its ID and base units).
        const amounts = Object.entries(value as Record<string, string>).map(([id, amount]) => {
          const token = tokens[id];
          const reading = token?.decimals != null ? `${units(amount, token).short} ${token.symbol}` : `${amount} long${amount === "1" ? "" : "s"}`;
          return { id, amount, reading };
        });
        return { key, text, decoded: null, amounts };
      }
      return { key, text, decoded: key === "msg" && typeof value === "string" ? decodeMsg(value, tokens, hints) : null, amounts: null };
    });
}

/**
 * "What you'll sign" for an EVM wallet (D-030): an ERC-191 message for NEAR Intents, not a
 * transaction, decoded intent by intent. The deadline and nonce are set when you sign.
 */
export function SignedReview({
  calls,
  signer: account,
  tokens,
  hints,
  inert,
  view,
  onView,
}: {
  calls: Call[];
  signer: string;
  tokens: Record<string, Token>;
  hints: Record<string, Token | undefined>;
  inert?: string;
  view: View;
  onView: (view: View) => void;
}) {
  const intents = calls.map(intentOf);
  const minutes = DEADLINE_MS / 60_000;
  const envelope = {
    signer_id: account,
    verifying_contract: config.intentsContract,
    deadline: `<set when you sign: ${minutes} minutes later>`,
    nonce: "<fresh when you sign>",
    intents,
  };
  const dim = inert ? "opacity-55" : undefined;
  return (
    <section className="rounded-xl bg-bed px-3.5 py-3" aria-label="What you'll sign" aria-disabled={inert ? true : undefined}>
      {inert && <p className="mb-2 text-meta text-iron">{inert}</p>}
      <header className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 ${dim ?? ""}`}>
        <p className="plate-label text-label text-iron-2">What you'll sign · a message (ERC-191), not a transaction</p>
        <ViewToggle view={view} onView={onView} />
      </header>
      {intents.some((intent) => intent === null) ? (
        <p className="mt-2.5 text-label text-iron">This needs a NEAR wallet: Warrant doesn't relay it for an EVM wallet.</p>
      ) : view === "decoded" ? (
        <dl className={`mt-2.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-label ${dim ?? ""}`}>
          <dt className="fig text-iron-2">signer_id</dt>
          <dd className="fig [overflow-wrap:anywhere]">
            <Wrapped text={account} /> <span className="text-iron-2">· your wallet's account inside Intents</span>
          </dd>
          <dt className="fig text-iron-2">verifying_contract</dt>
          <dd className="fig flex flex-wrap items-center gap-2">
            {config.intentsContract} <span className={roleChip}>NEAR Intents</span>
          </dd>
          {intents.map(
            (intent, i) =>
              intent && (
                <Fragment key={`${intent.intent}-${i}`}>
                  <dt className="fig text-iron-2">intent</dt>
                  <dd>
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="fig text-meta text-iron">{intent.intent}</span>
                      <span className={roleChip}>Warrant</span>
                    </p>
                    <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-l-2 border-rule pl-3">
                      {intentRows(intent, tokens, hints).map((line) => (
                        <Fragment key={line.key}>
                          <dt className="fig text-iron-2">{line.key}</dt>
                          <dd className="fig [overflow-wrap:anywhere]">
                            {line.amounts ? (
                              line.amounts.map((token) => (
                                <span key={token.id} className="block">
                                  {token.reading}{" "}
                                  <span className="text-iron-2">
                                    · <Wrapped text={token.id} /> · {token.amount}
                                  </span>
                                </span>
                              ))
                            ) : line.decoded ? (
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
                          </dd>
                        </Fragment>
                      ))}
                    </dl>
                  </dd>
                </Fragment>
              ),
          )}
          <dt className="fig text-iron-2">deadline</dt>
          <dd className="fig">
            {minutes} minutes after you sign <span className="text-iron-2">· then Intents refuses it</span>
          </dd>
          <dt className="fig text-iron-2">nonce</dt>
          <dd className="fig">
            fresh when you sign <span className="text-iron-2">· salted and expiring, so it can't be replayed</span>
          </dd>
        </dl>
      ) : (
        <pre className={`fig mt-2.5 max-h-60 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] text-label leading-snug ${dim ?? ""}`}>{JSON.stringify(envelope, null, 2)}</pre>
      )}
      <p className="mt-2.5 text-label text-iron-2">
        Your wallet shows this message as text. Warrant's relayer sends it to NEAR Intents and pays the gas; changing any of it would break your
        signature.
      </p>
    </section>
  );
}
