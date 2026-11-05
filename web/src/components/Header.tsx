import clsx from "clsx";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { config } from "../lib/config";
import { disconnectEvm, isEvmAccount } from "../lib/evm";
import { account } from "../lib/format";
import { follow, href, type View } from "../lib/route";
import { disconnect, signer } from "../lib/wallet";
import { Mark } from "./Mark";

const navLink = "border-b-2 py-1 transition-colors duration-150 hover:text-panel-ink";
/** The connect menu's content loads on first use (the pointer reaching the button fetches it early). */
const loadConnect = () => import("./Connect");
const ConnectOptions = lazy(() => loadConnect().then((m) => ({ default: m.ConnectOptions })));
/** The connect menu's width (20rem) and the page gutter it keeps from the viewport's edge. */
const MENU_WIDTH_PX = 320;
const GUTTER_PX = 16;

export function Header({
  view,
  viewer,
  onViewer,
  suggestions,
  onWrite,
}: {
  view: View;
  viewer: string | null;
  onViewer: (account: string | null) => void;
  suggestions: string[];
  onWrite: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <a href={href("board")} onClick={follow} className="flex items-center gap-2" aria-label="Warrant, the board">
          <Mark className="h-7 w-6 text-panel-ink" />
          <span className="display text-[1.2rem] leading-none tracking-[0.16em] text-panel-ink [font-variation-settings:'wdth'_125,'wght'_680]">WARRANT</span>
        </a>
        <nav aria-label="Views" className="flex items-center gap-5 text-ui text-panel-ink-2">
          <a
            className={clsx(navLink, view === "board" ? "border-panel-ink text-panel-ink" : "border-transparent")}
            href={href("board", {}, "board")}
            onClick={follow}
            aria-current={view === "board" ? "page" : undefined}
          >
            Board
          </a>
          <a
            className={clsx(navLink, view === "account" ? "border-panel-ink text-panel-ink" : "border-transparent")}
            href={href("account")}
            onClick={follow}
            aria-current={view === "account" ? "page" : undefined}
          >
            Account
          </a>
          <a className={clsx(navLink, "hidden border-transparent md:inline")} href={href("board", {}, "how")} onClick={follow}>
            How it works
          </a>
          <a className={clsx(navLink, "hidden border-transparent md:inline")} href={href("board", {}, "refusals")} onClick={follow}>
            Refusals
          </a>
        </nav>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="plate-label hidden h-8 items-center gap-2 rounded-full px-3 text-label text-panel-ink-2 shadow-[inset_0_0_0_1px_var(--color-panel-line)] sm:inline-flex"
          title={config.network === "mainnet" ? "Reading NEAR mainnet" : `Reading a local devnet: ${config.rpcUrl}`}
        >
          <span className={clsx("h-1.5 w-1.5 rounded-full", config.network === "mainnet" ? "bg-live" : "bg-release")} aria-hidden="true" />
          {config.network === "mainnet" ? "Mainnet" : "Local devnet"}
        </span>
        {signer === "wallet" ? <Wallet viewer={viewer} onViewer={onViewer} /> : <ViewAs viewer={viewer} onViewer={onViewer} suggestions={suggestions} />}
        <button
          type="button"
          onClick={onWrite}
          data-tone="lock"
          className="enamel plate-label h-9 rounded-full px-4 text-meta transition-[translate,background-color] duration-150 active:translate-y-px"
        >
          Write<span className="hidden sm:inline"> a series</span>
        </button>
      </div>
    </header>
  );
}

function Wallet({ viewer, onViewer }: { viewer: string | null; onViewer: (account: string | null) => void }) {
  const [open, setOpen] = useState(false);
  // Which edge of the button the menu hangs from: its right edge when the menu fits to the left of
  // it, else its left edge (a phone's header wraps, putting the button at the start of a row).
  const [place, setPlace] = useState<{ align: "left" | "right"; width: number }>({ align: "right", width: MENU_WIDTH_PX });
  const menu = useRef<HTMLDivElement>(null);

  // The menu closes on Escape and on a click outside it.
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  if (viewer) {
    const evm = isEvmAccount(viewer);
    return (
      <span className="flex items-center gap-2 text-ui">
        <a className="fig text-panel-ink underline decoration-panel-line underline-offset-4 hover:decoration-panel-ink" href={href("account")} onClick={follow} title="Your account">
          {account(viewer)}
        </a>
        {evm && (
          <span className="plate-label rounded-full px-1.5 py-0.5 text-micro text-panel-ink-2 shadow-[inset_0_0_0_1px_var(--color-panel-line)]" title="An EVM wallet: it signs messages, and Warrant's relayer sends them">
            EVM
          </span>
        )}
        <button
          type="button"
          className="text-panel-ink-2 underline decoration-panel-line underline-offset-4 hover:text-panel-ink"
          onClick={() => {
            if (evm) {
              disconnectEvm();
              onViewer(null);
            } else void disconnect().then(() => onViewer(null));
          }}
        >
          Disconnect
        </button>
      </span>
    );
  }
  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="connect-menu"
        className="plate-label h-9 rounded-full px-4 text-meta text-panel-ink shadow-[inset_0_0_0_1.5px_var(--color-panel-ink)] transition-colors duration-150 hover:bg-panel-raised"
        onPointerEnter={() => void loadConnect()}
        onFocus={() => void loadConnect()}
        onClick={(event) => {
          const { left, right } = event.currentTarget.getBoundingClientRect();
          setPlace(
            right >= MENU_WIDTH_PX + GUTTER_PX
              ? { align: "right", width: MENU_WIDTH_PX }
              : { align: "left", width: Math.min(MENU_WIDTH_PX, window.innerWidth - left - GUTTER_PX) },
          );
          setOpen((o) => !o);
        }}
      >
        Connect wallet
      </button>
      {open && (
        <div
          id="connect-menu"
          role="group"
          aria-label="Connect a wallet"
          style={{ width: place.width }}
          className={clsx(
            "absolute top-full z-30 mt-2 rounded-[18px] bg-card p-2 text-iron shadow-[var(--shadow-float)]",
            place.align === "right" ? "right-0" : "left-0",
          )}
        >
          <Suspense fallback={<p className="px-3 py-2 text-label text-iron-2">Finding wallets…</p>}>
            <ConnectOptions surface="menu" onViewer={onViewer} onDone={() => setOpen(false)} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

/** Devnet only: read (and, with the devnet signer, act) as any account (D-017; docs/DESIGN.md "Data truth"). */
function ViewAs({
  viewer,
  onViewer,
  suggestions,
}: {
  viewer: string | null;
  onViewer: (account: string | null) => void;
  suggestions: string[];
}) {
  const [draft, setDraft] = useState(viewer ?? "");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onViewer(draft.trim() || null);
      }}
    >
      <label className="plate-label hidden text-label text-panel-ink-3 sm:inline" htmlFor="view-as">
        {signer === "devnet" ? "Act as" : "View as"}
      </label>
      <input
        id="view-as"
        list="view-as-accounts"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="account"
        aria-label={signer === "devnet" ? "Act as account" : "View as account"}
        className="fig h-9 w-[10.5rem] rounded-full border border-panel-line bg-card px-3.5 sm:w-44 text-meta text-panel-ink outline-none placeholder:text-panel-ink-3 focus-visible:border-lock focus-visible:shadow-[0_0_0_3px_oklch(0.5_0.2_264/0.15)]"
      />
      <datalist id="view-as-accounts">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </form>
  );
}
