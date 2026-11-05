import { ArrowRightIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";

import { type Board, type Offer, positionId, type Series } from "../lib/chain";
import { account, count, fitFigure, units, utc } from "../lib/format";
import { type ActionId, type Lever, interlock, likelyMove, phase } from "../lib/interlock";
import { exerciseNet, useReference } from "../lib/reference";
import type { SheetRequest } from "./ActionSheet";
import { Clock } from "./Num";
import { Amount, KindPlate, Label, PhaseChip } from "./parts";
import { Payoff } from "./Payoff";
import { Route } from "./Route";

// The levers carry the motion and tooltip libraries; they load after first paint (below the fold).
const LeverFrame = lazy(() => import("./LeverFrame").then((m) => ({ default: m.LeverFrame })));

const cheapest = (a: Offer, b: Offer) => (BigInt(a.price_per_option) < BigInt(b.price_per_option) ? -1 : 1);
/** The card lists this many offers; the rest are counted, and the Buy sheet picks among them all. */
const OFFERS_SHOWN = 4;

interface Props {
  series: Series;
  board: Board;
  nowMs: number;
  viewer: string | null;
  refused: ActionId | null;
  onSheet: (request: SheetRequest) => void;
}

/** One series as the board shows it, worked out once for the card, the bench and the sheet. */
function seriesView({ series, board, nowMs, viewer }: Props, net: number | null = null) {
  const p = phase(series, nowMs);
  const longs = board.viewer?.longs[series.token_id] ?? 0n;
  const levers = interlock(series, { viewer, longs, offers: board.offers, nowMs });
  const offers = board.offers.filter((o) => o.series_id === series.series_id && BigInt(o.remaining) > 0n).sort(cheapest);
  const buyable = offers.filter((o) => o.seller !== viewer);
  const isWriter = viewer !== null && viewer === series.writer;
  const move = likelyMove(levers, { isWriter, holds: longs > 0n, buyable: buyable.length > 0, exerciseNet: net });
  return { p, longs, levers, offers, buyable, isWriter, move };
}

/**
 * The trade card (wide screens): what you act on, short enough to stay pinned beside the list:
 * the terms, your likely move, the offers and your position. The machinery sits in the bench below.
 */
export function DetailCard(props: Props) {
  const { series, board, viewer, onSheet } = props;
  const net = exerciseNet(series, board.tokens, useReference(series.underlying, series.quote));
  const { p, longs, levers, offers, buyable, isWriter, move } = seriesView(props, net);
  const pull = (lever: Lever, offerId?: string) => onSheet({ type: "lever", lever, series, offerId });
  return (
    <article className="detail flex flex-col gap-6 lg:rounded-[22px] lg:bg-card lg:p-7 lg:shadow-[var(--shadow-card)]" aria-labelledby={`series-${series.series_id}`}>
      <Head series={series} phase={p} />
      <Terms {...props} phase={p} />
      {move && <PrimaryMove lever={move} series={series} board={board} offers={buyable} net={net} onPull={() => pull(move, move.id === "buy" ? buyable[0]?.offer_id : undefined)} />}
      <Offers {...props} phase={p} offers={offers} buy={levers.find((l) => l.id === "buy")} onBuy={pull} />
      {viewer && <Position {...props} longs={longs} isWriter={isWriter} />}
    </article>
  );
}

/**
 * The bench under the board and card (wide screens): the series' machinery with room to read it:
 * where its money rests and which levers move for you, beside what a holder makes at expiry.
 */
export function DetailBench(props: Props) {
  const { series } = props;
  const { p, levers } = seriesView(props);
  return (
    <section className="detail grid gap-8 lg:rounded-[22px] lg:bg-card lg:p-7 lg:shadow-[var(--shadow-card)] xl:grid-cols-12 xl:gap-x-10" aria-labelledby={`bench-${series.series_id}`}>
      <h3 id={`bench-${series.series_id}`} className="sr-only">
        Series {series.series_id}: route of funds, interlock and payoff
      </h3>
      <div className="xl:col-span-7">
        <ControlPanel {...props} phase={p} levers={levers} />
      </div>
      <div className="xl:col-span-5">
        <Payoff series={series} board={props.board} />
      </div>
    </section>
  );
}

/** Everything in one column: the phone's series sheet, with the likely move docked at its foot. */
export function DetailSheet(props: Props) {
  const { series, board, viewer, onSheet } = props;
  const net = exerciseNet(series, board.tokens, useReference(series.underlying, series.quote));
  const { p, longs, levers, offers, buyable, isWriter, move } = seriesView(props, net);
  const pull = (lever: Lever, offerId?: string) => onSheet({ type: "lever", lever, series, offerId });
  // What you can do comes first on a phone; the machinery that explains it follows.
  return (
    <article className="detail flex flex-col gap-7" aria-labelledby={`series-${series.series_id}`}>
      <Head series={series} phase={p} />
      <Terms {...props} phase={p} />
      <Offers {...props} phase={p} offers={offers} buy={levers.find((l) => l.id === "buy")} onBuy={pull} />
      {viewer && <Position {...props} longs={longs} isWriter={isWriter} />}
      <ControlPanel {...props} phase={p} levers={levers} />
      <Payoff series={series} board={board} />
      {move && (
        <div className="detail-dock">
          <PrimaryMove lever={move} series={series} board={board} offers={buyable} net={net} onPull={() => pull(move, move.id === "buy" ? buyable[0]?.offer_id : undefined)} />
        </div>
      )}
    </article>
  );
}

function Head({ series, phase: p }: { series: Series; phase: ReturnType<typeof phase> }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <h2 id={`series-${series.series_id}`} className="display text-[2.75rem]">
          <span className="sr-only">Series </span>#{series.series_id}
        </h2>
        <KindPlate kind={series.kind} />
        <PhaseChip phase={p} />
      </div>
      <p className="text-meta text-iron-2">
        writer <span className="fig text-iron">{account(series.writer)}</span>
      </p>
    </header>
  );
}

