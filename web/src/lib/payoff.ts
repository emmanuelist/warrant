import type { Series } from "./chain";

/**
 * Prices in the quote token's base units for one whole underlying unit, computed with integers from
 * the series terms (no price feed): where exercise starts to pay, and where the holder breaks even.
 */
export function strikePrice(series: Series, underlyingDecimals: number): bigint | null {
  const size = BigInt(series.underlying_per_option);
  return size === 0n ? null : (BigInt(series.strike_per_option) * 10n ** BigInt(underlyingDecimals)) / size;
}

/** Break-even includes the premium: strike + premium for a call, strike − premium for a put. */
export function breakEven(series: Series, premium: bigint, underlyingDecimals: number): bigint | null {
  const size = BigInt(series.underlying_per_option);
  const strike = BigInt(series.strike_per_option);
  const at = series.kind === "call" ? strike + premium : strike - premium;
  return size === 0n || at <= 0n ? null : (at * 10n ** BigInt(underlyingDecimals)) / size;
}
