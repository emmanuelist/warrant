import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactElement, ReactNode } from "react";

export const TipProvider = Tooltip.Provider;

/**
 * Hover and keyboard-focus help for a control, as a small floating card. Radix does the behavior
 * (delay, collision, Escape, aria-describedby); `container` keeps it in a modal dialog's top
 * layer when the control sits inside one.
 */
export function Tip({ content, children, container }: { content: ReactNode; children: ReactElement; container?: Element | null }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal container={container}>
        <Tooltip.Content className="tip" side="top" sideOffset={10} collisionPadding={12}>
          {content}
          <Tooltip.Arrow className="tip-arrow" width={12} height={6} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
