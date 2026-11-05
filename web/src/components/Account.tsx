import { ArrowRightIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { type ReactNode, use } from "react";

import { type Board, nep141, type Offer, positionId, type Series } from "../lib/chain";
import { config, explorer } from "../lib/config";
import { isEvmAccount } from "../lib/evm";
import { account as short, compact, count, fitFigure, units, utcShort } from "../lib/format";
import { freeCaption, interlock, type Lever, phase } from "../lib/interlock";
import { follow, href } from "../lib/route";
import { useTransfers } from "../lib/transfers";
import { ViewerContext } from "../lib/viewer";
import { signer } from "../lib/wallet";
import type { SheetRequest } from "./ActionSheet";
import { Tracker } from "./CrossChain";
import { Figure } from "./Num";
import { Amount, Countdown, KindPlate, Out, PhaseChip } from "./parts";
import { Terminal, Tracks } from "./System";

// 30px to see; the ::before reaches 44px to hit on a phone.
const rowAction =
  "plate-label relative inline-flex h-8 items-center rounded-full px-2.5 text-label before:absolute before:inset-x-0 before:-inset-y-[7px] shadow-[inset_0_0_0_1.5px_var(--color-iron)] transition-colors duration-150 hover:bg-bed active:translate-y-px";

function Action({ children, onClick, label, className }: { children: ReactNode; onClick: () => void; label?: string; className?: string }) {
  return (
    <button type="button" className={clsx(rowAction, className)} onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

const panelPrimary =
  "plate-label inline-flex h-10 items-center rounded-full bg-panel-ink px-4 text-meta text-panel transition-[translate,background-color] duration-150 hover:bg-ink-hover active:translate-y-px";
const panelSecondary =
  "plate-label inline-flex h-10 items-center rounded-full px-4 text-meta text-panel-ink shadow-[inset_0_0_0_1.5px_var(--color-panel-ink)] transition-colors duration-150 hover:bg-panel-raised";

/**
 * The account's opening panel: who, and the same route as the board's at the scale of one account
 * (wallet ⇄ its own balance inside Intents ⇄ what it has committed to Warrant), lit from chain.
 */
export function AccountHero({ board, viewer, onSheet }: { board: Board; viewer: string | null; onSheet: (request: SheetRequest) => void }) {
  if (!viewer) {
    return (
      <section className="pb-14 pt-10 sm:pt-14" aria-labelledby="account-title">
        <h1 id="account-title" className="display text-display-1">
          No account chosen
        </h1>
        <p className="mt-5 max-w-[54ch] text-lead text-panel-ink-2">
          {signer === "wallet"
            ? "Connect a NEAR wallet or an EVM wallet to see your balances inside Intents, your longs, the series you wrote, and your offers. Everything is read from chain."
            : "Choose a devnet account under “Act as” to see its balances inside Intents, its longs, the series it wrote and its offers."}
        </p>
      </section>
    );
  }
  const me = board.viewer;
  const evm = isEvmAccount(viewer);
  if (!me) {
    return (
      <section className="pb-14 pt-10 sm:pt-14" aria-busy="true" aria-labelledby="account-title">
        <h1 id="account-title" className="display break-all text-display-1 text-panel-ink-3" title={viewer}>
          {short(viewer)}
        </h1>
        <p className="mt-5 text-lead text-panel-ink-3" role="status">
          Reading this account from chain…
        </p>
      </section>
    );
  }

  const tokenIds = Object.keys(board.tokens).filter((id) => nep141(id));
  const firstToken = board.allowed[0]?.token_id ?? tokenIds[0] ?? "";
  const held = tokenIds.filter((id) => (me.inIntents[id] ?? 0n) > 0n);
  const [primary, ...others] = held.length > 0 ? held : [firstToken];
  const positionsInIntents = board.series.reduce((n, s) => n + (me.inIntents[positionId(s.token_id)] ?? 0n), 0n);
  const written = board.series.filter((s) => s.writer === viewer);
  const locked = written.filter((s) => BigInt(s.collateral_held) > 0n);
  const lockedPrimary = locked.filter((s) => s.collateral_token === firstToken).reduce((n, s) => n + BigInt(s.collateral_held), 0n);
  const claimable = written.some((s) => BigInt(s.proceeds_held) > 0n) || Object.values(me.owed).some((v) => v > 0n);
  const walletHas = (me.wallet.near ?? 0n) > 0n || Object.values(me.wallet.tokens).some((v) => v > 0n);
  const nearToken = { id: "near", symbol: "NEAR", decimals: 24 };
  const fmt = (raw: bigint, id: string) => `${units(raw, board.tokens[id]).short} ${board.tokens[id]?.symbol ?? ""}`.trim();

  return (
    <section className="pb-12 pt-10 sm:pt-14 lg:pb-14" aria-labelledby="account-title">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0">
          <h1 id="account-title" className="display break-all text-display-1" title={viewer}>
            {short(viewer)}
          </h1>
          <p className="mt-5 max-w-[58ch] text-lead text-panel-ink-2">
            Your value sits in three places: {evm ? "your EVM wallet, on its own chain" : "your NEAR wallet"}, your own balance inside
            Intents, and what you've committed to Warrant. Only the last is locked, and only until each series expires.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={panelPrimary} onClick={() => onSheet({ type: "deposit", token: firstToken })}>
            Deposit
          </button>
          <button type="button" className={panelSecondary} onClick={() => onSheet({ type: "withdraw", token: firstToken })}>
            Withdraw
          </button>
          {explorer && !evm && (
            <a className="plate-label inline-flex h-10 items-center px-2 text-meta text-panel-ink-2 underline decoration-panel-line underline-offset-4 hover:text-panel-ink" href={explorer.account(viewer)} target="_blank" rel="noreferrer">
              NearBlocks
              <Out />
            </a>
          )}
        </div>
      </div>

      <div className="sys mt-12 lg:mt-14" role="img" aria-label={`${evm ? "EVM wallet, on its own chain" : `Wallet ${units(me.wallet.near ?? 0n, nearToken).short} NEAR`}; inside Intents ${held.map((id) => fmt(me.inIntents[id] ?? 0n, id)).join(", ") || "nothing"}; committed to Warrant: ${locked.length} series locked.`}>
        <Terminal label={evm ? "EVM wallet" : "Wallet"} sub={evm ? "on its own chain" : me.wallet.near === null ? "no account yet" : `${compact(me.wallet.near, nearToken)} NEAR`} />
        <Tracks
          at={[0.1, 1.15]}
          forward={
            evm
              ? { label: "deposit", value: "through 1Click", lit: config.network === "mainnet" ? "iron" : null }
              : { label: "deposit", value: walletHas ? "from wallet" : "wallet empty", lit: walletHas ? "iron" : null }
          }
          back={{ label: "withdraw", value: held.length > 0 ? "any time" : "nothing to withdraw", lit: held.length > 0 ? "iron" : null }}
        />
        <div className="sys-station" aria-hidden="true">
          <div className="flex items-baseline justify-between gap-3">
            <span className="plate-label text-label">NEAR Intents · yours</span>
            <span className="fig text-micro text-iron-2">{short(board.intentsId)}</span>
          </div>
          <p className="display mt-3 whitespace-nowrap" style={{ fontSize: fitFigure(units(me.inIntents[primary ?? ""] ?? 0n, board.tokens[primary ?? ""]).short, "4.25rem") }}>
            <Figure raw={me.inIntents[primary ?? ""] ?? 0n} token={board.tokens[primary ?? ""]} rollIn delay={500} />
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-ui">
            <span className="font-semibold">{board.tokens[primary ?? ""]?.symbol}</span>
            {others.map((id) => (
              <span key={id} className="fig">
                + {units(me.inIntents[id] ?? 0n, board.tokens[id]).short} <span className="text-iron-2">{board.tokens[id]?.symbol}</span>
              </span>
            ))}
            {positionsInIntents > 0n && (
              <span className="fig">
                + {count(positionsInIntents)} <span className="text-iron-2">long{positionsInIntents === 1n ? "" : "s"}</span>
              </span>
            )}
          </p>
          <p className="mt-2 text-meta text-iron-2">yours to write, buy and exercise with, or to withdraw</p>
        </div>
        <Tracks
          at={[0.5, 0.85]}
          forward={{ label: "lock · pay", value: lockedPrimary > 0n ? `${fmt(lockedPrimary, firstToken)} locked` : `${locked.length} series locked`, lit: locked.length > 0 ? "lock" : null }}
          back={{ label: "release · deliver", value: claimable ? "claims waiting" : "nothing to claim", lit: claimable ? "deliver" : null }}
        />
        <Terminal label="Warrant" tone="lock" sub={`${written.length} written · ${count(Object.values(me.longs).reduce((n, v) => n + v, 0n))} longs`} />
      </div>
    </section>
  );
}

/**
 * Where this account's value sits, read from chain: its NEAR wallet, its own balance inside
 * Intents, and what it has committed to Warrant. The columns are the stations of one route.
 */
export function Account({
  board,
  nowMs,
  viewer,
  suggestions,
  onViewer,
  onSheet,
}: {
  board: Board;
  nowMs: number;
  viewer: string | null;
  suggestions: string[];
  onViewer: (account: string) => void;
  onSheet: (request: SheetRequest) => void;
}) {
  const transfers = useTransfers(viewer);
  if (!viewer) return <NoViewer suggestions={suggestions} onViewer={onViewer} />;
  if (!board.viewer) return <main id="account" className="min-h-[40vh]" aria-busy="true" />;

  const me = board.viewer;
  const written = board.series.filter((s) => s.writer === viewer);
  const offers = board.offers.filter((o) => o.seller === viewer && BigInt(o.remaining) > 0n);
  const listed = (seriesId: string) => offers.filter((o) => o.series_id === seriesId).reduce((sum, o) => sum + BigInt(o.remaining), 0n);
  const positions = board.series.filter(
    (s) => (me.longs[s.token_id] ?? 0n) > 0n || (me.inIntents[positionId(s.token_id)] ?? 0n) > 0n || listed(s.series_id) > 0n,
  );
  const tokenIds = Object.keys(board.tokens).filter((id) => nep141(id));

  return (
    <main id="account" className="flex flex-col gap-16 pb-16 pt-14">
      <section aria-labelledby="custody-title">
        <h2 id="custody-title" className="display mb-8 text-display-3">
          Where your value sits
        </h2>
        <div className="custody" role="table" aria-label="Where your value sits">
          <RouteHeader viewer={viewer} intents={board.intentsId} />
          <div role="rowgroup">
            {tokenIds.map((id) => (
              <TokenRow key={id} id={id} board={board} written={written} onSheet={onSheet} />
            ))}
          </div>
          <div role="rowgroup" aria-label="Positions">
            <div role="row" className="custody-group">
              <span role="columnheader" className="plate-label text-label text-iron-2">
                Positions · longs
              </span>
            </div>
            {positions.length === 0 ? (
              <div role="row" className="custody-row">
                <span role="cell" className="col-span-full text-ui text-iron-2">
                  No longs yet. Buy one on the board; it lands in Warrant's ledger, ready to exercise or move into Intents.
                </span>
              </div>
            ) : (
              positions.map((series) => (
                <PositionRow key={series.series_id} series={series} board={board} nowMs={nowMs} viewer={viewer} listed={listed(series.series_id)} onSheet={onSheet} />
              ))
            )}
          </div>
        </div>
      </section>

      <Written board={board} nowMs={nowMs} viewer={viewer} written={written} onSheet={onSheet} />
      <div className="grid gap-16 xl:grid-cols-2 xl:gap-10">
        <Offers board={board} nowMs={nowMs} offers={offers} onSheet={onSheet} />
        <Transfers transfers={transfers} />
      </div>
    </main>
  );
}

function NoViewer({ suggestions, onViewer }: { suggestions: string[]; onViewer: (account: string) => void }) {
  if (signer === "wallet" || suggestions.length === 0) return <main id="account" className="min-h-[30vh]" />;
  return (
    <main id="account" className="pb-16 pt-14">
      <h2 className="text-h3 font-semibold [font-variation-settings:'wdth'_112,'wght'_700]">Accounts on this devnet</h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <li key={s}>
            <button type="button" className={rowAction} onClick={() => onViewer(s)}>
              <span className="fig normal-case tracking-normal">{s}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** The route as column heads: wallet ⇄ Intents (yours) ⇄ Warrant (committed). */
function RouteHeader({ viewer, intents }: { viewer: string; intents: string }) {
  return (
    <div role="row" className="custody-head" aria-label="Stations">
      <span role="columnheader" className="plate-label self-end text-label text-iron-2">
        Asset
      </span>
      <Station label={isEvmAccount(viewer) ? "Your EVM wallet" : "Your wallet"} brief="Wallet" sub={short(viewer)} />
      <Track forward="deposit" back="withdraw" tone="iron" />
      <Station label="NEAR Intents · yours" brief="Intents" sub={short(intents)} filled />
      <Track forward="lock · pay" back="release · deliver" tone="lock" />
      <Station label="Warrant · committed" brief="Warrant" sub={short(config.optionsContract)} />
    </div>
  );
}

/** A station plate; on phones only its one-word name fits, so the account line waits for lg. */
function Station({ label, brief, sub, filled = false }: { label: string; brief: string; sub: string; filled?: boolean }) {
  return (
    <span
      role="columnheader"
      aria-label={label}
      className={clsx(
        "flex min-w-0 flex-col justify-center gap-0.5 rounded-xl px-1.5 py-2 text-center lg:px-3 lg:py-2.5 lg:text-left",
        filled ? "bg-iron text-board" : "text-iron shadow-[inset_0_0_0_1.5px_var(--color-iron)]",
      )}
    >
      <span className="plate-label truncate text-meta">
        <span className="lg:hidden">{brief}</span>
        <span className="hidden lg:inline">{label}</span>
      </span>
      <span className={clsx("fig hidden truncate text-micro lg:block", filled ? "text-rule" : "text-iron-2")}>{sub}</span>
    </span>
  );
}

function Track({ forward, back, tone }: { forward: string; back: string; tone: "iron" | "lock" }) {
  return (
    <span className="custody-track" data-tone={tone} aria-hidden="true">
      <span className="plate-label text-micro">
        {forward} <CaretRightIcon weight="fill" size="0.95em" className="inline-block align-[-0.12em]" aria-hidden="true" />
      </span>
      <span className="custody-rail" />
      <span className="custody-rail custody-rail-back" />
      <span className="plate-label text-micro text-iron-2">
        <CaretLeftIcon weight="fill" size="0.95em" className="inline-block align-[-0.12em]" aria-hidden="true" /> {back}
      </span>
    </span>
  );
}

/** Mobile: each cell names its station, since the route header is hidden. */
function Cell({ station, children, className }: { station: string; children: ReactNode; className?: string }) {
  return (
    <div role="cell" className={clsx("custody-cell", className)}>
      <span className="plate-label text-micro text-iron-2 lg:hidden">{station}</span>
      <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5 pt-0.5">{children}</div>;
}

function TokenRow({
  id,
  board,
  written,
  onSheet,
}: {
  id: string;
  board: Board;
  written: Series[];
  onSheet: (request: SheetRequest) => void;
}) {
  const me = board.viewer;
  const token = board.tokens[id];
  const isWrap = nep141(id) === config.wrapContract;
  const allowed = board.allowed.some((a) => a.token_id === id);
  const wallet = me?.wallet.tokens[id] ?? 0n;
  const inside = me?.inIntents[id] ?? 0n;
  const owed = me?.owed[id] ?? 0n;
  const lockedIn = written.filter((s) => s.collateral_token === id && BigInt(s.collateral_held) > 0n);
  const locked = lockedIn.reduce((sum, s) => sum + BigInt(s.collateral_held), 0n);
  const proceeds = written.filter((s) => s.payment_token === id).reduce((sum, s) => sum + BigInt(s.proceeds_held), 0n);
  const nearToken = { id: "near", symbol: "NEAR", decimals: 24 };
  const viewer = use(ViewerContext);
  const evm = viewer !== null && isEvmAccount(viewer);

  return (
    <div role="row" className="custody-row">
      <div role="rowheader" className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body font-semibold [font-variation-settings:'wdth'_108,'wght'_680]">{token?.symbol ?? id}</span>
        <span className="fig truncate text-micro text-iron-2" title={id}>
          {nep141(id)}
        </span>
      </div>
      <Cell station="Wallet">
        {evm ? (
          <span className="text-iron-2">on your wallet's chain</span>
        ) : (
          <>
            {isWrap && <Amount raw={me?.wallet.near ?? 0n} token={nearToken} roll />}
            <Amount raw={wallet} token={token} className={isWrap && wallet === 0n ? "text-iron-2" : undefined} roll />
          </>
        )}
        {allowed && (
          <Actions>
            <Action onClick={() => onSheet({ type: "deposit", token: id })} label={`Deposit ${token?.symbol ?? id} into Intents`}>
              Deposit
            </Action>
          </Actions>
        )}
      </Cell>
      <span className="custody-gap" aria-hidden="true" />
      <Cell station="Intents">
        <Amount raw={inside} token={token} className="text-body" roll />
        {inside > 0n && (
          <Actions>
            <Action onClick={() => onSheet({ type: "withdraw", token: id })} label={`Withdraw ${token?.symbol ?? id}`}>
              Withdraw
            </Action>
            {!evm && (
              <Action onClick={() => onSheet({ type: "send", tokenId: id })} label={`Send ${token?.symbol ?? id} inside Intents`}>
                Send
              </Action>
            )}
          </Actions>
        )}
      </Cell>
      <span className="custody-gap" aria-hidden="true" />
      <Cell station="Warrant">
        {locked === 0n && proceeds === 0n && owed === 0n ? (
          <span className="text-iron-2">—</span>
        ) : (
          <>
            {locked > 0n && (
              <span>
                <Amount raw={locked} token={token} className="text-lock" roll /> <span className="text-iron-2">locked · {lockedIn.length} series</span>
              </span>
            )}
            {proceeds > 0n && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-deliver" aria-hidden="true" />
                <Amount raw={proceeds} token={token} className="text-deliver-ink" roll /> <span className="text-iron-2">proceeds to claim</span>
              </span>
            )}
            {owed > 0n && (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-refuse" aria-hidden="true" />
                <Amount raw={owed} token={token} className="text-refuse-ink" /> <span className="text-iron-2">owed to you</span>
                <Action onClick={() => onSheet({ type: "retry", token: id })}>Retry</Action>
              </span>
            )}
          </>
        )}
      </Cell>
    </div>
  );
}

function PositionRow({
  series,
  board,
  nowMs,
  viewer,
  listed,
  onSheet,
}: {
  series: Series;
  board: Board;
  nowMs: number;
  viewer: string;
  listed: bigint;
  onSheet: (request: SheetRequest) => void;
}) {
  const me = board.viewer;
  const ledger = me?.longs[series.token_id] ?? 0n;
  const inside = me?.inIntents[positionId(series.token_id)] ?? 0n;
  const p = phase(series, nowMs);
  const levers = interlock(series, { viewer, longs: ledger, offers: board.offers, nowMs });
  const exercise = levers.find((l) => l.id === "exercise");

  return (
    <div role="row" className="custody-row">
      <div role="rowheader" className="flex min-w-0 flex-col gap-1">
        <a className="flex items-center gap-2 hover:underline hover:decoration-rule hover:underline-offset-4" href={href("board", { series: series.series_id })} onClick={follow}>
          <span className="fig text-iron-2">#{series.series_id}</span>
          <KindPlate kind={series.kind} />
        </a>
        <span className="text-meta text-iron-2">
          pay <Amount raw={series.payment_per_option} token={board.tokens[series.payment_token]} className="text-iron-2" /> · get{" "}
          <Amount raw={series.collateral_per_option} token={board.tokens[series.collateral_token]} className="text-iron-2" />
        </span>
      </div>
      <Cell station="Wallet">
        <span className="text-iron-2" title="Longs live in Warrant's ledger or inside Intents, not in a wallet">
          <span aria-hidden="true">—</span>
          <span className="sr-only">never held in a wallet</span>
        </span>
      </Cell>
      <span className="custody-gap" aria-hidden="true" />
      <Cell station="Intents">
        {inside === 0n ? (
          <span className="text-iron-2">
            <span aria-hidden="true">—</span>
            <span className="sr-only">no longs</span>
          </span>
        ) : (
          <span>
            <span className="fig text-body">{count(inside)}</span> <span className="text-iron-2">long{inside === 1n ? "" : "s"}</span>
          </span>
        )}
        {inside > 0n && (
          <Actions>
            <Action onClick={() => onSheet({ type: "position", series, direction: "out" })} label={`Move longs of series ${series.series_id} back to Warrant`}>
              Move back
            </Action>
            <Action onClick={() => onSheet({ type: "send", tokenId: positionId(series.token_id) })} label={`Send longs of series ${series.series_id} inside Intents`}>
              Send
            </Action>
          </Actions>
        )}
      </Cell>
      <span className="custody-gap" aria-hidden="true" />
      <Cell station="Warrant">
        <span className={ledger === 0n ? "text-iron-2" : undefined}>
          <span className="fig text-body">{count(ledger)}</span> <span className="text-iron-2">{p === "locked" ? "exercisable" : "held · lapsed"}</span>
          {listed > 0n && (
            <span className="text-iron-2">
              {" "}· <span className="fig text-iron">{count(listed)}</span> listed
            </span>
          )}
        </span>
        <span className="text-meta text-iron-2">
          {p === "locked" ? (
            <>
              exercise closes in <Countdown toNs={series.expiry_ns} />
            </>
          ) : (
            <>closed {utcShort(series.expiry_ns)}</>
          )}
        </span>
        {ledger > 0n && (
          <Actions>
            {exercise && (
              <Action onClick={() => onSheet({ type: "lever", lever: exercise, series })} label={`Exercise series ${series.series_id}${exercise.state === "free" ? "" : ": locked, test the lock"}`}>
                {exercise.state === "free" ? "Exercise" : "Exercise · locked"}
              </Action>
            )}
            {p === "locked" && (
              <Action onClick={() => onSheet({ type: "position", series, direction: "in" })} label={`Move longs of series ${series.series_id} into Intents`}>
                Move to Intents
              </Action>
            )}
          </Actions>
        )}
      </Cell>
    </div>
  );
}

const TONE: Record<Lever["tone"], string> = {
  lock: "bg-lock text-board",
  iron: "bg-iron text-board",
  live: "bg-live text-iron",
  release: "bg-release text-iron",
  deliver: "bg-deliver text-iron",
};

/** A lever plate as a button: coloured when free; unlit with its lock when not (the Interlock). */
function Plate({ lever, onPull }: { lever: Lever; onPull: () => void }) {
  const free = lever.state === "free";
  return (
    <button
      type="button"
      onClick={onPull}
      title={free ? `${lever.label}: free` : `${lever.label}: locked, ${lever.lock}. Pull to test the lock on chain.`}
      className={clsx(
        "flex w-[9rem] flex-col items-start gap-0.5 rounded-xl px-2.5 py-1.5 text-left transition-[translate] duration-150 active:translate-y-px",
        free ? TONE[lever.tone] : "text-iron-2 shadow-[inset_0_0_0_1px_var(--color-rule)] hover:shadow-[inset_0_0_0_1px_var(--color-iron-2)]",
      )}
    >
      <span className="plate-label text-meta leading-none">
        <span className="fig mr-1 text-micro opacity-80">{lever.num}</span>
        {lever.label}
      </span>
      <span className="text-micro leading-tight">{free ? freeCaption(lever) : lever.lock}</span>
    </button>
  );
}

function Written({
  board,
  nowMs,
  viewer,
  written,
  onSheet,
}: {
  board: Board;
  nowMs: number;
  viewer: string;
  written: Series[];
  onSheet: (request: SheetRequest) => void;
}) {
  return (
    <section aria-labelledby="written-title">
      <SectionHead id="written-title" title="Series you wrote" note="Claims on strike payments and on collateral after expiry" />
      {written.length === 0 ? (
        <Empty>
          You haven't written a series. A writer locks collateral inside Intents, sells longs, and collects the strike when they
          are exercised.
        </Empty>
      ) : (
        <ol className="border-y border-iron/80">
          {written.map((series) => {
            const levers = interlock(series, { viewer, longs: board.viewer?.longs[series.token_id] ?? 0n, offers: board.offers, nowMs });
            const claims = levers.filter((l) => l.id === "proceeds" || l.id === "reclaim");
            const p = phase(series, nowMs);
            return (
              <li key={series.series_id} className="grid grid-cols-1 gap-x-6 gap-y-3 border-b border-rule px-3 py-4 last:border-b-0 lg:grid-cols-[minmax(11rem,1fr)_minmax(16rem,1.4fr)_18.5rem] lg:items-center">
                <div className="flex min-w-0 flex-col gap-1">
                  <a className="flex items-center gap-2 hover:underline hover:decoration-rule hover:underline-offset-4" href={href("board", { series: series.series_id })} onClick={follow}>
                    <span className="fig text-iron-2">#{series.series_id}</span>
                    <KindPlate kind={series.kind} />
                    <PhaseChip phase={p} />
                  </a>
                  <span className="text-meta text-iron-2">
                    {p === "locked" ? (
                      <>
                        releases in <Countdown toNs={series.expiry_ns} />
                      </>
                    ) : (
                      <>expired {utcShort(series.expiry_ns)}</>
                    )}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-ui sm:grid-cols-3">
                  <div>
                    <dt className="plate-label text-micro text-iron-2">Locked</dt>
                    <dd className="mt-0.5">
                      <Amount raw={series.collateral_held} token={board.tokens[series.collateral_token]} />
                    </dd>
                  </div>
                  <div>
                    <dt className="plate-label text-micro text-iron-2">Open longs</dt>
                    <dd className="fig mt-0.5">{count(series.long_supply)}</dd>
                  </div>
                  <div>
                    <dt className="plate-label text-micro text-iron-2">Proceeds</dt>
                    <dd className="mt-0.5">
                      <Amount raw={series.proceeds_held} token={board.tokens[series.payment_token]} />
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {claims.map((lever) => (
                    <Plate key={lever.id} lever={lever} onPull={() => onSheet({ type: "lever", lever, series })} />
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Offers({ board, nowMs, offers, onSheet }: { board: Board; nowMs: number; offers: Offer[]; onSheet: (request: SheetRequest) => void }) {
  return (
    <section aria-labelledby="offers-title">
      <SectionHead id="offers-title" title="Your open offers" note="Longs escrowed by Warrant until sold or cancelled" />
      {offers.length === 0 ? (
        <Empty>No open offers. List longs from a series' Interlock; buyers pay you straight into your Intents balance.</Empty>
      ) : (
        <ul className="border-y border-iron/80">
          {offers.map((offer) => (
            <li key={offer.offer_id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule px-3 py-3 text-ui last:border-b-0">
              <a className="flex items-center gap-3 hover:underline hover:decoration-rule hover:underline-offset-4" href={href("board", { series: offer.series_id })} onClick={follow}>
                <span className="fig text-iron-2">offer {offer.offer_id}</span>
                <span className="text-iron-2">series #{offer.series_id}</span>
              </a>
              <span>
                <span className="fig">{count(offer.remaining)}</span> <span className="text-iron-2">at</span>{" "}
                <Amount raw={offer.price_per_option} token={board.tokens[offer.price_token]} /> <span className="text-iron-2">each</span>
                {expiredSeries(board, offer.series_id, nowMs) && <span className="text-iron-2"> · series expired, unsellable</span>}
              </span>
              <Action className="ml-auto" onClick={() => onSheet({ type: "cancel", offer })}>
                Cancel offer
              </Action>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Transfers({ transfers }: { transfers: ReturnType<typeof useTransfers> }) {
  return (
    <section aria-labelledby="transfers-title">
      <SectionHead id="transfers-title" title="Cross-chain transfers" note="Started in this browser · status read live from 1Click" />
      {transfers.length === 0 ? (
        <Empty>
          {config.network === "mainnet"
            ? "None yet. Deposits from and withdrawals to other chains (Base, Arbitrum, Solana, Bitcoin…) are tracked here until they land."
            : "Cross-chain routes are mainnet-only; this devnet has none to track."}
        </Empty>
      ) : (
        <ul className="border-y border-iron/80">
          {transfers.map((t) => (
            <li key={t.depositAddress} className="grid gap-x-6 gap-y-2 border-b border-rule px-3 py-3 text-ui last:border-b-0">
              <span className="fig text-meta text-iron-2">{new Date(t.createdAt).toISOString().slice(0, 16).replace("T", " ")} UTC</span>
              <span>
                <span className="plate-label mr-2 text-label text-iron-2">{t.direction === "in" ? "In" : "Out"}</span>
                {t.from} <ArrowRightIcon size="0.9em" className="inline-block align-[-0.08em] text-iron-2" aria-label="to" /> {t.to}
              </span>
              <Tracker depositAddress={t.depositAddress} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function expiredSeries(board: Board, seriesId: string, nowMs: number): boolean {
  const series = board.series.find((s) => s.series_id === seriesId);
  return series ? phase(series, nowMs) !== "locked" : false;
}

function SectionHead({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 id={id} className="text-h2 leading-tight [font-variation-settings:'wdth'_115,'wght'_760]">
        {title}
      </h2>
      <p className="text-meta text-iron-2">{note}</p>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="border-y border-rule py-5">
      <p className="max-w-[64ch] text-iron-2">{children}</p>
    </div>
  );
}
