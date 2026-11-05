import { useSyncExternalStore } from "react";

import type { TransferStatus } from "./oneclick";

/**
 * Cross-chain transfers started in this browser, so the account page can keep tracking them after
 * the sheet closes. Only the deposit address, labels and the times each status was first seen are
 * kept; status itself is always read live from 1Click. A per-viewer convenience: losing it loses
 * nothing on chain.
 */
export interface Transfer {
  depositAddress: string;
  account: string;
  direction: "in" | "out";
  /** e.g. "25.00 USDC · Base" */
  from: string;
  /** e.g. "≈ 24.99 USDC · NEAR Intents" */
  to: string;
  /** The chain on the far side, for step names ("Delivered on Base"). */
  chain: string;
  createdAt: number;
  /** When the quote lapses (ISO); a deposit should land before it. */
  validUntil: string;
  /** 1Click's estimate, in seconds, once the deposit is seen. */
  timeEstimate: number;
  /** 1Click's `updatedAt` for each status, recorded when this browser first saw it. */
  steps: Partial<Record<TransferStatus, string>>;
}

const KEY = "warrant.transfers.v2";
const listeners = new Set<() => void>();
let cache: Transfer[] | null = null;

function read(): Transfer[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed) ? (parsed as Transfer[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: Transfer[]): void {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private window): tracking still works until the page closes.
  }
  for (const listener of listeners) listener();
}

export function remember(transfer: Omit<Transfer, "createdAt" | "steps">): void {
  const entry: Transfer = { ...transfer, createdAt: Date.now(), steps: {} };
  write([entry, ...read().filter((t) => t.depositAddress !== transfer.depositAddress)].slice(0, 20));
}

/** Records when a status was first seen; later sightings keep the first time. */
export function markStep(depositAddress: string, status: TransferStatus, at: string): void {
  const all = read();
  const target = all.find((t) => t.depositAddress === depositAddress);
  if (!target || target.steps[status]) return;
  write(all.map((t) => (t === target ? { ...t, steps: { ...t.steps, [status]: at } } : t)));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTransfers(account: string | null): Transfer[] {
  const all = useSyncExternalStore(subscribe, read);
  return account ? all.filter((t) => t.account === account) : [];
}

export function useTransfer(depositAddress: string): Transfer | undefined {
  const all = useSyncExternalStore(subscribe, read);
  return all.find((t) => t.depositAddress === depositAddress);
}
