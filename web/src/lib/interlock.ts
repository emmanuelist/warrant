import type { Offer, Series } from "./chain";
import { utcShort } from "./format";

export type ActionId = "write" | "list" | "buy" | "exercise" | "close" | "proceeds" | "reclaim";
export type Tone = "lock" | "iron" | "live" | "release" | "deliver";

export interface Lever {
  id: ActionId;
  num: number;
  label: string;
  /** Enamel by function: what the lever moves (docs/DESIGN.md "Tokens"). */
  tone: Tone;
  state: "free" | "locked";
  /** Why it's locked, in contract terms. */
  lock?: string;
  /** The chain refusal this lock mirrors (docs/SPEC.md "Refusals"). */
  err?: string;
  /** A free lever's caveat, shown as its caption ("only your offers"). */
  note?: string;
}

interface Context {
  viewer: string | null;
  longs: bigint;
  offers: Offer[];
  nowMs: number;
}

/** The series' state machine for this viewer, one lever per action. */
export function interlock(series: Series, { viewer, longs, offers, nowMs }: Context): Lever[] {
  const expired = nowMs >= Number(BigInt(series.expiry_ns) / 1_000_000n);
  const isWriter = viewer !== null && viewer === series.writer;
  const holds = longs > 0n;
  const open = offers.filter((o) => o.series_id === series.series_id && BigInt(o.remaining) > 0n);
  const openOffer = open.length > 0;
  // Buying your own offer isn't refused by the contract (it only pays you back), so the lever stays
  // free; its caption says why its sheet points to Cancel instead.
  const onlyYours = openOffer && open.every((o) => o.seller === viewer);
  const afterExpiry = { lock: `closed ${utcShort(series.expiry_ns)}`, err: "ERR_EXPIRED" };
  const writerOnly = { lock: "writer only", err: "ERR_NOT_WRITER" };
  const noLongs = { lock: "hold ≥ 1 long", err: "ERR_INSUFFICIENT_LONGS" };

  const lever = (
    id: ActionId,
    num: number,
    label: string,
    tone: Tone,
    blocked: { lock: string; err?: string } | null,
  ): Lever => (blocked ? { id, num, label, tone, state: "locked", ...blocked } : { id, num, label, tone, state: "free" });

  // Each lever checks its conditions in the same order as the contract, so the lock named here is
  // the refusal the chain returns when the lock is tested (contracts/options/src).
  const levers = [
    lever("write", 1, "Write", "lock", !isWriter ? writerOnly : expired ? afterExpiry : null),
    lever("list", 2, "List", "iron", expired ? afterExpiry : !holds ? noLongs : null),
    lever("buy", 3, "Buy", "iron", !openOffer ? { lock: "no open offer", err: "ERR_UNKNOWN_OFFER" } : expired ? afterExpiry : null),
    lever("exercise", 4, "Exercise", "live", expired ? afterExpiry : !holds ? noLongs : null),
    lever("close", 5, "Close", "release", !isWriter ? writerOnly : expired ? afterExpiry : !holds ? noLongs : null),
    lever(
      "proceeds",
      6,
      "Proceeds",
      "deliver",
      !isWriter ? writerOnly : BigInt(series.proceeds_held) === 0n ? { lock: "nothing received", err: "ERR_NOTHING_TO_PAY" } : null,
    ),
    lever(
      "reclaim",
      7,
      "Reclaim",
      "release",
      !isWriter
        ? writerOnly
        : !expired
          ? { lock: `until ${utcShort(series.expiry_ns)}`, err: "ERR_NOT_EXPIRED" }
          : series.reclaimed
            ? { lock: "already reclaimed", err: "ERR_ALREADY_RECLAIMED" }
            : null,
    ),
  ];
  return levers.map((l) => (l.id === "buy" && l.state === "free" && onlyYours ? { ...l, note: "only your offers" } : l));
}

/** A free lever's caption: its caveat if it has one, the two claims as claimable, else free. */
export function freeCaption(lever: Lever): string {
  return lever.note ?? (lever.id === "proceeds" || lever.id === "reclaim" ? "claimable" : "free");
}

/**
 * The viewer's likely next move on a series, offered first on the trade card ahead of the whole
 * Interlock: claims before trades for its writer, the right itself for a holder, and the best open
 * offer for anyone else. `null` when nothing is free that a person would come here to do.
 */
export function likelyMove(
  levers: Lever[],
  { isWriter, holds, buyable, exerciseNet = null }: { isWriter: boolean; holds: boolean; buyable: boolean; exerciseNet?: number | null },
): Lever | null {
  const free = (id: ActionId) => levers.find((l) => l.id === id && l.state === "free") ?? null;
  // Exercising at a loss is the one irreversible way to lose money here: when the indicative net is
  // negative, listing the longs is the move offered first.
  const exercise = exerciseNet !== null && exerciseNet < 0 ? null : free("exercise");
  if (isWriter) return free("reclaim") ?? free("proceeds") ?? (holds ? free("list") : null) ?? free("write");
  if (holds) return exercise ?? free("list");
  return buyable ? free("buy") : null;
}

/** Where a series is in its life, from chain state and chain time. */
export type Phase = "locked" | "released" | "reclaimed";

export function phase(series: Series, nowMs: number): Phase {
  if (series.reclaimed) return "reclaimed";
  return nowMs >= Number(BigInt(series.expiry_ns) / 1_000_000n) ? "released" : "locked";
}
