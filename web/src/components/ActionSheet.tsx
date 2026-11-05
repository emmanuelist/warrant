import { lazy, type ReactNode, type SubmitEvent, Suspense, use, useEffect, useRef, useState } from "react";

import { type Board, type Kind, type Offer, positionId, type Series, type Token } from "../lib/chain";
import { chainNow, useChainSecond } from "../lib/clock";
import { config, explorer } from "../lib/config";
import { causeOf } from "../lib/errors";
import { isEvmAccount } from "../lib/evm";
import { account, count, countdown, parse, units, utc, utcShort } from "../lib/format";
import type { ActionId, Lever } from "../lib/interlock";
import { breakEven } from "../lib/payoff";
import { exerciseNet, useReference } from "../lib/reference";
import { ViewerContext } from "../lib/viewer";
import { type Call, NEAR_FOR_GAS, onOptions, send, signer, viaIntents } from "../lib/wallet";
import { CrossChainIn, CrossChainOut, MainnetOnly } from "./CrossChain";
import { DialPreview } from "./Dial";
import { Choice, CountField, countProblem, Field, inputClass, Submit, wholeCount } from "./form";
import { CancelOffer, DepositFromWallet, MovePosition, RetryPayout, SendInIntents, WithdrawToWallet } from "./Funds";
import { Amount, Dismiss, Out } from "./parts";
import { Review } from "./Review";

const ConnectOptions = lazy(() => import("./Connect").then((m) => ({ default: m.ConnectOptions })));

export type SheetRequest =
  | { type: "lever"; lever: Lever; series: Series; offerId?: string; count?: string }
  | { type: "create"; draft?: CreateDraft }
  /** `amount` fills the form (a top-up's shortfall); `back` is the action to return to afterwards. */
  | { type: "deposit"; token: string; amount?: bigint; back?: SheetRequest }
  | { type: "withdraw"; token: string }
  | { type: "send"; tokenId: string }
  | { type: "position"; series: Series; direction: "in" | "out" }
  | { type: "cancel"; offer: Offer }
  | { type: "retry"; token: string };

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; hashes: string[] }
  | { kind: "refused"; hashes: string[]; err: string }
  | { kind: "error"; message: string };

function keyOf(request: SheetRequest): string {
  switch (request.type) {
    case "lever":
      return `lever-${request.series.series_id}-${request.lever.id}-${request.offerId ?? ""}`;
    case "position":
      return `position-${request.series.series_id}-${request.direction}`;
    case "cancel":
      return `cancel-${request.offer.offer_id}`;
    case "send":
      return `send-${request.tokenId}`;
    case "create":
      return "create";
    default:
      return `${request.type}-${request.token}`;
  }
}

function titleOf(request: SheetRequest): string {
  switch (request.type) {
    case "create":
      return "Write a new series";
    case "lever":
      return request.lever.state === "locked"
        ? `${request.lever.label} is locked · series #${request.series.series_id}`
        : request.lever.id === "proceeds"
          ? `Claim proceeds · series #${request.series.series_id}`
          : `${request.lever.label} · series #${request.series.series_id}`;
    case "deposit":
      return "Deposit into NEAR Intents";
    case "withdraw":
      return "Withdraw from NEAR Intents";
    case "send":
      return "Send inside NEAR Intents";
    case "position":
      return request.direction === "in" ? `Move longs into Intents · #${request.series.series_id}` : `Move longs back to Warrant · #${request.series.series_id}`;
    case "cancel":
      return `Cancel offer ${request.offer.offer_id}`;
    case "retry":
      return "Retry a payout";
  }
}

