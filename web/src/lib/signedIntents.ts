/**
 * Warrant's calls as the intents a wallet without a NEAR account signs (D-030; docs/SPEC.md
 * "Signed actions"). Writes, purchases and exercises become `transfer` intents carrying their
 * `msg`; the direct methods become `auth_call` intents to `on_auth`; positions move inside Intents
 * with `transfer` and back to Warrant's ledger with `mt_withdraw`. Warrant's relayer sends them.
 */
import { bytesToBase64 } from "./base58";
import { chainNow } from "./clock";
import { config } from "./config";
import { personalSign } from "./evm";
import type { Outcome } from "./nearTx";
import { view } from "./rpc";
import type { Call } from "./wallet";

export type Intent = { intent: string } & Record<string, unknown>;

/** How long a signature stays valid: Intents refuses it after this, and the relayer allows ≤ 15 min. */
export const DEADLINE_MS = 10 * 60_000;
const AUTH_METHODS = new Set(["list", "cancel_offer", "close", "withdraw_proceeds", "reclaim_collateral", "retry_payout", "mt_transfer_call"]);

/** The intent `call` becomes when an EVM wallet signs it, or `null` when Warrant can't relay it. */
export function intentOf(call: Call): Intent | null {
  const args = call.args as Record<string, unknown>;
  const fromIntents = call.receiverId === config.intentsContract;
  if (fromIntents && call.method === "mt_transfer_call" && args.receiver_id === config.optionsContract) {
    return { intent: "transfer", receiver_id: config.optionsContract, tokens: { [String(args.token_id)]: String(args.amount) }, msg: args.msg };
  }
  if (call.receiverId === config.optionsContract && AUTH_METHODS.has(call.method)) {
    return { intent: "auth_call", contract_id: config.optionsContract, msg: JSON.stringify({ action: call.method, ...args }) };
  }
  if (fromIntents && call.method === "mt_transfer" && String(args.token_id).startsWith(`nep245:${config.optionsContract}:`)) {
    return { intent: "transfer", receiver_id: args.receiver_id, tokens: { [String(args.token_id)]: String(args.amount) } };
  }
  if (fromIntents && call.method === "mt_withdraw" && args.token === config.optionsContract) {
    return { intent: "mt_withdraw", token: args.token, receiver_id: args.receiver_id, token_ids: args.token_ids, amounts: args.amounts };
  }
  return null;
}

/** A V1 versioned nonce: `5628f6c6 ‖ 00 ‖ salt ‖ deadline (i64 LE, ns) ‖ 15 random bytes`. */
function versionedNonce(salt: string, deadlineMs: number): string {
  const bytes = new Uint8Array(32);
  bytes.set([0x56, 0x28, 0xf6, 0xc6, 0]);
  bytes.set(Uint8Array.from(salt.match(/../g) ?? [], (pair) => parseInt(pair, 16)), 5);
  new DataView(bytes.buffer).setBigInt64(9, BigInt(deadlineMs) * 1_000_000n, true);
  bytes.set(crypto.getRandomValues(new Uint8Array(15)), 17);
  return bytesToBase64(bytes);
}

/** The ERC-191 message for `intents`, valid for DEADLINE_MS of chain time from now. */
async function payloadFor(signer: string, intents: Intent[]): Promise<string> {
  // Whole milliseconds: the clock estimate is fractional, and the nonce encodes it as an integer.
  const deadline = Math.floor(chainNow()) + DEADLINE_MS;
  const salt = await view<string>(config.intentsContract, "current_salt");
  return JSON.stringify({
    signer_id: signer,
    verifying_contract: config.intentsContract,
    deadline: new Date(deadline).toISOString(),
    nonce: versionedNonce(salt, deadline),
    intents,
  });
}

/** Has the wallet sign `calls` as intents, then the relayer send them; resolves to the outcome. */
export async function relaySigned(signer: string, calls: Call[]): Promise<Outcome> {
  const intents = calls.map((call) => {
    const intent = intentOf(call);
    if (!intent) throw new Error(`${call.method} needs a NEAR wallet: Warrant doesn't relay it for an EVM wallet.`);
    return intent;
  });
  const payload = await payloadFor(signer, intents);
  const signature = await personalSign(signer, payload);
  const response = await fetch(config.relayUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ signed: { standard: "erc191", payload, signature } }),
  });
  let body: { outcome?: Outcome; error?: string } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // Not JSON (a host without the relayer answers with a page): reported below.
  }
  if (!response.ok || !body.outcome) throw new Error(body.error ?? `Warrant's relayer didn't answer (HTTP ${response.status}).`);
  return body.outcome;
}
