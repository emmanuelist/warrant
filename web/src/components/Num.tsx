import NumberFlow, { type Format, NumberFlowGroup } from "@number-flow/react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import type { Token } from "../lib/chain";
import { useChainSecond } from "../lib/clock";
import { units } from "../lib/format";

/** Same display rule as `units`: 2 to 6 fraction digits, truncated (never rounded up), grouped. */
/** Readers who asked for less motion get the chain's value at once, not a count up from zero. */
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const AMOUNT: Format = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
  roundingMode: "trunc",
  useGrouping: true,
};

/**
 * A chain figure that rolls to its new value when the chain changes it (NumberFlow), so a
 * deposit, an exercise or a release is seen arriving, not just replaced. `rollIn` counts up from
 * zero on first paint, after `delay` ms. The exact decimal goes in as a string: no float ever
 * touches the amount.
 */
export function Figure({
  raw,
  token,
  className,
  rollIn = false,
  delay = 0,
}: {
  raw: bigint | string;
  token: Token | undefined;
  className?: string;
  rollIn?: boolean;
  delay?: number;
}) {
  const value = units(raw, token);
  const decimal = value.full.replace(/,/g, "");
  const [shown, setShown] = useState(() => (rollIn && !reducedMotion() ? "0" : decimal));
  const rolled = useRef(!rollIn || reducedMotion());
  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        rolled.current = true;
        setShown(decimal);
      },
      rolled.current ? 0 : delay,
    );
    return () => window.clearTimeout(timer);
  }, [decimal, delay]);
  if (token?.decimals == null) return <span className={className}>{value.short}</span>;
  const truncated = (decimal.split(".")[1] ?? "").replace(/0+$/, "").length > 6;
  return (
    <NumberFlow
      className={className}
      value={shown as `${number}`}
      locales="en-US"
      format={AMOUNT}
      suffix={truncated ? "…" : undefined}
      title={`${value.full} ${token.symbol}`}
    />
  );
}

const pad: Format = { minimumIntegerDigits: 2, useGrouping: false };

/** Time left until `toNs`, by chain clock, with each digit spinning down as it ticks. */
export function Clock({ toNs, className }: { toNs: string; className?: string }) {
  const nowMs = useChainSecond();
  const end = Number(BigInt(toNs) / 1_000_000n);
  const total = Math.max(0, Math.floor((end - nowMs) / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  // Read as words ("6 days, 23 hours, 8 minutes"), not as the rolling digits' parts.
  const spoken = [days > 0 && `${days} day${days === 1 ? "" : "s"}`, `${hours} hour${hours === 1 ? "" : "s"}`, `${minutes} minute${minutes === 1 ? "" : "s"}`]
    .filter(Boolean)
    .join(", ");
  return (
    <time className={clsx("fig whitespace-nowrap", className)} dateTime={new Date(end).toISOString()}>
      <span className="sr-only">{spoken}</span>
      <span aria-hidden="true">
        <NumberFlowGroup>
          {days > 0 && (
            <>
              <NumberFlow value={days} trend={-1} locales="en-US" />d{" "}
            </>
          )}
          <NumberFlow value={hours} format={pad} trend={-1} locales="en-US" />:
          <NumberFlow value={minutes} format={pad} trend={-1} locales="en-US" />:
          <NumberFlow value={total % 60} format={pad} trend={-1} locales="en-US" />
        </NumberFlowGroup>
      </span>
    </time>
  );
}
