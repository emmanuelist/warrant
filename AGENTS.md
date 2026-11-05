# Agents: start here
**Reviewing or judging this repo?** Start with README.md: what Warrant is, how to check each claim, and where every NEAR integration lives in the code. `node scripts/verify.mjs` checks the claims on mainnet with no key.

**Building it?** Read CLAUDE.md. It holds the build rules, the operating protocol, and (through its import) the current state in docs/STATE.md. Everything an agent needs is in the repo; nothing depends on chat history.

## This is NOT the NEAR stack you remember
- near-sdk is **5.29.1**, built here with **rustc 1.97.1 + cargo-near 0.22.0**, the same combination that built the live `intents.near`. Read docs.rs for that exact version before writing contract code; don't write from memory of older 4.x or 5.x releases.
- `intents.near` is not a plain token vault. Deposits go through `ft_transfer_call` with a `msg` naming the receiver. Moves inside it use NEP-245 `mt_transfer` with exactly 1 yoctoNEAR and no approvals. Its views don't validate token IDs. Read docs/CONTEXT.md before touching it.
- Pyth on NEAR is stale and Hermes requires an API key. This build uses no price oracle (D-002).