function Terms({ series, board, phase: p }: Props & { phase: ReturnType<typeof phase> }) {
  // A long figure (12.345678 tUSDC) shrinks to its third of the card instead of running into the
  // next term, and both figures share that size so the row reads as one (each cell is a size
  // container, styles.css). Short figures stay at heading size.
  const text = (raw: string, tokenId: string) => `${units(raw, board.tokens[tokenId]).short} ${board.tokens[tokenId]?.symbol ?? ""}`;
  const pays = text(series.payment_per_option, series.payment_token);
  const receives = text(series.collateral_per_option, series.collateral_token);
  const figure = { fontSize: fitFigure(pays.length >= receives.length ? pays : receives, "var(--text-h3)") };
  return (
    <dl className="detail-terms border-y border-rule py-4">
      <div>
        <dt>
          <Label>Holder pays</Label>
        </dt>
        <dd className="mt-1 text-h3 text-live-ink" style={figure}>
          <Amount raw={series.payment_per_option} token={board.tokens[series.payment_token]} />
        </dd>
      </div>
      <div>
        <dt>
          <Label>Holder receives</Label>
        </dt>
        <dd className="mt-1 text-h3 text-deliver-ink" style={figure}>
          <Amount raw={series.collateral_per_option} token={board.tokens[series.collateral_token]} />
        </dd>
      </div>
      <div>
        <dt>
          <Label>{p === "locked" ? "Exercise closes in" : "Exercise closed"}</Label>
        </dt>
        <dd className="mt-1">
          {p === "locked" ? <Clock toNs={series.expiry_ns} className="detail-clock text-lock" /> : <span className="text-lead text-iron-2">expired</span>}
          <span className="fig block text-label text-iron-2">{utc(series.expiry_ns)}</span>
        </dd>
      </div>
    </dl>
  );
}

/** The series' own control panel: where its money rests, and which levers move for you. */
function ControlPanel({ series, board, viewer, refused, onSheet, phase: p, levers }: Props & { phase: ReturnType<typeof phase>; levers: Lever[] }) {
  return (
    <section className="panel rounded-2xl px-4 pb-5 pt-4 shadow-[inset_0_0_0_1px_var(--color-panel-line)]" aria-label="Control panel">
      <p className="text-label text-panel-ink-2">
        <span className="plate-label">Route of funds</span> · <span className="fig text-panel-ink">#{series.series_id}</span> · from chain state
      </p>
      <div className="mt-3">
        <Route series={series} phase={p} tokens={board.tokens} intentsAccount={board.intentsId} />
      </div>
      <div className="mt-5 border-t border-panel-line pt-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="plate-label text-label text-panel-ink-2">
            Interlock {viewer ? <>· as <span className="fig normal-case tracking-normal text-panel-ink">{account(viewer)}</span></> : "· connect to see yours"}
          </p>
          <span className="text-meta text-panel-ink-3">bolted = the contract refuses it · pull to test</span>
        </div>
        <Suspense fallback={<div className="frame frame-pending" aria-hidden="true" />}>
          <LeverFrame levers={levers} refused={refused} onPull={(lever) => onSheet({ type: "lever", lever, series })} />
        </Suspense>
      </div>
    </section>
  );
}

