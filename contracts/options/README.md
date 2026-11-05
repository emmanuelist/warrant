# Warrant: options contract

**Options that can't default and need no oracle: the collateral is locked inside NEAR Intents until expiry.**

Every option is fully collateralized and physically settled inside `intents.near`. The holder pays the strike and receives the underlying, so no price feed is involved.

- Behavior, messages, refusals and invariants: [docs/SPEC.md](../../docs/SPEC.md)
- Why it's built this way: [docs/DECISIONS.md](../../docs/DECISIONS.md) (D-002, D-009, D-012)
- Proof: [docs/EVIDENCE.md](../../docs/EVIDENCE.md) (E-004 unit tests, E-005 sandbox run against byte-identical mainnet Intents)

## Build and test

Requires the toolchain pinned in the repo root (`rust-toolchain.toml`, rustc 1.97.1) and cargo-near 0.22.0.

```bash
cargo near build non-reproducible-wasm --abi-features abi   # → target/near/options.wasm
cargo test -- --test-threads=1                              # unit tests + sandbox tests
```

The sandbox tests fetch `intents.near` and `wrap.near` code from mainnet, check it against pinned code hashes, and run the whole lifecycle locally next to this contract. They need network access the first time; the code is cached under `target/mainnet-wasm/`.
