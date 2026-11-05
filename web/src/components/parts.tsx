import { ArrowUpRightIcon, XIcon } from "@phosphor-icons/react";
import clsx from "clsx";

import type { Kind, Token } from "../lib/chain";
import { useChainSecond } from "../lib/clock";
import { countdown, units } from "../lib/format";
import type { Phase } from "../lib/interlock";
import { Figure } from "./Num";

export function Amount({
  raw,
  token,
  className,
  unit = true,
  roll = false,
}: {
  raw: bigint | string;
  token: Token | undefined;
  className?: string;
  unit?: boolean;
  /** Roll to each new value (NumberFlow), for balances a transaction moves while you watch. */
  roll?: boolean;
}) {
  const value = units(raw, token);
  return (
    <span className={clsx("whitespace-nowrap", className)} title={`${value.full} ${token?.symbol ?? ""}`.trim()}>
      {roll ? <Figure raw={raw} token={token} className="fig" /> : <span className="fig">{value.short}</span>}
      {unit && <span className="ml-1 text-iron-2">{token?.symbol ?? "units"}</span>}
    </span>
  );
}

/** Time left until `toNs` by chain clock; the only part of a row that re-renders each second. */
export function Countdown({ toNs, className }: { toNs: string; className?: string }) {
  const remaining = Number(BigInt(toNs) / 1_000_000n) - useChainSecond();
  return (
    <time className={clsx("fig", className)} dateTime={new Date(Number(BigInt(toNs) / 1_000_000n)).toISOString()}>
      {countdown(remaining)}
    </time>
  );
}

export function KindPlate({ kind, onPanel = false }: { kind: Kind; onPanel?: boolean }) {
  const filled = onPanel ? "bg-panel-ink text-panel" : "bg-iron text-board";
  const outlined = onPanel ? "text-panel-ink shadow-[inset_0_0_0_1.5px_var(--color-panel-ink)]" : "text-iron shadow-[inset_0_0_0_1.5px_var(--color-iron)]";
  return (
    <span className={clsx("plate-label inline-flex h-5 items-center rounded-md px-1.5 text-label", kind === "call" ? filled : outlined)}>
      {kind}
    </span>
  );
}

const PHASE: Record<Phase, { label: string; className: string }> = {
  locked: { label: "Locked", className: "bg-lock text-board" },
  released: { label: "Released", className: "bg-release text-iron" },
  reclaimed: { label: "Reclaimed", className: "text-iron-2 shadow-[inset_0_0_0_1px_var(--color-rule)]" },
};

/** A series' phase as a lamp: lock blue while collateral is locked, caution yellow once released. */
export function PhaseLamp({ phase }: { phase: Phase }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "h-2.5 w-2.5 shrink-0 rounded-full",
        phase === "locked" ? "bg-lock" : phase === "released" ? "bg-release" : "bg-board shadow-[inset_0_0_0_1px_var(--color-iron-2)]",
      )}
    />
  );
}

export function PhaseChip({ phase }: { phase: Phase }) {
  const { label, className } = PHASE[phase];
  return <span className={clsx("plate-label inline-flex h-5 items-center rounded-md px-1.5 text-label", className)}>{label}</span>;
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("plate-label text-label text-iron-2", className)}>{children}</div>;
}

/** The page measure, inside full-bleed bands (the control panel, the board, the footer). */
export function Wrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("mx-auto w-full max-w-[90rem] px-[max(1rem,16px)] sm:px-8", className)}>{children}</div>;
}

/** A sheet's dismiss control: an icon, so it never reads as the Close lever beside it; 44px to hit. */
export function Dismiss({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss"
      title="Dismiss"
      className="-my-2 -mr-3 grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full text-iron-2 transition-colors duration-150 hover:bg-bed hover:text-iron"
    >
      <XIcon size={18} weight="bold" aria-hidden="true" />
    </button>
  );
}

/** Marks a link that opens an explorer in a new tab. */
export function Out() {
  return (
    <>
      <ArrowUpRightIcon weight="bold" size="0.85em" className="ml-0.5 inline-block align-[-0.04em]" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </>
  );
}
