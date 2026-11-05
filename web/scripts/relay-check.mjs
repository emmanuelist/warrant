/**
 * Checks the relayer (relay/relay.ts, D-030) end to end on the running devnet. A wallet with no
 * NEAR account signs erc191 intents with the tests' deterministic EVM key (32 bytes of 0x42,
 * tests/common/evm.rs); the dev server relays them; every result is read back from chain.
 *
 *   cargo test --test devnet -- --ignored --nocapture   # in contracts/options
 *   npm run dev                                         # in web/
 *   node scripts/relay-check.mjs [dev-server-origin]    # default http://localhost:5173
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

import { base58Encode, bytesToBase64 } from "../src/lib/base58.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.development.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);
const RPC = env.VITE_RPC_URL;
const OPTIONS = env.VITE_OPTIONS_CONTRACT;
const INTENTS = env.VITE_INTENTS_CONTRACT;
const WNEAR = "nep141:wrap.sandbox";
const WNEAR_ONE = 10n ** 24n;
const TUSDC_ONE = 10n ** 6n;
const origin = process.argv[2] ?? "http://localhost:5173";

const key = new Uint8Array(32).fill(0x42);
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const address = `0x${hex(keccak_256(secp256k1.getPublicKey(key, false).slice(1)).slice(12))}`;

async function rpc(method, params) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "check", method, params }),
  });
  const body = await response.json();
  if (body.result === undefined) throw new Error(JSON.stringify(body.error));
  return body.result;
}

async function view(contract, method, args) {
  const result = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: contract,
    method_name: method,
    args_base64: bytesToBase64(new TextEncoder().encode(JSON.stringify(args))),
  });
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(result.result)));
}

/** Intents checks deadlines against block time, which a seeded devnet runs ahead of. */
const chainNow = async () => Number(BigInt((await rpc("block", { finality: "final" })).header.timestamp_nanosec) / 1_000_000n);

const balance = async (token) => BigInt(await view(INTENTS, "mt_balance_of", { account_id: address, token_id: token }));

