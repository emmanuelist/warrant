import { animate, type MotionValue, motion, type PanInfo, useInView, useMotionValue, useReducedMotion } from "motion/react";
import { type ButtonHTMLAttributes, type ReactNode, type Ref, useEffect, useRef, useState } from "react";

import type { Lever as LeverState } from "../lib/interlock";

/** Degrees: a thrown lever's travel, the pull past which a release throws, and where a lock bar stops one. */
const THROWN = 38;
const THROW_AT = 22;
const LOCK_STOP = 5;

const settle = { type: "spring", stiffness: 300, damping: 18 } as const;
const lift = { type: "spring", stiffness: 420, damping: 22 } as const;
const snap = { type: "spring", stiffness: 900, damping: 38 } as const;

/** Past the lock bar a pull only compresses, like a rubber stop: it can never reach a throw. */
function againstLock(pull: number): number {
  return pull <= LOCK_STOP ? pull : Math.min(LOCK_STOP + Math.sqrt(pull - LOCK_STOP) * 0.7, LOCK_STOP + 3);
}

function kick(rotate: MotionValue<number>) {
  animate(rotate, [rotate.get(), -11, 3.5, -1, 0], { duration: 0.62, ease: "easeOut" });
}

/** What a tooltip trigger (Radix `asChild`) hands the lever; composed with its own handlers. */
type TriggerProps = Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onPointerMove" | "onPointerLeave" | "onPointerDown" | "onFocus" | "onBlur" | "onClick" | "aria-describedby"
> & { ref?: Ref<HTMLButtonElement> };

interface Props extends TriggerProps {
  lever: Pick<LeverState, "num" | "label" | "tone" | "state">;
  /** The chain refused this lever's transaction: the plate stays red, and the arm kicks back once. */
  refused?: boolean;
  /** Each increment replays a recorded refusal: a kick, with the plate lit red while it lasts. */
  strikes?: number;
  index?: number;
  size?: "frame" | "xl";
  /** Settle into position the first time the lever comes into view. */
  arm?: boolean;
  /** Makes the lever a button that opens its sheet; without it the lever is decorative. */
  onPull?: () => void;
  /** A decorative lever pulled against its lock: the owner replays the refusal (`strikes`). */
  onLocked?: () => void;
  label?: string;
  caption?: ReactNode;
}

/**
 * One interlocking lever (docs/DESIGN.md "Signatures"), physically pullable: drag it down (or
 * along its arc). A free lever throws past the catch and opens its sheet; a locked one stops dead
 * at its lock bar and springs back. Click and keyboard do the same without the drag.
 */
export function Lever({
  lever,
  refused = false,
  strikes = 0,
  index = 0,
  size = "frame",
  arm = true,
  onPull,
  onLocked,
  label,
  caption,
  ref,
  onFocus,
  onBlur,
  onClick,
  ...trigger
}: Props) {
  const reduce = useReducedMotion() ?? false;
  const rotate = useMotionValue(reduce || !arm ? 0 : -22);
  const slot = useRef<HTMLSpanElement>(null);
  const inView = useInView(slot, { once: true, amount: 0.6 });
  const timers = useRef(new Set<number>());
  const panning = useRef(false);
  const dragged = useRef(false);
  const throwing = useRef(false);
  const [bumped, setBumped] = useState(false);
  const [lit, setLit] = useState(false);
  const locked = lever.state === "locked";
  const perPixel = size === "xl" ? 0.4 : 0.62;

  const later = (run: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      run();
    }, ms);
    timers.current.add(id);
  };

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  // Arming: the frame settles into position as it first appears.
  useEffect(() => {
    if (!arm || reduce || !inView) return;
    const controls = animate(rotate, 0, { ...settle, delay: 0.08 + index * 0.055 });
    return () => controls.stop();
  }, [arm, reduce, inView, rotate, index]);

  // The chain refused this lever.
  useEffect(() => {
    if (refused && !reduce) kick(rotate);
  }, [refused, reduce, rotate]);

  // A replayed refusal.
  useEffect(() => {
    if (strikes === 0) return;
    const on = requestAnimationFrame(() => setLit(true));
    const off = window.setTimeout(() => setLit(false), 700);
    if (!reduce) kick(rotate);
    return () => {
      cancelAnimationFrame(on);
      window.clearTimeout(off);
    };
  }, [strikes, reduce, rotate]);

  const bump = () => {
    setBumped(true);
    later(() => setBumped(false), 260);
  };

  const throwLever = () => {
    throwing.current = true;
    animate(rotate, -THROWN, snap);
    later(() => {
      throwing.current = false;
      animate(rotate, 0, settle);
      onPull?.();
    }, 150);
  };

  const hitLock = () => {
    bump();
    if (onLocked) onLocked();
    else kick(rotate);
    onPull?.();
  };

  const release = () => {
    const pulled = -rotate.get();
    if (locked && pulled >= LOCK_STOP - 0.5) hitLock();
    else if (!locked && pulled >= THROW_AT) throwLever();
    else animate(rotate, 0, settle);
  };

  const gestures = reduce
    ? {}
    : {
        onPanStart: () => {
          panning.current = true;
          dragged.current = false;
        },
        onPan: (_event: PointerEvent, info: PanInfo) => {
          if (Math.hypot(info.offset.x, info.offset.y) > 4) dragged.current = true;
          const pull = Math.max(0, info.offset.y, -info.offset.x) * perPixel;
          // jump, not set: the hand overrides any spring still running (hover lift, arming).
          rotate.jump(-(locked ? againstLock(pull) : Math.min(pull, THROWN)));
        },
        onPanEnd: () => {
          panning.current = false;
          release();
          // The click that may follow this pointerup is the drag's, not a new pull; any later one is.
          later(() => {
            dragged.current = false;
          }, 0);
        },
        onHoverStart: () => {
          if (!panning.current && !locked) animate(rotate, -9, lift);
        },
        onHoverEnd: () => {
          if (!panning.current && !throwing.current) animate(rotate, 0, settle);
        },
      };

  const body = (
    <>
      <span ref={slot} className="lever-slot" aria-hidden="true">
        <motion.span className="lever-arm" style={{ rotate }} />
      </span>
      <span className="lever-plate" aria-hidden="true">
        <span className="num">{lever.num}</span>
        <span className="name plate-label">{lever.label}</span>
      </span>
      {caption !== undefined && (
        <span className="lever-lock" aria-hidden="true">
          {caption}
        </span>
      )}
    </>
  );

  const shared = {
    className: size === "xl" ? "lever lever-xl" : "lever",
    "data-state": lever.state,
    "data-tone": lever.tone,
    "data-refused": refused || lit,
    "data-bumped": bumped,
    ...gestures,
  };

  if (!onPull) {
    return (
      <motion.div {...shared} aria-hidden="true">
        {body}
      </motion.div>
    );
  }

  return (
    <motion.button
      // The trigger's own data-state (tooltip open/closed) yields to the lever's (free/locked).
      {...trigger}
      {...shared}
      ref={ref}
      type="button"
      aria-label={label}
      onFocus={(event) => {
        onFocus?.(event);
        if (!locked && !reduce && event.currentTarget.matches(":focus-visible")) animate(rotate, -9, lift);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        if (!reduce) animate(rotate, 0, settle);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        if (reduce) onPull();
        else if (locked) hitLock();
        else throwLever();
      }}
    >
      {body}
    </motion.button>
  );
}
