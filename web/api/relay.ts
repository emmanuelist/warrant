/**
 * The relayer on Vercel (D-030, docs/CONTEXT.md "Hosting"): `/api/relay`, the same origin as the
 * page. RELAY_* are secrets set in the host's settings and never reach the bundle.
 */
import { handle } from "../relay/relay.ts";

declare const process: { env: Record<string, string | undefined> };

export default {
  fetch(request: Request): Promise<Response> | Response {
    const { RELAY_ACCOUNT_ID: accountId, RELAY_SECRET_KEY: secretKey } = process.env;
    if (!accountId || !secretKey) {
      return new Response(JSON.stringify({ error: "The relayer isn't configured on this host." }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    return handle(request, {
      rpcUrl: process.env.VITE_RPC_URL ?? "https://free.rpc.fastnear.com",
      intents: process.env.VITE_INTENTS_CONTRACT ?? "intents.near",
      options: process.env.VITE_OPTIONS_CONTRACT ?? "warrant-options.near",
      accountId,
      secretKey,
    });
  },
};
