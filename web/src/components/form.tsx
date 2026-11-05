import clsx from "clsx";
import { type ReactNode, useId } from "react";

import type { Token } from "../lib/chain";
import { units } from "../lib/format";
import type { Tone } from "../lib/interlock";
import { Label } from "./parts";

export const inputClass =
  "fig h-11 w-full min-w-0 rounded-xl border border-rule bg-board px-3 text-body outline-none focus-visible:border-iron focus-visible:shadow-[0_0_0_1px_var(--color-iron)] aria-[invalid=true]:border-refuse";

export function Field({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={clsx("flex min-w-0 flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <span className="text-meta text-iron-2">{hint}</span>}
    </label>
  );
}

/**
 * A count of whole options, with what bounds it (held, left in the offer, what a balance covers)
 * and a Max that fills it. Its error is tied to the input, so it's read with it.
 */
export function CountField({
  label,
  value,
  onChange,
  max,
  bound,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The largest count that would go through, if known. */
  max: bigint | null;
  /** What sets `max`, e.g. "you hold 7". */
  bound: string | null;
  error: string | null;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="plate-label text-label text-iron-2">
          {label}
        </label>
        {bound && (
          <span className="flex items-baseline gap-2 text-meta text-iron-2">
            {bound}
            {max !== null && max > 0n && (
              <button
                type="button"
                className="plate-label text-label text-iron underline decoration-rule underline-offset-4 hover:decoration-iron"
                onClick={() => onChange(max.toString())}
              >
                Max
              </button>
            )}
          </span>
        )}
      </div>
      <input
        id={id}
        className={inputClass}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error !== null}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="text-meta text-refuse">
          {error}
        </p>
      )}
    </div>
  );
}

/** An amount input with the balance it draws from and a Max that fills it exactly. */
export function AmountField({
  label,
  unit,
  value,
  onChange,
  balance,
  token,
  invalid,
  balanceLabel = "available",
}: {
  label: string;
  /** Shown in its own casing after the uppercase label: "AMOUNT (wNEAR)". */
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  balance: bigint | null;
  token: Token | undefined;
  invalid?: boolean;
  balanceLabel?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label>
          {label}
          {unit && <span className="normal-case tracking-normal"> ({unit})</span>}
        </Label>
        {balance !== null && (
          <button
            type="button"
            className="fig text-meta text-iron-2 underline decoration-rule underline-offset-4 hover:text-iron hover:decoration-iron"
            onClick={() => onChange(units(balance, token).full.replace(/,/g, ""))}
            title={`Use all ${units(balance, token).full} ${token?.symbol ?? ""}`}
          >
            {units(balance, token).short} {balanceLabel} · max
          </button>
        )}
      </div>
      <input
        className={inputClass}
        inputMode="decimal"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-label={unit ? `${label} (${unit})` : label}
      />
    </div>
  );
}

/** A few exclusive choices as plates (the call/put control's language); `grid` sets four as 2×2 on a phone. */
export function Choice<T extends string>({
  name,
  value,
  options,
  onChange,
  className,
  grid = false,
}: {
  name: string;
  value: T;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  onChange: (value: T) => void;
  className?: string;
  grid?: boolean;
}) {
  return (
    <fieldset className={clsx(grid ? "grid grid-cols-2 gap-2 sm:grid-cols-4" : "flex gap-2", className)}>
      <legend className="sr-only">{name}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={clsx(
            "plate-label flex min-h-10 flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-full px-2 py-1.5 text-center text-meta leading-tight shadow-[inset_0_0_0_1.5px_var(--color-iron)] transition-colors duration-150 has-[:checked]:bg-iron has-[:checked]:text-board has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-iron",
            option.disabled && "cursor-not-allowed opacity-45",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * The sheet's one action. `blocked` says why it can't be sent (shown under it); `invalid` disables
 * it silently when a field already shows its own error.
 */
export function Submit({
  blocked,
  invalid = false,
  busy,
  children,
  review,
  tone = "iron",
}: {
  blocked: string | null;
  invalid?: boolean;
  busy: boolean;
  children: ReactNode;
  review?: ReactNode;
  /** The enamel of what the action does (D-032): iron for trades and transfers. */
  tone?: Tone | "refuse";
}) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {review}
      <button
        type="submit"
        disabled={blocked !== null || invalid || busy}
        data-tone={tone}
        className="enamel plate-label h-11 rounded-full px-5 text-ui transition-[opacity,translate,background-color] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Sending…" : children}
      </button>
      {blocked && <p className="text-meta text-iron-2">{blocked}</p>}
    </div>
  );
}

/** Whole options: a positive integer, or null. */
export function wholeCount(text: string): bigint | null {
  return /^\d+$/.test(text.trim()) && BigInt(text.trim()) > 0n ? BigInt(text.trim()) : null;
}

/** Why a typed count isn't a whole number of options, or null if it is one. */
export function countProblem(text: string): string | null {
  const t = text.trim();
  if (t === "") return "Enter how many options.";
  if (/^\d+$/.test(t)) return BigInt(t) > 0n ? null : "At least 1 option.";
  return /^\d*[.,]\d*$/.test(t) ? "Whole options only: 1, 2, 3…" : "A whole number of options, like 3.";
}

/** A NEAR account ID per the protocol's rules (2–64 chars, lowercase parts joined by dots). */
export function isAccountId(text: string): boolean {
  return text.length >= 2 && text.length <= 64 && /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(text);
}
