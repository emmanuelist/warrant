# Warrant

**Options that can't default and need no oracle: the collateral is locked inside NEAR Intents until expiry.**

Built for NEAR HACKATHON, tracks `defi` and `open`.

**Status, 2026-11-05: not on mainnet yet.** Everything below runs locally against byte-identical mainnet Intents bytecode. Current truth: [docs/STATE.md](docs/STATE.md).

## What it is

A writer locks collateral inside `intents.near` and gets options, each one a NEP-245 token. A holder can exercise until expiry: they pay the strike inside Intents and receive the underlying inside Intents. After expiry the writer takes back what wasn't exercised. Nothing can move that collateral in between, and no price feed is consulted, because the holder decides whether exercising is worth it.

## The problem

An option is a promise, and on-chain promises usually lean on one of two outside parties. Under-collateralized options need a margin engine and liquidators to keep the seller solvent. Cash-settled options need an oracle at expiry. On NEAR that risk is concrete: Pyth's feed had stopped updating when this was built ([E-001](docs/EVIDENCE.md)).

Warrant needs neither. Every option is fully collateralized when written and settles by delivering the asset. Keeping it all inside Intents means the balances can reach other chains through 1Click, and a wallet with no NEAR account can take part by signing intents.

## Try it

No keys and no funds are needed.

You need `rustup` (the repo pins rustc 1.97.1 in `rust-toolchain.toml`), [cargo-near](https://github.com/near/cargo-near) 0.22.0 and Node 22 or newer.

**1. Run the proof.**

```bash
cd contracts/options
cargo near build non-reproducible-wasm --abi-features abi
cargo test -- --test-threads=1
```

You see 78 unit tests pass, then the `sandbox` suite (3) and the `signers` suite (1). One of the 78 runs about 32,000 random steps across every action, checks the books after each against the transfers the contract actually schedules, winds every sequence down until nothing is left, and fails if any action or refusal was never reached (`cargo test invariants -- --nocapture` prints the counts). The sandbox suites download the live `intents.near` and `wrap.near` bytecode from mainnet and refuse to run if its hash differs from the pin in `tests/common/mod.rs`.

- Refusals covered: early reclaim, late exercise, exercise without the option, unauthorized calls, wrong-token deposits, double exercise.
- `signers` has a wallet with no NEAR account write, list, cancel, claim and reclaim through relayed `erc191` intents.

**2. Open the app on a local chain.**

```bash
# In contracts/options. Leave it running until you see DEVNET READY.
cargo test --test devnet -- --ignored --nocapture

# In a second terminal
cd web
npm ci
npm run dev
```

Open `http://localhost:5173/?as=alice.sandbox` and you see the Lock Dial and a board of series, every figure read from the local chain. The devnet signs as any seeded account, so `/?as=bob.sandbox` shows a holder's view and `/account?as=bob.sandbox` shows their positions.

**3. Try to break the lock.** Choose "Refusals" in the header, press "Send one yourself", then "Test the lock". The transaction is really sent and the contract refuses it. You see "Refused by chain", `ERR_NOT_EXPIRED` and the transaction hash.

**4. Fill the refusal room.** `node scripts/run.mjs --devnet write && node scripts/run.mjs --devnet room` sends every attempt for real, 28 refused by name and 3 honest calls, and stops unless each one ends as it must. Reload the page and "Every way in, refused" reads them all back from chain.

## How it works

| Part | Where | What it does |
|---|---|---|
| Options contract | [contracts/options](contracts/options) | Holds each series, offer and position. Collateral arrives through `intents.near` `mt_transfer_call`, and every payout is `mt_transfer` inside Intents. Behaviour and refusals: [docs/SPEC.md](docs/SPEC.md) |
| Web app | [web/src](web/src) | One board and an account page. Shows exactly what you'll sign, then reads the result back from chain |
| Relayer | [web/relay](web/relay) | Pays gas for wallets with no NEAR account. Refuses anything but a Warrant action, previews with `simulate_intents`, then sends `execute_intents` |

NEAR technology used:

- **NEAR Intents:** `mt_transfer_call`, `mt_transfer`, `execute_intents`, `simulate_intents`, the `transfer` and `auth_call` intents
- **1Click API:** deposits from and payouts to other chains
- **Signing standards:** NEP-413 and ERC-191
- **Token standards:** NEP-141 and NEP-245
- **Contract metadata:** NEP-330
- **Wallets:** near-connect, plus EIP-6963 for EVM wallets

## Limits

- **Not on mainnet, not hosted, not audited.** The list of what only mainnet can prove is in [docs/STATE.md](docs/STATE.md).
- **Keys.** The contract will live on its own account, and whoever holds a full-access key there could deploy new code that moves the collateral. The plan is to delete every key before submission and let anyone check it with one command ([D-035](docs/DECISIONS.md)). Until then, "can't default" depends on that key holder.
- **Retiring.** From 2026-11-26, once the contract holds nothing for anyone, anyone can retire it: its account is deleted and its storage deposit returns to its owner. It moves no tokens, and it refuses while it holds a single unit. A writer who never reclaims keeps it from retiring ([D-038](docs/DECISIONS.md), [SPEC](docs/SPEC.md)).
- **Storage.** The contract pays for its own storage from a finite balance. Filling it would refuse transactions that add state until someone tops it up.
- **Wallets.** Wallets with no NEAR account means EVM only. Solana and passkey signers aren't built ([D-030](docs/DECISIONS.md)).
- **Physical settlement.** A holder must bring the strike to exercise. There's no cash settlement by design ([D-002](docs/DECISIONS.md)).

## When and how it was built

Built from 2026-10-20, inside the window the organizers set from the announcement on 2026-10-19 (their Q-001). Git history starts on 2026-11-05, so the dated record is [docs/DECISIONS.md](docs/DECISIONS.md) and [docs/EVIDENCE.md](docs/EVIDENCE.md). There's no pre-hackathon code.

Written with Claude Code (AI), under the rules in [CLAUDE.md](CLAUDE.md).

Libraries and templates:

- **Contract:** near-sdk 5.29.1, `defuse-nep245` from `near/intents` at the deployed commit, and the `cargo near new` template with its near-sandbox and near-api test stack
- **Web:** React, Vite, Tailwind, TypeScript, motion, @number-flow/react, @radix-ui/react-tooltip, @phosphor-icons/react, @hot-labs/near-connect
- **Dev only, never bundled:** @noble/curves and @noble/hashes

Exact versions are in `contracts/options/Cargo.lock` and `web/package-lock.json`.

## License

[MIT](LICENSE).
