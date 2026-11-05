import clsx from "clsx";
import { type CSSProperties, useState } from "react";

import { type Board as BoardData, positionId, type Series } from "../lib/chain";
import { account, count, units } from "../lib/format";
import { interlock, likelyMove, phase } from "../lib/interlock";
import { exerciseNet, useReference } from "../lib/reference";
import { Amount, Countdown, KindPlate, Label, PhaseChip, PhaseLamp } from "./parts";

// Six columns at the full width between 1024 and 1280 (App.tsx). From 1280 the list shares the row
// with the trade card, so the best offer folds into "Collateral · longs", as on a phone; "Your move"
// already names it for anyone who'd buy. Written out whole: Tailwind only generates classes it
// finds as literal strings.
const COLUMNS =
  "lg:grid-cols-[3rem_minmax(12.25rem,1.4fr)_minmax(8.25rem,1fr)_minmax(7.25rem,0.9fr)_7.25rem_8.5rem] xl:grid-cols-[3rem_minmax(12.25rem,1.4fr)_minmax(8.25rem,1fr)_7.25rem_8.5rem] lg:gap-x-2";
/** The best offer's own column, where there's room for it. */
const OFFER_COLUMN = "hidden lg:block xl:hidden";

/** What a series' collateral is doing, by phase: the word that sits beside its amount. */
const HELD = { locked: "locked", released: "released", reclaimed: "returned" } as const;
/** The collateral figure in its phase's ink: blued steel while locked, release amber once open. */
const HELD_INK = { locked: "text-lock", released: "text-release-ink", reclaimed: "text-iron-2" } as const;

/** Series as rows in one frame, not cards (docs/DESIGN.md "Space, surface, depth"). */
export function Board({
  board,
  nowMs,
  viewer,
  selected,
  onSelect,
  onWrite,
}: {
  board: BoardData;
  nowMs: number;
  viewer: string | null;
  selected: string | null;
  onSelect: (seriesId: string) => void;
  onWrite: () => void;
}) {
  if (board.series.length === 0) {
    return (
      <div className="card px-6 py-10">
        <Label>No series yet</Label>
        <p className="mt-2 max-w-[54ch] text-iron-2">
          A writer creates a series by moving collateral into this contract inside NEAR Intents. Until then there is
          nothing to buy, exercise or reclaim; only Write is free.
        </p>
        <button
          type="button"
          onClick={onWrite}
          className="plate-label mt-5 h-10 rounded-full bg-lock px-4 text-meta text-board transition-transform duration-150 active:translate-y-px"
        >
          Write the first series
        </button>
      </div>
    );
  }

  return <Filtered board={board} nowMs={nowMs} viewer={viewer} selected={selected} onSelect={onSelect} />;
}

type KindFilter = "all" | "call" | "put";
type StateFilter = "all" | "live" | "expired";

/** Is this series any of the viewer's business: written, held, held inside Intents, or offered? */
function involves(series: Series, board: BoardData, viewer: string): boolean {
  const me = board.viewer;
  return (
    series.writer === viewer ||
    (me?.longs[series.token_id] ?? 0n) > 0n ||
    (me?.inIntents[positionId(series.token_id)] ?? 0n) > 0n ||
    board.offers.some((o) => o.series_id === series.series_id && o.seller === viewer && BigInt(o.remaining) > 0n)
  );
}

