import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import type { Board, Series } from "../lib/chain";
import { units, utc, utcShort } from "../lib/format";
import { Clock, Figure } from "./Num";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SPAN = 365 * DAY;
/** Degrees of scale, clockwise from 12 o'clock, where a lock opens. The rest is the bezel's index. */
const SWEEP = 330;

/** Time to release on a log scale, so a lock opening in an hour and one opening in a quarter both read. */
export function angleFor(ms: number): number {
  const t = Math.min(Math.max(ms, 0), SPAN);
  return (SWEEP * Math.log1p(t / HOUR)) / Math.log1p(SPAN / HOUR);
}

function point(deg: number, r: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [500 + r * Math.sin(rad), 500 - r * Math.cos(rad)];
}

/** A slide rule's spacing: hourly to a day, daily to a week, weekly to a month, monthly to a year. */
const TICKS: { deg: number; major: boolean }[] = [
  ...Array.from({ length: 23 }, (_, i) => (i + 1) * HOUR),
  ...Array.from({ length: 6 }, (_, i) => (i + 1) * DAY),
  ...Array.from({ length: 3 }, (_, i) => (i + 1) * 7 * DAY),
  ...Array.from({ length: 12 }, (_, i) => (i + 1) * 30 * DAY),
].map((ms) => ({ deg: angleFor(ms), major: [HOUR, 6 * HOUR, DAY, 3 * DAY, 7 * DAY, 30 * DAY, 90 * DAY, 360 * DAY].includes(ms) }));

const SCALE = [
  { label: "1h", ms: HOUR },
  { label: "6h", ms: 6 * HOUR },
  { label: "1d", ms: DAY },
  { label: "3d", ms: 3 * DAY },
  { label: "1w", ms: 7 * DAY },
  // Tenors as traders write them (1M, 3M): two characters like every other mark, so the printed
  // scale clears the blued centre at 9 o'clock too.
  { label: "1m", ms: 30 * DAY },
  { label: "3m", ms: 90 * DAY },
  { label: "1y", ms: SPAN },
];

// The scale is printed between the major ticks (388) and the blued centre's edge (322 + its 2px
// polished rim), with clearance on both sides at the phone's larger size too.
const R = { mark: 438, tickOut: 414, tickMinor: 402, tickMajor: 388, label: 358, inner: 322 };

const expiryMs = (s: Series) => Number(BigInt(s.expiry_ns) / 1_000_000n);
/** How long after a lock runs out it may still play its release: until the chain read after this removes it. */
const RELEASE_WINDOW_MS = 20_000;

