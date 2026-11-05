/**
 * NEAR transaction signing with nothing but `fetch` and WebCrypto, so the same code runs in the
 * browser (the devnet signer, D-017) and on a server (the relayer, D-030). No build config is read
 * here: every call names its RPC URL.
 */
import { base58Decode, base58Encode, bytesToBase64 } from "./base58.ts";
import { rpcAt } from "./nearRpc.ts";

export interface FunctionCall {
  method: string;
  args: object;
  gas: bigint;
  deposit: bigint;
}

export interface Transaction {
  receiverId: string;
  actions: FunctionCall[];
}

/** The parts of a final execution outcome we read (same shape the wallet returns). */
export interface Outcome {
  transaction: { hash: string };
  receipts_outcome: { outcome: { status: unknown } }[];
}

// PKCS#8 header for a raw 32-byte Ed25519 seed (RFC 8410).
const PKCS8_ED25519 = [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20];

class Borsh {
  private bytes: number[] = [];
  u8(value: number) {
    this.bytes.push(value & 0xff);
  }
  u32(value: number) {
    for (let i = 0; i < 4; i++) this.bytes.push((value >>> (8 * i)) & 0xff);
  }
  uint(value: bigint, size: number) {
    for (let i = 0; i < size; i++) this.bytes.push(Number((value >> BigInt(8 * i)) & 0xffn));
  }
  raw(bytes: Uint8Array) {
    for (const byte of bytes) this.bytes.push(byte);
  }
  vec(bytes: Uint8Array) {
    this.u32(bytes.length);
    this.raw(bytes);
  }
  string(text: string) {
    this.vec(new TextEncoder().encode(text));
  }
  done(): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(this.bytes);
  }
}

async function importKey(secret: string): Promise<{ key: CryptoKey; publicKey: Uint8Array }> {
  const bytes = base58Decode(secret.replace(/^ed25519:/, ""));
  if (bytes.length !== 64) throw new Error("The key must be an ed25519 secret key (seed and public key)");
  const der = new Uint8Array(48);
  der.set(PKCS8_ED25519);
  der.set(bytes.slice(0, 32), 16);
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
  return { key, publicKey: bytes.slice(32) };
}

/** Borsh `Transaction` (V0): signer, key, nonce, receiver, block hash, `FunctionCall` actions. */
function serialize(signerId: string, publicKey: Uint8Array, nonce: bigint, blockHash: string, tx: Transaction) {
  const w = new Borsh();
  w.string(signerId);
  w.u8(0);
  w.raw(publicKey);
  w.uint(nonce, 8);
  w.string(tx.receiverId);
  w.raw(base58Decode(blockHash));
  w.u32(tx.actions.length);
  for (const action of tx.actions) {
    w.u8(2);
    w.string(action.method);
    w.vec(new TextEncoder().encode(JSON.stringify(action.args)));
    w.uint(action.gas, 8);
    w.uint(action.deposit, 16);
  }
  return w.done();
}

/** Signs `tx` as `signerId` with `secret` (a full-access or function-call key) and waits for finality. */
export async function signAndSend(url: string, secret: string, signerId: string, tx: Transaction): Promise<Outcome> {
  const { key, publicKey } = await importKey(secret);
  const access = await rpcAt<{ nonce: number; block_hash: string }>(url, "query", {
    request_type: "view_access_key",
    finality: "final",
    account_id: signerId,
    public_key: `ed25519:${base58Encode(publicKey)}`,
  });
  const body = serialize(signerId, publicKey, BigInt(access.nonce) + 1n, access.block_hash, tx);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", body));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, hash));
  const signed = new Uint8Array(body.length + 65);
  signed.set(body);
  signed[body.length] = 0;
  signed.set(signature, body.length + 1);
  return rpcAt<Outcome>(url, "send_tx", { signed_tx_base64: bytesToBase64(signed), wait_until: "FINAL" });
}