function Filtered({
  board,
  nowMs,
  viewer,
  selected,
  onSelect,
}: {
  board: BoardData;
  nowMs: number;
  viewer: string | null;
  selected: string | null;
  onSelect: (seriesId: string) => void;
}) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [state, setState] = useState<StateFilter>("all");
  const [mine, setMine] = useState(false);
  const live = (s: Series) => phase(s, nowMs) === "locked";
  const matches = (s: Series, k: KindFilter, st: StateFilter, m: boolean) =>
    (k === "all" || s.kind === k) && (st === "all" || (st === "live") === live(s)) && (!m || (viewer !== null && involves(s, board, viewer)));
  const tally = (k: KindFilter, st: StateFilter, m: boolean) => board.series.filter((s) => matches(s, k, st, m)).length;
  const visible = board.series.filter((s) => matches(s, kind, state, mine));
  const filtered = kind !== "all" || state !== "all" || mine;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3" role="group" aria-label="Filter series">
        <Segment
          name="kind"
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "All", count: tally("all", state, mine) },
            { value: "call", label: "Calls", count: tally("call", state, mine) },
            { value: "put", label: "Puts", count: tally("put", state, mine) },
          ]}
        />
        <Segment
          name="state"
          label="State"
          value={state}
          onChange={setState}
          options={[
            { value: "all", label: "All", count: tally(kind, "all", mine) },
            { value: "live", label: "Locked", count: tally(kind, "live", mine) },
            { value: "expired", label: "Expired", count: tally(kind, "expired", mine) },
          ]}
        />
        {viewer && (
          <label className={clsx(segment, "has-[:checked]:bg-iron has-[:checked]:text-board")}>
            <input type="checkbox" className="sr-only" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            Mine <span className="fig ml-1.5 normal-case opacity-70">{tally(kind, state, true)}</span>
          </label>
        )}
      </div>
      <div className={clsx("hidden gap-4 px-4 pb-2.5 lg:grid", COLUMNS)}>
        {["#", "Strike · size", "Collateral · longs", "Best offer", "Expiry", "Your move"].map((label) => (
          <Label key={label} className={label === "Best offer" ? OFFER_COLUMN : undefined}>
            {label}
          </Label>
        ))}
      </div>
      {visible.length === 0 && (
        <div className="card px-5 py-8">
          <p className="text-iron-2">No series match {filtered ? "these filters" : "yet"}.</p>
          {filtered && (
            <button
              type="button"
              className="plate-label mt-3 h-8 rounded-full px-3 text-label shadow-[inset_0_0_0_1.5px_var(--color-iron)] hover:bg-bed"
              onClick={() => {
                setKind("all");
                setState("all");
                setMine(false);
              }}
            >
              Show every series
            </button>
          )}
        </div>
      )}
      <ol className={clsx("card overflow-hidden", visible.length === 0 && "hidden")}>
        {visible.map((series, index) => (
          <Row
            key={series.series_id}
            index={index}
            series={series}
            board={board}
            nowMs={nowMs}
            viewer={viewer}
            selected={selected === series.series_id}
            onSelect={onSelect}
          />
        ))}
      </ol>
    </div>
  );
}

// 32px to see; the ::before reaches 44px to hit, so the chips stay light on a phone.
const segment =
  "plate-label relative inline-flex h-8 cursor-pointer items-center rounded-full before:absolute before:inset-x-0 before:-inset-y-[7px] px-2.5 text-label text-iron-2 shadow-[inset_0_0_0_1px_var(--color-rule)] transition-colors duration-150 hover:text-iron has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-iron";

