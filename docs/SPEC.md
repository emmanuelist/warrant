# Warrant: options contract specification

Fully collateralized, physically settled options whose collateral, premiums and payouts live inside NEAR Intents (`intents.near`). No price oracle is involved (D-002). Design decisions are in D-009 and D-012. This file is the single home for contract behavior. Code, tests and the README refer here.

## Model

**Token IDs** below are Intents token IDs, e.g. `nep141:wrap.near` or `nep141:17208628…33a1` (USDC).

A **series** has exactly one writer and these immutable parameters:

| Field | Meaning |
|---|---|
| `kind` | `call` or `put` |
| `underlying` | Intents token ID of the asset optioned |
| `quote` | Intents token ID of the strike/premium asset |
| `underlying_per_option` | Underlying units one option delivers (call) or takes (put) |
| `strike_per_option` | Quote units paid (call) or received (put) on exercise of one option |
| `expiry_ns` | Exercise is allowed while `block_timestamp < expiry_ns` |

Derived per kind:

| | Call | Put |
|---|---|---|
| Collateral token | `underlying` | `quote` |
| Collateral per option | `underlying_per_option` | `strike_per_option` |
| Exercise payment token | `quote` | `underlying` |
| Exercise payment per option | `strike_per_option` | `underlying_per_option` |
| Exercise delivery per option | `underlying_per_option` | `strike_per_option` |

**Positions:** each series is a NEP-245 token in this contract, with `token_id` = the series ID as a decimal string. One token is one option (a long). Holders can deposit longs into Intents (`mt_transfer_call` to `intents.near`, where they appear as `nep245:<this contract>:<series_id>`), move them there, and withdraw them back with `intents.mt_withdraw`. Only longs held in this contract's ledger can be exercised.

**Series state:** `long_supply`, `collateral_held`, `proceeds_held`, `exercised`, `reclaimed: bool`.

## Actions through Intents
The caller runs `intents.near.mt_transfer_call(receiver_id = <this contract>, token_id, amount, approval: null, memo, msg)` with 1 yoctoNEAR and **≥ 200 Tgas**. Intents moves the tokens to this contract inside its ledger, then calls our `mt_on_transfer`. If we panic, Intents refunds everything. If we return refunds, Intents returns those amounts.

`msg` is JSON with an `action` tag:

| Action | `msg` | Token sent | Effect |
|---|---|---|---|
| `create` | `{"action":"create","kind":"call","underlying":"…","quote":"…","underlying_per_option":"…","strike_per_option":"…","expiry_ns":"…"}` | Collateral token, ≥ the allowlist minimum | New series with writer = `sender_id`. Mints `n = amount / collateral_per_option` longs to the writer. Refunds `amount % collateral_per_option`. |
| `write` | `{"action":"write","series_id":"7"}` | That series' collateral token | Writer-only, before expiry. Mints `n` more longs to the writer. Refunds the remainder. |
| `buy` | `{"action":"buy","offer_id":"3","amount":"2"}` | The series' `quote` | Before expiry. Pays `price_per_option × amount` to the seller (`mt_transfer` inside Intents) and moves `amount` longs from escrow to the buyer. Refunds overpayment. |
| `exercise` | `{"action":"exercise","series_id":"7","amount":"2","receiver_id":null}` | The exercise payment token | Before expiry, and the sender must hold ≥ `amount` longs. Burns them, adds the payment to `proceeds_held`, and pays `amount × delivery` of the collateral token to `receiver_id` (default: the sender). Refunds overpayment. |

Batch transfers (more than one token) are rejected.

## Direct methods
All value-moving methods require exactly 1 yoctoNEAR (an explicit, full-access signature).

| Method | Who / when | Effect |
|---|---|---|
| `list(series_id, amount, price_per_option) -> offer_id` | Any long holder, before expiry | Escrows `amount` longs in the contract and creates a fixed-price offer |
| `cancel_offer(offer_id)` | The offer's seller | Returns the unsold longs |
| `close(series_id, amount)` | Writer, before expiry, holding ≥ `amount` longs | Burns the longs and pays `amount × collateral_per_option` back to the writer |
| `withdraw_proceeds(series_id)` | Writer, any time | Pays `proceeds_held` to the writer |
| `reclaim_collateral(series_id)` | Writer, after expiry, once | Pays `collateral_held` to the writer. Unexercised longs are now worthless. |
| `retry_payout(token_id)` | Anyone with an owed balance | Re-sends the owed amount |
| `allow_token(token_id, min_amount)` / `disallow_token(token_id)` | Owner | Edits the allowlist. Existing series are unaffected. |

Every payout is `intents.near.mt_transfer(receiver, token_id, amount)` from this contract with 1 yocto. If that promise fails, the amount is added to `owed[(receiver, token_id)]` and an `payout_failed` event is emitted.

## Signed actions (D-030)
A wallet without a NEAR account (EVM, Solana, passkey) acts through intents it signs. `intents.near` verifies the signature and executes the intent when anyone relays it with `execute_intents`. The signer's Intents account is its own address (`0x…` for an EVM wallet).

