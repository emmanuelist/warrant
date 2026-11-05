/**
 * The relayer for wallets without a NEAR account (D-030, docs/SPEC.md "Signed actions"). It takes
 * one signed intent and sends it to Intents with `execute_intents`, paying the gas. It holds no
 * funds and decides nothing: it refuses what isn't a Warrant action, previews the rest for free
 * with `simulate_intents`, then sends it. Its key should be a function-call key that can only call
 * `execute_intents` on Intents, with a capped allowance (docs/CONTEXT.md, "Signers without a NEAR
 * account").
 *
 * `handle` is a Fetch-API handler, so any host that runs one can serve it; the dev server mounts it
 * at /api/relay (vite.config.ts).
 */
import { rpcAt, viewAt } from "../src/lib/nearRpc.ts";
import { type Outcome, signAndSend } from "../src/lib/nearTx.ts";

export interface RelayConfig {
  rpcUrl: string;
  /** The Intents contract: the payload's `verifying_contract` and the relayed call's receiver. */
  intents: string;
  /** Warrant's options contract: the only contract a relayed intent may act on. */
  options: string;
  /** The account that pays the gas, and its key. */
  accountId: string;
  secretKey: string;
}

/** A request this relayer won't send, with the HTTP status that says why. */
export class Refused extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const STANDARDS = new Set(["erc191"]);
/** `msg` actions Warrant's `mt_on_transfer` runs (tokens move with them). */
const TRANSFER_ACTIONS = new Set(["create", "write", "buy", "exercise"]);
/** `msg` actions Warrant's `on_auth` runs. */
const AUTH_ACTIONS = new Set(["list", "cancel_offer", "close", "withdraw_proceeds", "reclaim_collateral", "retry_payout", "mt_transfer_call"]);
const MAX_DEADLINE_MS = 15 * 60_000;
const MAX_INTENTS = 4;
const GAS = 300_000_000_000_000n;
/** Per signer, per instance: plenty for a person, too few to drain the gas allowance quickly. */
const LIMIT = { count: 30, windowMs: 10 * 60_000 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(text: unknown): unknown {
  if (typeof text !== "string") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function action(msg: unknown): string | undefined {
  const parsed = parseJson(msg);
  return isRecord(parsed) && typeof parsed.action === "string" ? parsed.action : undefined;
}

/** True when the intent acts on Warrant and on nothing else. */
function touchesOnlyWarrant(intent: unknown, signer: string, cfg: RelayConfig): boolean {
  if (!isRecord(intent)) return false;
  switch (intent.intent) {
    case "transfer": {
      const tokens = isRecord(intent.tokens) ? Object.keys(intent.tokens) : [];
      if (tokens.length !== 1) return false;
      // A Warrant action paid with this token, or a Warrant position moved inside Intents.
      if (intent.msg !== undefined) return intent.receiver_id === cfg.options && TRANSFER_ACTIONS.has(action(intent.msg) ?? "");
      return tokens[0]?.startsWith(`nep245:${cfg.options}:`) ?? false;
    }
    case "auth_call":
      return (
        intent.contract_id === cfg.options &&
        (intent.attached_deposit === undefined || intent.attached_deposit === "0") &&
        AUTH_ACTIONS.has(action(intent.msg) ?? "")
      );
    case "mt_withdraw":
      // Positions back to the signer's own ledger at Warrant, e.g. before exercising them.
      return intent.token === cfg.options && intent.receiver_id === signer && intent.msg === undefined;
    default:
      return false;
  }
}

/** Checks a signed payload and returns its signer, or throws `Refused`. */
export function check(signed: unknown, cfg: RelayConfig, now = Date.now()): string {
  if (!isRecord(signed) || typeof signed.standard !== "string" || !STANDARDS.has(signed.standard)) {
    throw new Refused(400, "Only erc191 payloads are relayed.");
  }
  const payload = parseJson(signed.payload);
  if (!isRecord(payload)) throw new Refused(400, "The payload is not JSON.");
  if (payload.verifying_contract !== cfg.intents) throw new Refused(400, `verifying_contract must be ${cfg.intents}.`);
  const deadline = typeof payload.deadline === "string" ? Date.parse(payload.deadline) : Number.NaN;
  if (!(deadline > now && deadline <= now + MAX_DEADLINE_MS)) throw new Refused(400, "The deadline must be within 15 minutes.");
  const signer = payload.signer_id;
  if (typeof signer !== "string") throw new Refused(400, "The payload names no signer.");
  // A few intents may share one signature (e.g. a long out of Intents, then exercised); Intents
  // runs them in order, all or none.
  const intents = payload.intents;
  if (!Array.isArray(intents) || intents.length < 1 || intents.length > MAX_INTENTS) {
    throw new Refused(400, `One to ${MAX_INTENTS} intents per payload.`);
  }
  if (!intents.every((intent) => touchesOnlyWarrant(intent, signer, cfg))) throw new Refused(400, "Every intent must be a Warrant action.");
  return signer;
}

const recent = new Map<string, number[]>();

function limit(signer: string, now: number) {
  const times = (recent.get(signer) ?? []).filter((time) => time > now - LIMIT.windowMs);
  if (times.length >= LIMIT.count) throw new Refused(429, "Too many intents from this wallet. Try again in a few minutes.");
  times.push(now);
  recent.set(signer, times);
}

/** The chain's clock: Intents checks deadlines against block time, which a devnet may run ahead of. */
async function chainNowMs(cfg: RelayConfig): Promise<number> {
  const block = await rpcAt<{ header: { timestamp_nanosec: string } }>(cfg.rpcUrl, "block", { finality: "final" });
  return Number(BigInt(block.header.timestamp_nanosec) / 1_000_000n);
}

/** Checks, previews and sends one signed payload; resolves to the final execution outcome. */
export async function relay(body: unknown, cfg: RelayConfig): Promise<Outcome> {
  const signed = isRecord(body) ? body.signed : undefined;
  const signer = check(signed, cfg, await chainNowMs(cfg));
  limit(signer, Date.now());
  try {
    await viewAt(cfg.rpcUrl, cfg.intents, "simulate_intents", { signed: [signed] });
  } catch (error) {
    throw new Refused(422, `Intents would refuse it: ${error instanceof Error ? error.message : String(error)}`);
  }
  return signAndSend(cfg.rpcUrl, cfg.secretKey, cfg.accountId, {
    receiverId: cfg.intents,
    actions: [{ method: "execute_intents", args: { signed: [signed] }, gas: GAS, deposit: 0n }],
  });
}

function json(status: number, body: object): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** POST `{signed}` → 200 `{outcome}`, or an error status with `{error}`. */
export async function handle(request: Request, cfg: RelayConfig): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "POST a signed intent." });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "The body is not JSON." });
  }
  try {
    return json(200, { outcome: await relay(body, cfg) });
  } catch (error) {
    if (error instanceof Refused) return json(error.status, { error: error.message });
    return json(502, { error: error instanceof Error ? error.message : String(error) });
  }
}
