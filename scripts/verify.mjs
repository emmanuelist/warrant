#!/usr/bin/env node
/**
 * Checks Warrant's claims against mainnet and Base. It only reads: no key, no wallet, no install,
 * nothing sent. Takes under a minute, most of it reading the refusal room from public archive
 * nodes. Exits non-zero if a claim doesn't hold.
 *
 *   node scripts/verify.mjs
 */
import { readFileSync } from "node:fs";

const CONTRACT = "warrant-options.near";
const CODE_HASH = "DADQfyxqwetsaZBh5n7JEQ8MnwZKQiqzCxaS465svgYz";
const SOURCE = "https://github.com/emmanuelist/warrant/tree/f14416969258a8f1aa6073adddb57d961f126b57";
// SourceScan's contract: its backend rebuilds a public repo and writes down what it got.
const VERIFIER = "v2-verifier.sourcescan.near";
// Live Intents and wNEAR, as tests/common/mod.rs pins them for the sandbox suites.
const PINS = { "intents.near": "BtA1BEFNS619KkvXFsgcpQ21Tb5yMm32aaUkn7xNothk", "wrap.near": "DL2f5xmZ44cQRP6vBMt94rvseH5d5KKnAGis2WkTAsh1" };
const SITE = "https://warrant-options.vercel.app";
const RELAYER = "f6464d4e059e10b687070c2a0b1bde4ed8aadf51ca9196474aa47079890f90ec";
// The round trip (docs/EVIDENCE.md, E-032): one wallet with no NEAR account, on both chains.
const WALLET = "0x05db2855abc2d062934617ace3e39e864f977b0b";
const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const DEPOSIT = "0xbd6289cc629a617fd25d6f0ecadde052a58421a3eb2d67d8704deb31bb340b1e";
const PAYOUT = "0xa3a88f87aa6663d4539a1a7151e93c9ddb441e79279d5096434298d34529f172";
const RELAYED = { buy: "AMbpVMg6XbMZxywmMDEJJiffdD32rQXSnSPZBXGKTGQA", exercise: "EyQj34zmL54Cm3fCLW8AB6Qf9DFxRMNuRvSdVNRSoNw1" };
const SIGNED_IN_A_WALLET = { hash: "CvMRoftt8jhibE7pchQvZ3JBb9bXnDXUNAkwzonseGPU", signer: "e96016e5fa01a7b81a3e360f92b69a51e817ccaff33954f65247cfccd6dbda50" };

const NODES = ["https://free.rpc.fastnear.com", "https://rpc.mainnet.near.org", "https://near.drpc.org", "https://rpc.intea.rs"];
const ARCHIVES = ["https://archival-rpc.mainnet.fastnear.com", "https://archival-rpc.mainnet.near.org"];

async function post(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  const body = await response.json();
  if (body.result === undefined) throw new Error(JSON.stringify(body.error ?? body).slice(0, 200));
  return body.result;
}

/** Public nodes limit each visitor, so each read walks the list until one answers. */
async function ask(nodes, method, params) {
  let failure;
  for (let round = 0; round < 3; round++) {
    for (const url of nodes) {
      try {
        return await post(url, method, params);
      } catch (error) {
        failure = error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000 * (round + 1)));
  }
  throw failure;
}

