import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

/** Two views and a few query parameters; small enough not to need a router library. */
export type View = "board" | "account";

const BASE = import.meta.env.BASE_URL;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

window.addEventListener("popstate", notify);

// Whether the reader has scrolled or keyed since the page was sent to a #target (settleHash).
let moved = false;
for (const type of ["wheel", "touchmove", "keydown"] as const) {
  window.addEventListener(type, () => (moved = true), { passive: true });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUrl(): URL {
  const href = useSyncExternalStore(subscribe, () => window.location.href);
  return new URL(href);
}

export function viewOf(url: URL): View {
  return url.pathname.replace(BASE, "/").replace(/\/+$/, "") === "/account" ? "account" : "board";
}

export function href(view: View, params: Record<string, string> = {}, hash = ""): string {
  const url = new URL(view === "account" ? `${BASE}account` : BASE, window.location.origin);
  const as = new URLSearchParams(window.location.search).get("as");
  if (as) url.searchParams.set("as", as);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.hash = hash;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Moves focus to the new view (or the linked section) so keyboard and screen-reader users land in it. */
function focusView(hash: string): void {
  const target = (hash ? document.getElementById(hash) : null) ?? document.querySelector<HTMLElement>("main");
  if (!target) return;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}

/**
 * A lazy section above a link's #target (the story) loads after the page was scrolled to it and
 * pushes it down. Each such section calls this as it mounts, to put the target back in view,
 * unless the reader has moved on since.
 */
export function settleHash(): void {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (id && !moved) document.getElementById(id)?.scrollIntoView();
}

/** Same-document navigation; a root view transition where supported (same-document-transitions). */
export function navigate(to: string): void {
  moved = false;
  const hash = new URL(to, window.location.origin).hash.slice(1);
  const go = () => {
    flushSync(() => {
      window.history.pushState(null, "", to);
      notify();
    });
    const element = hash ? document.getElementById(hash) : null;
    if (element) element.scrollIntoView();
    else window.scrollTo(0, 0);
  };
  if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(go).finished.finally(() => focusView(hash));
  } else {
    go();
    focusView(hash);
  }
}

/** Updates query parameters in place (no history entry), e.g. the selected series. */
export function setParams(params: Record<string, string | null>): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState(null, "", url);
  notify();
}

/** For `<a href>` clicks: plain left clicks stay in the app; modified clicks open as usual. */
export function follow(event: React.MouseEvent<HTMLAnchorElement>): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const to = event.currentTarget.getAttribute("href");
  if (!to || event.currentTarget.target === "_blank") return;
  const url = new URL(to, window.location.href);
  if (url.origin !== window.location.origin) return;
  event.preventDefault();
  if (url.pathname === window.location.pathname && url.hash) {
    moved = false;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    window.history.pushState(null, "", url);
    focusView(url.hash.slice(1));
    return;
  }
  navigate(`${url.pathname}${url.search}${url.hash}`);
}
