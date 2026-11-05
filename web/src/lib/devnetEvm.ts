/**
 * Devnet only: an EIP-1193 wallet for the tests' public EVM key (32 bytes of 0x42,
 * contracts/options/tests/common/evm.rs), announced through EIP-6963 like any browser wallet. The
 * devnet board can then act as the 0x wallet tests/devnet.rs funds, through the same path a real
 * wallet takes (D-030; the NEAR-account counterpart is the genesis key, D-017). The dev server
 * loads it (main.tsx); production builds drop it.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

import type { EvmWallet } from "./evm";

const KEY = new Uint8Array(32).fill(0x42);
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const address = `0x${hex(keccak_256(secp256k1.getPublicKey(KEY, false).slice(1)).slice(12))}`;

function personalSign(messageHex: string): string {
  const message = Uint8Array.from(messageHex.slice(2).match(/../g) ?? [], (pair) => parseInt(pair, 16));
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${message.length}`);
  // noble's "recovered" format leads with the recovery byte; a wallet returns r ‖ s ‖ v (27/28).
  const signature = secp256k1.sign(keccak_256(new Uint8Array([...prefix, ...message])), KEY, { prehash: false, format: "recovered" });
  return `0x${hex(signature.slice(1))}${(27 + (signature[0] ?? 0)).toString(16)}`;
}

const wallet: EvmWallet = {
  info: {
    uuid: "8c6f2b1e-3d4a-4f5b-9a7c-2e1d0b9f6a42",
    name: "Devnet test wallet",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%23272a33'/%3E%3Cpath d='M7 8h10M7 12h10M7 16h6' stroke='%23fff' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E",
    rdns: "dev.warrant.devnet-test-wallet",
  },
  provider: {
    async request({ method, params }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [address];
        case "personal_sign":
          return personalSign(String((params ?? [])[0]));
        default:
          throw Object.assign(new Error(`The devnet test wallet doesn't support ${method}.`), { code: 4200 });
      }
    },
  },
};

const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze(wallet) }));
window.addEventListener("eip6963:requestProvider", announce);
announce();
