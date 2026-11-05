import { useEffect, useSyncExternalStore } from "react";

import type { Board } from "./chain";

/**
 * The chain's clock in the browser: the last final block's timestamp plus local time elapsed since
 * it was read. Read two ways, so the app doesn't re-render every second:
 * - `useChainSecond` ticks once a second, for the few components that show a running clock;
 * - `useChainNow` moves on each chain read and exactly at the next expiry, for state (which series
 *   are past expiry, where a lock sits on the dial).
 */
let base = { chainMs: 0, at: 0 };
let second = 0;
let coarse = 0;
const tickers = new Set<() => void>();
const readers = new Set<() => void>();
let timer = 0;

const now = () => base.chainMs + (performance.now() - base.at);

function publish() {
  coarse = now();
  for (const listener of readers) listener();
}

/** Called with every chain read (useBoard). */
export function syncChainClock(chainMs: number, at: number): void {
  base = { chainMs, at };
  second = Math.floor(now() / 1000);
  publish();
}

/** Chain time right now, for a value computed on demand (an expiry preset), never during render. */
export function chainNow(): number {
  return now();
}

function subscribeSecond(listener: () => void) {
  tickers.add(listener);
  if (tickers.size === 1) {
    timer = window.setInterval(() => {
      second = Math.floor(now() / 1000);
      for (const ticker of tickers) ticker();
    }, 1000);
  }
  return () => {
    tickers.delete(listener);
    if (tickers.size === 0) window.clearInterval(timer);
  };
}

function subscribeReads(listener: () => void) {
  readers.add(listener);
  return () => readers.delete(listener);
}

/** Chain time to the second, in ms; re-renders its caller once a second. */
export function useChainSecond(): number {
  return useSyncExternalStore(subscribeSecond, () => second) * 1000;
}

/** Chain time for state: moves on every chain read and at the next expiry between reads. */
export function useChainNow(board: Board | null): number {
  const value = useSyncExternalStore(subscribeReads, () => coarse);
  useEffect(() => {
    if (!board) return;
    const upcoming = board.series.map((s) => Number(BigInt(s.expiry_ns) / 1_000_000n)).filter((t) => t > value);
    if (upcoming.length === 0) return;
    // setTimeout's ceiling is ~24.8 days; a later expiry is picked up by a later chain read.
    const id = window.setTimeout(publish, Math.min(Math.min(...upcoming) - value + 25, 2_147_000_000));
    return () => window.clearTimeout(id);
  }, [board, value]);
  return value;
}
