import { ArrowDownIcon } from "@phosphor-icons/react";
import clsx from "clsx";

import type { Board, Series, Token } from "../lib/chain";
import { config, explorer } from "../lib/config";
import { account, count, units, utcShort } from "../lib/format";
import { follow, href } from "../lib/route";
import { Dial } from "./Dial";
import { KindPlate, Out } from "./parts";
import { Terminal, Tracks } from "./System";

const expiryMs = (ns: string) => Number(BigInt(ns) / 1_000_000n);

function sums(series: Series[], pick: (s: Series) => [string, bigint]): [string, bigint][] {
  const totals = new Map<string, bigint>();
  for (const s of series) {
    const [token, amount] = pick(s);
    if (amount > 0n) totals.set(token, (totals.get(token) ?? 0n) + amount);
  }
  return [...totals.entries()];
}

function amounts(entries: [string, bigint][], tokens: Record<string, Token>): string {
  if (entries.length === 0) return "none yet";
  return entries.map(([token, amount]) => `${units(amount, tokens[token]).short} ${tokens[token]?.symbol ?? ""}`.trim()).join(" · ");
}

/**
 * The opening stage (DESIGN.md "Space, surface, depth"): the thesis, then the Route at the scale of the whole
 * system with the vault's time lock at its centre, every figure read from chain.
 */
