import { useCallback, useEffect, useState } from "react";

import { type Board, loadBoard } from "./chain";
import { syncChainClock } from "./clock";

/** Public nodes limit each visitor, so this stays a slow background read; a transaction reloads at once. */
const REFRESH_MS = 15_000;

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; board: Board };

/** The board, refreshed from chain while it's on screen; `reload` after a transaction. */
export function useBoard(viewer: string | null) {
  const [state, setState] = useState<State>({ status: "loading" });

  const reload = useCallback(async () => {
    try {
      const board = await loadBoard(viewer);
      syncChainClock(board.chainTimeMs, performance.now());
      setState({ status: "ready", board });
    } catch (error) {
      setState((previous) =>
        previous.status === "ready"
          ? previous
          : { status: "error", message: error instanceof Error ? error.message : String(error) },
      );
    }
  }, [viewer]);

  useEffect(() => {
    let cancelled = false;
    let reading = false;
    const tick = async () => {
      if (cancelled || reading || document.hidden) return;
      reading = true;
      await reload();
      reading = false;
    };
    void tick();
    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [reload]);

  return { state, reload };
}
