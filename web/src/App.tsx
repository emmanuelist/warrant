import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

import { Account, AccountHero } from "./components/Account";
import { ActionSheet, type SheetRequest } from "./components/ActionSheet";
import { Board } from "./components/Board";
import { DetailBench, DetailCard, DetailSheet } from "./components/Detail";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Mark } from "./components/Mark";
import { Dismiss, Wrap } from "./components/parts";
import { useChainNow } from "./lib/clock";
import { config } from "./lib/config";
import { isEvmAccount, watchEvm } from "./lib/evm";
import { account } from "./lib/format";
import { type ActionId, phase } from "./lib/interlock";
import { follow, setParams, useUrl, viewOf } from "./lib/route";
import { useBoard } from "./lib/useBoard";
import { ViewerContext } from "./lib/viewer";
import { signer, watchAccount } from "./lib/wallet";

const Refusals = lazy(() => import("./components/Refusals").then((m) => ({ default: m.Refusals })));
const LockStory = lazy(() => import("./components/LockStory").then((m) => ({ default: m.LockStory })));

const WIDE = "(min-width: 64rem)";

/** The devnet's seeded accounts (tests/devnet.rs), holders included; empty on mainnet. */
const devnetAccounts = ((import.meta.env.VITE_DEVNET_ACCOUNTS as string | undefined) ?? "").split(",").filter(Boolean);

function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE).matches,
  );
}