export function Hero({ board, nowMs, onSelect }: { board: Board; nowMs: number; onSelect: (seriesId: string) => void }) {
  const live = board.series.filter((s) => nowMs < expiryMs(s.expiry_ns) && BigInt(s.collateral_held) > 0n);
  const locked = sums(live, (s) => [s.collateral_token, BigInt(s.collateral_held)]);
  const proceeds = sums(board.series, (s) => [s.payment_token, BigInt(s.proceeds_held)]);
  const delivered = sums(board.series, (s) => [s.collateral_token, BigInt(s.exercised) * BigInt(s.collateral_per_option)]);
  const exercised = board.series.reduce((n, s) => n + BigInt(s.exercised), 0n);
  const writers = new Set(board.series.map((s) => s.writer)).size;
  const openLongs = live.reduce((n, s) => n + BigInt(s.long_supply), 0n);
  const next = [...live].sort((a, b) => expiryMs(a.expiry_ns) - expiryMs(b.expiry_ns))[0];
  const owed = Object.entries(board.obligations).filter(([, amount]) => amount > 0n);
  // What each obligation is made of, so it reconciles with the dial's figure: the dial counts only
  // locks still running; the contract also holds released collateral and proceeds until claimed.
  const released = sums(
    board.series.filter((s) => nowMs >= expiryMs(s.expiry_ns)),
    (s) => [s.collateral_token, BigInt(s.collateral_held)],
  );
  const part = (entries: [string, bigint][], token: string) => entries.find(([t]) => t === token)?.[1] ?? 0n;

  const allBacked = owed.every(([token, amount]) => (board.contractInIntents[token] ?? 0n) >= amount);
  const chips = owed.map(([token, amount]) => {
    const held = board.contractInIntents[token] ?? 0n;
    const backed = held >= amount;
    const t = board.tokens[token];
    const parts = [
      [part(locked, token), "locked"],
      [part(released, token), "released"],
      [part(proceeds, token), "proceeds"],
    ].filter(([value]) => (value as bigint) > 0n) as [bigint, string][];
    return (
      <li key={token} className="flex flex-col items-center gap-0.5 rounded-2xl bg-card px-4 py-2 text-meta shadow-[var(--shadow-key)]">
        <span className="flex items-center gap-2 text-iron">
          <span className={clsx("h-2 w-2 rounded-full", backed ? "bg-live" : "bg-refuse")} aria-hidden="true" />
          <span className="font-semibold">{t?.symbol}</span> <span className="plate-label text-label">{backed ? "backed" : "short"}</span>
        </span>
        <span className="fig text-iron-2">
          holds {units(held, t).short} · owes {units(amount, t).short}
        </span>
        {parts.length > 1 && <span className="fig text-label text-iron-2">= {parts.map(([value, label]) => `${units(value, t).short} ${label}`).join(" + ")}</span>}
      </li>
    );
  });

  const summary = [
    `${live.length} series locking ${amounts(locked, board.tokens)} inside NEAR Intents`,
    `proceeds held ${amounts(proceeds, board.tokens)}`,
    `delivered ${amounts(delivered, board.tokens)}`,
    `${exercised} exercised`,
  ].join("; ");

  return (
    <section className="hero pb-12 pt-10 sm:pt-14 lg:pb-14" aria-labelledby="thesis">
      <h1 id="thesis" className="hero-thesis">
        <span className="hero-display display">Options that can't default and need no oracle:</span>
        <span className="hero-claim text-claim leading-[1.45] text-panel-ink-2 [font-variation-settings:'wdth'_100,'wght'_460]">
          the collateral is <span className="text-lock-lit [font-variation-settings:'wdth'_100,'wght'_600]">locked inside NEAR Intents</span> until
          expiry.
        </span>
      </h1>

      <div className="sys sys-hero mt-8 lg:mt-10" role="group" aria-label={`Route of funds across every series, read from chain: ${summary}.`}>
        <Terminal label="Writers" tone="lock" sub={`${writers} writing`} />
        <Tracks
          at={[0.3, 1.35]}
          forward={{ label: "collateral in", value: `${live.length} series`, lit: live.length > 0 ? "lock" : null }}
          back={{ label: "proceeds held", value: amounts(proceeds, board.tokens), lit: proceeds.length > 0 ? "deliver" : null }}
        />
        <div className="sys-station sys-vault">
          <Dial board={board} nowMs={nowMs} onSelect={onSelect} />
          {/* Phones: the route folds into one line under the dial (the full route is the desktop's). */}
          <p className="sys-strip" aria-hidden="true">
            <span>
              <span className="fig">{writers}</span> writer{writers === 1 ? "" : "s"}
            </span>
            <span className="sys-strip-rail" data-lit={live.length > 0 ? "lock" : undefined} />
            <span className="text-panel-ink">NEAR Intents</span>
            <span className="sys-strip-rail" data-lit={openLongs > 0n ? "deliver" : undefined} />
            <span>
              <span className="fig">{count(openLongs)}</span> longs open
            </span>
          </p>
          {owed.length > 0 && (
            <>
              {/* Utilities, not the component layer, set display here: Tailwind's `flex` would beat it. */}
              <ul className="mt-9 hidden flex-wrap justify-center gap-2 lg:flex" aria-label="Backing, from chain">
                {chips}
              </ul>
              {/* Phones: one verdict, the per-token proof one tap away. */}
              <details className="backing-phone mt-6">
                <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-2 rounded-full bg-card px-4 py-2 text-meta shadow-[var(--shadow-key)]">
                  <span className={clsx("h-2 w-2 rounded-full", allBacked ? "bg-live" : "bg-refuse")} aria-hidden="true" />
                  <span className="font-semibold text-iron">{allBacked ? "Backed 1:1" : "Short"}</span>
                  <span className="text-iron-2">holds {allBacked ? "≥" : "<"} owes · details</span>
                </summary>
                <ul className="mt-3 flex flex-col items-center gap-2" aria-label="Backing, from chain">
                  {chips}
                </ul>
              </details>
            </>
          )}
        </div>
        <Tracks
          at={[0.75, 1.05]}
          forward={{ label: "delivered", value: amounts(delivered, board.tokens), lit: exercised > 0n ? "deliver" : null }}
          back={{ label: "strike paid", value: `${count(exercised)} exercised`, lit: exercised > 0n ? "live" : null }}
        />
        <Terminal label="Holders" tone="deliver" sub={`${count(openLongs)} longs open`} />
      </div>

      <div className="mt-12 flex flex-col items-center gap-3 text-meta text-panel-ink-2">
        {next ? (
          <p className="flex max-w-[64ch] flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
            <span className="h-2 w-2 rounded-full bg-release-lit" aria-hidden="true" />
            <span className="plate-label text-label text-panel-ink">Next release</span>
            <span className="fig">#{next.series_id}</span>
            <KindPlate kind={next.kind} onPanel />
            <span>
              <span className="fig">{units(next.collateral_held, board.tokens[next.collateral_token]).short}</span> {board.tokens[next.collateral_token]?.symbol} returns to{" "}
              <span className="fig">{account(next.writer)}</span> at {utcShort(next.expiry_ns)} unless exercised first
            </span>
          </p>
        ) : (
          <p>No collateral is waiting on expiry.</p>
        )}
        <a
          className="plate-label mt-2 inline-flex h-10 items-center gap-2 rounded-full px-4 text-label text-panel-ink shadow-[inset_0_0_0_1.5px_var(--color-panel-ink)] transition-colors duration-150 hover:bg-panel-raised"
          href={href("board", {}, "board")}
          onClick={follow}
        >
          Every series
          <ArrowDownIcon size={14} weight="bold" aria-hidden="true" />
        </a>
        {explorer && (
          <p className="text-panel-ink-3">
            <a className="underline decoration-panel-line underline-offset-4 hover:text-panel-ink hover:decoration-panel-ink" href={explorer.account(config.optionsContract)} target="_blank" rel="noreferrer">
              Verify the contract on NearBlocks
              <Out />
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
