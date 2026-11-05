/**
 * EVM wallets as Warrant accounts (D-030). Found through EIP-6963, each signs Intents payloads with
 * `personal_sign` (ERC-191), and its Intents account is its own lowercase 0x address. It holds no
 * NEAR account, so Warrant's relayer sends what it signs (web/relay/relay.ts).
 */
import { useSyncExternalStore } from "react";

import { base58Encode } from "./base58";

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: "accountsChanged", listener: (accounts: string[]) => void): void;
}

export interface EvmWallet {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

/** An Intents account owned by an EVM key: `0x` and 40 lowercase hex digits. */
export function isEvmAccount(account: string): boolean {
  return /^0x[0-9a-f]{40}$/.test(account);
}

const wallets = new Map<string, EvmWallet>();
const listeners = new Set<() => void>();
let announced: EvmWallet[] = [];

function onAnnounce(event: Event) {
  const wallet = (event as CustomEvent<EvmWallet | undefined>).detail;
  if (!wallet?.info?.rdns || wallets.has(wallet.info.rdns)) return;
  wallets.set(wallet.info.rdns, wallet);
  announced = [...wallets.values()];
  for (const listener of listeners) listener();
}

window.addEventListener("eip6963:announceProvider", onAnnounce);
window.dispatchEvent(new Event("eip6963:requestProvider"));

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** The EVM wallets this browser has announced (EIP-6963), as they arrive. */
export function useEvmWallets(): EvmWallet[] {
  return useSyncExternalStore(subscribe, () => announced);
}

// The wallet last connected, remembered per browser so a reload restores it without a prompt.
const REMEMBERED = "warrant.evm-wallet";
let active: EvmWallet | null = null;

function remember(rdns: string | null) {
  try {
    if (rdns) localStorage.setItem(REMEMBERED, rdns);
    else localStorage.removeItem(REMEMBERED);
  } catch {
    // Storage may be blocked; the wallet then asks again next time.
  }
}

function remembered(): string | null {
  try {
    return localStorage.getItem(REMEMBERED);
  } catch {
    return null;
  }
}

const first = (accounts: unknown) => (Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0].toLowerCase() : null);

function follow(wallet: EvmWallet, onAccount: (account: string | null) => void) {
  wallet.provider.on?.("accountsChanged", (accounts) => {
    if (active === wallet) onAccount(first(accounts));
  });
}

/** Asks `wallet` for its account; resolves to the 0x address, or null if the person declines. */
export async function connectEvm(wallet: EvmWallet, onAccount: (account: string | null) => void): Promise<string | null> {
  const account = first(await wallet.provider.request({ method: "eth_requestAccounts" }));
  if (account) {
    active = wallet;
    remember(wallet.info.rdns);
    follow(wallet, onAccount);
  }
  return account;
}

export function disconnectEvm() {
  active = null;
  remember(null);
}

/** Restores the remembered wallet's account without a prompt, once that wallet announces itself. */
export function watchEvm(onAccount: (account: string | null) => void): () => void {
  const rdns = remembered();
  if (!rdns) return () => {};
  const restore = async () => {
    const wallet = wallets.get(rdns);
    if (!wallet || active) return;
    active = wallet;
    follow(wallet, onAccount);
    onAccount(first(await wallet.provider.request({ method: "eth_accounts" })));
  };
  void restore();
  return subscribe(() => void restore());
}

async function walletFor(account: string): Promise<EvmWallet | null> {
  if (active) return active;
  // Acting as a 0x account without connecting (the devnet's "Act as"): any wallet that holds it.
  for (const wallet of wallets.values()) {
    const accounts = await wallet.provider.request({ method: "eth_accounts" });
    if (Array.isArray(accounts) && accounts.some((a) => typeof a === "string" && a.toLowerCase() === account)) return wallet;
  }
  return null;
}

/**
 * `personal_sign` over `message`, as Intents reads it: `secp256k1:` and the base58 of r ‖ s ‖ v,
 * with v brought from the wallet's 27/28 to the recovery id 0/1 (docs/CONTEXT.md, "Trap: v").
 */
export async function personalSign(account: string, message: string): Promise<string> {
  const wallet = await walletFor(account);
  if (!wallet) throw new Error("Connect the EVM wallet that holds this account to sign.");
  const hex = `0x${Array.from(new TextEncoder().encode(message), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  const signature = await wallet.provider.request({ method: "personal_sign", params: [hex, account] });
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Error("The wallet returned no signature.");
  const bytes = Uint8Array.from(signature.slice(2).match(/../g) ?? [], (pair) => parseInt(pair, 16));
  const v = bytes[64] ?? 0;
  if (v >= 27) bytes[64] = v - 27;
  return `secp256k1:${base58Encode(bytes)}`;
}
