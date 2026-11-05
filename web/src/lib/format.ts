import type { Token } from "./chain";

const MAX_FRACTION = 6;
const MIN_FRACTION = 2;

/**
 * Base units to a display string: grouped digits, at least 2 and at most 6 fraction digits
 * (docs/DESIGN.md "States: long numbers"). `full` keeps every digit for title/aria.
 */
export function units(raw: bigint | string, token: Token | undefined): { short: string; full: string } {
  const value = typeof raw === "bigint" ? raw : BigInt(raw);
  const decimals = token?.decimals;
  if (decimals === null || decimals === undefined) {
    const plain = group(value.toString());
    return { short: plain, full: `${plain} base units` };
  }
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = group((abs / base).toString());
  const fraction = (abs % base).toString().padStart(decimals, "0");
  const trimmed = fraction.replace(/0+$/, "");
  const shown = trimmed.length > MAX_FRACTION ? trimmed.slice(0, MAX_FRACTION) : trimmed.padEnd(Math.min(MIN_FRACTION, decimals), "0");
  const sign = negative ? "−" : "";
  return {
    short: `${sign}${whole}${shown ? `.${shown}` : ""}${trimmed.length > MAX_FRACTION ? "…" : ""}`,
    full: `${sign}${whole}${fraction ? `.${fraction}` : ""}`,
  };
}

/** At most two fraction digits, for tight labels; the full value belongs in a title. */
export function compact(raw: bigint | string, token: Token | undefined): string {
  if (token?.decimals == null) return units(raw, token).short;
  const [whole, fraction = ""] = units(raw, token).full.split(".");
  return fraction ? `${whole}.${fraction.slice(0, 2).padEnd(2, "0")}` : (whole ?? "");
}

/** Font size that fits `text` on one line in its container: Mona Sans display figures run ~0.6em wide. */
export function fitFigure(text: string, max = "4.75rem"): string {
  return `min(${max}, ${(150 / Math.max(text.length, 5)).toFixed(1)}cqi)`;
}

/** A decimal string typed by a person to base units; `null` if it isn't a valid amount. */
export function parse(text: string, decimals: number): bigint | null {
  const match = /^(\d+)(?:\.(\d*))?$/.exec(text.trim());
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) return null;
  return BigInt(match[1] ?? "0") * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function count(raw: bigint | string): string {
  return group((typeof raw === "bigint" ? raw : BigInt(raw)).toString());
}

/** "6d 04:12:33", "04:12:33", or "00:00:05". */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(Math.floor((total % 86_400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

export function utc(ns: string): string {
  const date = new Date(Number(BigInt(ns) / 1_000_000n));
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** "27 Oct 20:43 UTC": short enough for a lever plate caption. */
export function utcShort(ns: string): string {
  const date = new Date(Number(BigInt(ns) / 1_000_000n));
  const month = date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return `${date.getUTCDate()} ${month} ${date.toISOString().slice(11, 16)} UTC`;
}

/** Implicit (64-hex) accounts shortened; named accounts kept whole. */
export function account(id: string): string {
  // Implicit accounts: a NEAR key's 64 hex digits, or an EVM wallet's 0x address (D-030).
  return /^([0-9a-f]{64}|0x[0-9a-f]{40})$/.test(id) ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

/** "wNEAR" for a known token, the raw ID otherwise. */
export function symbol(tokens: Record<string, Token>, id: string): string {
  return tokens[id]?.symbol ?? id;
}
