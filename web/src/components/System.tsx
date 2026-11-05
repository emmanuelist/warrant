import type { CSSProperties } from "react";

/**
 * The Route at system scale (DESIGN.md "Signatures"): terminals and a station joined by paired
 * tracks, drawn in HTML so every figure stays real text. Shared by the board's and the account's
 * opening panels, and by each series' own route (Route.tsx).
 */
export type Lit = "lock" | "live" | "deliver" | "release" | "iron" | null;

export interface Leg {
  label: string;
  value: string;
  lit: Lit;
}

/** `tone`: the side of the route a terminal stands on: what it locks (lock) or receives (deliver). */
export function Terminal({ label, sub, tone }: { label: string; sub: string; tone?: "lock" | "deliver" }) {
  return (
    <div className="sys-terminal" data-tone={tone} aria-hidden="true">
      <span className="sys-terminal-label plate-label text-label">{label}</span>
      <span className={/\d|\./.test(sub) ? "fig text-label text-panel-ink-2" : "text-label text-panel-ink-2"}>{breakable(sub)}</span>
    </div>
  );
}

/** An account ID that may wrap only after a dot ("alice." / "sandbox"), never mid-name or mid-number. */
export function breakable(text: string) {
  return text.split(/(?<=\.)(?=[a-z])/i).map((part, i) => (
    <span key={i}>
      {i > 0 && <wbr />}
      {part}
    </span>
  ));
}

/**
 * `at`: when each rail is drawn as the route is set on first paint, in seconds: the forward leg,
 * then the return leg. A signal box sets a route one section at a time; so does this panel.
 */
export function Tracks({ forward, back, at = [0, 0] }: { forward: Leg; back: Leg; at?: [number, number] }) {
  return (
    <div className="sys-tracks" aria-hidden="true">
      {[
        { leg: forward, dir: "fwd", set: at[0] },
        { leg: back, dir: "back", set: at[1] },
      ].map(({ leg, dir, set }) => (
        <div key={dir} className="sys-track" data-dir={dir} data-lit={leg.lit ?? undefined} style={{ "--set": `${set}s` } as CSSProperties}>
          <span className="plate-label text-label text-panel-ink-2">{leg.label}</span>
          <span className="sys-rail" />
          {/* Monospace is for data: amounts and counts, not words like "any time". */}
          <span className={/\d/.test(leg.value) ? "fig text-label text-panel-ink-2" : "text-label text-panel-ink-2"}>{leg.value}</span>
        </div>
      ))}
    </div>
  );
}