/** `personal_sign` as an EVM wallet returns it: r ‖ s ‖ v, v = 27 or 28. */
function personalSign(message) {
  const bytes = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${bytes.length}`);
  const digest = keccak_256(new Uint8Array([...prefix, ...bytes]));
  // noble's "recovered" format puts the recovery byte first.
  const signature = secp256k1.sign(digest, key, { prehash: false, format: "recovered" });
  return new Uint8Array([...signature.slice(1), 27 + signature[0]]);
}

/** A V1 versioned nonce: magic ‖ version ‖ salt ‖ deadline (i64 LE, ns) ‖ 15 random bytes. */
async function nonce(deadlineMs) {
  const salt = await view(INTENTS, "current_salt", {});
  const bytes = new Uint8Array(32);
  bytes.set([0x56, 0x28, 0xf6, 0xc6, 0]);
  bytes.set(Uint8Array.from(salt.match(/../g), (pair) => parseInt(pair, 16)), 5);
  new DataView(bytes.buffer).setBigInt64(9, BigInt(deadlineMs) * 1_000_000n, true);
  bytes.set(crypto.getRandomValues(new Uint8Array(15)), 17);
  return bytesToBase64(bytes);
}

/** @param {{deadlineMs?: number, verifyingContract?: string, rawV?: boolean}} options */
async function sign(intents, options = {}) {
  const deadline = (await chainNow()) + (options.deadlineMs ?? 5 * 60_000);
  const payload = JSON.stringify({
    signer_id: address,
    verifying_contract: options.verifyingContract ?? INTENTS,
    deadline: new Date(deadline).toISOString(),
    nonce: await nonce(deadline),
    intents: [intents].flat(),
  });
  const signature = personalSign(payload);
  if (!options.rawV) signature[64] -= 27;
  return { standard: "erc191", payload, signature: `secp256k1:${base58Encode(signature)}` };
}

async function relay(signed, method = "POST") {
  const response = await fetch(`${origin}/api/relay`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify({ signed }) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

const failures = (outcome) => JSON.stringify(outcome.receipts_outcome.map((r) => r.outcome.status).filter((s) => JSON.stringify(s).includes("Failure")));

function line(label, detail) {
  console.log(`${label.padEnd(44)} ${detail}`);
}

const toOptions = (token, amount, msg) => ({
  intent: "transfer",
  receiver_id: OPTIONS,
  tokens: { [token]: amount.toString() },
  msg: JSON.stringify(msg),
});

line("wallet (no NEAR account)", address);
const wnear = await balance(WNEAR);
line("wNEAR inside Intents", `${wnear / WNEAR_ONE}`);
assert.ok(wnear >= WNEAR_ONE, "tests/devnet.rs funds this wallet");

// 1. A write through the relayer: the series' writer is the 0x address.
const before = await view(OPTIONS, "get_series_list", { limit: "100" });
const expiry = (BigInt(await chainNow()) + 86_400_000n) * 1_000_000n;
const create = await sign(
  toOptions(WNEAR, WNEAR_ONE, {
    action: "create",
    kind: "call",
    underlying: WNEAR,
    quote: "nep141:tusdc.sandbox",
    underlying_per_option: WNEAR_ONE.toString(),
    strike_per_option: (2n * TUSDC_ONE).toString(),
    expiry_ns: expiry.toString(),
  }),
);
const written = await relay(create);
assert.equal(written.status, 200, JSON.stringify(written.body));
assert.equal(failures(written.body.outcome), "[]");
const after = await view(OPTIONS, "get_series_list", { limit: "100" });
const series = after[after.length - 1];
assert.equal(after.length, before.length + 1);
assert.equal(series.writer, address);
line("200 write (transfer + create msg)", `series #${series.series_id}, writer ${series.writer}, tx ${written.body.outcome.transaction.hash}`);

// 2. A list through on_auth.
const listed = await relay(await sign({ intent: "auth_call", contract_id: OPTIONS, msg: JSON.stringify({ action: "list", series_id: series.series_id, amount: "1", price_per_option: (TUSDC_ONE / 2n).toString() }) }));
assert.equal(listed.status, 200, JSON.stringify(listed.body));
assert.equal(failures(listed.body.outcome), "[]");
const offers = await view(OPTIONS, "get_offers", { limit: "100" });
const offer = offers.find((o) => o.seller === address && o.series_id === series.series_id);
assert.ok(offer, "an offer by the 0x address on the new series");
line("200 list (auth_call -> on_auth)", `offer #${offer.offer_id}, seller ${offer.seller}`);

// 3. Relayed, then refused by Warrant on chain: Intents refunds in full.
const held = await balance(WNEAR);
const refused = await relay(await sign(toOptions(WNEAR, WNEAR_ONE, { action: "write", series_id: "1" })));
assert.equal(refused.status, 200);
assert.match(failures(refused.body.outcome), /ERR_NOT_WRITER/);
assert.equal(await balance(WNEAR), held, "refunded in full");
line("200 relayed, refused on chain", `ERR_NOT_WRITER, wNEAR unchanged, tx ${refused.body.outcome.transaction.hash}`);

// 4. What a relayed action needs of the gas it's given: one exercise, then a reclaim through on_auth.
const oneOption = async (expiryNs) => {
  const made = await relay(
    await sign(
      toOptions(WNEAR, WNEAR_ONE, {
        action: "create",
        kind: "call",
        underlying: WNEAR,
        quote: "nep141:tusdc.sandbox",
        underlying_per_option: WNEAR_ONE.toString(),
        strike_per_option: (2n * TUSDC_ONE).toString(),
        expiry_ns: expiryNs.toString(),
      }),
    ),
  );
  assert.equal(made.status, 200, JSON.stringify(made.body));
  assert.equal(failures(made.body.outcome), "[]");
  return (await view(OPTIONS, "get_series_list", { limit: "100" })).at(-1);
};
const single = await oneOption(expiry);
const exercisedOne = await relay(await sign(toOptions("nep141:tusdc.sandbox", 2n * TUSDC_ONE, { action: "exercise", series_id: single.series_id, amount: "1" })));
assert.equal(exercisedOne.status, 200, JSON.stringify(exercisedOne.body));
assert.equal(failures(exercisedOne.body.outcome), "[]");
assert.equal((await view(OPTIONS, "get_series", { series_id: single.series_id })).collateral_held, "0");
line("200 one exercise", `paid both ways, tx ${exercisedOne.body.outcome.transaction.hash}`);

const lapsing = await oneOption((BigInt(await chainNow()) + 90_000n) * 1_000_000n);
while (!(await view(OPTIONS, "get_series", { series_id: lapsing.series_id })).expired) await new Promise((resolve) => setTimeout(resolve, 3_000));
const reclaimed = await relay(await sign({ intent: "auth_call", contract_id: OPTIONS, msg: JSON.stringify({ action: "reclaim_collateral", series_id: lapsing.series_id }) }));
assert.equal(reclaimed.status, 200, JSON.stringify(reclaimed.body));
assert.equal(failures(reclaimed.body.outcome), "[]");
assert.equal((await view(OPTIONS, "get_series", { series_id: lapsing.series_id })).collateral_held, "0");
line("200 reclaim (auth_call -> on_auth)", `collateral back, tx ${reclaimed.body.outcome.transaction.hash}`);

// 5. Two exercises under one signature, each paying two transfers: the most the relayer's gas carries.
const twoCalls = await relay(
  await sign(
    toOptions(WNEAR, 2n * WNEAR_ONE, {
      action: "create",
      kind: "call",
      underlying: WNEAR,
      quote: "nep141:tusdc.sandbox",
      underlying_per_option: WNEAR_ONE.toString(),
      strike_per_option: (2n * TUSDC_ONE).toString(),
      expiry_ns: expiry.toString(),
    }),
  ),
);
assert.equal(twoCalls.status, 200, JSON.stringify(twoCalls.body));
const pairSeries = (await view(OPTIONS, "get_series_list", { limit: "100" })).at(-1);
const exercise = toOptions("nep141:tusdc.sandbox", 2n * TUSDC_ONE, { action: "exercise", series_id: pairSeries.series_id, amount: "1" });
const pair = await relay(await sign([exercise, exercise]));
assert.equal(pair.status, 200, JSON.stringify(pair.body));
assert.equal(failures(pair.body.outcome), "[]");
const exercised = await view(OPTIONS, "get_series", { series_id: pairSeries.series_id });
assert.equal(exercised.exercised, "2");
assert.equal(exercised.collateral_held, "0");
const paid = pair.body.outcome.receipts_outcome.reduce((sum, r) => sum + BigInt(r.outcome.gas_burnt), BigInt(pair.body.outcome.transaction_outcome.outcome.gas_burnt));
line("200 two exercises, one signature", `burnt ${Number(paid / 10n ** 11n) / 10} TGas of the relayer's prepaid gas, tx ${pair.body.outcome.transaction.hash}`);

// 6. What the relayer itself refuses, and why.
const three = toOptions(WNEAR, 1n, { action: "write", series_id: "1" });
const cases = [
  ["three intents under one signature", sign([three, three, three]), 400, /One to 2 intents/],
  ["a transfer to another account with a msg", sign({ intent: "transfer", receiver_id: "alice.sandbox", tokens: { [WNEAR]: "1" }, msg: "{}" }), 400, /Warrant action/],
  ["a plain wNEAR transfer out", sign({ intent: "transfer", receiver_id: "bob.sandbox", tokens: { [WNEAR]: "1" } }), 400, /Warrant action/],
  ["an auth_call to another contract", sign({ intent: "auth_call", contract_id: "wrap.sandbox", msg: "{}" }), 400, /Warrant action/],
  ["another network's verifying_contract", sign(toOptions(WNEAR, 1n, { action: "write", series_id: "1" }), { verifyingContract: "intents.near" }), 400, /verifying_contract/],
  ["a deadline an hour out", sign(toOptions(WNEAR, 1n, { action: "write", series_id: "1" }), { deadlineMs: 3_600_000 }), 400, /15 minutes/],
  ["v left at 27/28", sign(toOptions(WNEAR, 1n, { action: "write", series_id: "1" }), { rawV: true }), 422, /invalid signature/],
  ["the first write, replayed", Promise.resolve(create), 422, /nonce was already used/],
];
for (const [label, signed, status, pattern] of cases) {
  const result = await relay(await signed);
  assert.equal(result.status, status, `${label}: ${JSON.stringify(result.body)}`);
  assert.match(result.body.error ?? "", pattern);
  line(`${status} ${label}`, result.body.error);
}
const get = await relay({}, "GET");
assert.equal(get.status, 405);
line("405 GET", get.body.error);
console.log("relay check passed");
