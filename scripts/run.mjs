#!/usr/bin/env node
/**
 * The real transactions behind the mainnet board (#10, D-027): the allowlist, balances inside
 * Intents, a series with an offer, and the three refusals the board reads back by hash. `--devnet`
 * points the same steps at the local sandbox, which is how they are rehearsed before they cost
 * anything. Keys are read from ~/.near-credentials and never printed.
 *
 *   node scripts/run.mjs [--devnet] status            read-only: accounts, balances, config, board
 *   node scripts/run.mjs [--devnet] allow             owner: allow wNEAR, USDC and BTC
 *   node scripts/run.mjs [--devnet] fund <near>       writer: wrap NEAR and deposit it into Intents
 *   node scripts/run.mjs swap <near>                  mainnet: writer swaps wNEAR to USDC inside Intents through 1Click
 *   node scripts/run.mjs swap-check                   mainnet: signs a real 1Click intent and only simulates it (free)
 *   node scripts/run.mjs [--devnet] share <usdc>      writer: move USDC to the holder inside Intents
 *   node scripts/run.mjs [--devnet] write             writer: the long-dated series and its offer
 *   node scripts/run.mjs [--devnet] refusals          three real refusals; prints VITE_REFUSAL_TXS
 */
import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { base58Encode } from "../web/src/lib/base58.ts";
import { rpcAt, viewAt } from "../web/src/lib/nearRpc.ts";
import { signAndSend } from "../web/src/lib/nearTx.ts";

const args = process.argv.slice(2);
const devnet = args[0] === "--devnet";
if (devnet) args.shift();
const [command, amountArg] = args;

const TGAS = 10n ** 12n;
const MAX_GAS = 300n * TGAS;
const YOCTO = 1n;
const NEAR_ONE = 10n ** 24n;
const USDC_ONE = 10n ** 6n;
const SECOND_NS = 10n ** 9n;
const DAY_NS = 86_400n * SECOND_NS;

const net = devnet ? devnetProfile() : mainnetProfile();

function mainnetProfile() {
  const credentials = join(homedir(), ".near-credentials");
  const implicit = (id) => JSON.parse(readFileSync(join(credentials, "implicit", `${id}.json`), "utf8")).private_key;
  const owner = "d0482bffd77daa246ff50cd36cd8c8392548a0cf0fc7d6ccd887a3675f084148";
  // The second account's key file is made by scripts/mainnet-deploy.sh, on the first run only.
  const holderDir = join(credentials, "warrant-holder");
  const holder = readdirSafe(holderDir)[0]?.replace(/\.json$/, "") ?? null;
  return {
    rpc: "https://free.rpc.fastnear.com",
    options: "warrant-options.near",
    intents: "intents.near",
    wrap: "wrap.near",
    usdc: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    btc: "nep141:btc.omft.near",
    owner,
    writer: owner,
    holder,
    key: (account) => (account === owner ? implicit(owner) : JSON.parse(readFileSync(join(holderDir, `${account}.json`), "utf8")).private_key),
  };
}

