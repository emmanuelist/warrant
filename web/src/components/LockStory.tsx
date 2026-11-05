import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

import { settleHash } from "../lib/route";
import { angleFor, DialFace } from "./Dial";

const HOUR = 3_600_000;
const WEEK = angleFor(7 * 24 * HOUR);
const LAST_HOUR = angleFor(HOUR);
/** Where on the way through the steps the lock opens (scroll progress). */
const OPENS_AT = 0.8;

/** The contract's own lines for each step (contracts/options/src), quoted exactly. */
const STEPS = [
  {
    tag: "Written",
    tone: "bg-lock",
    title: "The writer locks collateral inside NEAR Intents.",
    body: "It can only arrive through intents.near itself, and the contract records every unit it now holds. Longs are minted against it, one per option, and move like any asset inside Intents.",
    code: "series.collateral_held = locked;",
    source: "src/actions.rs:124",
  },
  {
    tag: "Holding",
    tone: "bg-live",
    title: "Until expiry, nothing opens it.",
    body: "A holder can exercise at any moment: pay the strike, take delivery from the locked collateral. The writer can't take a single unit back early. Pull that lever and the chain refuses.",
    code: "require!(series.is_expired(now), ERR_NOT_EXPIRED);",
    source: "src/market.rs:131",
  },
  {
    tag: "At expiry",
    tone: "bg-deliver",
    title: "The chain's clock opens the lock.",
    body: "No price feed decides anything. Exercise stops at that instant, and whatever wasn't exercised returns to the writer. The whole oracle is one comparison.",
    code: "now_ns >= self.expiry_ns",
    source: "src/types.rs:96",
  },
] as const;

/**
 * "How the lock holds": one series from written to open, told by scroll. The steps scroll as text;
 * beside them the dial runs its clock: the lock drops in a week out, travels to the index, and at
 * expiry the interlock flips (Exercise bolts, Reclaim frees). A diagram of the contract, so it
 * shows no chain figures.
 */
export function LockStory() {
  const steps = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  // Two readings of the same scroll: the text's (which step sits at the reading line) and the
  // clock's, which ends when the pinned dial would start to leave, so expiry plays out in view.
  const { scrollYProgress: reading } = useScroll({ target: steps, offset: ["start 0.62", "end 0.62"] });
  const { scrollYProgress: clock } = useScroll({ target: steps, offset: ["start 0.62", "end 0.88"] });
  const [step, setStep] = useState(0);
  const [opened, setOpened] = useState(false);
  const [refused, setRefused] = useState(false);

  // Mounting late pushes the board down; keep a link's #target where the reader was sent.
  useLayoutEffect(settleHash, []);

  useMotionValueEvent(reading, "change", (p) => setStep(p < 0.34 ? 0 : p < 0.66 ? 1 : 2));
  useMotionValueEvent(clock, "change", (p) => {
    setOpened(p >= OPENS_AT);
    setRefused(p >= 0.44 && p < 0.58);
  });

  // The lock's place on the ring: a week out while it's written, travelling to the last hour while
  // it holds, then to the index. With reduced motion it moves by step, not continuously.
  const travel = useTransform(clock, [0, 0.36, 0.64, OPENS_AT], [WEEK, WEEK, LAST_HOUR, 0]);
  const stepped = useTransform(clock, (p) => (p < 0.34 ? WEEK : p < OPENS_AT ? LAST_HOUR : 0));
  const deg = reduce ? stepped : travel;
  const drawn = useTransform(clock, [0.04, 0.24], [reduce ? 1 : 0, 1]);
  const arc = useTransform(() => (deg.get() / 360) * drawn.get());
  const dropped = useTransform(clock, [0, 0.12], [reduce ? 1 : 0, 1]);

  return (
    <section id="how" className="story scroll-mt-16" aria-labelledby="how-title">
      <div className="story-head">
        <h2 id="how-title" className="display text-display-3">
          How the lock holds
        </h2>
        <p className="mt-3 max-w-[52ch] text-lead text-iron-2">One series from written to open, in the contract's own lines. Scroll to run its clock.</p>
      </div>

      <div className="story-grid">
        <div className="story-visual" aria-hidden="true">
          <div className="story-dial" data-open={opened}>
            <DialFace arcDeg={null} sweepDelay={null}>
              <svg className="dial-svg" viewBox="0 0 1000 1000">
                <motion.circle className="story-arc" cx="500" cy="500" r="438" pathLength={1} style={{ pathLength: arc, rotate: -90 }} />
                <motion.g style={{ rotate: deg }}>
                  <rect width="1000" height="1000" fill="none" />
                  <motion.circle className="story-marker" data-open={opened} cx="500" cy="62" r="14" style={{ scale: dropped }} />
                </motion.g>
              </svg>
              <div className="dial-center">
                <p className="plate-label dial-kicker">{opened ? "Expiry" : "NEAR Intents"}</p>
                <p className="story-word" data-open={opened}>
                  {opened ? "Open" : "Locked"}
                </p>
                <p className="dial-unit">{opened ? "by the chain's clock" : step === 0 ? "held by the contract" : "until expiry"}</p>
              </div>
            </DialFace>
          </div>

          <div className="story-levers">
            <StoryLever num={4} label="Exercise" tone="live" free={!opened} caption={opened ? "closed at expiry" : "free"} />
            <StoryLever num={7} label="Reclaim" tone="release" free={opened} refused={refused} caption={opened ? "free" : "until expiry"} />
          </div>
          {/* A diagram's stamp, drawn apart from the band's real receipts below: outlined, not filled. */}
          <p className="story-answer" data-on={refused}>
            <span className="plate-label">The chain would refuse</span> <span className="fig">ERR_NOT_EXPIRED</span>
          </p>
        </div>

        <div ref={steps} className="story-steps">
          {STEPS.map((s, index) => (
            <article key={s.tag} className="story-step" data-active={step === index}>
              <h3 className="text-h2 leading-tight [font-variation-settings:'wdth'_108,'wght'_640]">{s.title}</h3>
              <p className="mt-3 max-w-[46ch] text-body">{s.body}</p>
              {/* The stage this line enforces, named beside the line itself rather than over the step. */}
              <figure className="story-code">
                <code className="fig">{s.code}</code>
                <figcaption>
                  <span className={`story-dot ${s.tone}`} aria-hidden="true" />
                  <span className="plate-label text-iron">{s.tag}</span>
                  <span className="fig">contracts/options/{s.source}</span>
                </figcaption>
              </figure>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** A lever drawn from the Interlock's own parts, without its physics: the story's levers aren't pulled by hand. */
function StoryLever({ num, label, tone, free, refused = false, caption }: { num: number; label: string; tone: string; free: boolean; refused?: boolean; caption: string }) {
  return (
    <div className="lever lever-static" data-state={free ? "free" : "locked"} data-tone={tone} data-refused={refused}>
      <span className="lever-slot">
        <span className="lever-arm" />
      </span>
      <span className="lever-plate">
        <span className="num">{num}</span>
        <span className="name plate-label">{label}</span>
      </span>
      <span className="lever-lock">{caption}</span>
    </div>
  );
}
