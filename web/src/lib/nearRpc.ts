/**
 * NEAR JSON-RPC with nothing but `fetch`, for the browser and for the relayer (D-030). No build
 * config is read here: every call names its RPC URL.
 */
import { bytesToBase64 } from "./base58.ts";

export class RpcError extends Error {
  /** What the node said beyond the error's name, such as why a transaction is invalid. */
  detail?: unknown;
  /** The node is the problem (rate limit, overload), not the request: another may answer. */
  busy = false;
}

/** Public mainnet nodes that allow browsers (CORS `*`), checked 2026-11-05 (docs/CONTEXT.md, "Reading transactions back"). */
export const MAINNET_NODES = ["https://free.rpc.fastnear.com", "https://rpc.mainnet.near.org", "https://near.drpc.org", "https://rpc.intea.rs"];
/** The ones that keep old transactions. */
export const MAINNET_ARCHIVES = ["https://archival-rpc.mainnet.fastnear.com", "https://archival-rpc.mainnet.near.org"];

/** Error names that say nothing about the request, only about the node that was asked. */
const NODE_TROUBLE = new Set(["TIMEOUT_ERROR", "INTERNAL_ERROR", "NO_SYNCED_BLOCKS", "UNAVAILABLE_SHARD"]);
/** How long a node that turned us away sits out. */
const REST_MS = 30_000;
const resting = new Map<string, number>();

/**
 * Asks the first node that isn't resting and moves on when one is busy. Public nodes limit each
 * visitor and all of them read the same chain, so one node's limit shouldn't darken the board.
 */
export async function anyNode<T>(urls: string[], call: (url: string) => Promise<T>): Promise<T> {
  const now = Date.now();
  const awake = urls.filter((url) => (resting.get(url) ?? 0) <= now);
  let failure: unknown;
  for (const url of awake.length > 0 ? awake : urls) {
    try {
      return await call(url);
    } catch (error) {
      if (error instanceof RpcError && !error.busy) throw error;
      resting.set(url, Date.now() + REST_MS);
      failure = error;
    }
  }
  throw failure;
}

interface RpcResponse<T> {
  result?: T;
  error?: { message?: string; cause?: { name?: string; info?: unknown }; data?: unknown };
}

export async function rpcAt<T>(url: string, method: string, params: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "warrant", method, params }),
  });
  if (!response.ok) {
    const error = new RpcError(`RPC ${response.status} from ${url}`);
    error.busy = true;
    throw error;
  }
  const body = (await response.json()) as RpcResponse<T>;
  if (body.error || body.result === undefined) {
    const error = new RpcError(body.error?.cause?.name ?? body.error?.message ?? "RPC returned no result");
    error.detail = body.error?.data ?? body.error?.cause?.info;
    error.busy = NODE_TROUBLE.has(body.error?.cause?.name ?? "");
    throw error;
  }
  return body.result;
}

/** A read-only contract call at final finality. */
export async function viewAt<T>(url: string, contract: string, method: string, args: object = {}): Promise<T> {
  const result = await rpcAt<{ result?: number[]; error?: string }>(url, "query", {
    request_type: "call_function",
    finality: "final",
    account_id: contract,
    method_name: method,
    args_base64: bytesToBase64(new TextEncoder().encode(JSON.stringify(args))),
  });
  if (result.error || !result.result) throw new RpcError(result.error ?? `${contract}.${method} returned nothing`);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(result.result))) as T;
}