/** Native modal dialog (Esc and focus handled by `showModal`); a bottom sheet on small screens. */
export function ActionSheet({
  request,
  board,
  viewer,
  suggestions,
  onViewer,
  onOpen,
  onClose,
  onSettled,
}: {
  request: SheetRequest | null;
  board: Board;
  viewer: string | null;
  /** Accounts to act as on the devnet, offered inside a sheet that has no one to send it. */
  suggestions: string[];
  onViewer: (account: string | null) => void;
  /** Opens another sheet in this one's place: a top-up, and the way back from it. */
  onOpen: (request: SheetRequest) => void;
  onClose: () => void;
  onSettled: (refusedLever: ActionId | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="sheet-title">
      {request && (
        <SheetBody
          key={keyOf(request)}
          request={request}
          board={board}
          viewer={viewer}
          suggestions={suggestions}
          onViewer={onViewer}
          onOpen={onOpen}
          onClose={() => ref.current?.close()}
          onSettled={onSettled}
        />
      )}
    </dialog>
  );
}

function SheetBody({
  request,
  board,
  viewer,
  suggestions,
  onViewer,
  onOpen,
  onClose,
  onSettled,
}: {
  request: SheetRequest;
  board: Board;
  viewer: string | null;
  suggestions: string[];
  onViewer: (account: string | null) => void;
  onOpen: (request: SheetRequest) => void;
  onClose: () => void;
  onSettled: (refusedLever: ActionId | null) => void;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const evm = viewer !== null && isEvmAccount(viewer);
  const [chosenRoute, setRoute] = useState<"wallet" | "chain">("wallet");
  // An EVM account has no NEAR wallet: its money moves in and out through 1Click (D-030).
  const route = evm ? "chain" : chosenRoute;
  // Once sent, the sheet shows the result and stops: its amounts were for the state before.
  const blocked =
    status.kind === "done"
      ? "Sent and settled. Reopen the sheet to send another."
      : signer === null
        ? "Signing works on mainnet. This board reads a local devnet, so it can show the action but not send it."
        : !viewer
          ? signer === "devnet"
            ? "Choose who acts, above, to send this."
            : "Connect a wallet, above, to send this."
          : !evm && board.viewer && board.viewer.wallet.near !== null && board.viewer.wallet.near < NEAR_FOR_GAS
            ? "This wallet needs about 0.1 NEAR free for gas. The chain holds it while the transaction runs and returns nearly all of it."
            : null;
  // The series as the chain reads it now, not as it was when the sheet opened.
  const live = request.type === "lever" ? (board.series.find((s) => s.series_id === request.series.series_id) ?? request.series) : null;
  const topUp = (token: string, amount: bigint, back: SheetRequest) => onOpen({ type: "deposit", token, amount, back });
  const busy = status.kind === "sending";

  const submit = async (calls: Call[], lever: ActionId | null) => {
    if (!viewer) return;
    setStatus({ kind: "sending" });
    try {
      const sent = await send(viewer, ...calls);
      if (sent.refusal) {
        setStatus({ kind: "refused", hashes: sent.hashes, err: sent.refusal });
        onSettled(lever);
      } else {
        setStatus({ kind: "done", hashes: sent.hashes });
        onSettled(null);
      }
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };
  const form = { board, viewer, blocked, busy, onSubmit: (calls: Call[]) => void submit(calls, null) };
  const single = (lever: ActionId | null) => (call: Call) => void submit([call], lever);
  const crossChain = request.type === "deposit" || request.type === "withdraw";

  let body: ReactNode;
  switch (request.type) {
    case "create":
      body = (
        <CreateForm
          board={board}
          draft={request.draft}
          blocked={blocked}
          busy={busy}
          onSubmit={single(null)}
          onTopUp={(token, amount, draft) => topUp(token, amount, { type: "create", draft })}
        />
      );
      break;
    case "lever":
      body =
        request.lever.state === "locked" ? (
          <TestTheLock lever={request.lever} series={live ?? request.series} board={board} blocked={blocked} busy={busy} onSubmit={single(request.lever.id)} />
        ) : (
          <LeverForm
            lever={request.lever}
            series={live ?? request.series}
            board={board}
            offerId={request.offerId}
            count={request.count}
            blocked={blocked}
            busy={busy}
            onSubmit={single(request.lever.id)}
            onTopUp={(token, amount, count) => topUp(token, amount, { ...request, count })}
            onCancel={(offer) => onOpen({ type: "cancel", offer })}
          />
        );
      break;
    case "deposit":
      body =
        route === "wallet" ? (
          <DepositFromWallet {...form} token={request.token} amount={request.amount} />
        ) : config.network === "mainnet" ? (
          <CrossChainIn board={board} viewer={viewer} tokenId={request.token} />
        ) : (
          <MainnetOnly />
        );
      break;
    case "withdraw":
      body =
        route === "wallet" ? (
          <WithdrawToWallet {...form} token={request.token} />
        ) : config.network === "mainnet" ? (
          <CrossChainOut board={board} viewer={viewer} tokenId={request.token} onSettled={() => onSettled(null)} />
        ) : (
          <MainnetOnly />
        );
      break;
    case "send":
      body = <SendInIntents {...form} tokenId={request.tokenId} />;
      break;
    case "position":
      body = <MovePosition {...form} series={request.series} direction={request.direction} />;
      break;
    case "cancel":
      body = <CancelOffer {...form} offer={request.offer} />;
      break;
    case "retry":
      body = <RetryPayout {...form} tokenId={request.token} />;
      break;
  }

  return (
    <div className="flex flex-col">
      <header
        className="sheet-head flex items-center justify-between gap-4 border-b border-rule px-6 pb-4 pt-5"
        data-tone={request.type === "lever" ? request.lever.tone : request.type === "create" ? "lock" : undefined}
      >
        <div className="flex items-center gap-3">
          {request.type === "lever" && <SheetPlate lever={request.lever} />}
          <h2 id="sheet-title" className="text-h3 leading-tight [font-variation-settings:'wdth'_112,'wght'_720]">
            {titleOf(request)}
          </h2>
        </div>
        <Dismiss onClick={onClose} />
      </header>
      <div className="flex flex-col gap-5 px-6 py-5">
        {crossChain && !evm && (
          <Choice
            name="Route"
            value={route}
            onChange={setRoute}
            options={
              request.type === "deposit"
                ? [
                    { value: "wallet", label: "From your NEAR wallet" },
                    { value: "chain", label: "From another chain" },
                  ]
                : [
                    { value: "wallet", label: "To your NEAR wallet" },
                    { value: "chain", label: "To another chain" },
                  ]
            }
          />
        )}
        {!viewer && signer !== null && <ViewerGate suggestions={suggestions} onViewer={onViewer} />}
        {body}
        <StatusLine status={status} />
        {request.type === "deposit" && request.back && (
          <button
            type="button"
            onClick={() => request.back && onOpen(request.back)}
            className={
              status.kind === "done"
                ? "plate-label flex h-11 items-center justify-center gap-2 rounded-full bg-iron px-5 text-ui text-board"
                : "plate-label self-start text-label text-iron-2 underline decoration-rule underline-offset-4 hover:text-iron"
            }
          >
            Back to {titleOf(request.back).toLowerCase()}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Who sends this, chosen inside the sheet: on mainnet a NEAR wallet or an EVM wallet (D-030); on the
 * devnet a seeded account, holders and the funded 0x wallet included.
 */
function ViewerGate({ suggestions, onViewer }: { suggestions: string[]; onViewer: (account: string | null) => void }) {
  if (signer === "wallet") {
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-bed px-3.5 py-3 text-ui" role="group" aria-label="Connect a wallet">
        <span className="text-iron-2">Connect a wallet to send this.</span>
        <Suspense fallback={<p className="text-label text-iron-2">Finding wallets…</p>}>
          <ConnectOptions surface="sheet" onViewer={onViewer} />
        </Suspense>
      </div>
    );
  }
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-bed px-3.5 py-3 text-ui" role="group" aria-label="Act as">
      <span className="text-iron-2">
        Act as a devnet account to send this. The sandbox key signs for NEAR accounts; the devnet test wallet signs for the 0x one.
      </span>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((id) => (
          <button key={id} type="button" className="fig h-10 rounded-full bg-card px-3.5 text-meta shadow-[var(--shadow-key)] transition-colors duration-150 hover:text-lock" onClick={() => onViewer(id)} title={id}>
            {account(id)}
          </button>
        ))}
      </div>
    </div>
  );
}

const PLATE: Record<Lever["tone"], string> = {
  lock: "bg-lock text-board",
  iron: "bg-iron text-board",
  live: "bg-live text-iron",
  release: "bg-release text-iron",
  deliver: "bg-deliver text-iron",
};

/** The lever this sheet was opened from, as its plate: coloured when free, unlit when locked. */
function SheetPlate({ lever }: { lever: Lever }) {
  return (
    <span
      aria-hidden="true"
      className={
        lever.state === "free"
          ? `flex h-10 min-w-10 flex-col items-center justify-center rounded-xl px-2 ${PLATE[lever.tone]}`
          : "flex h-10 min-w-10 flex-col items-center justify-center rounded-xl bg-board px-2 text-iron-2 shadow-[inset_0_0_0_1px_var(--color-rule)]"
      }
    >
      <span className="fig text-micro leading-none">{lever.num}</span>
      <span className="plate-label mt-0.5 text-label leading-none">{lever.label}</span>
    </span>
  );
}

function StatusLine({ status }: { status: Status }) {
  const viewer = use(ViewerContext);
  if (status.kind === "idle") return null;
  const links = (hashes: string[]) =>
    hashes.map((hash, index) => (
      <span key={hash}>
        {index > 0 && " · "}
        {explorer ? (
          <a className="fig underline underline-offset-4" href={explorer.tx(hash)} target="_blank" rel="noreferrer">
            {hash.slice(0, 10)}…
            <Out />
          </a>
        ) : (
          <span className="fig" title={hash}>
            {hash.slice(0, 10)}…
          </span>
        )}
      </span>
    ));
  const cause = status.kind === "refused" ? causeOf(status.err) : null;
  return (
    <div className="border-t border-rule pt-4 text-ui" role="status" aria-live="polite">
      {status.kind === "sending" && (
        <p className="text-iron-2">
          {viewer && isEvmAccount(viewer)
            ? "Waiting for your wallet's signature, then for the relayer and the chain…"
            : signer === "devnet"
              ? "Signing with the devnet key and waiting for finality…"
              : "Waiting for the wallet and the chain…"}
        </p>
      )}
      {status.kind === "done" && (
        <p>
          Done on chain · {links(status.hashes)} <span className="text-iron-2">· the figures above are read back from chain.</span>
        </p>
      )}
      {status.kind === "refused" && (
        <>
          <p>
            <span className="plate-label mr-2 rounded-full bg-refuse px-1.5 py-0.5 text-label text-board">Refused by chain</span>
            <span className="fig">{status.err}</span> · {links(status.hashes)} · anything sent through Intents was refunded.
          </p>
          {cause && <p className="mt-1.5 text-iron-2">{cause}</p>}
        </>
      )}
      {status.kind === "error" && <p className="text-refuse">{status.message}</p>}
    </div>
  );
}

const cheapest = (a: Offer, b: Offer) => (BigInt(a.price_per_option) < BigInt(b.price_per_option) ? -1 : 1);
const plural = (n: bigint, word: string) => `${count(n)} ${word}${n === 1n ? "" : "s"}`;
const least = (a: bigint, b: bigint) => (a < b ? a : b);

const COUNT_LABEL: Partial<Record<ActionId, string>> = {
  write: "Options to write",
  list: "Options to list",
  buy: "Options to buy",
  exercise: "Options to exercise",
  close: "Options to close",
};

/** An amount inside an uppercase button: the figure set as data, the symbol in its own case. */
function Sum({ raw, token }: { raw: bigint | string; token: Token | undefined }) {
  return (
    <>
      <span className="fig">{units(raw, token).short}</span> <span className="normal-case tracking-normal">{token?.symbol ?? ""}</span>
    </>
  );
}

/** What a count of options would send, say and cost; null pieces where the count can't go through. */
interface Plan {
  call: Call | null;
  summary: ReactNode;
  /** The commit button: the verb and what moves ("Exercise 1 · pay 4.80 tUSDC"). */
  commit: ReactNode;
  max: bigint | null;
  bound: string | null;
  countError: string | null;
  reason: string | null;
  pays: string | null;
  gap: Gap | null;
}

/** What a balance lacks for an action: filled by a top-up from the wallet. */
interface Gap {
  token: string;
  need: bigint;
  have: bigint;
}

/**
 * A free lever's action. It knows what the chain would refuse before you sign: counts are bounded
 * by what you hold, what's left in the offer, and what your Intents balance covers, so the only
 * refusal anyone sees on purpose is "Test the lock".
 */
function LeverForm({
  lever,
  series,
  board,
  offerId: preset,
  count: typedBefore,
  blocked,
  busy,
  onSubmit,
  onTopUp,
  onCancel,
}: {
  lever: Lever;
  series: Series;
  board: Board;
  offerId?: string;
  /** The count typed before a top-up, restored on the way back. */
  count?: string;
  blocked: string | null;
  busy: boolean;
  onSubmit: (call: Call) => void;
  onTopUp: (token: string, amount: bigint, count: string) => void;
  onCancel: (offer: Offer) => void;
}) {
  const me = board.viewer;
  const viewer = me?.account ?? null;
  const open = board.offers.filter((o) => o.series_id === series.series_id && BigInt(o.remaining) > 0n);
  const offers = open.filter((o) => o.seller !== viewer).sort(cheapest);
  const [typed, setTyped] = useState(typedBefore ?? "1");
  const [price, setPrice] = useState("");
  const ratio = useReference(series.underlying, series.quote);
  const net = exerciseNet(series, board.tokens, ratio);
  const [offerId, setOfferId] = useState(() => (preset && offers.some((o) => o.offer_id === preset) ? preset : (offers[0]?.offer_id ?? "")));
  const quote = board.tokens[series.quote];
  const col = board.tokens[series.collateral_token];
  const pay = board.tokens[series.payment_token];
  const offer = offers.find((o) => o.offer_id === offerId);
  const id = series.series_id;
  const longs = me?.longs[series.token_id] ?? 0n;
  const parked = me?.inIntents[positionId(series.token_id)] ?? 0n;
  const fmt = (raw: bigint, tokenId: string) => `${units(raw, board.tokens[tokenId]).short} ${board.tokens[tokenId]?.symbol ?? ""}`.trim();
  const balanceOf = (tokenId: string) => (me ? (me.inIntents[tokenId] ?? 0n) : null);
  const covers = (tokenId: string, each: bigint) => {
    const balance = balanceOf(tokenId);
    return balance === null || each === 0n ? null : balance / each;
  };
  // A short balance isn't a wrong count: it's a gap to fill, offered as a top-up beside the form.
  const gapOf = (need: bigint, tokenId: string): Gap | null => {
    const balance = balanceOf(tokenId);
    return balance !== null && need > balance ? { token: tokenId, need, have: balance } : null;
  };
  const tooMany = (verb: string) =>
    longs === 0n && parked > 0n
      ? "Your longs are inside Intents. Move them back to Warrant from your account first."
      : `You hold ${plural(longs, "long")} here. ${verb} ${count(longs)} or fewer.`;

  const plan = (options: bigint | null, shape: string | null): Plan => {
    let call: Call | null = null;
    let summary: ReactNode = null;
    let commit: ReactNode = lever.label;
    let max: bigint | null = null;
    let bound: string | null = null;
    let countError: string | null = shape;
    let reason: string | null = null;
    let pays: string | null = null;
    let gap: Gap | null = null;

    switch (lever.id) {
      case "write": {
        const each = BigInt(series.collateral_per_option);
        pays = series.collateral_token;
        max = covers(pays, each);
        bound = max === null ? null : `balance covers ${count(max)}`;
        if (options) {
          const amount = options * each;
          gap = gapOf(amount, pays);
          call = viaIntents(series.collateral_token, amount, { action: "write", series_id: id });
          summary = <>Locks <Amount raw={amount} token={col} /> inside Intents for {plural(options, "more option")}.</>;
          commit = (
            <>
              Write {count(options)} · lock <Sum raw={amount} token={col} />
            </>
          );
        }
        break;
      }
      case "list": {
        max = longs;
        bound = `you hold ${count(longs)}`;
        const each = quote?.decimals != null ? parse(price, quote.decimals) : null;
        if (options && options > longs) countError = tooMany("List");
        else if (options && !(each && each > 0n))
          reason = price.trim() === "" ? `Set a price per option in ${quote?.symbol ?? "the quote token"}.` : `A price in ${quote?.symbol ?? "the quote token"}, up to ${quote?.decimals ?? 0} decimals.`;
        if (options && each && each > 0n) {
          call = onOptions("list", { series_id: id, amount: options.toString(), price_per_option: each.toString() });
          summary = <>Escrows {plural(options, "long")}; buyers pay <Amount raw={each} token={quote} /> each, straight to you inside Intents.</>;
          commit = (
            <>
              List {count(options)} at <Sum raw={each} token={quote} />
            </>
          );
        }
        break;
      }
      case "buy": {
        if (!offer) {
          reason = open.length > 0 ? "The only open offers on this series are yours: buying one only pays you back. Cancel it instead." : "No open offer on this series.";
          break;
        }
        const each = BigInt(offer.price_per_option);
        const left = BigInt(offer.remaining);
        const affordable = covers(series.quote, each);
        pays = series.quote;
        max = affordable === null ? left : least(left, affordable);
        bound = `${count(left)} left${affordable !== null && affordable < left ? ` · balance covers ${count(affordable)}` : ""}`;
        if (options) {
          const premium = options * each;
          if (options > left) countError = `Offer ${offer.offer_id} has ${count(left)} left.`;
          else gap = gapOf(premium, series.quote);
          const underlying = board.tokens[series.underlying];
          const even = underlying?.decimals != null ? breakEven(series, each, underlying.decimals) : null;
          call = viaIntents(series.quote, premium, { action: "buy", offer_id: offer.offer_id, amount: options.toString() });
          summary = (
            <>
              Pays <Amount raw={premium} token={quote} /> from your Intents balance for {plural(options, "long")}.
              {even !== null && (
                <>
                  {" "}Break-even at expiry: 1 {underlying?.symbol} = <Amount raw={even} token={quote} /> (strike {series.kind === "call" ? "+" : "−"} premium).
                </>
              )}
            </>
          );
          commit = (
            <>
              Buy {count(options)} · pay <Sum raw={premium} token={quote} />
            </>
          );
        }
        break;
      }
      case "exercise": {
        const each = BigInt(series.payment_per_option);
        const affordable = covers(series.payment_token, each);
        pays = series.payment_token;
        max = affordable === null ? longs : least(longs, affordable);
        bound = `you hold ${count(longs)}`;
        if (options) {
          const cost = options * each;
          if (options > longs) countError = tooMany("Exercise");
          else gap = gapOf(cost, series.payment_token);
          call = viaIntents(series.payment_token, cost, { action: "exercise", series_id: id, amount: options.toString() });
          summary = (
            <>Pays <Amount raw={cost} token={pay} /> and receives <Amount raw={options * BigInt(series.collateral_per_option)} token={col} />, both inside Intents.</>
          );
          commit = (
            <>
              Exercise {count(options)} · pay <Sum raw={cost} token={pay} />
            </>
          );
        }
        break;
      }
      case "close": {
        max = longs;
        bound = `you hold ${count(longs)}`;
        if (options) {
          const back = options * BigInt(series.collateral_per_option);
          if (options > longs) countError = tooMany("Close");
          call = onOptions("close", { series_id: id, amount: options.toString() });
          summary = <>Burns {plural(options, "long")} of yours and returns <Amount raw={back} token={col} />.</>;
          commit = (
            <>
              Close {count(options)} · get back <Sum raw={back} token={col} />
            </>
          );
        }
        break;
      }
      case "proceeds":
        countError = null;
        call = onOptions("withdraw_proceeds", { series_id: id });
        summary = <>Moves <Amount raw={series.proceeds_held} token={pay} /> of strike payments to your Intents balance.</>;
        commit = (
          <>
            Claim <Sum raw={series.proceeds_held} token={pay} />
          </>
        );
        break;
      case "reclaim":
        countError = null;
        call = onOptions("reclaim_collateral", { series_id: id });
        summary = <>Returns <Amount raw={series.collateral_held} token={col} /> of unexercised collateral. Remaining longs lapse.</>;
        commit = (
          <>
            Reclaim <Sum raw={series.collateral_held} token={col} />
          </>
        );
        break;
    }
    return { call, summary, commit, max, bound, countError, reason, pays, gap };
  };

  const now = plan(wholeCount(typed), countProblem(typed));
  // While the count can't be sent, the review keeps its place (dimmed) instead of collapsing.
  const shown = now.call ?? (COUNT_LABEL[lever.id] ? plan(1n, null).call : null);
  const sendable = now.call !== null && now.countError === null && now.gap === null;
  const label = COUNT_LABEL[lever.id];
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (now.call && sendable) onSubmit(now.call);
  };
  const balance = now.pays ? balanceOf(now.pays) : null;
  const hints = { price_per_option: quote };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      {lever.id === "buy" && offers.length > 1 && (
        <Field label="Offer">
          <select className={inputClass} value={offerId} onChange={(e) => setOfferId(e.target.value)}>
            {offers.map((o) => (
              <option key={o.offer_id} value={o.offer_id}>
                offer {o.offer_id} · {count(o.remaining)} at {units(o.price_per_option, quote).short} {quote?.symbol}
              </option>
            ))}
          </select>
        </Field>
      )}
      {label && (lever.id !== "buy" || offer) && <CountField label={label} value={typed} onChange={setTyped} max={now.max} bound={now.bound} error={now.countError} />}
      {lever.id === "list" && (
        <Field label={<>Price per option <span className="normal-case tracking-normal">({quote?.symbol ?? "quote"})</span></>}>
          <input className={inputClass} inputMode="decimal" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={price.trim() !== "" && now.reason !== null} />
        </Field>
      )}
      {((now.summary && now.countError === null) || (now.pays && balance !== null)) && (
        <div className="flex flex-col gap-1.5 text-ui">
          {now.summary && now.countError === null && <p className="text-iron-2">{now.summary}</p>}
          {now.pays && balance !== null && (
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-meta text-iron-2">
              <span>Your Intents balance</span>
              <Amount raw={balance} token={board.tokens[now.pays]} roll className="text-iron" />
            </p>
          )}
        </div>
      )}
      {lever.id === "exercise" && <Moneyness series={series} board={board} ratio={ratio} net={net} />}
      {now.gap && (
        <div className="flex flex-col items-start gap-2.5 rounded-xl bg-bed px-3.5 py-3 text-ui">
          <p>
            This needs <span className="fig">{fmt(now.gap.need, now.gap.token)}</span>; your Intents balance is{" "}
            <span className="fig">{fmt(now.gap.have, now.gap.token)}</span>.
          </p>
          <button
            type="button"
            className="plate-label inline-flex h-10 items-center rounded-full bg-iron px-4 text-meta text-board transition-[translate] duration-150 active:translate-y-px"
            onClick={() => now.gap && onTopUp(now.gap.token, now.gap.need - now.gap.have, typed)}
          >
            Deposit <span className="fig ml-1.5">{units(now.gap.need - now.gap.have, board.tokens[now.gap.token]).short}</span>
            <span className="ml-1 normal-case tracking-normal">{board.tokens[now.gap.token]?.symbol}</span>
            <span aria-hidden="true">&nbsp;→</span>
          </button>
        </div>
      )}
      {lever.id === "buy" && !offer && open.length > 0 && (
        <div className="flex flex-col items-start gap-2.5">
          {open.map((o) => (
            <button
              key={o.offer_id}
              type="button"
              onClick={() => onCancel(o)}
              className="plate-label inline-flex h-10 items-center rounded-full px-4 text-meta shadow-[inset_0_0_0_1.5px_var(--color-iron)] hover:bg-bed"
            >
              Cancel your offer {o.offer_id}
            </button>
          ))}
        </div>
      )}
      <Submit
        blocked={blocked ?? now.reason}
        invalid={!sendable}
        busy={busy}
        tone={lever.tone}
        review={
          shown && <Review calls={[shown]} tokens={board.tokens} hints={hints} inert={sendable ? undefined : "Not sendable yet; see above."} />
        }
      >
        {now.commit}
      </Submit>
    </form>
  );
}

/**
 * Whether exercising pays, before you sign: 1Click's reference price (indicative, mainnet only,
 * never used for settlement) and what one option would net at it. Without a reference, it says so.
 */
function Moneyness({ series, board, ratio, net }: { series: Series; board: Board; ratio: number | null; net: number | null }) {
  const u = board.tokens[series.underlying];
  const q = board.tokens[series.quote];
  const fixed = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (ratio === null || net === null) {
    return (
      <p className="rounded-xl bg-bed px-3.5 py-3 text-meta text-iron-2">
        {config.network === "mainnet"
          ? "No reference price from 1Click right now. Compare the strike with the market before exercising."
          : "No reference price on this devnet. Compare the strike with the market before exercising; the payoff chart shows the break-even."}
      </p>
    );
  }
  const loses = net < 0;
  return (
    <div className={loses ? "rounded-xl bg-refuse/[0.07] px-3.5 py-3 text-ui shadow-[inset_0_0_0_1px_var(--color-refuse)]" : "rounded-xl bg-bed px-3.5 py-3 text-ui"}>
      <p className="text-meta text-iron-2">
        1Click reference, indicative and never used for settlement: 1 {u?.symbol} ≈ <span className="fig text-iron">{fixed(ratio)}</span> {q?.symbol}
      </p>
      <p className="mt-1">
        {loses ? (
          <>
            Exercising now <strong className="font-semibold">loses</strong> <span className="fig">{fixed(-net)}</span> {q?.symbol} per option at that price. Listing
            your longs may be better.
          </>
        ) : (
          <>
            Exercising nets <span className="fig">+{fixed(net)}</span> {q?.symbol} per option at that price.
          </>
        )}
      </p>
    </div>
  );
}

/** The authored moment: send the refused transaction for real and show the chain's answer. */
function TestTheLock({
  lever,
  series,
  board,
  blocked,
  busy,
  onSubmit,
}: {
  lever: Lever;
  series: Series;
  board: Board;
  blocked: string | null;
  busy: boolean;
  onSubmit: (call: Call) => void;
}) {
  const id = series.series_id;
  const offer = board.offers.find((o) => o.series_id === id && BigInt(o.remaining) > 0n);
  const calls: Record<ActionId, Call> = {
    write: viaIntents(series.collateral_token, BigInt(series.collateral_per_option), { action: "write", series_id: id }),
    list: onOptions("list", { series_id: id, amount: "1", price_per_option: "1" }),
    buy: viaIntents(series.quote, 1n, { action: "buy", offer_id: offer?.offer_id ?? "0", amount: "1" }),
    exercise: viaIntents(series.payment_token, BigInt(series.payment_per_option), { action: "exercise", series_id: id, amount: "1" }),
    close: onOptions("close", { series_id: id, amount: "1" }),
    proceeds: onOptions("withdraw_proceeds", { series_id: id }),
    reclaim: onOptions("reclaim_collateral", { series_id: id }),
  };
  const cause = lever.err ? causeOf(lever.err) : null;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(calls[lever.id]);
      }}
    >
      <p>
        Locked: <strong className="font-semibold">{lever.lock}</strong>.{cause && <span className="text-iron-2"> {cause}</span>}
      </p>
      <p className="text-iron-2">
        Don't take the interface's word for it. Pull the lever anyway: the transaction goes to the chain and the contract
        refuses it with <span className="fig text-iron">{lever.err}</span>. Anything sent through Intents comes back.
      </p>
      <Submit blocked={blocked} busy={busy} tone="refuse" review={<Review calls={[calls[lever.id]]} tokens={board.tokens} />}>
        Test the lock
      </Submit>
    </form>
  );
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const PRESETS = [
  { value: "1h", label: "1 hour", ms: HOUR },
  { value: "1d", label: "1 day", ms: DAY },
  { value: "1w", label: "1 week", ms: 7 * DAY },
  { value: "1mo", label: "1 month", ms: 30 * DAY },
] as const;
type Preset = (typeof PRESETS)[number]["value"] | "exact";
/** The contract takes 1 minute to 366 days (types.rs MIN_EXPIRY_NS, MAX_EXPIRY_NS); two minutes at
 *  the near end leaves time to sign before the window closes. */
