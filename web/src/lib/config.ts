import { MAINNET_ARCHIVES, MAINNET_NODES } from "./nearRpc";

export type Network = "mainnet" | "sandbox";

const env = import.meta.env;

/** Where the board reads from. Set per build (docs/DESIGN.md "Data truth"). */
const network = (env.VITE_NETWORK ?? "mainnet") as Network;
const rpcUrl = env.VITE_RPC_URL ?? "https://free.rpc.fastnear.com";

export const config = {
  network,
  rpcUrl,
  /** The nodes the page may read from, in order (`anyNode`). A build that names one uses only that. */
  rpcUrls: env.VITE_RPC_URL ? [rpcUrl] : MAINNET_NODES,
  /**
   * For reading old transactions by hash (the refusals band): a regular node forgets them after a
   * few epochs (docs/CONTEXT.md, "Reading transactions back"); archival nodes keep every one.
   */
  archivalRpcUrls: env.VITE_ARCHIVAL_RPC_URL ? [env.VITE_ARCHIVAL_RPC_URL] : network === "mainnet" ? MAINNET_ARCHIVES : [rpcUrl],
  optionsContract: env.VITE_OPTIONS_CONTRACT ?? "",
  intentsContract: env.VITE_INTENTS_CONTRACT ?? "intents.near",
  /** The wNEAR contract Intents uses for NEAR (no view exposes it; mainnet `wrap.near`). */
  wrapContract: env.VITE_WRAP_CONTRACT ?? "wrap.near",
  /** The public source repository, linked from the footer once it exists. */
  repoUrl: env.VITE_REPO_URL ?? "",
  /** Where intents signed by wallets without a NEAR account go to be sent (web/relay/relay.ts, D-030). */
  relayUrl: env.VITE_RELAY_URL ?? "/api/relay",
};

/** Explorer links exist only for mainnet; the sandbox has none. */
export const explorer =
  config.network === "mainnet"
    ? {
        tx: (hash: string) => `https://nearblocks.io/txns/${hash}`,
        account: (id: string) => `https://nearblocks.io/address/${id}`,
      }
    : null;