/** The blued arc: clockwise along the lock track from the index to `deg`. */
function arcPath(deg: number): string {
  const [x, y] = point(deg, R.mark);
  return `M 500 ${500 - R.mark} A ${R.mark} ${R.mark} 0 ${deg > 180 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}

/**
 * The Lock Dial (docs/DESIGN.md "Signatures"): the vault's time lock. Every live series sits on the
 * ring by how long until its lock opens; the blued arc runs to the next one. The centre is the
 * collateral the locks hold, read from chain. A marker opens its series on the board.
 */
export function Dial({ board, nowMs, onSelect }: { board: Board; nowMs: number; onSelect: (seriesId: string) => void }) {
  const live = board.series.filter((s) => nowMs < expiryMs(s) && BigInt(s.collateral_held) > 0n);
  const totals = new Map<string, bigint>();
  for (const s of live) totals.set(s.collateral_token, (totals.get(s.collateral_token) ?? 0n) + BigInt(s.collateral_held));
  const ranked = [...totals.entries()].sort((a, b) => live.filter((s) => s.collateral_token === b[0]).length - live.filter((s) => s.collateral_token === a[0]).length);
  const [primary, ...others] = ranked;
  const soonest = [...live].sort((a, b) => expiryMs(a) - expiryMs(b));
  const next = soonest[0];

  // Locks that open together share a radius step outward-in, so none hides another.
  const placed: { series: Series; deg: number; r: number }[] = [];
  for (const s of soonest) {
    const deg = angleFor(expiryMs(s) - nowMs);
    const crowd = placed.filter((p) => Math.abs(p.deg - deg) < 3).length;
    placed.push({ series: s, deg, r: R.mark - crowd * 24 });
  }

  const nextDeg = next ? angleFor(expiryMs(next) - nowMs) : 0;

  const figure = primary ? units(primary[1], board.tokens[primary[0]]).short : "0";
  const [sweepDelay] = useState(() => -((nowMs / 1000) % 60));
  // The readout at the centre follows the lock you point at or focus; otherwise the next to open.
  const [pointed, setPointed] = useState<string | null>(null);
  const shown = live.find((s) => s.series_id === pointed) ?? next;
  const shownAmount = (s: Series) => `${units(s.collateral_held, board.tokens[s.collateral_token]).short} ${board.tokens[s.collateral_token]?.symbol ?? ""}`.trim();
  const stage = useStageLight();
  // A lock that has just run out opens on the dial, once: the animation plays out in CSS.
  const opening = board.series.find((s) => nowMs >= expiryMs(s) && nowMs - expiryMs(s) < RELEASE_WINDOW_MS && BigInt(s.collateral_held) > 0n);

  return (
    <div ref={stage} className="dial-stage">
      <DialFace arcDeg={next ? nextDeg : null} sweepDelay={sweepDelay}>
        {opening && (
          <div key={opening.series_id} className="dial-release" aria-hidden="true">
            <span className="dial-release-flash" />
            <span className="dial-release-ring" />
            <span className="dial-release-ring" data-second="true" />
          </div>
        )}
        <div className="dial-center" data-opening={opening ? "true" : undefined} aria-hidden="true">
          <p className="plate-label dial-kicker">
            Locked in <span className="dial-kicker-near">NEAR </span>Intents
          </p>
          <p className="dial-figure" style={{ fontSize: `min(10.5cqi, ${(88 / Math.max(figure.length, 1)).toFixed(2)}cqi)` }}>
            {primary ? <Figure raw={primary[1]} token={board.tokens[primary[0]]} rollIn delay={700} /> : "0"}
          </p>
          <p className="dial-unit">
            {primary ? (board.tokens[primary[0]]?.symbol ?? primary[0]) : "nothing locked yet"}
            {others.map(([token, amount]) => (
              <span key={token} className="fig">
                {" "}
                + {units(amount, board.tokens[token]).short} {board.tokens[token]?.symbol}
              </span>
            ))}
          </p>
          {opening && (
            <p key={opening.series_id} className="dial-opened fig">
              <span>Lock #{opening.series_id} open</span>
              <span className="dial-opened-dot"> · </span>
              <span>{shownAmount(opening)}</span>
            </p>
          )}
          {shown && (
            <p className="dial-next">
              <span className="plate-label">{shown === next ? "Next opens in" : `#${shown.series_id} opens in`}</span>
              <Clock toNs={shown.expiry_ns} />
              <span className="dial-next-what fig">
                <span>
                  #{shown.series_id} · {shownAmount(shown)}
                </span>
                <span className="dial-next-when">{utcShort(shown.expiry_ns).replace(" UTC", "")}</span>
              </span>
            </p>
          )}
        </div>

        {placed.map(({ series, deg, r }, index) => {
          const [x, y] = point(deg, r);
          const token = board.tokens[series.collateral_token];
          const amount = `${units(series.collateral_held, token).short} ${token?.symbol ?? ""}`.trim();
          return (
            <button
              key={series.series_id}
              type="button"
              className="dial-marker"
              data-next={series === next}
              data-pointed={series.series_id === pointed}
              style={{ left: `${x / 10}%`, top: `${y / 10}%`, "--i": index } as CSSProperties}
              aria-label={`Series ${series.series_id}, ${series.kind}: ${amount} locked until ${utc(series.expiry_ns)}. Open it on the board.`}
              onPointerEnter={() => setPointed(series.series_id)}
              onPointerLeave={() => setPointed((p) => (p === series.series_id ? null : p))}
              onFocus={() => setPointed(series.series_id)}
              onBlur={() => setPointed((p) => (p === series.series_id ? null : p))}
              onClick={() => onSelect(series.series_id)}
            />
          );
        })}
      </DialFace>
    </div>
  );
}

/**
 * Where a lock being written would sit among the live ones (the Write sheet's expiry): every live
 * lock as a dot on the ring, the new one in blued steel at its expiry, the arc running to it.
 */
export function DialPreview({ board, nowMs, opensAt }: { board: Board; nowMs: number; opensAt: number | null }) {
  const live = board.series.filter((s) => nowMs < expiryMs(s) && BigInt(s.collateral_held) > 0n);
  const deg = opensAt === null ? null : angleFor(opensAt - nowMs);
  const mark = deg === null ? null : point(deg, R.mark);
  return (
    <div className="dial-preview" aria-hidden="true">
      <DialFace arcDeg={deg} sweepDelay={null}>
        <svg className="dial-svg" viewBox="0 0 1000 1000">
          {live.map((s) => {
            const [x, y] = point(angleFor(expiryMs(s) - nowMs), R.mark);
            return <circle key={s.series_id} className="dial-preview-lock" cx={x.toFixed(1)} cy={y.toFixed(1)} r="17" />;
          })}
          {mark && <circle className="dial-preview-new" cx={mark[0].toFixed(1)} cy={mark[1].toFixed(1)} r="30" />}
        </svg>
      </DialFace>
    </div>
  );
}

