import type { Series, Token } from "../lib/chain";
import { account, count, units } from "../lib/format";
import type { Phase } from "../lib/interlock";
import { breakable, type Leg, Terminal, Tracks } from "./System";

/**
 * The Route (docs/DESIGN.md, signature 2): where this series' money rests and what has moved,
 * drawn only from chain state. Everything passes through the Intents block; nothing leaves it.
 * Built from the system route's own parts (System.tsx), so every figure is real text at a
 * readable size: across the card on a wide screen, top to bottom in the phone's sheet.
 */
export function Route({
  series,
  phase,
  tokens,
  intentsAccount,
}: {
  series: Series;
  phase: Phase;
  tokens: Record<string, Token>;
  intentsAccount: string;
}) {
  const collateral = BigInt(series.collateral_held);
  const proceeds = BigInt(series.proceeds_held);
  const exercised = BigInt(series.exercised);
  const col = tokens[series.collateral_token];
  const pay = tokens[series.payment_token];
  const fmt = (raw: bigint, token: Token | undefined) => `${units(raw, token).short} ${token?.symbol ?? ""}`.trim();

  const legs: Record<"collateral" | "proceeds" | "delivered" | "strike", Leg> = {
    collateral: {
      label: phase === "reclaimed" ? "collateral returned" : phase === "released" ? "collateral released" : "collateral locked",
      value: fmt(collateral, col),
      lit: collateral > 0n ? (phase === "locked" ? "lock" : "release") : null,
    },
    proceeds: { label: "proceeds held", value: fmt(proceeds, pay), lit: proceeds > 0n ? "deliver" : null },
    delivered: { label: "delivered", value: fmt(exercised * BigInt(series.collateral_per_option), col), lit: exercised > 0n ? "deliver" : null },
    strike: { label: "strike paid", value: `${count(exercised)} exercised`, lit: exercised > 0n ? "live" : null },
  };
  const summary = Object.values(legs)
    .map((leg) => `${leg.label}: ${leg.value}`)
    .join("; ");

  return (
    <div className="sys sys-series" role="img" aria-label={`Route of funds. ${summary}`}>
      <Terminal label="Writer" tone="lock" sub={account(series.writer)} />
      <Tracks at={[0.1, 0.22]} forward={legs.collateral} back={legs.proceeds} />
      <div className="sys-intents" aria-hidden="true">
        <span className="plate-label text-label">NEAR Intents</span>
        <span className="fig text-label sys-intents-2">{breakable(account(intentsAccount))}</span>
        <span className="fig mt-1.5 text-ui">{fmt(collateral, col)}</span>
        <span className="fig text-label sys-intents-2">{proceeds > 0n ? `+ ${fmt(proceeds, pay)}` : "held for this series"}</span>
      </div>
      <Tracks at={[0.34, 0.46]} forward={legs.delivered} back={legs.strike} />
      <Terminal label="Holders" tone="deliver" sub={`${count(series.long_supply)} open`} />
    </div>
  );
}