export function App() {
  const [viewer, setViewer] = useState<string | null>(() =>
    config.network === "sandbox" ? new URLSearchParams(window.location.search).get("as") : null,
  );
  const { state, reload } = useBoard(viewer);
  const board = state.status === "ready" ? state.board : null;
  const nowMs = useChainNow(board);
  const wide = useWide();
  const url = useUrl();
  const view = viewOf(url);
  const selected = url.searchParams.get("series");
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const [refused, setRefused] = useState<ActionId | null>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const detailScope = useRef<HTMLDivElement>(null);
  const deepLinked = useRef(false);

  useEffect(() => {
    if (signer !== "wallet") return;
    // One connection at a time (Connect.tsx): an empty answer from one kind of wallet leaves an
    // account of the other kind in place.
    void watchAccount((account) => setViewer((current) => account ?? (current && isEvmAccount(current) ? current : null)));
    return watchEvm((account) => setViewer((current) => account ?? (current && !isEvmAccount(current) ? current : null)));
  }, []);

  useEffect(() => {
    document.title = view === "account" ? "Account · Warrant" : selected ? `Series #${selected} · Warrant` : "Warrant";
  }, [view, selected]);

  // A shared `?series=` link opens that series once the board has loaded: its sheet on a phone; on a
  // wide screen the board scrolls into view, marked as the link's target so the lazy story above it
  // puts it back in view when it loads (settleHash).
  useEffect(() => {
    if (deepLinked.current || state.status !== "ready") return;
    deepLinked.current = true;
    if (view !== "board" || !selected || !state.board.series.some((s) => s.series_id === selected)) return;
    if (!wide) {
      detailDialog.current?.showModal();
    } else if (!window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#board`);
      document.getElementById("board")?.scrollIntoView();
    }
  }, [state, wide, view, selected]);

  useEffect(() => {
    if (config.network !== "sandbox") return;
    const url = new URL(window.location.href);
    if (viewer) url.searchParams.set("as", viewer);
    else url.searchParams.delete("as");
    window.history.replaceState(null, "", url);
  }, [viewer]);

  if (!config.optionsContract) {
    return (
      <Shell>
        <Problem title="Not configured" heading="No contract to read" detail="VITE_OPTIONS_CONTRACT is not set in this build." />
      </Shell>
    );
  }

  if (state.status === "loading") {
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  }

  if (state.status === "error") {
    return (
      <Shell>
        <Problem
          title="Can't read the chain"
          heading="The board is dark"
          detail={config.network === "mainnet" ? state.message : `${state.message} · ${config.rpcUrl}`}
          action={
            <button type="button" className="plate-label mt-8 h-10 rounded-full bg-panel-ink px-4 text-meta text-panel hover:bg-ink-hover" onClick={() => void reload()}>
              Try again
            </button>
          }
        />
      </Shell>
    );
  }

  // Right after the viewer changes, the last read still describes the previous account: show no
  // one's balances until the chain answers for the new one.
  const data = state.board.viewer && state.board.viewer.account !== viewer ? { ...state.board, viewer: null } : state.board;
  const fallback = data.series.find((s) => phase(s, nowMs) === "locked") ?? data.series[0];
  const current = data.series.find((s) => s.series_id === selected) ?? fallback;
  // Accounts to act as on the devnet: its seeded ones (holders included), then every writer and seller.
  const suggestions = [...new Set([...devnetAccounts, ...data.series.map((s) => s.writer), ...data.offers.map((o) => o.seller)])];

  const select = (seriesId: string) => {
    const update = () =>
      flushSync(() => {
        setParams({ series: seriesId });
        setRefused(null);
      });
    if (!wide) {
      update();
      detailDialog.current?.showModal();
      return;
    }
    // Scoped view transition where supported; otherwise an instant update (scoped-component-transitions).
    const scope = detailScope.current as (HTMLDivElement & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }) | null;
    if (scope && "startViewTransition" in Element.prototype && scope.startViewTransition) {
      scope.startViewTransition(update).ready.catch(() => {});
    } else {
      update();
    }
  };

  // A lock on the dial opens its series; on a wide screen the board glides into view beneath.
  const openFromDial = (seriesId: string) => {
    select(seriesId);
    if (wide) document.getElementById("board")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const detailProps = current
    ? {
        series: current,
        board: data,
        nowMs,
        viewer,
        refused,
        onSheet: (request: SheetRequest) => {
          setRefused(null);
          setSheet(request);
        },
      }
    : null;

  const boardView = (
    <>
      <Suspense fallback={null}>
        <Wrap>
          <LockStory />
        </Wrap>
      </Suspense>
      <Wrap>
        <main id="board" className="grid scroll-mt-24 gap-x-10 gap-y-8 pb-20 pt-14 xl:grid-cols-12">
          <h2 className="display text-display-3 xl:col-span-12">Every series, read from chain</h2>
          <section className="xl:col-span-7" aria-label="Series">
            <Board board={data} nowMs={nowMs} viewer={viewer} selected={current?.series_id ?? null} onSelect={select} onWrite={() => setSheet({ type: "create" })} />
          </section>
          {/* The card holds what you act on and stays pinned beside the list; the series' machinery
              (route, interlock, payoff) gets the full width below both. */}
          {wide && detailProps && (
            <>
              <aside className="xl:col-span-5" aria-label={`Series ${detailProps.series.series_id}`}>
                <div ref={detailScope} className="xl:sticky xl:top-20">
                  <DetailCard key={detailProps.series.series_id} {...detailProps} />
                </div>
              </aside>
              <div className="xl:col-span-12">
                <DetailBench key={detailProps.series.series_id} {...detailProps} />
              </div>
            </>
          )}
        </main>
      </Wrap>
      <Suspense fallback={null}>
        <Refusals board={data} nowMs={nowMs} viewer={viewer} onSheet={setSheet} />
      </Suspense>
      {!wide && (
        <dialog ref={detailDialog} className="sheet" aria-label={current ? `Series ${current.series_id}` : "Series"}>
          <div className="flex justify-end border-b border-rule px-5 py-2">
            <Dismiss onClick={() => detailDialog.current?.close()} />
          </div>
          <div className="px-5 pt-5">{detailProps && <DetailSheet key={detailProps.series.series_id} {...detailProps} />}</div>
        </dialog>
      )}
    </>
  );

  return (
    <ViewerContext value={viewer}>
      <Shell>
        <a href={view === "account" ? "#account" : "#board"} onClick={follow} className="skip-link">
          Skip to {view === "account" ? "your account" : "the board"}
        </a>
        <div className="site-head">
          <Wrap>
            <Header view={view} viewer={viewer} onViewer={setViewer} suggestions={suggestions} onWrite={() => setSheet({ type: "create" })} />
          </Wrap>
        </div>
        <div className="panel stage">
          <Wrap>
            {view === "account" ? <AccountHero board={data} viewer={viewer} onSheet={setSheet} /> : <Hero board={data} nowMs={nowMs} onSelect={openFromDial} />}
            {config.network === "sandbox" && (
              <aside aria-label="Network" className="mx-auto w-fit max-w-full pb-10 text-center text-meta text-panel-ink-3">
                <span className="block max-w-[64ch]">
                  Local devnet running byte-identical mainnet NEAR Intents. Every figure is read from chain.{" "}
                  {signer === "devnet" ? (
                    viewer ? (
                      <>
                        Acting as{" "}
                        <span className="fig text-panel-ink" title={viewer}>
                          {account(viewer)}
                        </span>
                        {isEvmAccount(viewer)
                          ? ": the devnet test wallet signs its intents, and the dev server's relayer sends them for real on this chain."
                          : ": transactions are signed with the sandbox's public genesis key and executed for real on this chain."}
                      </>
                    ) : (
                      "Choose an account under “Act as” to send transactions; they're signed with the sandbox's public genesis key."
                    )
                  ) : (
                    <>
                      Signing is enabled on mainnet.
                      {viewer && (
                        <>
                          {" "}Viewing as{" "}
                          <span className="fig text-panel-ink" title={viewer}>
                            {account(viewer)}
                          </span>{" "}
                          (read-only).
                        </>
                      )}
                    </>
                  )}
                </span>
              </aside>
            )}
          </Wrap>
        </div>
        {view === "account" ? (
          <Wrap>
            <Account board={data} nowMs={nowMs} viewer={viewer} suggestions={suggestions} onViewer={setViewer} onSheet={setSheet} />
          </Wrap>
        ) : (
          boardView
        )}
        <Footer />
        <ActionSheet
          request={sheet}
          board={data}
          viewer={viewer}
          suggestions={suggestions}
          onViewer={setViewer}
          onOpen={setSheet}
          onClose={() => setSheet(null)}
          onSettled={(lever) => {
            setRefused(lever);
            void reload();
          }}
        />
      </Shell>
    </ViewerContext>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div id="top" className="flex min-h-dvh flex-col">
      {children}
    </div>
  );
}