const near = (method, params) => ask(NODES, method, params);
const view = async (account, name, args = {}) => {
  const result = await near("query", {
    request_type: "call_function",
    finality: "final",
    account_id: account,
    method_name: name,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(result.result).toString());
};
const account = (id) => near("query", { request_type: "view_account", finality: "final", account_id: id });
const keys = async (id) => (await near("query", { request_type: "view_access_key_list", finality: "final", account_id: id })).keys;
const tx = (hash, signer) => ask(ARCHIVES, "tx", { tx_hash: hash, sender_account_id: signer, wait_until: "NONE" });
const failuresOf = (outcome) => outcome.receipts_outcome.filter((r) => typeof r.outcome.status === "object" && r.outcome.status !== null && "Failure" in r.outcome.status);

let failed = 0;
function report(kind, name, detail) {
  if (kind === "FAIL") failed++;
  console.log(`${kind.padEnd(4)}  ${name.padEnd(26)} ${detail}`);
}
const check = (ok, name, detail) => report(ok ? "PASS" : "FAIL", name, detail);
const short = (id) => (id.length > 24 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);

const series = [];
for (let from = 0; ; from += 100) {
  const page = await view(CONTRACT, "get_series_list", { from_index: String(from), limit: "100" });
  series.push(...page);
  if (page.length < 100) break;
}

// The code on chain is the code in the repo.
const onChain = await account(CONTRACT);
check(onChain.code_hash === CODE_HASH, "contract code", `${CONTRACT} code_hash ${onChain.code_hash}`);
const metadata = await view(CONTRACT, "contract_source_metadata");
check(metadata.link === SOURCE, "contract source (NEP-330)", metadata.link);
const rebuilt = await view(VERIFIER, "get_contract", { account_id: CONTRACT });
check(rebuilt?.code_hash === CODE_HASH, "rebuilt by a third party", `${VERIFIER} records ${rebuilt?.code_hash}`);

// Nobody can change it, once the keys are gone.
const contractKeys = await keys(CONTRACT);
if (contractKeys.length === 0) report("PASS", "contract keys", "none: nobody can deploy new code, only its own retire can delete it");
else report("NOTE", "contract keys", `${contractKeys.length} full-access key: new code could still be deployed, until the lock (docs/DECISIONS.md, D-035)`);

// What Warrant sits on.
for (const [id, hash] of Object.entries(PINS)) {
  const live = await account(id);
  if (live.code_hash === hash) report("PASS", "dependency pin", `${id} is the bytecode the sandbox tests run against`);
  else report("NOTE", "dependency pin", `${id} has been upgraded since it was pinned: ${live.code_hash}`);
}

// Every unit owed is held inside Intents, under the contract's own account.
const owed = {};
for (const s of series) {
  owed[s.collateral_token] = (owed[s.collateral_token] ?? 0n) + BigInt(s.collateral_held);
  owed[s.payment_token] = (owed[s.payment_token] ?? 0n) + BigInt(s.proceeds_held);
}
for (const [token, amount] of Object.entries(owed)) {
  const held = BigInt(await view("intents.near", "mt_balance_of", { account_id: CONTRACT, token_id: token }));
  check(held >= amount, "backed inside Intents", `${token.slice(0, 30)} holds ${held}, owes ${amount}`);
}
const live = series.filter((s) => !s.expired && BigInt(s.collateral_held) > 0n);
check(live.length > 0, "a live series", `${series.length} series, ${live.length} holding collateral, e.g. #${live[0]?.series_id} ${live[0]?.kind} by ${short(live[0]?.writer ?? "")}`);

// The refusal room: every attempt read back by hash, and it has to have ended as the catalogue says.
const catalog = JSON.parse(readFileSync(new URL("../web/src/lib/room.json", import.meta.url), "utf8"));
const line = readFileSync(new URL("../web/.env.production", import.meta.url), "utf8")
  .split("\n")
  .find((text) => text.startsWith("VITE_REFUSAL_TXS="));
const recorded = new Map(
  (line ?? "")
    .slice("VITE_REFUSAL_TXS=".length)
    .split(",")
    .map((entry) => {
      const [id, signer, hash] = entry.split(":");
      return [id, { signer, hash }];
    }),
);
const names = new Set();
let refused = 0;
let honest = 0;
const wrong = [];
const queue = [...catalog];
await Promise.all(
  Array.from({ length: 2 }, async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const sent = recorded.get(entry.id);
      if (!sent) {
        wrong.push(`${entry.id}: no recorded hash`);
        continue;
      }
      const outcome = await tx(sent.hash, sent.signer);
      const failures = failuresOf(outcome);
      const name = JSON.stringify(failures).match(/ERR_[A-Z_]+/)?.[0] ?? null;
      if (entry.expect ? name !== entry.expect : failures.length > 0) wrong.push(`${entry.id}: wanted ${entry.expect ?? "success"}, chain says ${name ?? "success"}`);
      else if (entry.expect) {
        refused++;
        names.add(name);
      } else honest++;
    }
  }),
);
const total = catalog.filter((entry) => entry.expect).length;
check(wrong.length === 0 && refused === total, "refusal room", `${refused} of ${total} refused by name, ${names.size} distinct refusals; ${honest} honest calls went through`);
for (const problem of wrong) report("FAIL", "refusal room", problem);

