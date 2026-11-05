import type { NearConnector } from "@hot-labs/near-connect";

import { config } from "./config";
import type { Outcome, Transaction } from "./devnetSigner";
import { isEvmAccount } from "./evm";

export type { Transaction };

export const TGAS = 1_000_000_000_000n;
const MAX_GAS = 300n * TGAS;
const ONE_YOCTO = 1n;

/** The local sandbox's genesis key, written by tests/devnet.rs. Read only in sandbox builds. */
const devnetKey: string | undefined = config.network === "sandbox" ? import.meta.env.VITE_SANDBOX_SIGNER_KEY : undefined;

/**
 * Who signs: a NEAR wallet on mainnet; on the local devnet, the sandbox key for the account being
 * viewed (D-017). `null` when neither exists, and the UI says so instead of faking a signature.
 */
export const signer: "wallet" | "devnet" | null = config.network === "mainnet" ? "wallet" : devnetKey ? "devnet" : null;
export const signingAvailable = signer !== null;

let connector: Promise<NearConnector> | null = null;

function getConnector(): Promise<NearConnector> {
  connector ??= import("@hot-labs/near-connect").then(async ({ NearConnector }) => {
    const instance = new NearConnector({
      network: "mainnet",
      providers: { mainnet: [config.rpcUrl] },
    });
    await instance.whenManifestLoaded;
    return instance;
  });
  return connector;
}

export async function connect(): Promise<string | null> {
  const instance = await getConnector();
  const wallet = await instance.connect();
  const [first] = await wallet.getAccounts();
  return first?.accountId ?? null;
}

export async function disconnect(): Promise<void> {
  const instance = await getConnector();
  await instance.disconnect();
}

/** Calls `onChange` with the account on sign-in and `null` on sign-out. */
export async function watchAccount(onChange: (account: string | null) => void): Promise<void> {
  if (signer !== "wallet") return;
  const instance = await getConnector();
  instance.on("wallet:signIn", (event) => onChange(event.accounts[0]?.accountId ?? null));
  instance.on("wallet:signOut", () => onChange(null));
  try {
    const wallet = await instance.wallet();
    const [first] = await wallet.getAccounts();
    onChange(first?.accountId ?? null);
  } catch {
    onChange(null);
  }
}

export interface Call {
  receiverId: string;
  method: string;
  args: object;
  /** yoctoNEAR. Defaults to exactly 1: every Warrant and Intents method we call asserts it. */
  deposit?: bigint;
  /** Defaults to an even share of the 300 Tgas a transaction may carry. */
  gas?: bigint;
}

/** `intents.mt_transfer_call` to this contract: how writes, purchases and exercises arrive (SPEC.md). */
export function viaIntents(tokenId: string, amount: bigint, msg: object): Call {
  return {
    receiverId: config.intentsContract,
    method: "mt_transfer_call",
    args: {
      receiver_id: config.optionsContract,
      token_id: tokenId,
      amount: amount.toString(),
      approval: null,
      memo: null,
      msg: JSON.stringify(msg),
    },
  };
}

/** A direct method on this contract (list, close, claims): all take exactly 1 yoctoNEAR. */
export function onOptions(method: string, args: object): Call {
  return { receiverId: config.optionsContract, method, args };
}

/** A method on the Intents contract, acting for the signer (predecessor auth, 1 yoctoNEAR). */
export function onIntents(method: string, args: object): Call {
  return { receiverId: config.intentsContract, method, args };
}

export interface Sent {
  /** Every transaction hash, in signing order. */
  hashes: string[];
  /** The contract's own refusal, if any receipt in any tree failed with one (docs/SPEC.md). */
  refusal: string | null;
}

/**
 * Consecutive calls to the same receiver become one transaction with several actions. Exported so
 * the review panel shows exactly what `send` signs.
 */
export function transactionsFor(calls: Call[]): Transaction[] {
  const transactions: { receiverId: string; calls: Call[] }[] = [];
  for (const call of calls) {
    const last = transactions.at(-1);
    if (last && last.receiverId === call.receiverId) last.calls.push(call);
    else transactions.push({ receiverId: call.receiverId, calls: [call] });
  }
  return transactions.map(({ receiverId, calls: group }) => {
    const fixed = group.reduce((sum, c) => sum + (c.gas ?? 0n), 0n);
    const open = BigInt(group.filter((c) => c.gas === undefined).length);
    const share = open > 0n ? (MAX_GAS - fixed) / open : 0n;
    return {
      receiverId,
      actions: group.map((c) => ({ method: c.method, args: c.args, gas: c.gas ?? share, deposit: c.deposit ?? ONE_YOCTO })),
    };
  });
}

function settle(outcomes: Outcome[]): Sent {
  const failures = JSON.stringify(
    outcomes.flatMap((o) =>
      o.receipts_outcome.filter((r) => typeof r.outcome.status === "object" && r.outcome.status !== null && "Failure" in r.outcome.status),
    ),
  );
  return {
    hashes: outcomes.map((o) => o.transaction.hash),
    refusal: failures.match(/ERR_[A-Z_]+/)?.[0] ?? (failures.length > 2 ? "receipt failed" : null),
  };
}

/**
 * Signs and sends `calls` as `signerId`, in order, and reports the chain's answer. An EVM account
 * signs them as intents and Warrant's relayer sends them (D-030).
 */
export async function send(signerId: string, ...calls: Call[]): Promise<Sent> {
  if (isEvmAccount(signerId)) {
    const { relaySigned } = await import("./signedIntents");
    return settle([await relaySigned(signerId, calls)]);
  }
  const transactions = transactionsFor(calls);
  if (signer === "devnet" && devnetKey) {
    const { sendDevnet } = await import("./devnetSigner");
    return settle(await sendDevnet(devnetKey, signerId, transactions));
  }
  const instance = await getConnector();
  const wallet = await instance.wallet();
  const shaped = transactions.map((tx) => ({
    signerId,
    receiverId: tx.receiverId,
    actions: tx.actions.map((a) => ({
      type: "FunctionCall" as const,
      params: { methodName: a.method, args: a.args, gas: a.gas.toString(), deposit: a.deposit.toString() },
    })),
  }));
  // near-connect types outcomes via @near-js/types (not installed); we read only hashes and statuses.
  const outcomes = (
    shaped.length === 1 && shaped[0]
      ? [await wallet.signAndSendTransaction(shaped[0])]
      : await wallet.signAndSendTransactions({ signerId, transactions: shaped })
  ) as Outcome[];
  return settle(outcomes);
}

/**
 * NEP-413 signature over an Intents payload (1Click's signed-intent execution). Wallets return the
 * signature as base64; Intents wants `ed25519:<base58>` (docs/CONTEXT.md, "1Click").
 */
export async function signIntent(signerId: string, message: string, nonce: Uint8Array): Promise<{ publicKey: string; signature: string }> {
  if (signer !== "wallet") throw new Error("Signing messages needs a NEAR wallet on mainnet.");
  const instance = await getConnector();
  const wallet = await instance.wallet();
  const signed = await wallet.signMessage({ message, recipient: config.intentsContract, nonce, signerId });
  return { publicKey: signed.publicKey, signature: signed.signature };
}
