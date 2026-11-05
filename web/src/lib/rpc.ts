import { config } from "./config";
import { anyNode, RpcError, rpcAt, viewAt } from "./nearRpc";

export { RpcError };

export async function rpc<T>(method: string, params: unknown, urls = config.rpcUrls): Promise<T> {
  return anyNode(urls, (url) => rpcAt<T>(url, method, params));
}

/** A read-only contract call at final finality. */
export async function view<T>(contract: string, method: string, args: object = {}): Promise<T> {
  return anyNode(config.rpcUrls, (url) => viewAt<T>(url, contract, method, args));
}

/** The chain's own clock (latest final block), in milliseconds. */
export async function chainTimeMs(): Promise<number> {
  const block = await rpc<{ header: { timestamp_nanosec: string } }>("block", { finality: "final" });
  return Number(BigInt(block.header.timestamp_nanosec) / 1_000_000n);
}

/** An account's NEAR: `amount` is spendable plus storage-locked; `storage_usage` is in bytes. */
export async function viewAccount(accountId: string): Promise<{ amount: string; storage_usage: number } | null> {
  try {
    return await rpc<{ amount: string; storage_usage: number }>("query", {
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    });
  } catch (error) {
    if (error instanceof RpcError && error.message === "UNKNOWN_ACCOUNT") return null;
    throw error;
  }
}