// A real wallet signed from the hosted page, and a wallet with no NEAR account went all the way round.
const walletTx = await tx(SIGNED_IN_A_WALLET.hash, SIGNED_IN_A_WALLET.signer);
check(failuresOf(walletTx).length === 0 && walletTx.transaction.receiver_id === "intents.near", "wallet-signed purchase", `${SIGNED_IN_A_WALLET.hash} from ${short(SIGNED_IN_A_WALLET.signer)}`);

const relayerKey = (await keys(RELAYER)).find((key) => key.access_key.permission !== "FullAccess");
const scope = relayerKey?.access_key.permission.FunctionCall;
check(scope?.receiver_id === "intents.near" && scope.method_names.join() === "execute_intents", "relayer's hosted key", `can only call ${scope?.receiver_id}.${scope?.method_names}, ${(Number(scope?.allowance) / 1e24).toFixed(4)} NEAR left to spend on gas`);
for (const [what, hash] of Object.entries(RELAYED)) {
  const outcome = await tx(hash, RELAYER);
  const logs = [outcome.transaction_outcome, ...outcome.receipts_outcome].flatMap((o) => o.outcome.logs).join();
  check(failuresOf(outcome).length === 0 && outcome.transaction.public_key === relayerKey?.public_key && logs.includes(WALLET), `relayed ${what}`, `${hash} names ${short(WALLET)}, sent by that key`);
}
const usdcMoves = async (hash) => {
  const receipt = await post("https://mainnet.base.org", "eth_getTransactionReceipt", [hash]);
  return receipt.logs
    .filter((log) => log.address.toLowerCase() === BASE_USDC && log.topics[0].startsWith("0xddf252ad"))
    .map((log) => ({ from: `0x${log.topics[1].slice(-40)}`, to: `0x${log.topics[2].slice(-40)}`, amount: Number(BigInt(log.data)) / 1e6 }));
};
const paidIn = await usdcMoves(DEPOSIT);
check(paidIn.some((move) => move.from === WALLET), "paid in from Base", `${paidIn[0]?.amount} USDC from ${short(WALLET)}, ${DEPOSIT.slice(0, 12)}…`);
const paidOut = await usdcMoves(PAYOUT);
check(paidOut.some((move) => move.to === WALLET), "paid out on Base", `${paidOut[0]?.amount} USDC to ${short(WALLET)}, ${PAYOUT.slice(0, 12)}…`);

// The hosted page and relayer answer.
const page = await fetch(SITE, { signal: AbortSignal.timeout(20_000) });
check(page.ok && (await page.text()).includes("Warrant"), "hosted page", SITE);
const refusal = await fetch(`${SITE}/api/relay`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ signed: { standard: "nep413" } }),
  signal: AbortSignal.timeout(30_000),
});
check(refusal.status === 400, "hosted relayer", `refuses what isn't a signed Warrant action: ${(await refusal.json()).error}`);

console.log(failed === 0 ? "\nEvery claim above holds on chain." : `\n${failed} claim(s) did not hold.`);
process.exit(failed === 0 ? 0 : 1);
