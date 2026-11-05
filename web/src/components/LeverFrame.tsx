import { useCallback, useState } from "react";

import { type ActionId, freeCaption, type Lever as LeverState } from "../lib/interlock";
import { Lever } from "./Lever";
import { Tip, TipProvider } from "./Tip";

/** What each lever does, in contract terms (docs/SPEC.md "Actions" and "Direct methods"). */
const DOES: Record<ActionId, string> = {
  write: "Lock more collateral in this series and mint longs against it.",
  list: "Offer longs you hold at a fixed price. They wait in escrow until bought.",
  buy: "Pay an open offer's price and receive its longs.",
  exercise: "Burn longs and pay the exercise price. The locked collateral is delivered to you.",
  close: "Burn longs you hold and take back the collateral behind them.",
  proceeds: "Withdraw the exercise payments this series has received.",
  reclaim: "After expiry, take back the collateral no one exercised.",
};

/**
 * The Interlock (docs/DESIGN.md, signature 1): the series' state machine for this viewer. A free
 * lever starts the action; a locked one names its lock in contract terms and can be pulled anyway
 * to let the chain refuse it.
 */
export function LeverFrame({
  levers,
  refused,
  onPull,
}: {
  levers: LeverState[];
  refused: ActionId | null;
  onPull: (lever: LeverState) => void;
}) {
  // Inside the phone's detail dialog, tips must join the dialog's top layer to be seen.
  const [layer, setLayer] = useState<Element | null>(null);
  const frame = useCallback((node: HTMLDivElement | null) => setLayer(node?.closest("dialog") ?? null), []);

  return (
    <TipProvider delayDuration={350} skipDelayDuration={400}>
      <div ref={frame} className="frame" role="group" aria-label="Interlock: what you can and cannot do on this series">
        {levers.map((lever, index) => (
          <Tip
            key={lever.id}
            container={layer}
            content={
              <>
                <p className="flex items-center gap-2">
                  <span className="plate-label text-label">{lever.label}</span>
                  <span className={lever.state === "free" ? "h-2 w-2 rounded-full bg-iron" : "h-2 w-2 rounded-full shadow-[inset_0_0_0_1.5px_var(--color-iron-2)]"} aria-hidden="true" />
                  <span className="text-label text-iron-2">{lever.state === "free" ? `${freeCaption(lever)} for you` : "locked"}</span>
                </p>
                <p className="mt-1">{DOES[lever.id]}</p>
                {lever.state === "locked" && (
                  <p className="mt-2 border-t border-rule pt-2 text-iron-2">
                    {lever.lock}. Pull it anyway and the chain refuses: <span className="fig text-refuse [overflow-wrap:anywhere]">{lever.err}</span>
                  </p>
                )}
              </>
            }
          >
            <Lever
              lever={lever}
              refused={refused === lever.id}
              index={index}
              label={lever.state === "free" ? `${lever.label}: ${freeCaption(lever)}` : `${lever.label}: locked, ${lever.lock}. Pull to test the lock.`}
              caption={lever.state === "locked" ? lever.lock : freeCaption(lever)}
              onPull={() => onPull(lever)}
            />
          </Tip>
        ))}
      </div>
    </TipProvider>
  );
}