- **Actions that move tokens** (`create`, `write`, `buy`, `exercise`) use a signed `transfer` intent to this contract, with the same `msg` as in "Actions through Intents". Intents calls `mt_on_transfer` with `sender_id` = the signer, so that section applies unchanged.
- **Direct methods** use a signed `auth_call` intent, and Intents calls `on_auth(signer_id, msg)`.
  - `on_auth` is accepted only from the configured Intents contract (`ERR_NOT_INTENTS`).
  - It runs the method named in `msg` with `signer_id` as the caller, so every refusal of that method holds.
  - No yoctoNEAR is needed: the signature authorizes the call.

| `msg` | Runs |
|---|---|
| `{"action":"list","series_id":"7","amount":"2","price_per_option":"…"}` | `list` |
| `{"action":"cancel_offer","offer_id":"3"}` | `cancel_offer` |
| `{"action":"close","series_id":"7","amount":"1"}` | `close` |
| `{"action":"withdraw_proceeds","series_id":"7"}` | `withdraw_proceeds` |
| `{"action":"reclaim_collateral","series_id":"7"}` | `reclaim_collateral` |
| `{"action":"retry_payout","token_id":"nep141:…"}` | `retry_payout` |
| `{"action":"mt_transfer_call","receiver_id":"intents.near","token_id":"7","amount":"1","memo":null,"msg":""}` | NEP-245 `mt_transfer_call` of the signer's longs, e.g. into Intents |

Any other `msg` is refused with `ERR_BAD_MSG`. Payouts go to the signer's Intents account, as for any caller.

## Views
`get_config`, `get_series(series_id)`, `get_series_list(from_index, limit)`, `get_offer(offer_id)`, `get_offers(from_index, limit)`, `get_owed(account_id, token_id)`, plus NEP-245 `mt_balance_of`, `mt_batch_balance_of`, `mt_supply`, `mt_batch_supply`, `mt_token`. All `u128`/`u64` values are JSON strings.

## Refusals (exact panic messages)
| Message | When |
|---|---|
| `ERR_NOT_INTENTS` | `mt_on_transfer` or `on_auth` called by anyone but the configured Intents contract |
| `ERR_BATCH_NOT_SUPPORTED` | More than one token in a transfer |
| `ERR_BAD_MSG` | `msg` doesn't parse, or names an action `on_auth` doesn't run |
| `ERR_TOKEN_NOT_ALLOWED` | `create` with a token not on the allowlist |
| `ERR_BELOW_MIN` | `create` deposit below the token's minimum |
| `ERR_SAME_TOKEN` | `underlying == quote` |
| `ERR_ZERO` | A zero amount, per-option size or price |
| `ERR_BAD_EXPIRY` | `expiry_ns` not within [now + 60 s, now + 366 days] |
| `ERR_UNKNOWN_SERIES` / `ERR_UNKNOWN_OFFER` | Unknown ID |
| `ERR_WRONG_TOKEN` | Sent token isn't the one this action needs |
| `ERR_NOT_WRITER` | Writer-only method or action called by someone else |
| `ERR_NOT_SELLER` | `cancel_offer` by a non-seller |
| `ERR_EXPIRED` | `write`, `buy`, `exercise`, `list` or `close` at or after expiry |
| `ERR_NOT_EXPIRED` | `reclaim_collateral` before expiry |
| `ERR_ALREADY_RECLAIMED` | Second `reclaim_collateral` |
| `ERR_INSUFFICIENT_LONGS` | `exercise`, `close` or `list` with fewer longs than requested |
| `ERR_INSUFFICIENT_PAYMENT` | Payment below the required amount |
| `ERR_OFFER_AMOUNT` | `buy` amount exceeds what the offer has left |
| `ERR_NOTHING_TO_PAY` | `withdraw_proceeds` / `retry_payout` with nothing due |
| `ERR_NOT_OWNER` | Allowlist edits by a non-owner |
| `ERR_OVERFLOW` | Arithmetic overflow |

## Invariants (tested)
1. For each series, until `reclaim_collateral`: `collateral_held == long_supply × collateral_per_option`. Escrowed longs count in `long_supply`.
2. `proceeds_held == exercised × payment_per_option − withdrawn_proceeds`.
3. This contract's Intents balance of each token ≥ Σ over series of (`collateral_held` + `proceeds_held`) in that token, plus Σ `owed` in that token.
4. A refused action leaves every balance unchanged.

## Events (NEP-297, standard `intents_options`, version `1.0.0`)
`create`, `write`, `list`, `cancel_offer`, `buy`, `exercise`, `close`, `withdraw_proceeds`, `reclaim_collateral`, `payout_failed`, `payout_retried`. Position movements also emit standard `nep245` `mt_mint` / `mt_burn` / `mt_transfer`.

## Limitations (known, accepted for the hackathon)
- **Storage:** the contract pays for storage (series, offers, NEP-245 balances), with no NEP-145 registration. The allowlist minimum limits series spam. Transfers of longs to many fresh accounts still consume contract storage.
- **No pooling:** longs from different writers are different tokens, even with identical parameters (D-012).
- **Expired longs** remain in balances as worthless tokens.
- **No audit.** Demo amounts only.
