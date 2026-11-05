# Context
Verified facts about everything this project depends on. Each entry says how it was verified, so no session has to re-derive it or trust training data. Read before touching an integration. Anything not verified is labelled **unverified**.

## Networks
| Name | Network | RPC (env var `NEAR_RPC_URL`) | Explorer | Verified |
|---|---|---|---|---|
| NEAR mainnet | `mainnet`, protocol version 87 (2026-11-05; 86 on 2026-10-20) | https://free.rpc.fastnear.com | https://nearblocks.io (API: https://api.nearblocks.io/v1, no key needed for tx lists) | 2026-10-20: `view_account`, `call_function`, `gas_price`, `EXPERIMENTAL_protocol_config` answered |
| NEAR testnet | `testnet` | https://test.rpc.fastnear.com | https://testnet.nearblocks.io | 2026-10-20: `view_account` answered |

**Protocol constants (mainnet, 2026-10-20):**
- Storage costs 1e19 yocto per byte, which is **1 NEAR per 100 KB**. It's locked, and returned when the data or account is deleted.
- Gas price is 1e8 yocto/gas, which is **0.0001 NEAR per Tgas**. That's the protocol minimum.

## Accounts
| Role | Account | Status | Verified |
|---|---|---|---|
| Dev and owner account (D-004, D-035) | `d0482bffd77daa246ff50cd36cd8c8392548a0cf0fc7d6ccd887a3675f084148` (implicit). Public key `ed25519:F23dZLwKtwWF4hBWHarhLTvWHjSTcSLweArLua7BQTLT`. Key file `~/.near-credentials/implicit/<id>.json` | Not on-chain until funded (`UNKNOWN_ACCOUNT`) | 2026-11-05 |
| Contract account (D-035) | `warrant-options.near`. `warrant.near` exists and isn't ours | Not created (`UNKNOWN_ACCOUNT`) | 2026-11-05 |

## Contracts we call (mainnet)
| Name | Account | Source of address | Interface we use | Verified how |
|---|---|---|---|---|
| NEAR Intents | `intents.near` | HACKATHON.md partner table → https://docs.near-intents.org, https://github.com/near/intents | See "NEAR Intents interface" below | Views answered 2026-10-20. **Deployed build (NEP-330 `contract_source_metadata`): v0.4.5, commit `16d04f6ec4401263f8914638710260da50bb46b0` (2026-10-07), `cargo near build non-reproducible-wasm --locked --features=contract`, env `sourcescan/cargo-near:0.22.0-rust-1.97.1`, near-sdk 5.29.1 (Cargo.lock).** Read source at that commit, not `main`. |
| USDC (native on NEAR) | `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` | 1Click `/v0/tokens` (symbol USDC, blockchain `near`) | NEP-141, **6 decimals** (`1000000` → "1.0" in a 1Click quote). `storage_balance_bounds` min/max `1250000000000000000000` (0.00125 NEAR) | `view_account`, quote and bounds view, 2026-10-20 |
| wNEAR | `wrap.near` | 1Click `/v0/tokens` | NEP-141, **24 decimals**. `near_deposit` (attach NEAR), `near_withdraw(amount)` (1 yocto). Storage bounds 0.00125 NEAR. Intents exposes no view naming its wNEAR contract (`wnear_id` → MethodNotFound), so the web app takes it from `VITE_WRAP_CONTRACT` (default `wrap.near`) | Same; flows run on the devnet (E-007) |
| BTC inside Intents | `btc.omft.near` | Intents token list | NEP-141 (bridged) | `view_account`, 2026-10-20 |
| USDC on Base / Arbitrum (Intents IDs) | `nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near` / `nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near` | 1Click `/v0/tokens` | Withdrawal to the destination chain via a 1Click quote | Dry quotes, 2026-10-20 |
| Chain Signatures MPC | `v1.signer` (mainnet), `v1.signer-prod.testnet` | Ecosystem docs | Not on the core path | `view_account`, 2026-10-20 |
| Pyth | `pyth-oracle.near` | — | **Do not use** (Traps, E-001) | 2026-10-20 |
| Rhea price oracle | `priceoracle.near` | — | Not used; `get_price_data` returns null outside `oracle_call` | 2026-10-20 |
| Test USDC (testnet) | `usdc.fakes.testnet` | — | NEP-141 for testnet runs | `view_account`, 2026-10-20 |

