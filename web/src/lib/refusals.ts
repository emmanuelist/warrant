import { config } from "./config";
import { rpc } from "./rpc";

export type RefusalId = "reclaim-early" | "exercise-expired" | "exercise-unheld";

/**
 * The refusals band's recorded transactions on this network: `id:signer:hash,…` in
 * VITE_REFUSAL_TXS, written by tests/devnet.rs on the devnet and by the demo run on mainnet. They
 * are only pointers: everything the band shows is read back from chain by hash.
 */
export const recorded: Partial<Record<RefusalId, { signer: string; hash: string }>> = Object.fromEntries(
  ((import.meta.env.VITE_REFUSAL_TXS as string | undefined) ?? "")
    .split(",")
    .map((entry) => entry.trim().split(":"))
    .filter((parts) => parts.length === 3 && parts.every(Boolean))
    .map(([id, signer, hash]) => [id, { signer, hash }]),
);

/** The parts of the `tx` RPC's final execution outcome we read (docs/CONTEXT.md, "RPC"). */
interface TxResult {
  transaction: { signer_id: string; receiver_id: string; actions: ({ FunctionCall?: { method_name: string; args: string } } | string)[] };
  transaction_outcome: { block_hash: string };
  receipts_outcome: { outcome: { executor_id: string; logs: string[]; status: unknown } }[];
}

interface Nep245Event {
  standard?: string;
  event?: string;
  data?: { old_owner_id?: string; new_owner_id?: string; token_ids?: string[]; amounts?: string[]; memo?: string }[];
}

export interface ReadBack {
  hash: string;
  signer: string;
  receiver: string;
  method: string;
  /** For a transfer through Intents, the action it carried to Warrant (`msg`), e.g. exercise. */
  action: Record<string, string> | null;
  /** The ERR_* this contract's failed receipt returned. */
  err: string | null;
  /** What Intents sent back to the signer: NEP-245 `mt_transfer` from Warrant, memo "refund". */
  refunds: { tokenId: string; amount: bigint }[];
  atMs: number;
}

function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const fromBase64 = (base64: string) => new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));

/**
 * A refused transaction read back from chain by its hash: who sent what, the contract's refusal
 * from its failed receipt, Intents' refund from its event log, and the block's time. Old hashes
 * need an archival node (`config.archivalRpcUrl`).
 */
export async function readRefusal(hash: string, signer: string): Promise<ReadBack> {
  const tx = await rpc<TxResult>("tx", { tx_hash: hash, sender_account_id: signer, wait_until: "NONE" }, config.archivalRpcUrl);
  const block = await rpc<{ header: { timestamp_nanosec: string } }>("block", { block_id: tx.transaction_outcome.block_hash }, config.archivalRpcUrl);

  const call = tx.transaction.actions.map((a) => (typeof a === "string" ? null : a.FunctionCall)).find(Boolean);
  const args = call ? (json(fromBase64(call.args)) as Record<string, unknown> | null) : null;
  const msg = typeof args?.msg === "string" ? (json(args.msg) as Record<string, string> | null) : null;

  const failed = tx.receipts_outcome.filter(
    (r) => r.outcome.executor_id === config.optionsContract && typeof r.outcome.status === "object" && r.outcome.status !== null && "Failure" in r.outcome.status,
  );
  const err = JSON.stringify(failed).match(/ERR_[A-Z_]+/)?.[0] ?? null;

  const refunds = tx.receipts_outcome
    .flatMap((r) => r.outcome.logs)
    .filter((log) => log.startsWith("EVENT_JSON:"))
    .flatMap((log) => {
      try {
        const event = JSON.parse(log.slice("EVENT_JSON:".length)) as Nep245Event;
        if (event.standard !== "nep245" || event.event !== "mt_transfer") return [];
        return (event.data ?? [])
          .filter((d) => d.memo === "refund" && d.old_owner_id === config.optionsContract && d.new_owner_id === signer)
          .flatMap((d) => (d.token_ids ?? []).map((tokenId, i) => ({ tokenId, amount: BigInt(d.amounts?.[i] ?? "0") })));
      } catch {
        return [];
      }
    });

  return {
    hash,
    signer: tx.transaction.signer_id,
    receiver: tx.transaction.receiver_id,
    method: call?.method_name ?? "",
    action: msg,
    err,
    refunds,
    atMs: Number(BigInt(block.header.timestamp_nanosec) / 1_000_000n),
  };
}