function Offers({
  series,
  board,
  viewer,
  onSheet,
  phase: p,
  offers,
  buy,
  onBuy,
}: Props & { phase: ReturnType<typeof phase>; offers: Offer[]; buy: Lever | undefined; onBuy: (lever: Lever, offerId: string) => void }) {
  const shown = offers.slice(0, OFFERS_SHOWN);
  const closed = p !== "locked";
  return (
    <section aria-labelledby={`offers-${series.series_id}`}>
      <Label className="mb-2">
        <span id={`offers-${series.series_id}`}>{closed ? "Offers · closed at expiry" : "Offers"}</span>
      </Label>
      {closed && offers.length > 0 && <p className="mb-2 text-meta text-iron-2">Nothing here can be bought after expiry; a seller can cancel to take the longs back.</p>}
      {offers.length === 0 ? (
        <p className="text-iron-2">No open offers on this series.</p>
      ) : (
        <ul className="border-t border-rule">
          {shown.map((offer) => {
            const mine = offer.seller === viewer;
            return (
              <li key={offer.offer_id} className={closed ? "flex items-center justify-between gap-3 border-b border-rule py-2 text-ui text-iron-2" : "flex items-center justify-between gap-3 border-b border-rule py-2 text-ui"}>
                <span className="flex min-w-0 flex-col">
                  <span>
                    <span className="fig">{count(offer.remaining)}</span> <span className="text-iron-2">at</span>{" "}
                    <Amount raw={offer.price_per_option} token={board.tokens[offer.price_token]} /> <span className="text-iron-2">each</span>
                  </span>
                  <span className="truncate text-meta text-iron-2" title={offer.seller}>
                    offer {offer.offer_id} · {mine ? "yours" : account(offer.seller)}
                  </span>
                </span>
                {mine ? (
                  <button type="button" className="offer-action" onClick={() => onSheet({ type: "cancel", offer })} aria-label={`Cancel offer ${offer.offer_id}`}>
                    Cancel
                  </button>
                ) : buy && p === "locked" ? (
                  <button type="button" className="offer-action" onClick={() => onBuy(buy, offer.offer_id)} aria-label={`Buy from offer ${offer.offer_id}`}>
                    Buy
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {offers.length > shown.length && (
        <p className="mt-2 text-meta text-iron-2">
          + {offers.length - shown.length} more {offers.length - shown.length === 1 ? "offer" : "offers"}, all in the Buy sheet
        </p>
      )}
    </section>
  );
}

function Position({ series, board, longs, isWriter }: Props & { longs: bigint; isWriter: boolean }) {
  const inside = board.viewer?.inIntents[positionId(series.token_id)] ?? 0n;
  const listed = board.offers
    .filter((o) => o.series_id === series.series_id && o.seller === board.viewer?.account)
    .reduce((n, o) => n + BigInt(o.remaining), 0n);
  return (
    <section>
      <Label className="mb-2">Your position</Label>
      <p className="text-ui">
        <span className="fig">{count(longs)}</span> long{longs === 1n ? "" : "s"} here
        {inside > 0n && (
          <>
            {" "}· <span className="fig">{count(inside)}</span> inside Intents
          </>
        )}
        {listed > 0n && (
          <>
            {" "}· <span className="fig">{count(listed)}</span> listed
          </>
        )}
        {isWriter && <span className="text-iron-2"> · you wrote this series</span>}
      </p>
    </section>
  );
}

/**
 * The viewer's likely next move as the card's one primary action. The Interlock stays the full
 * set, with every lock named; this is the shortcut to the move most people came to make.
 */
function PrimaryMove({ lever, series, board, offers, net, onPull }: { lever: Lever; series: Series; board: Board; offers: Offer[]; net: number | null; onPull: () => void }) {
  const amount = (raw: string | bigint, tokenId: string) => `${units(raw, board.tokens[tokenId]).short} ${board.tokens[tokenId]?.symbol ?? ""}`.trim();
  const best = offers[0];
  const text: Record<ActionId, [string, string]> = {
    buy: best
      ? [`Buy at ${amount(best.price_per_option, best.price_token)}`, `${offers.length === 1 ? "the open offer" : `best of ${offers.length} offers`} · ${count(best.remaining)} left`]
      : ["Buy", ""],
    exercise: [
      `Exercise · pay ${amount(series.payment_per_option, series.payment_token)}`,
      net === null
        ? `receive ${amount(series.collateral_per_option, series.collateral_token)} per option · no reference price here`
        : `nets +${net.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${board.tokens[series.quote]?.symbol ?? ""} per option at 1Click's reference`,
    ],
    list: ["List your longs", "buyers pay you inside Intents"],
    reclaim: [`Reclaim ${amount(series.collateral_held, series.collateral_token)}`, "the collateral no one exercised"],
    proceeds: [`Claim ${amount(series.proceeds_held, series.payment_token)}`, "strike payments, to your Intents balance"],
    write: ["Write more options", "lock more collateral in this series"],
    close: ["Close", ""],
  };
  const [title, note] = text[lever.id];
  return (
    <button type="button" className="primary-move enamel" data-tone={lever.tone} onClick={onPull}>
      <span className="primary-move-num fig" aria-hidden="true">
        {lever.num}
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start text-left">
        <span className="text-ui font-semibold">{title}</span>
        {note && <span className="text-meta font-normal">{note}</span>}
      </span>
      <ArrowRightIcon size={18} weight="bold" aria-hidden="true" className="shrink-0" />
    </button>
  );
}