function devnetProfile() {
  const env = Object.fromEntries(
    readFileSync(new URL("../web/.env.development.local", import.meta.url), "utf8")
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
  return {
    rpc: env.VITE_RPC_URL,
    options: env.VITE_OPTIONS_CONTRACT,
    intents: env.VITE_INTENTS_CONTRACT,
    wrap: env.VITE_WRAP_CONTRACT,
    usdc: "nep141:tusdc.sandbox",
    btc: null,
    owner: "owner.sandbox",
    writer: "carol.sandbox",
    holder: "bob.sandbox",
    key: () => env.VITE_SANDBOX_SIGNER_KEY,
  };
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

const wnear = `nep141:${net.wrap}`;
const view = (account, method, params = {}) => viewAt(net.rpc, account, method, params);

/** The chain's clock: expiries are checked against block time, which a devnet may run ahead of. */
async function chainNowNs() {
  const block = await rpcAt(net.rpc, "block", { finality: "final" });
  return BigInt(block.header.timestamp_nanosec);
}

async function send(signer, receiverId, method, callArgs, deposit = YOCTO, gas = MAX_GAS) {
  return signAndSend(net.rpc, net.key(signer), signer, { receiverId, actions: [{ method, args: callArgs, gas, deposit }] });
}

const failures = (outcome) =>
  outcome.receipts_outcome
    .map((receipt) => receipt.outcome.status)
    .filter((status) => typeof status === "object" && status !== null && "Failure" in status);

/** Sends and stops the run if any receipt failed: every step before a refusal must really land. */
async function ok(label, ...call) {
  const outcome = await send(...call);
  const failed = failures(outcome);
  if (failed.length) throw new Error(`${label} failed (${outcome.transaction.hash}): ${JSON.stringify(failed)}`);
  console.log(`${label}: ${outcome.transaction.hash}`);
  return outcome;
}

/** `intents.mt_transfer_call` into the options contract: how writes, purchases and exercises arrive (SPEC.md). */
const viaIntents = (signer, token, amount, msg) => [
  signer,
  net.intents,
  "mt_transfer_call",
  { receiver_id: net.options, token_id: token, amount: amount.toString(), approval: null, memo: null, msg: JSON.stringify(msg) },
];

const balanceIn = async (account, token) => BigInt(await view(net.intents, "mt_balance_of", { account_id: account, token_id: token }));

/** Which series `writer` wrote with these terms: series ids are only returned through logs. */
async function latestSeries(writer) {
  const all = [];
  for (let from = 0; ; from += 100) {
    const page = await view(net.options, "get_series_list", { from_index: String(from), limit: "100" });
    all.push(...page);
    if (page.length < 100) break;
  }
  const mine = all.filter((series) => series.writer === writer);
  return mine.at(-1) ?? null;
}

const createMsg = (underlyingPerOption, strikePerOption, expiryNs) => ({
  action: "create",
  kind: "call",
  underlying: wnear,
  quote: net.usdc,
  underlying_per_option: underlyingPerOption.toString(),
  strike_per_option: strikePerOption.toString(),
  expiry_ns: expiryNs.toString(),
});

// A call on 0.1 NEAR with a 0.45 USDC strike: tiny, as D-004 asks.
const PER_OPTION = NEAR_ONE / 10n;
const STRIKE = (USDC_ONE * 45n) / 100n;
const PREMIUM = (USDC_ONE * 2n) / 100n;

const steps = {
  async status() {
    const now = await chainNowNs();
    console.log(`network ${devnet ? "devnet" : "mainnet"} · chain time ${new Date(Number(now / 1_000_000n)).toISOString()}`);
    for (const [role, id] of [
      ["owner", net.owner],
      ["writer", net.writer],
      ["holder", net.holder],
      ["contract", net.options],
    ]) {
      if (!id) {
        console.log(`${role}: no key file yet`);
        continue;
      }
      try {
        const account = await rpcAt(net.rpc, "query", { request_type: "view_account", finality: "final", account_id: id });
        const keys = await rpcAt(net.rpc, "query", { request_type: "view_access_key_list", finality: "final", account_id: id });
        const near = Number((BigInt(account.amount) * 10_000n) / NEAR_ONE) / 10_000;
        console.log(`${role} ${id}: ${near} NEAR · ${account.storage_usage} bytes · code ${account.code_hash} · ${keys.keys.length} key(s)`);
      } catch (error) {
        console.log(`${role} ${id}: ${error instanceof Error ? error.message.slice(0, 90) : error}`);
      }
    }
    for (const id of [net.writer, net.holder].filter(Boolean)) {
      console.log(`inside Intents ${id}: wNEAR ${await balanceIn(id, wnear)} · USDC ${await balanceIn(id, net.usdc)}`);
    }
    try {
      console.log("config:", JSON.stringify(await view(net.options, "get_config")));
      const series = await view(net.options, "get_series_list", { from_index: "0", limit: "100" });
      const offers = await view(net.options, "get_offers", { from_index: "0", limit: "100" });
      console.log(`board: ${series.length} series, ${offers.length} offers`);
    } catch (error) {
      console.log(`contract: ${error instanceof Error ? error.message.slice(0, 90) : error}`);
    }
  },

  async allow() {
    const tokens = [
      [wnear, NEAR_ONE / 20n],
      [net.usdc, USDC_ONE / 5n],
      // 1,000 sats: bridged BTC has 8 decimals (ft_metadata, 2026-11-05).
      ...(net.btc ? [[net.btc, 1_000n]] : []),
    ];
    for (const [token, min] of tokens) {
      await ok(`allow ${token}`, net.owner, net.options, "allow_token", { token_id: token, min_amount: min.toString() }, YOCTO, 30n * TGAS);
    }
    console.log(JSON.stringify((await view(net.options, "get_config")).allowed_tokens ?? (await view(net.options, "get_config"))));
  },

  async fund() {
    if (!amountArg) throw new Error("fund <near>");
    const amount = (BigInt(Math.round(Number(amountArg) * 1_000_000)) * NEAR_ONE) / 1_000_000n;
    const registered = await view(net.wrap, "storage_balance_of", { account_id: net.writer });
    if (registered === null) {
      const bounds = await view(net.wrap, "storage_balance_bounds");
      await ok("register on wNEAR", net.writer, net.wrap, "storage_deposit", { account_id: net.writer, registration_only: true }, BigInt(bounds.min), 20n * TGAS);
    }
    await ok("wrap", net.writer, net.wrap, "near_deposit", {}, amount, 20n * TGAS);
    await ok("deposit into Intents", net.writer, net.wrap, "ft_transfer_call", { receiver_id: net.intents, amount: amount.toString(), msg: "" });
    console.log(`writer wNEAR inside Intents: ${await balanceIn(net.writer, wnear)}`);
  },

  async swap() {
    if (devnet) throw new Error("1Click is mainnet-only");
    if (!amountArg) throw new Error("swap <near>");
    const amount = (BigInt(Math.round(Number(amountArg) * 1_000_000)) * NEAR_ONE) / 1_000_000n;
    const { depositAddress, intent, quote } = await oneClickIntent(amount);
    const signature = await signNep413(intent.payload, net.key(net.writer));
    const signed = { ...intent, ...signature };
    console.log(`quote: ${quote.amountInFormatted} wNEAR → ${quote.amountOutFormatted} USDC`);
    await view(net.intents, "simulate_intents", { signed: [signed] });
    const { intentHash } = await oneClick("/submit-intent", { type: "swap_transfer", signedData: signed });
    console.log(`submitted: ${intentHash}`);
    for (let waited = 0; waited < 180; waited += 5) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      const { status, swapDetails } = await oneClick(`/status?depositAddress=${encodeURIComponent(depositAddress)}`);
      console.log(`${waited + 5}s: ${status}`);
      if (status === "SUCCESS") {
        console.log(`near txs: ${JSON.stringify(swapDetails?.nearTxHashes ?? [])}`);
        console.log(`writer USDC inside Intents: ${await balanceIn(net.writer, net.usdc)}`);
        return;
      }
      if (status === "REFUNDED" || status === "FAILED") throw new Error(`1Click: ${status} ${swapDetails?.refundReason ?? ""}`);
    }
    throw new Error("1Click: no final status in three minutes");
  },

  /** Costs nothing: proves the NEP-413 signature is what Intents expects before any funds exist. */
  async "swap-check"() {
    if (devnet) throw new Error("1Click is mainnet-only");
    const { intent, quote } = await oneClickIntent(NEAR_ONE / 10n);
    const signed = { ...intent, ...(await signNep413(intent.payload, net.key(net.writer))) };
    console.log(`quote: ${quote.amountInFormatted} wNEAR → ${quote.amountOutFormatted} USDC`);
    console.log(`payload: ${JSON.stringify({ standard: intent.standard, recipient: intent.payload.recipient, public_key: signed.public_key })}`);
    try {
      console.log("simulate_intents:", JSON.stringify(await view(net.intents, "simulate_intents", { signed: [signed] })));
    } catch (error) {
      console.log(`simulate_intents refused: ${error instanceof Error ? error.message.slice(0, 200) : error}`);
    }
  },

  async share() {
    if (!amountArg) throw new Error("share <usdc>");
    if (!net.holder) throw new Error("no holder key file yet");
    const amount = BigInt(Math.round(Number(amountArg) * 1_000_000));
    await ok("USDC to the holder", net.writer, net.intents, "mt_transfer", {
      receiver_id: net.holder,
      token_id: net.usdc,
      amount: amount.toString(),
      approval: null,
      memo: null,
    });
    console.log(`holder USDC inside Intents: ${await balanceIn(net.holder, net.usdc)}`);
  },

  async write() {
    const now = await chainNowNs();
    // Outlives the hosted demo's last day (2026-11-25, Q-012) when written in November.
    await ok("write 3 calls", ...viaIntents(net.writer, wnear, 3n * PER_OPTION, createMsg(PER_OPTION, STRIKE, now + 30n * DAY_NS)));
    const series = await latestSeries(net.writer);
    await ok(`offer 2 of series ${series.series_id}`, net.writer, net.options, "list", { series_id: series.series_id, amount: "2", price_per_option: PREMIUM.toString() });
    console.log(`series ${series.series_id}: ${series.long_supply} longs, ${series.collateral_held} locked, token ${series.token_id}`);
  },

  async refusals() {
    if (!net.holder) throw new Error("no holder key file yet");
    const longDated = await latestSeries(net.writer);
    if (!longDated) throw new Error("run `write` first");
    const before = { writer: await balanceIn(net.writer, net.usdc), holder: await balanceIn(net.holder, net.usdc) };
    if (before.writer < STRIKE || before.holder < STRIKE) throw new Error(`both need ${STRIKE} USDC inside Intents: ${JSON.stringify(before, (_, v) => v.toString())}`);

    const now = await chainNowNs();
    await ok("write a short-dated call", ...viaIntents(net.writer, wnear, PER_OPTION, createMsg(PER_OPTION, STRIKE, now + 75n * SECOND_NS)));
    const shortDated = await latestSeries(net.writer);
    for (;;) {
      const series = await view(net.options, "get_series", { series_id: shortDated.series_id });
      if (series.expired) break;
      console.log(`series ${shortDated.series_id}: waiting for expiry`);
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }

    const refused = async (id, signer, expected, outcome) => {
      const text = JSON.stringify(failures(outcome));
      if (!text.includes(expected)) throw new Error(`${id}: expected ${expected}, got ${text}`);
      console.log(`${id}: ${expected} ${outcome.transaction.hash}`);
      return `${id}:${signer}:${outcome.transaction.hash}`;
    };
    const entries = [
      await refused("reclaim-early", net.writer, "ERR_NOT_EXPIRED", await send(net.writer, net.options, "reclaim_collateral", { series_id: longDated.series_id })),
      await refused(
        "exercise-expired",
        net.writer,
        "ERR_EXPIRED",
        await send(...viaIntents(net.writer, net.usdc, STRIKE, { action: "exercise", series_id: shortDated.series_id, amount: "1" })),
      ),
      await refused(
        "exercise-unheld",
        net.holder,
        "ERR_INSUFFICIENT_LONGS",
        await send(...viaIntents(net.holder, net.usdc, STRIKE, { action: "exercise", series_id: longDated.series_id, amount: "1" })),
      ),
    ];

    const after = { writer: await balanceIn(net.writer, net.usdc), holder: await balanceIn(net.holder, net.usdc) };
    if (after.writer !== before.writer || after.holder !== before.holder) throw new Error("a refused exercise was not refunded in full");
    console.log("both refused exercises refunded in full");
    await ok(`reclaim series ${shortDated.series_id}`, net.writer, net.options, "reclaim_collateral", { series_id: shortDated.series_id });
    console.log(`VITE_REFUSAL_TXS=${entries.join(",")}`);
  },
};

async function oneClick(path, body) {
  const response = await fetch(`https://1click.chaindefuser.com/v0${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`1Click ${path}: ${response.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

/** A live quote (never dry: only a live one has a deposit address) and its unsigned intent. Moves nothing. */
async function oneClickIntent(amount) {
  const { quote } = await oneClick("/quote", {
    dry: false,
    swapType: "EXACT_INPUT",
    slippageTolerance: 100,
    originAsset: wnear,
    depositType: "INTENTS",
    destinationAsset: net.usdc,
    amount: amount.toString(),
    refundTo: net.writer,
    refundType: "INTENTS",
    recipient: net.writer,
    recipientType: "INTENTS",
    deadline: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  const { intent } = await oneClick("/generate-intent", { type: "swap_transfer", standard: "nep413", signerId: net.writer, depositAddress: quote.depositAddress });
  return { depositAddress: quote.depositAddress, intent, quote };
}

/** NEP-413: sha256 of the tag and the borsh-encoded {message, nonce, recipient, callbackUrl}, signed with ed25519. */
async function signNep413(payload, secret) {
  const encoder = new TextEncoder();
  const string = (text) => {
    const bytes = encoder.encode(text);
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, bytes.length, true);
    return [length, bytes];
  };
  const tag = new Uint8Array(4);
  new DataView(tag.buffer).setUint32(0, 2_147_484_061, true);
  const nonce = Uint8Array.from(atob(payload.nonce), (c) => c.charCodeAt(0));
  const parts = [tag, ...string(payload.message), nonce, ...string(payload.recipient), new Uint8Array([0])];
  const message = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    message.set(part, at);
    at += part.length;
  }
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", message));

  const { base58Decode } = await import("../web/src/lib/base58.ts");
  const bytes = base58Decode(secret.replace(/^ed25519:/, ""));
  const der = new Uint8Array(48);
  der.set([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
  der.set(bytes.slice(0, 32), 16);
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, hash));
  return { public_key: `ed25519:${base58Encode(bytes.slice(32))}`, signature: `ed25519:${base58Encode(signature)}` };
}

const step = steps[command];
if (!step) {
  console.error(`Usage: node scripts/run.mjs [--devnet] ${Object.keys(steps).join("|")}`);
  process.exit(2);
}
await step();