const SOONEST = 2 * 60_000;
const LATEST = 366 * DAY;

/** A UTC instant as the `datetime-local` value this form reads as UTC ("2026-10-28T14:00"). */
const asField = (ms: number) => new Date(Math.ceil(ms / 60_000) * 60_000).toISOString().slice(0, 16);

/** The Write form's fields, kept across a top-up so you come back to what you typed. */
export interface CreateDraft {
  kind: Kind;
  underlying: string;
  quote: string;
  size: string;
  strike: string;
  count: string;
  preset: Preset;
  expiry: string;
}

function CreateForm({
  board,
  draft,
  blocked,
  busy,
  onSubmit,
  onTopUp,
}: {
  board: Board;
  draft?: CreateDraft;
  blocked: string | null;
  busy: boolean;
  onSubmit: (call: Call) => void;
  onTopUp: (token: string, amount: bigint, draft: CreateDraft) => void;
}) {
  const allowed = board.allowed.map((a) => a.token_id);
  const nowMs = useChainSecond();
  const [kind, setKind] = useState<Kind>(draft?.kind ?? "call");
  const [underlying, setUnderlying] = useState(draft?.underlying ?? allowed[0] ?? "");
  const [quote, setQuote] = useState(draft?.quote ?? allowed[1] ?? "");
  const [size, setSize] = useState(draft?.size ?? "1");
  const [strike, setStrike] = useState(draft?.strike ?? "");
  const [typed, setTyped] = useState(draft?.count ?? "1");
  const [preset, setPreset] = useState<Preset>(draft?.preset ?? "1w");
  const [expiry, setExpiry] = useState(() => draft?.expiry ?? asField(chainNow() + 7 * DAY));

  const u = board.tokens[underlying];
  const q = board.tokens[quote];
  const sizeUnits = u?.decimals != null ? parse(size, u.decimals) : null;
  const strikeUnits = q?.decimals != null ? parse(strike, q.decimals) : null;
  const options = wholeCount(typed);
  const expiryMs = expiry ? Date.parse(`${expiry}:00Z`) : NaN;
  const ahead = expiryMs - nowMs;
  const collateralToken = kind === "call" ? underlying : quote;
  const perOption = kind === "call" ? sizeUnits : strikeUnits;
  const amount = options && perOption ? options * perOption : null;
  const collateral = board.tokens[collateralToken];
  const minimum = BigInt(board.allowed.find((a) => a.token_id === collateralToken)?.min_amount ?? "0");
  const balance = board.viewer ? (board.viewer.inIntents[collateralToken] ?? 0n) : null;
  const fmt = (raw: bigint) => `${units(raw, collateral).short} ${collateral?.symbol ?? ""}`.trim();

  const sizeBad = size.trim() !== "" && !(sizeUnits && sizeUnits > 0n);
  const strikeBad = strike.trim() !== "" && !(strikeUnits && strikeUnits > 0n);
  const expiryBad = !Number.isFinite(expiryMs) || ahead < SOONEST || ahead > LATEST;
  // The first thing the contract would refuse, in its own order (actions.rs on_create), then the balance.
  const reason =
    underlying === quote
      ? "Underlying and quote must be different tokens."
      : !(sizeUnits && sizeUnits > 0n)
        ? `Set the size per option in ${u?.symbol ?? "the underlying"}${sizeBad ? `, up to ${u?.decimals ?? 0} decimals` : ""}.`
        : !(strikeUnits && strikeUnits > 0n)
          ? `Set the strike per option in ${q?.symbol ?? "the quote token"}${strikeBad ? `, up to ${q?.decimals ?? 0} decimals` : ""}.`
          : countProblem(typed)
            ? countProblem(typed)
            : expiryBad
              ? "Expiry must be 2 minutes to 366 days away."
              : amount !== null && amount < minimum
                ? `The contract's minimum for ${collateral?.symbol ?? "this"} collateral is ${fmt(minimum)}.`
                : null;
  // A short balance is a gap to fill (a top-up beside the form), not a fault in any field.
  const gap = reason === null && amount !== null && balance !== null && amount > balance ? amount - balance : null;

  const call =
    reason === null && gap === null && amount && sizeUnits && strikeUnits
      ? viaIntents(collateralToken, amount, {
          action: "create",
          kind,
          underlying,
          quote,
          underlying_per_option: sizeUnits.toString(),
          strike_per_option: strikeUnits.toString(),
          expiry_ns: (BigInt(expiryMs) * 1_000_000n).toString(),
        })
      : null;

  const choose = (value: Preset) => {
    setPreset(value);
    const picked = PRESETS.find((p) => p.value === value);
    if (picked) setExpiry(asField(chainNow() + picked.ms));
  };

  const tokenOptions = allowed.map((t) => (
    <option key={t} value={t}>
      {board.tokens[t]?.symbol ?? t}
    </option>
  ));
  const unit = (symbol: string | undefined, fallback: string) => <span className="normal-case tracking-normal">({symbol ?? fallback})</span>;

  return (
    <form
      className="grid grid-cols-2 gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (call) onSubmit(call);
      }}
    >
      <Choice
        name="Kind"
        className="col-span-2"
        value={kind}
        onChange={setKind}
        options={[
          { value: "call", label: "Call" },
          { value: "put", label: "Put" },
        ]}
      />
      <Field label="Underlying">
        <select className={inputClass} value={underlying} onChange={(e) => setUnderlying(e.target.value)} aria-invalid={underlying === quote}>
          {tokenOptions}
        </select>
      </Field>
      <Field label="Quote">
        <select className={inputClass} value={quote} onChange={(e) => setQuote(e.target.value)} aria-invalid={underlying === quote}>
          {tokenOptions}
        </select>
      </Field>
      <Field label={<>Size per option {unit(u?.symbol, "underlying")}</>}>
        <input className={inputClass} inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value)} aria-invalid={sizeBad} />
      </Field>
      <Field label={<>Strike per option {unit(q?.symbol, "quote")}</>}>
        <input className={inputClass} inputMode="decimal" placeholder="0.00" value={strike} onChange={(e) => setStrike(e.target.value)} aria-invalid={strikeBad} />
      </Field>
      <Field label="Options" className="col-span-2 sm:col-span-1">
        <input className={inputClass} inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} aria-invalid={typed.trim() !== "" && countProblem(typed) !== null} />
      </Field>

      <div className="col-span-2 flex flex-col gap-3 rounded-2xl bg-bed p-4">
        <p className="plate-label text-label text-iron-2" id="expiry-label">
          Expiry · UTC · the time lock
        </p>
        <Choice name="Expiry" grid value={preset} onChange={choose} options={PRESETS.map(({ value, label }) => ({ value, label }))} />
        <input
          className={inputClass}
          type="datetime-local"
          aria-labelledby="expiry-label"
          aria-describedby="expiry-readout"
          aria-invalid={expiryBad}
          min={asField(nowMs + SOONEST)}
          max={asField(nowMs + LATEST - 60_000)}
          value={expiry}
          onChange={(e) => {
            setExpiry(e.target.value);
            setPreset("exact");
          }}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <p id="expiry-readout" className="text-meta text-iron-2">
            {Number.isFinite(expiryMs) ? (
              <>
                Opens <span className="fig text-iron">{utc((BigInt(expiryMs) * 1_000_000n).toString())}</span>
                {ahead > 0 && (
                  <>
                    , in <span className="fig">{countdown(ahead)}</span>
                  </>
                )}
                . The dial shows where it lands among the locks running now.
              </>
            ) : (
              "Pick a preset or an exact time."
            )}
          </p>
          <DialPreview board={board} nowMs={nowMs} opensAt={expiryBad ? null : expiryMs} />
        </div>
      </div>

      <div className="col-span-2 flex flex-col gap-1.5 text-ui">
        <p className="text-iron-2">
          {amount ? (
            <>
              Locks <Amount raw={amount} token={collateral} /> inside Intents until expiry. Nothing can release it early except
              closing with your own longs.
            </>
          ) : (
            "Collateral is computed from the size, strike and count."
          )}
        </p>
        {balance !== null && (
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-meta text-iron-2">
            <span>Your Intents balance</span>
            <Amount raw={balance} token={collateral} roll className="text-iron" />
          </p>
        )}
      </div>
      {gap !== null && amount !== null && balance !== null && (
        <div className="col-span-2 flex flex-col items-start gap-2.5 rounded-xl bg-bed px-3.5 py-3 text-ui">
          <p>
            This locks <span className="fig">{fmt(amount)}</span>; your Intents balance is <span className="fig">{fmt(balance)}</span>.
          </p>
          <button
            type="button"
            className="plate-label inline-flex h-10 items-center rounded-full bg-iron px-4 text-meta text-board transition-[translate] duration-150 active:translate-y-px"
            onClick={() => onTopUp(collateralToken, gap, { kind, underlying, quote, size, strike, count: typed, preset, expiry })}
          >
            Deposit <span className="fig ml-1.5">{units(gap, collateral).short}</span>
            <span className="ml-1 normal-case tracking-normal">{collateral?.symbol}</span>
            <span aria-hidden="true">&nbsp;→</span>
          </button>
        </div>
      )}
      <div className="col-span-2">
        <Submit blocked={blocked ?? reason} invalid={call === null} busy={busy} tone="lock" review={call && <Review calls={[call]} tokens={board.tokens} />}>
          {call && amount ? (
            <>
              Lock <Sum raw={amount} token={collateral} /> until {utcShort((BigInt(expiryMs) * 1_000_000n).toString())}
            </>
          ) : (
            "Lock collateral · write series"
          )}
        </Submit>
      </div>
    </form>
  );
}