/** A row of exclusive choices with live counts; native radios, so arrow keys work. */
function Segment<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: T;
  options: { value: T; label: string; count: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1">
      <legend className="plate-label float-left mr-2 text-micro text-iron-2">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className={clsx(segment, "has-[:checked]:bg-iron has-[:checked]:text-board has-[:checked]:shadow-none")}>
          <input type="radio" name={name} className="sr-only" checked={value === option.value} onChange={() => onChange(option.value)} />
          {option.label} <span className="fig ml-1.5 normal-case opacity-70">{option.count}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Row({
  index,
  series,
  board,
  nowMs,
  viewer,
  selected,
  onSelect,
}: {
  index: number;
  series: Series;
  board: BoardData;
  nowMs: number;
  viewer: string | null;
  selected: boolean;
  onSelect: (seriesId: string) => void;
}) {
  const p = phase(series, nowMs);
  // An offer on an expired series can't be bought: the row shows none.
  const offers = p === "locked" ? board.offers.filter((o) => o.series_id === series.series_id && BigInt(o.remaining) > 0n) : [];
  const best = [...offers].sort((a, b) => (BigInt(a.price_per_option) < BigInt(b.price_per_option) ? -1 : 1))[0];
  const underlying = board.tokens[series.underlying];
  const quote = board.tokens[series.quote];
  const longs = board.viewer?.longs[series.token_id] ?? 0n;
  const levers = interlock(series, { viewer, longs, offers: board.offers, nowMs });
  const buyable = offers.filter((o) => o.seller !== viewer).sort((a, b) => (BigInt(a.price_per_option) < BigInt(b.price_per_option) ? -1 : 1));
  const net = exerciseNet(series, board.tokens, useReference(series.underlying, series.quote));
  const move = likelyMove(levers, { isWriter: viewer !== null && viewer === series.writer, holds: longs > 0n, buyable: buyable.length > 0, exerciseNet: net });
  const amount = (raw: string, tokenId: string) => `${units(raw, board.tokens[tokenId]).short} ${board.tokens[tokenId]?.symbol ?? ""}`.trim();
  // The viewer's likely move on this series, in words: the Interlock's answer, read at a glance.
  const moveText = move
    ? {
        buy: buyable[0] ? `Buy at ${units(buyable[0].price_per_option, quote).short}` : "Buy",
        exercise: `Exercise · ${count(longs)} held`,
        list: `List · ${count(longs)} held`,
        reclaim: `Reclaim ${amount(series.collateral_held, series.collateral_token)}`,
        proceeds: `Claim ${amount(series.proceeds_held, series.payment_token)}`,
        write: "Write more",
        close: "Close",
      }[move.id]
    : null;

  return (
    <li className="series-row border-b border-rule last:border-b-0" style={{ "--sibling-index": index + 1 } as CSSProperties}>
      <button
        type="button"
        onClick={() => onSelect(series.series_id)}
        aria-current={selected ? "true" : undefined}
        className={clsx(
          "grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-5 py-4 text-left text-ui lg:px-4 transition-colors duration-150 lg:gap-y-0",
          COLUMNS,
          selected ? "bg-lock/[0.05] shadow-[inset_0_0_0_1.5px_var(--color-lock)]" : "hover:bg-bed/70",
        )}
      >
        <span className="flex items-center gap-2">
          <PhaseLamp phase={p} />
          <span className="fig text-iron-2">#{series.series_id}</span>
        </span>

        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <KindPlate kind={series.kind} />
            <Amount raw={series.strike_per_option} token={quote} />
          </span>
          <span className="truncate text-meta text-iron-2" title={`written by ${series.writer}`}>
            <Amount raw={series.underlying_per_option} token={underlying} className="text-iron-2" /> each
            <span className="hidden lg:inline"> · {account(series.writer)}</span>
          </span>
        </span>

        {/* Below lg this is the third line: two long figures never share a line on a phone. */}
        <span className="col-span-2 col-start-2 row-start-2 flex flex-wrap gap-x-2.5 text-meta lg:col-span-1 lg:col-auto lg:row-auto lg:flex-col lg:gap-x-0 lg:text-ui">
          <span>
            <Amount raw={series.collateral_held} token={board.tokens[series.collateral_token]} className={HELD_INK[p]} />
            <span className={clsx("ml-1 text-iron-2", p === "locked" && "lg:hidden")}>{HELD[p]}</span>
          </span>
          <span className="text-iron-2 lg:text-meta">
            <span className="fig">{count(series.long_supply)}</span> {p === "locked" ? "open" : "lapsed"}
          </span>
          {/* On a phone the writer gets this full-width line instead of a truncated end of the one above. */}
          <span className="text-iron-2 lg:hidden">
            writer <span className="fig">{account(series.writer)}</span>
          </span>
          {best && (
            <span className="text-iron-2 lg:hidden xl:inline">
              offer <Amount raw={best.price_per_option} token={quote} />
            </span>
          )}
        </span>

        <span className={OFFER_COLUMN}>
          {best ? (
            <span>
              <Amount raw={best.price_per_option} token={quote} />
              <span className="fig ml-1 text-meta text-iron-2">×{best.remaining}</span>
            </span>
          ) : (
            <span className="text-iron-2">—</span>
          )}
        </span>

        <span className="col-start-3 row-start-1 self-start whitespace-nowrap text-right lg:col-auto lg:row-auto lg:self-center lg:text-left">
          {p === "locked" ? <Countdown toNs={series.expiry_ns} /> : <PhaseChip phase={p} />}
        </span>

        <span className={clsx("col-span-2 col-start-2 row-start-3 lg:col-span-1 lg:col-auto lg:row-auto", !move && "hidden lg:block")}>
          {move && moveText ? (
            <span className="move-chip text-meta" data-tone={move.tone}>
              <span className="min-w-0">{moveText}</span>
            </span>
          ) : (
            <span className="hidden text-meta text-iron-2 lg:inline">
              <span aria-hidden="true">—</span>
              <span className="sr-only">nothing for you to do</span>
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
