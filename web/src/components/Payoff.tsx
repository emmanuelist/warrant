import clsx from "clsx";
import { type KeyboardEvent, type PointerEvent, useLayoutEffect, useRef, useState } from "react";

import type { Board, Series } from "../lib/chain";
import { units } from "../lib/format";
import { breakEven as breakEvenRaw, strikePrice as strikePriceRaw } from "../lib/payoff";
import { useReference } from "../lib/reference";
import { Label } from "./parts";

const HEIGHT = 190;
const M = { top: 24, right: 14, bottom: 26, left: 46 };

/** A value with at most `digits` fraction digits, trailing zeros trimmed to two. */
function fmt(value: number, digits = 4): string {
  const fixed = Math.abs(value) < 1e-12 ? 0 : value;
  const text = fixed.toLocaleString("en-US", { minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits });
  return fixed < 0 ? text.replace("-", "−") : text;
}

const signed = (value: number) => (value > 1e-12 ? `+${fmt(value)}` : fmt(value));

/** Base units as a float, for geometry only; every printed landmark comes from integer math. */
function human(raw: string | bigint, decimals: number | null | undefined): number {
  return Number(raw) / 10 ** (decimals ?? 0);
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

type Landmark = "loss" | "even" | "profit";

/**
 * Holder's profit at expiry, per option, against the underlying's price in the quote token
 * (DESIGN.md "References": the readout leads, landmark chips snap to the points that matter).
 * Physical settlement means no price feed decides anything: this is arithmetic on the terms.
 */
export function Payoff({ series, board }: { series: Series; board: Board }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<Landmark | null>(null);
  const reference = useReference(series.underlying, series.quote);

  const u = board.tokens[series.underlying];
  const q = board.tokens[series.quote];
  const offers = board.offers.filter((o) => o.series_id === series.series_id && BigInt(o.remaining) > 0n);
  const best = [...offers].sort((a, b) => (BigInt(a.price_per_option) < BigInt(b.price_per_option) ? -1 : 1))[0];
  const premiumRaw = best ? BigInt(best.price_per_option) : 0n;
  if (u?.decimals == null || q?.decimals == null) return null;
  const kRaw = strikePriceRaw(series, u.decimals);
  const beRaw = breakEvenRaw(series, premiumRaw, u.decimals);
  if (kRaw === null) return null;

  const call = series.kind === "call";
  const size = human(series.underlying_per_option, u.decimals);
  const strike = human(series.strike_per_option, q.decimals);
  const premium = human(premiumRaw, q.decimals);
  const strikePrice = human(kRaw, q.decimals);
  const breakEven = beRaw === null ? null : human(beRaw, q.decimals);
  const profit = (x: number) => (call ? Math.max(0, size * x - strike) : Math.max(0, strike - size * x)) - premium;
  const xMax = Math.max(strikePrice * 2, (breakEven ?? 0) * 1.25, (reference ?? 0) * 1.15);
  const yValues = [profit(0), profit(xMax), -premium, 0];
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const pad = (yMax - yMin) * 0.12 || 1;
  const y0 = yMin - pad;
  const y1 = yMax + pad;

  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const sx = (x: number) => M.left + (x / xMax) * plotW;
  const sy = (y: number) => M.top + (1 - (y - y0) / (y1 - y0)) * plotH;
  const kink = { x: sx(strikePrice), y: sy(-premium) };
  const line = call
    ? `M${sx(0)} ${sy(-premium)} L${kink.x} ${kink.y} L${sx(xMax)} ${sy(profit(xMax))}`
    : `M${sx(0)} ${sy(profit(0))} L${kink.x} ${kink.y} L${sx(xMax)} ${sy(-premium)}`;
  const gain = breakEven !== null && breakEven > 0 && breakEven < xMax;
  const wash =
    breakEven === null
      ? ""
      : call
        ? `M${sx(breakEven)} ${sy(0)} L${sx(xMax)} ${sy(profit(xMax))} L${sx(xMax)} ${sy(0)} Z`
        : `M${sx(0)} ${sy(0)} L${sx(0)} ${sy(profit(0))} L${sx(breakEven)} ${sy(0)} Z`;
  // The losing side, between the line and zero: below break-even for a call, above it for a put.
  const lossWash =
    premium <= 0
      ? ""
      : call
        ? `M${sx(0)} ${sy(0)} L${sx(0)} ${sy(-premium)} L${kink.x} ${kink.y} L${sx(breakEven ?? xMax)} ${sy(0)} Z`
        : breakEven === null
          ? `M${sx(0)} ${sy(0)} L${sx(0)} ${sy(profit(0))} L${kink.x} ${kink.y} L${sx(xMax)} ${sy(-premium)} L${sx(xMax)} ${sy(0)} Z`
          : `M${sx(breakEven)} ${sy(0)} L${kink.x} ${kink.y} L${sx(xMax)} ${sy(-premium)} L${sx(xMax)} ${sy(0)} Z`;
  // The line changes colour exactly at zero: gain above, loss below, neutral where it runs along zero.
  const band = (y: number) => Math.min(1, Math.max(0, (y - M.top) / plotH));
  const splitId = `payoff-split-${series.series_id}`;
  const tone = (y: number) => (y > 1e-12 ? "gain" : y < -1e-12 ? "loss" : "even");
  const pair = `${q.symbol} per ${u.symbol}`;
  // A call's line stays low on the left and a put's on the right, so the label goes there if it fits.
  const refWidth = 7 * `1Click ref. ${fmt(reference ?? 0)}`.length;
  const refX = sx(reference ?? 0);
  const refAnchor = call ? (refX - M.left > refWidth ? "end" : "start") : width - M.right - refX > refWidth ? "start" : "end";
  const step = xMax / 100;
  const snap = (x: number) => Math.min(xMax, Math.max(0, Math.round(x / step) * step));
  const ticks = [0, xMax];

  const landmarks: Record<Landmark, { x: number; label: string; value: string } | null> = {
    loss: premium > 0 ? { x: strikePrice, label: "Max loss", value: `−${units(premiumRaw, q).short}` } : null,
    even: gain && breakEven !== null && beRaw !== null ? { x: breakEven, label: "Break-even", value: units(beRaw, q).short } : null,
    profit: call
      ? { x: xMax, label: "Max profit", value: "unlimited" }
      : { x: 0, label: "Max profit", value: `+${units(BigInt(series.strike_per_option) - premiumRaw, q).short}` },
  };
  const pinnedX = pinned ? (landmarks[pinned]?.x ?? null) : null;
  const active = hover ?? pinnedX;

  const onPointer = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setHover(snap(((event.clientX - box.left) / box.width) * xMax));
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = (event.key === "ArrowRight" ? 2 : -2) * step;
      setPinned(null);
      setHover((x) => snap((x ?? pinnedX ?? strikePrice) + delta));
    } else if (event.key === "Escape") {
      setHover(null);
      setPinned(null);
    }
  };

  const k = units(kRaw, q).short;
  const be = beRaw === null ? null : units(beRaw, q).short;
  const where = call ? "more" : "less";
  const sentence = be ? `Profits if 1 ${u.symbol} is worth ${where} than ${be} ${q.symbol} at expiry.` : `Can't profit at this premium: it exceeds the strike.`;
  const distance =
    reference !== null && breakEven !== null
      ? `At the 1Click reference price (${fmt(reference)}), ${u.symbol} is ${fmt((Math.abs(reference - breakEven) / breakEven) * 100, 1)}% ${
          reference >= breakEven ? "above" : "below"
        } break-even.`
      : null;
  // With no premium, break-even is the strike: list each price once.
  const rows = [...new Set([0, breakEven, strikePrice, strikePrice * 1.5, strikePrice * 2].filter((x): x is number => x !== null && x >= 0))];

  return (
    <section aria-labelledby={`payoff-${series.series_id}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Label>
          <span id={`payoff-${series.series_id}`}>Holder's profit at expiry</span>
        </Label>
        <span className="text-label text-iron-2">
          per option ·{" "}
          {best ? (
            <>
              premium <span className="fig text-iron">{units(premiumRaw, q).short}</span> {q.symbol}, best open offer
            </>
          ) : (
            "no open offer: shown before premium"
          )}
        </span>
      </div>

      {/* The readout leads: a plain sentence at rest, the value under the crosshair while exploring.
          Both states share one grid cell, so the chart below never jumps between them. */}
      <div className="mb-2 grid" aria-live="polite">
        <div className={clsx("[grid-area:1/1]", active !== null && "invisible")}>
          <p className="text-body leading-snug">{sentence}</p>
          <p className="mt-0.5 text-meta text-iron-2">
            {premium > 0 ? `The most a holder can lose is ${units(premiumRaw, q).short} ${q.symbol}, the premium.` : `Break-even is the strike, ${k} ${q.symbol}.`}
            {distance && ` ${distance}`}
          </p>
        </div>
        <div className={clsx("[grid-area:1/1]", active === null && "invisible")}>
          {pinned === "profit" && call && hover === null ? (
            <>
              <p className="text-h3 leading-tight [font-variation-settings:'wdth'_112,'wght'_720]">Unlimited</p>
              <p className="text-meta text-iron-2">
                Above {be ?? k}, each 1 {q.symbol} rise in {u.symbol} adds {fmt(size)} {q.symbol} per option.
              </p>
            </>
          ) : (
            <>
              <p className="fig text-h3 leading-tight">
                {signed(profit(active ?? strikePrice))} <span className="text-ui text-iron-2">{q.symbol}</span>
              </p>
              <p className="text-meta text-iron-2">
                if 1 {u.symbol} = {fmt(active ?? strikePrice)} {q.symbol} at expiry · writer {signed(-profit(active ?? strikePrice))}
              </p>
            </>
          )}
        </div>
      </div>

      <div
        ref={ref}
        className="payoff relative"
        tabIndex={0}
        role="img"
        aria-label={`Payoff chart. ${sentence} Use the left and right arrow keys to read other prices.`}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} aria-hidden="true" className="block overflow-visible">
            {/* zero baseline and axes: solid hairlines, one step off the board */}
            <line x1={M.left} x2={width - M.right} y1={sy(0)} y2={sy(0)} className="payoff-zero" />
            <line x1={M.left} x2={M.left} y1={M.top} y2={HEIGHT - M.bottom} className="payoff-axis" />
            <line x1={kink.x} x2={kink.x} y1={M.top - 6} y2={HEIGHT - M.bottom} className="payoff-axis" />
            {reference !== null && reference < xMax && (
              <>
                <line x1={sx(reference)} x2={sx(reference)} y1={M.top} y2={HEIGHT - M.bottom} className="payoff-ref" />
                {/* Up in the corner the line never reaches, clear of the landmarks along the baseline. */}
                <text x={sx(reference) + (refAnchor === "end" ? -5 : 5)} y={M.top + 10} textAnchor={refAnchor} className="payoff-note">
                  1Click ref. {fmt(reference)}
                </text>
              </>
            )}
            <defs>
              <linearGradient id={splitId} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={M.top} y2={M.top + plotH}>
                <stop offset={band(sy(0) - 1.5)} style={{ stopColor: "var(--color-gain)" }} />
                <stop offset={band(sy(0) - 1.5)} style={{ stopColor: "var(--color-iron-2)" }} />
                <stop offset={band(sy(0) + 1.5)} style={{ stopColor: "var(--color-iron-2)" }} />
                <stop offset={band(sy(0) + 1.5)} style={{ stopColor: "var(--color-loss)" }} />
              </linearGradient>
            </defs>
            {gain && <path d={wash} className="payoff-wash" data-tone="gain" />}
            {lossWash && <path d={lossWash} className="payoff-wash" data-tone="loss" />}
            <path d={line} className="payoff-line" stroke={`url(#${splitId})`} />

            <text x={kink.x} y={M.top - 10} textAnchor="middle" className="payoff-label">
              strike {k}
            </text>
            {premium > 0 && (
              <text x={call ? M.left + 6 : width - M.right - 6} y={kink.y + 15} textAnchor={call ? "start" : "end"} className="payoff-note">
                max loss {units(premiumRaw, q).short}
              </text>
            )}
            {gain && breakEven !== null && (
              /* below the baseline on the profitable side, where the line never runs */
              <text x={sx(breakEven) + (call ? 8 : -8)} y={sy(0) + 15} textAnchor={call ? "start" : "end"} className="payoff-label">
                break-even {be}
              </text>
            )}
            {(Object.keys(landmarks) as Landmark[]).map((id) => {
              const mark = landmarks[id];
              if (!mark) return null;
              return (
                <circle
                  key={id}
                  cx={sx(mark.x)}
                  cy={sy(profit(mark.x))}
                  r={pinned === id ? 5.5 : 4}
                  className={clsx("payoff-dot", pinned === id && "payoff-dot-pinned")}
                  data-tone={id === "even" ? "even" : tone(profit(mark.x))}
                />
              );
            })}

            {[0, y0 + pad, y1 - pad]
              .filter((v, i, all) => all.findIndex((w) => Math.abs(w - v) < (y1 - y0) * 0.08) === i)
              .map((v) => (
                <text key={v} x={M.left - 6} y={sy(v) + 3.5} textAnchor="end" className="payoff-tick">
                  {signed(v)}
                </text>
              ))}
            {ticks.map((t) => (
              <text key={t} x={sx(t)} y={HEIGHT - M.bottom + 15} textAnchor={t === 0 ? "start" : "end"} className="payoff-tick">
                {fmt(t, 2)}
              </text>
            ))}

            {active !== null && (
              <>
                <line x1={sx(active)} x2={sx(active)} y1={M.top} y2={HEIGHT - M.bottom} className="payoff-crosshair" />
                <circle cx={sx(active)} cy={sy(profit(active))} r={4} className="payoff-dot" data-tone={tone(profit(active))} />
              </>
            )}
            <rect
              x={M.left}
              y={M.top}
              width={plotW}
              height={plotH}
              fill="transparent"
              onPointerMove={onPointer}
              onPointerDown={onPointer}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Landmarks">
        {(Object.keys(landmarks) as Landmark[]).map((id) => {
          const mark = landmarks[id];
          if (!mark) return null;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={pinned === id}
              onClick={() => {
                setHover(null);
                setPinned((current) => (current === id ? null : id));
              }}
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-meta text-iron-2 shadow-[inset_0_0_0_1px_var(--color-rule)] transition-colors duration-150 hover:text-iron aria-pressed:bg-iron aria-pressed:text-board aria-pressed:shadow-none"
            >
              <span className="payoff-key" data-tone={id === "loss" ? "loss" : id === "profit" ? "gain" : "even"} aria-hidden="true" />
              <span className="plate-label text-micro">{mark.label}</span>
              <span className={/\d/.test(mark.value) ? "fig" : undefined}>{mark.value}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 max-w-[60ch] text-label text-iron-2">
        x: price of 1 {u.symbol} in {q.symbol} at expiry. No oracle settles this; the holder decides whether to exercise.
      </p>
      <details className="mt-2 text-meta">
        <summary className="plate-label w-fit cursor-pointer text-label text-iron-2 hover:text-iron">As a table</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-iron-2">
              <th className="pb-1 font-normal">{pair} at expiry</th>
              <th className="pb-1 text-right font-normal">Holder</th>
              <th className="pb-1 text-right font-normal">Writer</th>
            </tr>
          </thead>
          <tbody className="fig">
            {rows.map((x) => (
              <tr key={x} className="border-t border-rule">
                <td className="py-1">{fmt(x)}</td>
                <td className="py-1 text-right">{signed(profit(x))}</td>
                <td className="py-1 text-right">{signed(-profit(x))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
