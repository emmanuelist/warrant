/**
 * 1Click (NEAR Intents' cross-chain API), used without a partner key: unauthenticated quotes carry
 * an extra fee that is already inside `amountOut`. CORS is open. Shapes verified against the live
 * API on 2026-10-20 (docs/CONTEXT.md, "1Click").
 */
import { base58Encode, base64ToBytes } from "./base58";

const API = "https://1click.chaindefuser.com/v0";

export interface RemoteToken {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price: number;
  contractAddress: string | null;
}

export type TransferStatus =
  | "PENDING_DEPOSIT"
  | "KNOWN_DEPOSIT_TX"
  | "INCOMPLETE_DEPOSIT"
  | "PROCESSING"
  | "SUCCESS"
  | "REFUNDED"
  | "FAILED";

export const FINAL_STATUSES: TransferStatus[] = ["SUCCESS", "REFUNDED", "FAILED"];

export interface QuoteRequest {
  /** `true` prices the route without creating a deposit address. */
  dry: boolean;
  originAsset: string;
  depositType: "ORIGIN_CHAIN" | "INTENTS";
  destinationAsset: string;
  /** Base units of the origin asset. */
  amount: string;
  refundTo: string;
  refundType: "ORIGIN_CHAIN" | "INTENTS";
  recipient: string;
  recipientType: "DESTINATION_CHAIN" | "INTENTS";
}

export interface Quote {
  /** Present on non-dry quotes only. */
  depositAddress?: string;
  depositMemo?: string;
  amountIn: string;
  amountInFormatted: string;
  amountOut: string;
  amountOutFormatted: string;
  minAmountOut: string;
  /** Seconds. */
  timeEstimate: number;
  /** When the quote request lapses: generate-intent then answers "Quote has expired". */
  validUntil: string;
}

export interface Hop {
  hash: string;
  explorerUrl: string;
}

export interface StatusResponse {
  status: TransferStatus;
  updatedAt: string;
  swapDetails: {
    amountOutFormatted: string | null;
    refundedAmountFormatted: string;
    refundReason: string | null;
    originChainTxHashes: Hop[];
    destinationChainTxHashes: Hop[];
    nearTxHashes: string[];
  };
}

export class OneClickError extends Error {}

async function call<T>(path: string, init?: { body: unknown }): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: init ? "POST" : "GET",
    headers: init ? { "content-type": "application/json" } : undefined,
    body: init ? JSON.stringify(init.body) : undefined,
  });
  const body = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new OneClickError(body.message ?? `1Click answered ${response.status}`);
  return body;
}

let tokens: Promise<RemoteToken[]> | null = null;

/** Every asset 1Click can route, with its USD reference price. Fetched once per page load. */
export function remoteTokens(): Promise<RemoteToken[]> {
  tokens ??= call<RemoteToken[]>("/tokens").catch((error: unknown) => {
    tokens = null;
    throw error;
  });
  return tokens;
}

/** A live quote, valid for 30 minutes; 1% slippage tolerance, exact input. */
export async function quote(request: QuoteRequest): Promise<Quote> {
  const deadline = new Date(Date.now() + 30 * 60_000).toISOString();
  const body = { ...request, swapType: "EXACT_INPUT", slippageTolerance: 100, deadline };
  const response = await call<{ quote: Omit<Quote, "validUntil"> }>("/quote", { body });
  return { ...response.quote, validUntil: deadline };
}

export function status(depositAddress: string): Promise<StatusResponse> {
  return call<StatusResponse>(`/status?depositAddress=${encodeURIComponent(depositAddress)}`);
}

/** Optional: tells 1Click about an origin-chain deposit so it starts sooner. */
export function submitDeposit(depositAddress: string, txHash: string): Promise<unknown> {
  return call("/deposit/submit", { body: { depositAddress, txHash } });
}

export type UnsignedIntent =
  | { standard: "nep413"; payload: { message: string; nonce: string; recipient: string } }
  /** An EVM wallet's (D-030): the JSON message itself, signed with `personal_sign`. */
  | { standard: "erc191"; payload: string };

/**
 * For an INTENTS-type quote: the transfer to `depositAddress` that the user signs, as NEP-413 for a
 * NEAR wallet or ERC-191 for an EVM one (1Click answers 201 for both; docs/CONTEXT.md).
 */
export async function generateIntent(depositAddress: string, signerId: string, standard: UnsignedIntent["standard"] = "nep413"): Promise<UnsignedIntent> {
  const response = await call<{ intent: UnsignedIntent }>("/generate-intent", {
    body: { type: "swap_transfer", standard, signerId, depositAddress },
  });
  return response.intent;
}

/** Wallets return NEP-413 signatures as base64; Intents expects `ed25519:<base58>`. */
export function intentsSignature(signature: string): string {
  return signature.startsWith("ed25519:") ? signature : `ed25519:${base58Encode(base64ToBytes(signature))}`;
}

/** NEP-413: with the wallet's public key. ERC-191: the signature alone (Intents recovers the key). */
export async function submitIntent(intent: UnsignedIntent, publicKey: string | null, signature: string): Promise<string> {
  const signedData = intent.standard === "nep413" ? { ...intent, public_key: publicKey, signature: intentsSignature(signature) } : { ...intent, signature };
  const response = await call<{ intentHash: string }>("/submit-intent", { body: { type: "swap_transfer", signedData } });
  return response.intentHash;
}
