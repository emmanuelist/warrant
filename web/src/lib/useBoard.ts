import { useCallback, useEffect, useState } from "react";

import { type Board, loadBoard } from "./chain";
import { syncChainClock } from "./clock";

const REFRESH_MS = 8_000;

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; board: Board };

/** The board, refreshed from chain every few seconds; `reload` after a transaction. */
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
    const tick = async () => {
      if (!cancelled) await reload();
    };
    void tick();
    const id = window.setInterval(tick, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [reload]);

  return { state, reload };
}
