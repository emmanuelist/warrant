import NumberFlow from "@number-flow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { explorer } from "../lib/config";
import { readOutcome, recorded } from "../lib/refusals";
import ROOM from "../lib/room.json";
import { Out } from "./parts";

interface Attempt {
  id: string;
  family: string;
  title: string;
  /** The refusal this attempt must end in; `null` for an honest call, which must go through. */
  expect: string | null;
}

const ATTEMPTS = ROOM as Attempt[];
const FAMILIES = [...new Set(ATTEMPTS.map((attempt) => attempt.family))];
const REFUSED_TOTAL = ATTEMPTS.filter((attempt) => attempt.expect).length;
const HONEST_TOTAL = ATTEMPTS.length - REFUSED_TOTAL;
const NAMED_TOTAL = new Set(ATTEMPTS.map((attempt) => attempt.expect).filter(Boolean)).size;
/** How many transactions are read from the archival node at once. */
const READ_AT_ONCE = 4;

type Result = { kind: "reading" } | { kind: "error"; message: string } | { kind: "done"; err: string | null; failed: boolean };

const asExpected = (attempt: Attempt, result: Result | undefined) => result?.kind === "done" && (attempt.expect ? result.err === attempt.expect : !result.failed);

/**
 * Every refusal the contract names, attempted for real (#20, D-037). The list above says what each
 * attempt was and what it must end in; whether it did comes only from the chain, read back by hash
 * when the room scrolls into view. Nothing here is a simulation: a view call can't attach the
 * deposit these methods ask for, so each attempt is a transaction anyone can open.
 */
export function RefusalRoom() {
  const ref = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [reading, setReading] = useState(false);
  const recordedCount = ATTEMPTS.filter((attempt) => recorded[attempt.id]).length;

  const readAll = useCallback(async () => {
    setReading(true);
    setResults({});
    const queue = ATTEMPTS.filter((attempt) => recorded[attempt.id]);
    const worker = async () => {
      for (let attempt = queue.shift(); attempt; attempt = queue.shift()) {
        const { id } = attempt;
        const entry = recorded[id];
        if (!entry) continue;
        setResults((now) => ({ ...now, [id]: { kind: "reading" } }));
        const result = await readOutcome(entry.hash, entry.signer).then(
          (outcome): Result => ({ kind: "done", ...outcome }),
          (error: unknown): Result => ({ kind: "error", message: error instanceof Error ? error.message : String(error) }),
        );
        setResults((now) => ({ ...now, [id]: result }));
      }
    };
    await Promise.all(Array.from({ length: READ_AT_ONCE }, worker));
    setReading(false);
  }, []);

  useEffect(() => {
    const room = ref.current;
    if (!room || recordedCount === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void readAll();
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(room);
    return () => observer.disconnect();
  }, [readAll, recordedCount]);

  const refused = ATTEMPTS.filter((attempt) => attempt.expect && asExpected(attempt, results[attempt.id])).length;
  const honest = ATTEMPTS.filter((attempt) => !attempt.expect && asExpected(attempt, results[attempt.id])).length;
  const off = ATTEMPTS.filter((attempt) => results[attempt.id]?.kind === "done" && !asExpected(attempt, results[attempt.id])).length;
  const unread = ATTEMPTS.filter((attempt) => results[attempt.id]?.kind === "error").length;

  return (
    <div ref={ref} id="refusal-room" className="mt-20 scroll-mt-20 border-t border-panel-line pt-14">
      <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-8">
        <div className="max-w-[52ch]">
          <h3 className="display text-display-3">Every way in, refused</h3>
          <p className="mt-4 text-lead text-panel-ink-2">
            {REFUSED_TOTAL} attempts at all {NAMED_TOTAL} refusals the contract names, beside {HONEST_TOTAL} honest calls that have to go through.{" "}
            {recordedCount === ATTEMPTS.length
              ? "Each is a real transaction anyone can open."
              : recordedCount > 0
                ? `${recordedCount} of ${ATTEMPTS.length} are recorded on this network so far, as real transactions anyone can open.`
                : "None is recorded on this network yet."}
          </p>
        </div>

        <div id="room-tally" data-refused={refused} data-honest={honest} data-off={off} data-unread={unread} data-reading={reading} className="min-w-0">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1">
            <dd className="numeral text-right text-display-3 text-refuse-lit">
              <NumberFlow value={refused} locales="en-US" />
            </dd>
            <dt className="text-ui text-panel-ink-2">
              of {REFUSED_TOTAL} refused by name
            </dt>
            <dd className="numeral text-right text-display-3 text-live-lit">
              <NumberFlow value={honest} locales="en-US" />
            </dd>
            <dt className="text-ui text-panel-ink-2">
              of {HONEST_TOTAL} honest calls went through
            </dt>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              id="room-run"
              type="button"
              disabled={reading || recordedCount === 0}
              onClick={() => void readAll()}
              className="plate-label h-11 rounded-full border border-panel-line px-5 text-meta text-panel-ink transition-[translate,opacity] duration-150 hover:border-panel-ink-3 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            >
              {reading ? "Reading from chain…" : Object.keys(results).length > 0 ? "Read them back again" : "Read them back from chain"}
            </button>
            {off > 0 && <span className="text-meta text-release-lit">{off} off their rule</span>}
            {unread > 0 && <span className="text-meta text-panel-ink-3">{unread} couldn't be read just now</span>}
          </div>
        </div>
      </div>

      <div className="room-families mt-12">
        {FAMILIES.map((family) => (
          <section key={family} className="room-family" aria-label={family}>
            <h4 className="plate-label text-label text-panel-ink-3">{family}</h4>
            <ol className="mt-3">
              {ATTEMPTS.filter((attempt) => attempt.family === family).map((attempt) => (
                <Row key={attempt.id} attempt={attempt} result={results[attempt.id]} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function Row({ attempt, result }: { attempt: Attempt; result: Result | undefined }) {
  const entry = recorded[attempt.id];
  const short = entry ? `${entry.hash.slice(0, 6)}…${entry.hash.slice(-4)}` : "";
  const good = asExpected(attempt, result);
  const state = !entry ? "none" : !result ? "idle" : result.kind === "reading" ? "reading" : result.kind === "error" ? "error" : !good ? "off" : attempt.expect ? "refused" : "through";

  const outcome = (() => {
    switch (state) {
      case "none":
        return <span>not recorded yet</span>;
      case "reading":
        return <span>reading…</span>;
      case "error":
        return <span>couldn't read it just now</span>;
      case "idle":
        return <span>recorded</span>;
      case "through":
        return <span className="text-live-lit">went through</span>;
      case "refused":
        return <span className="fig text-refuse-lit">{result?.kind === "done" ? result.err : attempt.expect}</span>;
      default:
        return <span className="text-release-lit">{result?.kind === "done" ? (result.err ?? "went through") : ""}, expected {attempt.expect ?? "it to go through"}</span>;
    }
  })();

  return (
    <li className="room-row" data-state={state}>
      <span className="room-lamp" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-ui text-panel-ink">{attempt.title}</p>
        <p className="mt-0.5 text-meta text-panel-ink-3 [overflow-wrap:anywhere]">
          {outcome}
          {entry && (
            <>
              {" · "}
              {explorer ? (
                <a className="fig underline decoration-panel-line underline-offset-4 hover:text-panel-ink" href={explorer.tx(entry.hash)} target="_blank" rel="noreferrer" title={entry.hash}>
                  {short}
                  <Out />
                </a>
              ) : (
                <span className="fig" title={entry.hash}>
                  {short}
                </span>
              )}
            </>
          )}
        </p>
      </div>
    </li>
  );
}
