import { useEffect, useState } from "react";

import type { Series, Token } from "./chain";
import { config } from "./config";
import { remoteTokens } from "./oneclick";

/**
 * 1Click's USD reference prices as an underlying/quote ratio (quote per underlying). Indicative,
 * mainnet only, never used for settlement: physical settlement means no price decides anything.
 */
export function useReference(underlying: string, quote: string): number | null {
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    if (config.network !== "mainnet") return;
    let live = true;
    remoteTokens()
      .then((tokens) => {
        const u = tokens.find((t) => t.assetId === underlying)?.price;
        const q = tokens.find((t) => t.assetId === quote)?.price;
        if (live && u && q) setRatio(u / q);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [underlying, quote]);
  return ratio;
}

/**
 * What exercising one option would net, in the quote token, at a reference ratio: a call receives
 * the underlying and pays the strike; a put the other way round. The premium is already spent, so
 * it doesn't enter the decision. Indicative only: a float, for reading, never for a transaction.
 */
export function exerciseNet(series: Series, tokens: Record<string, Token>, ratio: number | null): number | null {
  const u = tokens[series.underlying];
  const q = tokens[series.quote];
  if (ratio === null || u?.decimals == null || q?.decimals == null) return null;
  const size = Number(series.underlying_per_option) / 10 ** u.decimals;
  const strike = Number(series.strike_per_option) / 10 ** q.decimals;
  return series.kind === "call" ? size * ratio - strike : strike - size * ratio;
}