/**
 * The dial's material without its data: polished bezel, sunburst lacquer, a heat-blued centre (blue
 * means locked), the printed log scale, the index where locks open, and the crystal. `arcDeg` runs the blued arc to a lock; `sweepDelay`
 * starts the seconds where the clock is (null: no seconds). The link preview renders it too.
 */
export function DialFace({ arcDeg, sweepDelay, children }: { arcDeg: number | null; sweepDelay: number | null; children?: ReactNode }) {
  const arc = arcDeg === null ? null : arcPath(arcDeg);
  return (
    <div className="dial">
      <div className="dial-bezel" aria-hidden="true" />
      <div className="dial-face" aria-hidden="true" />
      <div className="dial-blued" aria-hidden="true" />
      <svg className="dial-svg" viewBox="0 0 1000 1000" aria-hidden="true">
        <circle className="dial-track" cx="500" cy="500" r={R.mark} />
        <circle className="dial-ring" cx="500" cy="500" r={R.inner} />
        {TICKS.map((tick, i) => {
          const [x1, y1] = point(tick.deg, tick.major ? R.tickMajor : R.tickMinor);
          const [x2, y2] = point(tick.deg, R.tickOut);
          return (
            <line
              key={i}
              className="dial-tick"
              data-major={tick.major}
              x1={x1.toFixed(1)}
              y1={y1.toFixed(1)}
              x2={x2.toFixed(1)}
              y2={y2.toFixed(1)}
              style={{ "--i": i } as CSSProperties}
            />
          );
        })}
        {SCALE.map(({ label, ms }) => {
          const [x, y] = point(angleFor(ms), R.label);
          return (
            <text key={label} className="dial-scale" x={x.toFixed(1)} y={y.toFixed(1)} textAnchor="middle" dominantBaseline="central">
              {label}
            </text>
          );
        })}
        {/* The index: where every lock opens. */}
        <path className="dial-index" d="M 500 50 L 486 22 L 514 22 Z" />
        <text className="dial-scale dial-opens" x="500" y={500 - R.label} textAnchor="middle" dominantBaseline="central">
          opens
        </text>
        {arc && <path className="dial-arc" d={arc} pathLength={1} />}
        {/* The seconds: decoration, but it says the lock is running on time. */}
        {sweepDelay !== null && (
          <g className="dial-seconds">
            <g className="dial-sweep" style={{ animationDelay: `${sweepDelay.toFixed(2)}s` }}>
              <line x1="500" y1={500 - R.inner - 6} x2="500" y2={500 - R.tickOut + 4} />
              <circle cx="500" cy={500 - R.tickOut + 4} r="5" />
            </g>
          </g>
        )}
      </svg>
      <div className="dial-glass" aria-hidden="true" />
      {children}
    </div>
  );
}

/**
 * Studio light on the dial: it turns a few degrees toward the pointer and the bezel's highlight
 * follows it round. A plain rAF ease on CSS variables, so the hero needs no animation library.
 */
function useStageLight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stage = ref.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = { rx: 0, ry: 0, light: 205 };
    const now = { ...target };
    let frame = 0;
    let visible = true;

    const step = () => {
      now.rx += (target.rx - now.rx) * 0.07;
      now.ry += (target.ry - now.ry) * 0.07;
      const turn = ((target.light - now.light + 540) % 360) - 180;
      now.light += turn * 0.07;
      stage.style.setProperty("--rx", `${now.rx.toFixed(2)}deg`);
      stage.style.setProperty("--ry", `${now.ry.toFixed(2)}deg`);
      stage.style.setProperty("--light", `${now.light.toFixed(1)}deg`);
      const settled = Math.abs(target.rx - now.rx) < 0.02 && Math.abs(target.ry - now.ry) < 0.02 && Math.abs(turn) < 0.1;
      frame = settled ? 0 : requestAnimationFrame(step);
    };

    const onMove = (event: PointerEvent) => {
      if (!visible || event.pointerType === "touch") return;
      const box = stage.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      target.ry = Math.max(-8, Math.min(8, (dx / window.innerWidth) * 16));
      target.rx = Math.max(-6, Math.min(6, (-dy / window.innerHeight) * 12));
      target.light = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (!frame) frame = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
    });
    observer.observe(stage);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}
