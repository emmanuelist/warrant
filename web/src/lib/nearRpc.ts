/**
 * NEAR JSON-RPC with nothing but `fetch`, for the browser and for the relayer (D-030). No build
 * config is read here: every call names its RPC URL.
 */
import { bytesToBase64 } from "./base58.ts";

export class RpcError extends Error {
  /** What the node said beyond the error's name, such as why a transaction is invalid. */
  detail?: unknown;
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
  if (!response.ok) throw new RpcError(`RPC ${response.status} from ${url}`);
  const body = (await response.json()) as RpcResponse<T>;
  if (body.error || body.result === undefined) {
    const error = new RpcError(body.error?.cause?.name ?? body.error?.message ?? "RPC returned no result");
    error.detail = body.error?.data ?? body.error?.cause?.info;
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