### NEAR Intents interface (source: github.com/near/intents)
- **Deposit:** NEP-141 `ft_transfer_call(receiver_id: "intents.near", amount, msg)` on the token contract.
  - `msg = ""` credits the sender.
  - `msg = "<account_id>"` credits that account.
  - `msg` can also be JSON: `{"receiver_id": "...", "execute_intents": [...], "refund_if_fails": bool}`.
  - Any NEP-141 token is accepted; the token ID becomes `nep141:<token contract>`.
  - Source files: `contracts/defuse/src/contract/tokens/nep141/deposit.rs`, `contracts/defuse/src/tokens/mod.rs`.
- **Move to a contract, with notification (our collateral path, D-009):** `mt_transfer_call(receiver_id, token_id, amount: U128, approval: null, memo, msg: String)`.
  - Attach 1 yocto. It calls the receiver's NEP-245 `mt_on_transfer(sender_id: AccountId, previous_owner_ids: Vec<AccountId>, token_ids: Vec<TokenId>, amounts: Vec<U128>, msg: String) -> PromiseOrValue<Vec<U128>>`. The returned amounts are refunded (`notify_and_resolve_transfer`).
  - Sources at the deployed commit: `contracts/defuse/src/contract/tokens/nep245/core.rs`, `crates/near/nep245/src/receiver.rs`.
  - The deployed commit removed notifications on *deposits* (#374). `ft_transfer_call` into Intents does **not** notify anyone.
- **Move inside Intents:** `mt_transfer(receiver_id, token_id, amount: U128, approval: null, memo)`.
  - `#[payable]`; attach exactly 1 yoctoNEAR. Approvals are rejected with "approvals are not supported".
  - Acts for `env::predecessor_account_id()` via `ensure_auth_predecessor_id()`.
  - Source: `contracts/defuse/src/contract/tokens/nep245/core.rs`.
- **Withdraw to a NEAR account:** `ft_withdraw(token: AccountId, receiver_id, amount: U128, memo: Option<String>, msg: Option<String>)`.
  - Attach 1 yocto; same predecessor auth. `token` is the bare contract (`wrap.near`, not `nep141:wrap.near`). `msg: null` → the token's `ft_transfer`; a `msg` → `ft_transfer_call`.
  - The receiver must be registered on the token (NEP-145) or the transfer fails: check `storage_balance_of`, and `storage_deposit` first if it's `null`.
  - Source: `contracts/defuse/src/contract/tokens/nep141/withdraw.rs`. Run from the UI on the devnet (E-007).
- **Withdraw a NEP-245 position:** `mt_withdraw(token: AccountId, receiver_id, token_ids: Vec<String>, amounts: Vec<U128>, memo, msg)`, 1 yocto. For a Warrant long: `token` = the options contract, `token_ids` = `["<series_id>"]`. Source: `contracts/defuse/src/contract/tokens/nep245/withdraw.rs`.
- **Keys for signed intents:** `has_public_key(account_id, public_key) -> bool` (view) and `add_public_key(public_key)` (1 yocto, predecessor). NEP-413 signatures are checked against these keys; an implicit account's own key is known already (`public_keys_of`). Source: `contracts/defuse/src/contract/accounts/mod.rs`.
- **NEP-413 signed payload (`MultiPayload`):** `{"standard":"nep413","payload":{"recipient":"intents.near","nonce":"<base64, 32 bytes>","message":"<JSON: signer_id, deadline, intents>"},"public_key":"ed25519:<base58>","signature":"ed25519:<base58>"}`. Docs: integration/verifier-contract/signing-intents.
- **Signers without a NEAR account** (source at the deployed commit 16d04f6 = `defuse/v0.4.5`; **exercised in the sandbox against the pinned mainnet bytecode with an EVM key, E-016**, 2026-10-26; other standards are read from source only):
  - **Signing standards:** `nep413`, `erc191` (EVM), `raw_ed25519` (Solana), `webauthn` (passkeys), `ton_connect`, `sep53` (Stellar), `tip191` (Tron).
  - **Account ids:** the signer's account is its implicit id, so no `add_public_key` is needed. secp256k1 → `"0x" + hex(keccak256(pk)[12..32])`; ed25519 → `hex(pk)`; P-256 → `"0x" + hex(keccak256("p256" ‖ pk)[12..32])`. Source: `contracts/defuse/core/src/public_key.rs`.
  - **`transfer` intent:** fields `{receiver_id, tokens, memo?, msg?, min_gas?}`; the notification fields are serde-flattened. With a `msg`, Intents calls `receiver_id.mt_on_transfer(sender_id = signer, previous_owner_ids = [signer; n], token_ids, amounts, msg)`. `min_gas` defaults to 30 TGas, minimum 5. Warrant's `mt_on_transfer` (create / write / buy / exercise) takes its actor from `sender_id`, so it accepts this unchanged. Source: `core/src/intents/tokens.rs`, `src/contract/tokens/nep245/core.rs`.
  - **`auth_call` intent:** fields `{contract_id, msg, attached_deposit?, min_gas? (default 10 TGas)}`. It calls `contract_id.on_auth(signer_id, msg)`; NEAR's `escrow-swap` implements it. Warrant's direct calls use the predecessor as the actor, so a non-NEAR signer reaches them through Warrant's `on_auth` (added 2026-10-26, E-017). The callee is told: "Verification of `signer_id` is done by the predecessor_id, so the implementation MUST whitelist allowed callers"; Warrant accepts only its configured Intents contract. Source: `core/src/intents/auth.rs`, `crates/near/auth-call`.
  - **Who submits:** someone has to send `execute_intents` and pay its gas. The message bus's `publish_intent` requires `quote_hashes`, so it relays only swaps a solver has quoted, not arbitrary intents (docs: market-makers/message-bus/rpc).
  - **`erc191` wire format** (E-016): `{"standard":"erc191","payload":"<JSON string: signer_id, verifying_contract, deadline (RFC 3339), nonce (base64, 32 bytes), intents>","signature":"secp256k1:<base58 of r ‖ s ‖ v>"}`. The signed bytes are the payload string under the EIP-191 prefix (`personal_sign`).
  - **Trap: byte order.** Intents wants `r ‖ s ‖ recovery`. noble-curves 2.x `sign(..., {format: "recovered"})` returns `recovery ‖ r ‖ s` (recovery byte first), so reorder it (`web/scripts/relay-check.mjs`).
  - **Trap: v.** Intents parses the 65th byte with k256's `RecoveryId::from_byte` (0–3 only). An EVM wallet returns v = 27/28: subtract 27, or `execute_intents` panics "invalid signature" (E-016). High-S signatures are refused too (`ecrecover` with the malleability flag).
  - **Trap: `verifying_contract`** must be the network's Intents account (`intents.near`; `intents.sandbox` on the devnet), else "wrong verifying_contract". A relayed payload can't be replayed ("nonce was already used").
  - **Nonces:** any 32 bytes not starting `5628f6c6` are a legacy nonce and are accepted. The versioned V1 nonce is `5628f6c6 ‖ 00 ‖ salt (4 bytes, view current_salt(), hex) ‖ deadline (i64 LE ns, ≥ the payload deadline) ‖ 15 random bytes`. 1Click's `generate-intent` uses V1 with mainnet salt `252812b3` (E-016). Source: `core/src/nonce/versioned.rs`, `core/src/engine/mod.rs`.
  - **Warrant's relayer** (`web/relay/relay.ts`, E-018) takes 1–4 intents per payload. Each must be a `transfer` to the options contract with a create/write/buy/exercise `msg`, an `auth_call` to it with an `on_auth` action, a Warrant position moved inside Intents, or an `mt_withdraw` of positions to the signer. It also requires `verifying_contract` = this network's Intents and a deadline ≤ 15 minutes out, and caps each signer at 30 per 10 minutes per instance. It previews with `simulate_intents` (422 with the reason), then sends with 300 TGas.
  - **Relaying:** `execute_intents(signed: Vec<MultiPayload>)` is not payable and checks nothing about its caller. In E-016 one intent burnt 5–18 TGas (create 11.7, buy 18.2, exercise 17.7, refused + refunded 11.5, auth_call 5.9), which is ≤ 0.0019 NEAR at the 1e8 yocto/gas minimum. `simulate_intents` previews a signed payload for free (`intents_executed`). The `transfer` notification and `auth_call` are detached: a refusal in the callee doesn't revert the intent. Intents refunds what `mt_on_transfer` returns, and an `on_auth` refusal moves nothing.
  - **Positions:** longs bought or written by a `0x` signer sit on Warrant's own ledger under the `0x` id. Exercise works from there. Listing them, or moving them into Intents (`mt_transfer_call` with `msg: ""` deposits to the signer), goes through Warrant's `on_auth` (docs/SPEC.md, "Signed actions"; E-017).
  - **1Click for a `0x` account** (live, 2026-10-26, E-016): `POST /quote` with `recipient: "0x…", recipientType: "INTENTS"` quotes a Base USDC deposit into that Intents account. `POST /generate-intent {type:"swap_transfer", standard:"erc191", signerId:"0x…", depositAddress}` → 201 with an `erc191` payload to `personal_sign`. Exits therefore ride 1Click's own `submit-intent`, with `signedData: {standard: "erc191", payload, signature}`.
  - **Trap: 1Click doesn't check ERC-191 signatures at submit** (2026-10-26). A deliberately invalid signature got 201 and an `intentHash`, then `/status` reported `PROCESSING` for over a minute; NEP-413 junk gets 400 (E-007). The UI therefore runs `simulate_intents` on the signed payload before submitting (`CrossChain.tsx`). A valid ERC-191 submit that moves funds: **unverified** (#11).
- **Aurora Intents Connect** (docs, 2026-10-26): NEAR is a *source* chain only; NEAR as a destination is "Coming soon". It can't run Warrant actions today.
- **Views:**
  - `mt_balance_of(account_id, token_id)` → string amount.
  - `mt_tokens(from_index, limit)`.
  - `is_auth_by_predecessor_id_enabled(account_id)` → `true` for a fresh, never-used account (2026-10-20).
  - `public_keys_of(account_id)` → an implicit account's own key.
  - `simulate_intents({"signed": [...]})` is a **free view**. With an empty list it returns `{"intents_executed":[], "logs":["EVENT_JSON:{\"standard\":\"dip4\",\"version\":\"0.4.3\",...}"], "min_deadline":..., "state":{"fee":1,"current_salt":"252812b3"}}`. So the deployed event version is **dip4 0.4.3**, newer than the last tagged GitHub release `defuse/v0.4.2` (2026-02-16). Source: `contracts/defuse/src/contract/intents/mod.rs`.
- **Token ID kinds in use (first 3,000 listed, 2026-10-20):**
  - 127 `nep141:`, 2,718 `nep171:`, 155 `nep245:`, **0 `imt:`**.
  - NEP-245 issuers include `v2_1.omni.hot.tg`, `mt.nfts.tg`, a test account and a bare implicit account, so third-party NEP-245 deposits are permissionless.
- **IMT** (`imt:<minter>:<token_id>`, `ImtMint`/`ImtBurn` intents): **not live on mainnet.** The code is gated by `#[cfg(feature = "imt")]`. The `contract` feature doesn't include `imt` (`imt = ["defuse-core/imt"]`, `far = ["imt"]`, no default), and the deployed build used `--features=contract` only (E-003).
- **`escrow-swap` contract** (`contracts/escrow-swap`): a deterministic, immutable maker/taker escrow for any NEP-141/245 token. It's a reference design, not a dependency.

## SDKs and APIs
| Package / API | Pinned version | Calls we use (exact) | Verified in |
|---|---|---|---|
| near-sdk (Rust) | 5.29.1, built with rustc **1.97.1** (D-008). README MSRV is 1.95.0; the `cargo near new` template pins 1.93.0. | Read docs.rs/near-sdk/5.29.1 at M1 before use | crates.io (updated 2026-10-19); near-sdk-rs README; the template wasm builds with 1.97.1 (E-002) |
| near-contract-standards | 5.29.1 | NEP-141 receiver; NEP-245 for position tokens (verify module paths at M1) | crates.io |
| near-sandbox / near-api / cargo-near-build (dev-deps, D-010) | near-sandbox 0.3.16 (Cargo.toml `0.3.12`), near-api 0.8.6 (`0.8`), cargo-near-build 0.11.0, tokio 1 (`full`), testresult 0.4.1 | `near_sandbox::Sandbox::start_sandbox()`, `near_api::NetworkConfig::from_rpc_url("sandbox", …)`, `near_api::Signer::from_secret_key(near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY…)`, `near_api::Contract::deploy(…)` | `cargo near new` template `tests/test_basics.rs` + Cargo.lock; passed locally 2026-10-20 (E-002) |
| near-workspaces | 0.23.0 | **Not used** (D-010) | crates.io |
| cargo-near | 0.22.0 | `cargo near build non-reproducible-wasm` (dev); `reproducible-wasm` needs Docker | README; GitHub release `cargo-near-v0.22.0`, asset `cargo-near-installer.sh` |
| near-cli-rs | 0.30.1 (installed globally via npm) | `near account create-account fund-myself <id> '<n> NEAR' autogenerate-new-keypair save-to-legacy-keychain sign-as <funder> network-config mainnet sign-with-access-key-file <file> send`; `near contract deploy <id> use-file <wasm> with-init-call <fn> json-args '<json>' prepaid-gas '<n> Tgas' attached-deposit '0 NEAR' network-config mainnet sign-with-legacy-keychain send`; `near account list-keys <id> network-config mainnet now` (run against `intents.near`); `near account delete-keys <id> public-keys …` | `--help` at each level, 2026-11-05. The implicit key file (`implicit_account_id, master_seed_phrase, private_key, public_key, seed_phrase_hd_path`) is read by `sign-with-access-key-file`; the legacy keychain doesn't look in `implicit/`. **Sending: unverified until #10** |
| 1Click API | v0, **no partner key** (D-018) | Base `https://1click.chaindefuser.com/v0`, CORS `*`. Unauthenticated quotes carry an extra fee (the hackathon's Q-006: 0.2%; the docs said 0.25% on 2026-10-20), already inside `amountOut`.<br>• `GET /tokens` → `[{assetId, decimals, blockchain, symbol, price, contractAddress}]` (205 tokens, 37 chains).<br>• `POST /quote` fields `dry`, `swapType`, `slippageTolerance` (bps), `originAsset`, `depositType` (`ORIGIN_CHAIN`/`INTENTS`), `destinationAsset`, `amount`, `refundTo`, `refundType`, `recipient`, `recipientType` (`DESTINATION_CHAIN`/`INTENTS`), `deadline` → `{quote: {depositAddress (non-dry only), amountIn(Formatted), amountOut(Formatted), minAmountOut, timeEstimate, …}}`.<br>• `GET /status?depositAddress=` → `{status, updatedAt, swapDetails: {originChainTxHashes, destinationChainTxHashes: [{hash, explorerUrl}], nearTxHashes, refundedAmountFormatted, refundReason, …}}`; statuses `PENDING_DEPOSIT, KNOWN_DEPOSIT_TX, INCOMPLETE_DEPOSIT, PROCESSING, SUCCESS, REFUNDED, FAILED`.<br>• `POST /deposit/submit {depositAddress, txHash}` (optional speed-up).<br>• `INTENTS` deposits: `POST /generate-intent {type:"swap_transfer", standard:"nep413", signerId, depositAddress}` → `{intent}` (a `transfer` of exactly `amount` to `depositAddress`); the wallet signs it; `POST /submit-intent {type:"swap_transfer", signedData: {...intent, public_key, signature}}` → `{intentHash}` | Live, 2026-10-20 (E-007): non-dry quote and `generate-intent` (201) without a key; `submit-intent` validates without a key (400 on a junk signature, not 401). **A valid `submit-intent`: unverified (#11).** |
| @defuse-protocol/one-click-sdk-typescript | 0.1.26 (published 2026-09-22) | **Not used**: the web app calls the REST API directly (`web/src/lib/oneclick.ts`) | npm, 2026-10-20 |
| @hot-labs/near-connect | 0.11.4 | `wallet.signAndSendTransaction({signerId, receiverId, actions})`, `signAndSendTransactions({signerId, transactions})`, `signMessage({message, recipient, nonce: Uint8Array, signerId}) → {accountId, publicKey, signature}`; actions as `{type: "FunctionCall", params: {methodName, args, gas, deposit}}` | `build/types/index.d.ts`, 2026-10-20. Mainnet signing: **unverified** until #10 |
| Frontend candidates | @hot-labs/near-connect 0.11.4, near-api-js 7.3.1, vite 8.3.4 | Pin at scaffold (D-003 rule) | npm, 2026-10-20 |

## Measured costs (NEAR = $4.94 on 2026-10-20, $4.04 on 2026-11-05 from 1Click `/tokens`; the figures below are the 2026-10-20 dry quotes and RPC)
- 1 NEAR → USDC inside Intents: 4.913438 USDC out, a **0.54%** spread, about 10s.
- 1 USDC from Intents to Base: 0.997398 (**0.26%**), about 12s. To Arbitrum: 0.994551 (**0.55%**), about 9s.
- 1 USDC from Arbitrum into NEAR Intents (origin-chain deposit): 0.999798 (**0.02%**), about 25s.
- For reference, a Pyth `update_price_feeds` tx cost a 0.0015 NEAR fee with 0.01 NEAR attached.

## Traps
- **Pyth on NEAR is stale, and Hermes needs an API key** (since 2026-08-26 16:00 UTC per Pyth docs). `get_price` returns null with a 60s stale threshold. (E-001)
- **NEAR Intents is mainnet-only.** `intents.testnet` and `defuse.testnet` have no code, and the Intents docs `llms.txt` doesn't mention testnet. (2026-10-20)
- **`mt_balance_of` doesn't validate token IDs.** A nonsense ID like `xyz:intents.near:test` returns "0". Never infer a token type exists from a zero balance.
- **Exactly 1 yoctoNEAR** must be attached to `mt_transfer` and `ft_withdraw`.
- **Predecessor auth can be turned off per account** inside Intents. Our contract must never call a method that disables it.
- **Rust toolchain:** near-sdk 5.29.1 needs rustc ≥ 1.95.0. The machine default is 1.89.0 and must stay that way. `rust-toolchain.toml` pins **1.97.1** with `wasm32-unknown-unknown` for this folder (installed 2026-10-20).
- **`cargo near new` writes its own `rust-toolchain.toml` (1.93.0), a nested `.git`, and `.github/workflows/{test,deploy-staging,undeploy-staging,deploy-production}.yml`.** Delete all three when scaffolding `contracts/options` (D-010). Its release profile sets `overflow-checks = true`. Keep it.
- **Size anchor:** the minimal template contract compiles to 102.6 KB, about 1.03 NEAR of storage. Our options contract is 294.8 KB (about 2.95 NEAR) plus a 41 KB embedded ABI (2026-10-20).
- **Plain `cargo check` is rejected by near-sdk 5.29.1** (a deliberate `compile_error!`). Use `cargo check --target wasm32-unknown-unknown`, `cargo test`, `cargo clippy`, or `cargo near build`.
- **ABI generation needs `--abi-features abi`.** `defuse-nep245`'s `Token` only derives `JsonSchema` behind its `abi` feature, so our crate exposes `abi = ["defuse-nep245/abi"]`. The live intents.near build does the same (`--abi-features=abi,contract`). The sandbox test builds with `BuildOpts { abi_features: Some("abi"), .. }`.
- **`env::promise_result` is deprecated in 5.29.1** (clippy `-D warnings` fails). Use `env::promise_result_checked(idx, max_len)`. In `on_payout`, only `Err(PromiseError::Failed)` counts as failure, so a success we can't read is never paid twice.
- **Refusals inside `mt_on_transfer` don't fail the transaction.** `intents.mt_transfer_call` succeeds overall: our receipt fails, Intents' resolver refunds. Assert on `receipt_failures()` plus unchanged balances, and look for the failed receipt in explorers. Direct calls (`reclaim_collateral`, …) fail the transaction itself.
- **`Promise` is scheduled on drop.** Detached payouts use `.detach()` (near-sdk 5.29.1 `promise.rs`).

**Web (2026-10-20)**
- **Tailwind v4 layers:**
  - Unlayered custom CSS beats every Tailwind utility, so component classes live in `@layer components`.
  - Utilities (e.g. `block`) beat component-layer rules, so don't put a display utility on elements whose display a container query toggles (`.route-h` / `.route-v`).
- **Tailwind preflight zeroes `margin` on `<dialog>`**, removing the UA centering. `dialog.sheet` restores `margin: auto`.
- **near-connect** types its outcome via `@near-js/types`, which isn't installed. `wallet.ts` types the receipt shape it reads. Wallets support only `mainnet` / `testnet`, so the devnet board is read-only by design.
- **React 19.3 types deprecate `FormEvent`.** Use `SubmitEvent` for form submit handlers.
- **Vite env:** process environment overrides `.env.*` files. `VITE_RPC_URL=… npx vite` points a second server at another devnet without touching `web/.env.development.local`, which the devnet writes.
- **Element-scoped View Transitions** (`el.startViewTransition`) exist only in Chromium 147+. Feature-detect on `Element.prototype` and fall back to an instant update.
- **cargo-near** installs to `~/.cargo/bin`. Install with `CARGO_NEAR_NO_MODIFY_PATH=1` so it doesn't edit shell rc files.
- **Account deletion:** the beneficiary must exist, or the funds are dispersed to validators (https://docs.near.org/protocol/network/token-loss). Deleting moves only NEAR, so withdraw tokens and Intents balances first. Exchanges crediting a deletion transfer: **unverified**, so use a personal wallet.
- **Fresh releases:** near-sdk 5.29.1 and near-workspaces 0.23.0 were published 2026-10-19. TypeScript 7.0.2 and React 19.3.1 were published 2026-10-20.
- **NEP-413 signatures from wallets are base64; Intents wants `ed25519:<base58>`.** `oneclick.ts` converts (`intentsSignature`). The nonce from `generate-intent` is base64; near-connect wants it as a `Uint8Array`.
- **`generate-intent` answers 400 "Quote has expired" once the quote *request's* `deadline` passes**, even though the quote's `timeWhenInactive` is days later. The app quotes with a 30-minute deadline, shows "sign before HH:MM UTC", and sends an expired quote back to "Get a quote".
- **Python's urllib gets Cloudflare error 1010 from 1Click** (browser-signature block). curl and browsers are fine.
- **Tailwind v4 doesn't scan `web/scripts/og.html`**, so arbitrary utilities there never compile. The link-preview template uses plain CSS on the app's tokens and component classes.
- **`vite.config.ts` is type-checked with `vite/client` types only (no `@types/node`).** Use Vite hooks instead of `node:fs`: `configResolved(c).env` for env, `generateBundle` + `this.emitFile` for the `/account` shell copy.
- **eslint-plugin-react-hooks 7 flags `Date.now()` in handlers declared in a component body** (`react-hooks/purity`). Stamp times inside library functions (`transfers.ts` `remember`).
- **Playwright can't `check()` an `sr-only` radio** whose label covers it; click the label text, as a person would.

**Web (2026-10-21)**
- **Motion `MotionValue.set()` doesn't stop a running animation.** A drag that sets values while a hover spring is still running fights it: on release the lever flew to +102° and no sheet opened. Writes from the hand use `jump()`, which stops animations and resets velocity (E-011).
- **Don't hang side effects on Motion's `animate(...).then()`**: an interrupted animation (hover end, blur) may never resolve. `Lever.tsx` schedules the pull with a timer and tracks a `throwing` flag instead.
- **NumberFlow 0.6.2 exposes its value through ElementInternals** (role image, `ariaLabel` = the formatted value) with the digits in shadow DOM: light-DOM `textContent` is empty, and Playwright's `ariaSnapshot` lists the digits separately. Check the real tree with CDP `Accessibility.getPartialAXTree`.
- **Radix Tooltip `asChild` hands the trigger its own `data-state`** (`closed`/`delayed-open`), which overwrote the lever's `free`/`locked`. `Lever` spreads the trigger's props first, then its own.
- **`npx tsc -b` emits `.js` next to every source** (this tsconfig has no `noEmit`), and Vite resolves `.js` before `.tsx`. Typecheck with `npm run typecheck` only.
- **The web code has no formatter config.** Don't run prettier: its defaults reflow files to 80 columns, unlike the hand-formatted code.
- **Dialog transitions:** `@starting-style` entry works in every current engine; the exit needs `overlay` plus discrete `display` transitions, which only Chromium has, so Firefox and Safari close instantly (accepted).
- **Playwright `goto` to the URL already loaded can restore its old scroll position.** Navigate via `about:blank` before capturing a first frame.
- **A container query's `rem` follows this root's 15px**, not 16: `@container (max-width: 21.5rem)` is 322px. The dial's breakpoints are written in px (2026-10-26).
- **`color-mix(in oklch, …)` with white drifts hue:** `oklch(1 0 0)` carries an explicit hue of 0, so an 11% green tint over white rendered pink (`oklch(0.956 0.0165 17.38)`). Tint and darken in OKLab (`color-mix(in oklab, …)`); OKLCH mixes against `transparent` are fine (2026-10-26).
- **Tailwind utilities beat `@layer components`:** an `inline-flex` utility on the custody track labels overrode their `display: none` on phones. Put alignment on children instead.
- **Theme scopes work through variables:** Tailwind v4 colour utilities read `var(--color-*)` at use, so `.night` re-lights every `*-panel-*` utility inside it without a second class.
- **Tailwind only generates classes it finds as literal strings.** A class built in a template literal (`lg:grid-cols-[${SIX}]`) is never emitted; write each variant out whole (`Board.tsx` COLUMNS).
- **React reveals resolved Suspense content in ~300 ms batches**, so a scroll taken two frames after a lazy chunk's import resolves lands before the content arrives. Lazy sections re-apply the URL's `#target` as they mount instead (`route.ts` `settleHash`).

**Reading transactions back (2026-10-21, D-027)**
- **`tx` RPC:** `{"method":"tx","params":{"tx_hash","sender_account_id","wait_until":"NONE"}}` returns `{final_execution_status, status, transaction, transaction_outcome, receipts_outcome}`. `transaction.actions[i].FunctionCall` has `method_name` and base64 `args`; `transaction_outcome.block_hash` dates it via `block` `{block_id: <hash>}` → `header.timestamp_nanosec`. Verified on the devnet and on mainnet (archival) 2026-10-21.
- **A refusal inside `mt_transfer_call` reads like this:** the outer status is `SuccessValue`; our receipt (executor `options.*`) fails with `ActionError … ExecutionError: "Smart contract panicked: ERR_…"`; Intents logs `EVENT_JSON:{"standard":"nep245","event":"mt_transfer","data":[{"old_owner_id":<options>,"new_owner_id":<signer>,"token_ids":[…],"amounts":[…],"memo":"refund"}]}`. A direct call (e.g. `reclaim_collateral`) fails at the top level and moves nothing.
- **Regular RPC nodes forget transactions after a few epochs.** `free.rpc.fastnear.com` answers `UNKNOWN_TRANSACTION` for a block-150,000,000 tx that `https://archival-rpc.mainnet.fastnear.com` returns in full (CORS `*`). The refusals band reads through `config.archivalRpcUrl`.
- **The sandbox keeps about two minutes of history** (epoch 60 blocks, `gc_num_epochs_to_keep` 5): a seeded tx is `UNKNOWN_TRANSACTION` minutes later. `tests/devnet.rs` starts it with `SandboxConfig { additional_config: Some(json!({"gc_num_epochs_to_keep": 100_000})), .. }` (merged into `config.json`).
- **near-api 0.8.6:** `ExecutionFinalResult::outcomes()[0]` is the transaction's own outcome; its `transaction_hash` field is the outcome id, i.e. the tx hash, and `CryptoHash` displays as base58.


- **A component-layer `display: none` loses to a display utility on the same element** (again, 2026-10-21): the phone's backing list kept Tailwind's `flex`. Toggle display with responsive utilities (`hidden lg:flex`) on elements that carry one.

**Devnet signer (D-017)**
- Every devnet account shares the sandbox genesis key (`near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY`, public key `ed25519:5BGSaf6YjVm7565VzWQHNxoyEjwr3jUpRJSGjREvU9dB`). `tests/devnet.rs` writes it to `web/.env.development.local`.
- WebCrypto imports an Ed25519 secret only as PKCS#8: the 16-byte RFC 8410 header `302e020100300506032b657004220420` + the 32-byte seed (the first half of NEAR's 64-byte secret).
- A transaction is borsh `Transaction` V0 (signer, `0u8` + 32-byte key, nonce u64, receiver, block hash, actions; `FunctionCall` = variant `2`: method, args bytes, gas u64, deposit u128). Sign `sha256(bytes)`; `SignedTransaction` = bytes + `0u8` + 64-byte signature; RPC `send_tx {signed_tx_base64, wait_until: "FINAL"}`. Nonce and block hash come from `view_access_key`.
- Production builds never load `.env.development.*`; E-007 checks the key is absent from `dist`.

## Environment
| Var | Purpose | Where to get it |
|---|---|---|
| `NEAR_ACCOUNT_ID` | Dev/contract account | Accounts table above |
| `NEAR_RPC_URL` | Mainnet RPC | Networks table above |
| `NEAR_CREDENTIALS_DIR` | Key file location, never committed | `~/.near-credentials/implicit` |
| `VITE_SITE_URL` | Deployed origin; when set at build time, `og:url`/`og:image` become absolute (D-019) | The host, at deploy (#13) |
| `VITE_WRAP_CONTRACT` | wNEAR contract for the web app (default `wrap.near`; the devnet writes `wrap.sandbox`) | This file, "Contracts we call" |
| `VITE_SANDBOX_SIGNER_KEY` | Devnet only: the sandbox's public genesis key (D-017) | Written by `tests/devnet.rs` |
| `VITE_REFUSAL_TXS` | The refusals band's recorded refused transactions, `id:signer:hash,…` for `reclaim-early`, `exercise-expired`, `exercise-unheld` (D-027) | Written by `tests/devnet.rs`; on mainnet, by the demo run (#10) |
| `VITE_ARCHIVAL_RPC_URL` | Archival RPC for reading old transactions (default on mainnet `https://archival-rpc.mainnet.fastnear.com`; the devnet uses its own RPC) | This file, "Reading transactions back" |
| `VITE_REPO_URL` | Public repository, linked from the footer when set | GitHub, at #6/#13 |
| `VITE_DEVNET_ACCOUNTS` | Devnet only: the seeded accounts to act as, holders included (`alice.sandbox,bob.sandbox,carol.sandbox`), offered by the header and by sheets with no one to send them (D-028) | Written by `tests/devnet.rs` |
| `RELAY_ACCOUNT_ID` / `RELAY_SECRET_KEY` | **Server-side only, no `VITE_` prefix (never bundled).** The relayer's gas-paying account and its ed25519 key (`web/relay/relay.ts`, D-030). Mainnet: a function-call key limited to `intents.near` / `execute_intents` with a capped allowance, set in the host's secrets (rule 6). The dev server mounts `/api/relay` only when both are set | Devnet: written by `tests/devnet.rs` (`relayer.sandbox`, the genesis key) |
| `VITE_RELAY_URL` | Where the web app posts intents signed by EVM wallets (D-030). Default `/api/relay`: the dev server mounts it; on mainnet, the host that serves the relayer (the user's call at #10) | Default suffices when the relayer shares the site's origin |
| `BASE_PAYOUT_ADDRESS` | Demo payout address on Base | Generated at M2 |
