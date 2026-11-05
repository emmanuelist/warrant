import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Board, Series, Token } from "../lib/chain";
import { explorer } from "../lib/config";
import { account, units, utcShort } from "../lib/format";
import { interlock, type Lever as LeverState, phase, type Tone } from "../lib/interlock";
import { type ReadBack, readRefusal, recorded, type RefusalId } from "../lib/refusals";
import { settleHash } from "../lib/route";
import type { SheetRequest } from "./ActionSheet";
import { Lever } from "./Lever";
import { Out, Wrap } from "./parts";
import { RefusalRoom } from "./RefusalRoom";

interface Refusal {
  id: RefusalId;
  num: number;
  label: string;
  tone: Tone;
  title: string;
  body: string;
  /** The contract's refusal for this move (contracts/options/src); the card shows the chain's own. */
  err: string;
}

const REFUSALS: Refusal[] = [
  {
    id: "reclaim-early",
    num: 7,
    label: "Reclaim",
    tone: "release",
    title: "Reclaim before expiry",
    body: "Collateral stays locked until the clock runs out. Not even the writer can take it back early.",
    err: "ERR_NOT_EXPIRED",
  },
  {
    id: "exercise-expired",
    num: 4,
    label: "Exercise",
    tone: "live",
    title: "Exercise after expiry",
    body: "A right ends exactly at expiry. After it, the unexercised collateral is the writer's to reclaim, so no holder can take it.",
    err: "ERR_EXPIRED",
  },
  {
    id: "exercise-unheld",
    num: 4,
    label: "Exercise",
    tone: "live",
    title: "Exercise without the option",
    body: "Only a holder can exercise, and only as many as they hold. Intents refunds the payment in full.",
    err: "ERR_INSUFFICIENT_LONGS",
  },
];

/**
 * A bolted lever this viewer can pull for real right now, on the move most on the thesis first:
 * a writer's early reclaim, then exercising a live series they don't hold, then exercising after
 * expiry. The sheet sends it and shows the chain's refusal.
 */
function sendable(board: Board, nowMs: number, viewer: string | null): { lever: LeverState; series: Series } | null {
  const held = (s: Series) => board.viewer?.longs[s.token_id] ?? 0n;
  const pick = (series: Series | undefined, id: string, err: string) => {
    const lever = series && interlock(series, { viewer, longs: held(series), offers: board.offers, nowMs }).find((l) => l.id === id && l.err === err && l.state === "locked");
    return series && lever ? { lever, series } : null;
  };
  const live = board.series.filter((s) => phase(s, nowMs) === "locked");
  return (
    pick(
      live.find((s) => s.writer === viewer),
      "reclaim",
      "ERR_NOT_EXPIRED",
    ) ??
    pick(
      live.find((s) => held(s) === 0n),
      "exercise",
      "ERR_INSUFFICIENT_LONGS",
    ) ??
    pick(
      board.series.find((s) => phase(s, nowMs) !== "locked"),
      "exercise",
      "ERR_EXPIRED",
    )
  );
}

/**
 * "Three moves the contract refuses" (docs/DESIGN.md "Elevation pass"). Each card is a real
 * refused transaction, read back from chain by its hash: the contract's error from its receipt,
 * Intents' refund from its log. "Send one yourself" pulls a bolted lever for real; "Replay" only
 * replays the levers' kick.
 */