function BrandBar() {
  return (
    <div className="flex items-center gap-2 border-b border-panel-line py-3.5">
      <Mark className="h-7 w-6 text-panel-ink" />
      <span className="display text-[1.6rem] leading-none tracking-[-0.03em] text-panel-ink">WARRANT</span>
    </div>
  );
}

function Problem({ title, heading, detail, action }: { title: string; heading: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="panel flex-1">
      <Wrap>
        <BrandBar />
        <div className="grid gap-10 py-20 lg:grid-cols-12" role="alert">
          <div className="lg:col-span-7">
            <h1 className="display text-display-1">{heading}</h1>
            <p className="mt-6 max-w-[52ch] text-lead text-panel-ink-2">
              {title}. Every figure on this board is read from chain, so none are shown until the chain answers. Nothing is guessed or
              cached.
            </p>
            {action}
          </div>
          <div className="lg:col-span-5 lg:border-l lg:border-panel-line lg:pl-8">
            <p className="plate-label text-label text-panel-ink-3">What the chain said</p>
            <p className="fig mt-2 break-words text-ui text-panel-ink">{detail}</p>
          </div>
        </div>
      </Wrap>
    </div>
  );
}

function Loading() {
  return (
    <div className="panel flex-1">
      <Wrap>
        <BrandBar />
        <div className="py-14" aria-busy="true">
          <p className="sr-only" role="status">
            Reading the chain
          </p>
          <div className="h-[clamp(5rem,12vw,11rem)] w-3/4 animate-pulse rounded-2xl bg-panel-raised motion-reduce:animate-none" />
          <div className="mt-14 grid grid-cols-[1fr_2fr_1fr] gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-panel-raised motion-reduce:animate-none" />
            ))}
          </div>
        </div>
      </Wrap>
    </div>
  );
}