export function Refusals({ board, nowMs, viewer, onSheet }: { board: Board; nowMs: number; viewer: string | null; onSheet: (request: SheetRequest) => void }) {
  const ref = useRef<HTMLElement>(null);
  const [round, setRound] = useState(0);
  const target = sendable(board, nowMs, viewer);
  const anyRecorded = REFUSALS.some((r) => recorded[r.id]);

  const replay = useCallback(() => setRound((r) => r + 1), []);

  // Mounting late (a lazy chunk) moves nothing above it, but a link may have been sent here.
  useLayoutEffect(settleHash, []);

  useEffect(() => {
    const section = ref.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          replay();
          observer.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [replay]);

  return (
    <section ref={ref} id="refusals" className="panel night night-band scroll-mt-14 py-24 lg:py-32" aria-labelledby="refusals-title">
      <Wrap>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <h2 id="refusals-title" className="display max-w-[14ch] text-display-2">
            Three moves the contract refuses
          </h2>
          <div className="max-w-[46ch]">
            <p className="text-lead text-panel-ink-2">
              Not a policy: a mechanism.{" "}
              {anyRecorded
                ? "Each card is a real transaction the chain refused, read back from chain by its hash. Send one yourself and the chain refuses yours too."
                : "Each card is a refusal the contract returns; none is recorded on this network yet. Send one yourself and read the chain's answer."}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button
                type="button"
                disabled={!target}
                onClick={() => target && onSheet({ type: "lever", lever: target.lever, series: target.series })}
                className="plate-label h-11 rounded-full bg-panel-ink px-5 text-meta text-panel transition-[translate,opacity] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send one yourself
              </button>
              <button type="button" onClick={replay} className="plate-label h-11 px-1 text-meta text-panel-ink-2 underline decoration-panel-line underline-offset-4 hover:text-panel-ink">
                Replay
              </button>
            </div>
            {!target && <p className="mt-3 text-meta text-panel-ink-3">No bolted lever to pull on this board right now.</p>}
          </div>
        </div>

        <ol className="mt-14 grid gap-x-10 gap-y-12 border-t border-panel-line pt-12 lg:grid-cols-3">
          {REFUSALS.map((refusal, index) => (
            <RefusalCard key={refusal.id} refusal={refusal} index={index} round={round} tokens={board.tokens} />
          ))}
        </ol>

        <RefusalRoom />
      </Wrap>
    </section>
  );
}

type Read = { kind: "none" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: ReadBack };

/** The recorded transaction for a refusal, read back from chain once. */
function useReadBack(id: RefusalId): Read {
  const entry = recorded[id];
  const [read, setRead] = useState<Read>(entry ? { kind: "loading" } : { kind: "none" });
  useEffect(() => {
    if (!entry) return;
    let live = true;
    readRefusal(entry.hash, entry.signer).then(
      (data) => live && setRead({ kind: "ready", data }),
      (error: unknown) => live && setRead({ kind: "error", message: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      live = false;
    };
  }, [entry]);
  return read;
}

function RefusalCard({ refusal, index, round, tokens }: { refusal: Refusal; index: number; round: number; tokens: Record<string, Token> }) {
  const [strikes, setStrikes] = useState(0);
  const stamped = strikes > 0;
  const read = useReadBack(refusal.id);
  const err = read.kind === "ready" && read.data.err ? read.data.err : refusal.err;

  useEffect(() => {
    if (round === 0) return;
    const start = window.setTimeout(() => setStrikes((s) => s + 1), index * 320);
    return () => window.clearTimeout(start);
  }, [round, index]);

  return (
    <li className="refusal grid grid-cols-[auto_minmax(0,1fr)] items-start gap-5">
      <Lever
        lever={{ num: refusal.num, label: refusal.label, tone: refusal.tone, state: "locked" }}
        size="xl"
        arm={false}
        strikes={strikes}
        onLocked={() => setStrikes((s) => s + 1)}
      />
      <div className="min-w-0 pt-1">
        <h3 className="text-h3 leading-tight [font-variation-settings:'wdth'_110,'wght'_720]">{refusal.title}</h3>
        <p className="mt-2 text-panel-ink-2">{refusal.body}</p>
        <p className="mt-5 flex flex-col items-start gap-1.5">
          <span
            className="plate-label rounded-full px-2 py-1 text-label text-panel-ink transition-colors duration-300"
            style={{ background: stamped ? "var(--color-refuse)" : "var(--color-panel-raised)" }}
          >
            Refused by chain
          </span>
          <span className={stamped ? "fig text-ui text-refuse-lit [overflow-wrap:anywhere]" : "fig text-ui text-panel-ink-2 [overflow-wrap:anywhere]"}>{err}</span>
        </p>
        <Receipt read={read} tokens={tokens} />
      </div>
    </li>
  );
}

/** What the chain says about the recorded transaction: sender and time, the call, the refund, the hash. */
function Receipt({ read, tokens }: { read: Read; tokens: Record<string, Token> }) {
  if (read.kind === "none") return <p className="mt-3 text-meta text-panel-ink-3">No refused transaction recorded on this network yet.</p>;
  if (read.kind === "loading") return <p className="mt-3 text-meta text-panel-ink-3">Reading the transaction from chain…</p>;
  // RPC errors are single long words (UNKNOWN_TRANSACTION): let them wrap rather than widen the page.
  if (read.kind === "error") return <p className="mt-3 text-meta text-panel-ink-3 [overflow-wrap:anywhere]">Couldn't read the transaction from chain: {read.message}</p>;

  const { data } = read;
  const action = data.action;
  const short = `${data.hash.slice(0, 6)}…${data.hash.slice(-4)}`;

  return (
    <dl className="refusal-receipt mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-meta">
      <dt>sent</dt>
      <dd>
        <span className="fig text-panel-ink">{account(data.signer)}</span> · {utcShort((BigInt(data.atMs) * 1_000_000n).toString())}
      </dd>
      <dt>call</dt>
      <dd>
        {action ? (
          <>
            <span className="fig">{action.action ?? data.method}</span>
            {action.amount && <span className="fig"> {action.amount}</span>} on series <span className="fig">{action.series_id ?? "?"}</span>, through{" "}
            <span className="fig">{data.receiver}</span>
          </>
        ) : (
          <>
            <span className="fig">{data.method}</span> on <span className="fig">{data.receiver}</span>
          </>
        )}
      </dd>
      <dt>refund</dt>
      <dd>
        {data.refunds.length > 0 ? (
          <>
            {data.refunds.map(({ tokenId, amount }, i) => (
              <span key={tokenId}>
                {i > 0 && " + "}
                <span className="fig text-panel-ink">{units(amount, tokens[tokenId]).short}</span> {tokens[tokenId]?.symbol ?? tokenId}
              </span>
            ))}{" "}
            back to the sender
          </>
        ) : (
          "nothing was sent in, so nothing to refund"
        )}
      </dd>
      <dt>tx</dt>
      <dd>
        {explorer ? (
          <a className="fig underline decoration-panel-line underline-offset-4 hover:text-panel-ink" href={explorer.tx(data.hash)} target="_blank" rel="noreferrer" title={data.hash}>
            {short}
            <Out />
          </a>
        ) : (
          <span className="fig" title={data.hash}>
            {short}
          </span>
        )}{" "}
        · read from chain
      </dd>
    </dl>
  );
}
