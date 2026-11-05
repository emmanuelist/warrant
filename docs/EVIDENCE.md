# Evidence
Append-only proof log. Every claim in the README, demo or submission points to an entry here.

| # | Date | Claim | Proof | Commit |
|---|---|---|---|---|
| E-001 | 2026-10-20 | Pyth on NEAR is stale: the BTC/USD price was published 2026-08-25, no update since 2026-08-26, and Hermes requires an API key | Commands and output below; last update tx [C5DjFq2…](https://nearblocks.io/txns/C5DjFq2SJEttB7Lh5bfijZbeGSCTtUt4VyzpLFekitz5) | pre-commit (D-005) |
| E-002 | 2026-10-20 | Toolchain ready: rustc 1.97.1 (project-local), wasm32-unknown-unknown, cargo-near 0.22.0. NEAR's template builds to a 102.6 KB wasm and passes 7 unit + 1 sandbox-deploy test. | Output below | pre-commit (D-005) |
| E-003 | 2026-10-20 | Live `intents.near` is v0.4.5 (commit 16d04f6, cargo-near 0.22.0, rust 1.97.1, near-sdk 5.29.1); IMT not compiled in | Output below | pre-commit (D-005) |
| E-004 | 2026-10-20 | Options contract passes the full gate: fmt, clippy `-D warnings`, wasm build (294.8 KB), 57 unit tests covering every action and every refusal in docs/SPEC.md | Output below | pre-commit (D-011) |
| E-005 | 2026-10-20 | Full lifecycle works against **byte-identical mainnet** `intents.near` + `wrap.near` (hash-pinned, sandbox). Covers: collateral in via `mt_transfer_call`; premium paid inside Intents; a position deposited into Intents, moved to another account there, withdrawn; exercise delivers underlying; three refusals fully refunded; reclaim after expiry; delivered token leaves Intents as a plain balance. | `contracts/options/tests/sandbox.rs`, output below | pre-commit (D-011) |
| E-006 | 2026-10-20 | Web app renders every designed state from real chain data (local devnet with mainnet Intents bytecode), with no overflow at 1440 / 390 px. Lint (0 warnings) and production build pass. Reduced motion disables every animation. | Measurements and gate output below; renders in `docs/renders/` | pre-commit (D-011) |
| E-007 | 2026-10-20 | Every action the web app can send was executed through its own UI against byte-identical mainnet Intents (devnet signer, D-017): wrap-and-deposit, withdraw to wallet (with unwrap), positions into and out of Intents, a long sent inside Intents, exercise, a refused exercise refunded in full, cancel offer, write a series. 1Click answers quotes, `generate-intent` and `submit-intent` without a key, with CORS open (D-018). Account page, filters, payoff chart and deep links render without overflow at 1440 / 1024 / 390. | Transactions, traces, probes and gate output below; renders in `docs/renders/` | pre-commit (D-011) |
| E-008 | 2026-10-21 | The reference patterns (D-021) work on real data: the review panel lists exactly the calls each sheet sends (live NEP-145 registration check; Warrant's `msg` decoded), the payoff readout and landmark chips give exact break-even and max loss/profit for a call and a put with no layout shift, and the NEP-413 message review and transfer timeline render from a live 1Click quote and status. | Output below; renders in `docs/renders/` | pre-commit (D-011) |
| E-009 | 2026-10-21 | The depth pass (D-022) renders cleanly: the control-panel surface, system route hero, series instruments and refusals panel show no overflow at 1440 / 390; the station figure fits its plate exactly; all seven levers sit in one row; locked plates are dark and free ones lit; type and layout detectors report 0 findings; lint and build pass. | Measurements below; renders `docs/renders/v3-*.png` | pre-commit (D-011) |
| E-010 | 2026-10-21 | The type system (D-023) holds for readers who enlarge text: with Chromium's default font size at 16, 20 and 24px, board and account show no horizontal overflow at 390, 1024 and 1440; roles compute as specified; both fonts are preloaded and the metric-matched fallbacks are registered; type and layout detectors report 0 findings. | Output below | pre-commit (D-011) |
| E-011 | 2026-10-21 | The studio-light redesign (D-024, D-025) works on real devnet data: the Lock Dial places every live series on its log-time ring and its markers open their series; levers throw, stop at their bolts and kick back by drag, click and keyboard; tooltips name the exact `ERR_*`; rolling figures expose their full value to assistive tech; reduced motion removes every animation and shows figures at once; no horizontal overflow at 390 / 1024 / 1440 with reader fonts of 16, 20 and 24px; the whole dial sits above the fold at 1440×900; lint, typecheck and build pass with the levers' libraries in lazy chunks; the sandbox key is absent from `dist`. | Output below; renders `docs/renders/v4-*.png` | pre-commit (D-011) |
| E-012 | 2026-10-21 | "How the lock holds" (D-026) runs on scroll as designed: the active step follows the reading line, the Reclaim pull is refused while the lock holds, and expiry (levers flip, "Open") stays in view for 420px of scroll at 1440; the phone strip is 204px; reduced motion moves the lock by step with no transitions; the "How it works" link lands on the section with focus. The payoff table no longer repeats a price (a duplicate React key, seen every second on series without an offer). Lint, typecheck and build pass; Motion stays in a lazy chunk. | Output below; renders `docs/renders/v4-story-*.png` | pre-commit (D-011) |
| E-013 | 2026-10-21 | The critique fixes (D-027) work on real devnet data. Refusal cards read their transactions back from chain by hash (error, refund, sender, time), and "Send one yourself" sent a real exercise the chain refused and refunded. Sheets stop the three failing cases with field-tied errors (99 against 7 held, 1.5, a short balance); Buy on your own offer points to Cancel; Write rejects a 2020 expiry and 100,000 options. A real Buy went through from the phone's docked primary key and the sheet re-read the offer (4 → 3 left). Deep links and #targets land on the board and refusals. Route text is 11.5px or more at 1440 and 390. Story text is 4.83:1 or better in every state. axe-core 4.10.2 finds 0 violations on board, sheets and account at 1440 and 390; the impeccable detectors find 0 low-contrast. No overflow at 390 / 1024 / 1280 / 1440, nor with reader fonts of 20 and 24px at 390 / 1024 / 1440 (the story strip now wraps, and stops pinning when the phone is narrow in ems). Idle long frames fell from about 1 a second to 1 in 5 s. Lint, typecheck, build and the contract gate (fmt, clippy, 57 unit + 2 sandbox tests) pass; the devnet key is absent from `dist`. | Output below; captures `internal/research/ui-refs/fix-*.png` | pre-commit (D-011) |
| E-014 | 2026-10-21 | The second critique's fixes (D-028) render from devnet data. At 1440 the pinned card is 472px tall beside a 505px list, and the bench runs full width below it (route 676px wide, text 11.5px or more, seven levers in one row). Commits read "Exercise 1 · pay 4.80 tUSDC" and "Lock 1.00 wNEAR until 28 Oct 18:07 UTC". Write's review decodes `msg` (expiry "2026-10-28 18:07 UTC · in 7 days"). An over-count dims the review in place. "Your move" names each row's move at 1440 and 390. The dial's centre reads out the pointed lock, with no labels on the ring. A visitor picks bob inside the sheet and can buy. The skip link focuses `main#board`. There's no overflow at 390 / 1024 / 1280 / 1440, including a 64-hex account at 390, and no truncated writer names. axe 0 violations (board, sheets, phone sheet). Detectors: board 1440 nested-cards 3 + stripes advisory (deliberate); 390 stripes only; account clean. No console errors on four clean loads. Lint, typecheck, build (main 396.9 kB, 118.1 kB gzip), fmt and clippy pass; the devnet key is absent from `dist`. Before these fixes, the re-run critique (dual agent) scored 29/40 (was 27/40). | Output below; captures `internal/research/ui-refs/fix2-*.png`, `critique2-*.png` | pre-commit (D-011) |
| E-015 | 2026-10-21 | The third critique's fixes (D-029) work on devnet data. Board rows read "0.00 wNEAR returned · 2 lapsed" and "2.00 wNEAR released · 2 lapsed", with no offers on expired series. Lamps are one ink when free and hollow when bolted. Alice's Buy is captioned "only your offers" and its sheet opens "Cancel offer 1". Exercising 2 shows the devnet's no-reference note and a gap, "This needs 9.60 tUSDC; your Intents balance is 1.36 tUSDC", with "Deposit 8.24 tUSDC". The deposit sheet opens pre-filled, and "Back to exercise · series #1" restores the count of 2. Proceeds read "Claim proceeds" / "Claim 4.80 tUSDC". After a real Buy from the phone's dock, the sheet stops with "Sent and settled". On a phone the hero is 906px, the story 1,614px, and the board starts at 2,731px; the sheet leads with offers and position. axe 0 (board, phone sheet), no console errors, detectors deliberate-only. Lint, typecheck, build (404.1 kB, 119.8 kB gzip) and fmt pass; the devnet key is absent from `dist`. The third critique scored 28/40 (trend 27 → 29 → 28); audit 16/20. | Output below; captures `internal/research/ui-refs/fix3-*.png`, `critique3-*.png` | pre-commit (D-011) |
| E-016 | 2026-10-26 | **Spike, not product code:** a wallet from another chain can act on Warrant with no NEAR account. Against byte-identical mainnet `intents.near` (v0.4.5) and an unchanged Warrant, an EVM key with no NEAR account (`0x17c5…d025`) signs `erc191` intents that another account relays with `execute_intents`. Its `transfer`+`msg` intents create a series with the `0x` address as writer, buy an offer and exercise it. Two refusals (`ERR_NOT_WRITER`, `ERR_INSUFFICIENT_LONGS`) are refunded in full. An `auth_call` reaches `on_auth` with `signer_id` = the `0x` address and `intents.near` as the predecessor. Traps: v = 27/28 is refused (invalid signature), a replay is refused, another network's `verifying_contract` is refused, and a salted versioned nonce is accepted. The relayer pays 5–18 TGas per intent (≤ 0.0019 NEAR at the minimum gas price). 1Click quotes a Base USDC deposit straight into the `0x` Intents account, and `generate-intent` returns a ready-to-sign `erc191` exit intent (201). Nothing was signed or submitted to 1Click. | `internal/spikes/any-chain-signers` (gitignored, D-005): `cargo test --test signers -- --nocapture`; 1Click curl calls; output below | pre-commit (D-011) |
| E-017 | 2026-10-26 | Wallets without a NEAR account can run every Warrant action (#15, D-030). `on_auth(signer_id, msg)` runs list, cancel_offer, close, withdraw_proceeds, reclaim_collateral, retry_payout and `mt_transfer_call` for the signer of an `auth_call` intent, and only for calls from Intents. Gate green: fmt, clippy `-D warnings`, wasm 323.0 KB with `on_auth` in the ABI, 70 unit tests (13 new). Against byte-identical mainnet Intents, a `0x` wallet with no NEAR account writes, lists, cancels, moves a long into Intents, claims the strike, is refused an early reclaim (`ERR_NOT_EXPIRED`), and reclaims after expiry, all through relayed `erc191` intents. A NEAR account calling `on_auth` itself is refused (`ERR_NOT_INTENTS`). The existing sandbox suite still passes. | `contracts/options/src/auth.rs`, `tests/signers.rs`, `tests/common/evm.rs`; output below | pre-commit (D-011) |
| E-018 | 2026-10-26 | The relayer (#16, D-030) sends signed intents for wallets without a NEAR account and refuses everything else. On the devnet, through the dev server's `/api/relay`: an `erc191`-signed write creates series #8 with the `0x` address as writer, and an `auth_call` list creates offer #6 with it as seller. A write into someone else's series is relayed, refused on chain (`ERR_NOT_WRITER`) and refunded in full. The relayer itself refuses, with reasons: an intent touching anything but Warrant (400 ×3), another network's `verifying_contract` (400), a deadline beyond 15 minutes (400), an unconverted v (422, previewed "invalid signature"), a replay (422, "nonce was already used"), and GET (405). The production bundle holds no relayer code or key; the main JS is 404.19 kB. | `web/relay/relay.ts`, `node web/scripts/relay-check.mjs`; output below | pre-commit (D-011) |
| E-019 | 2026-10-26 | The web app works for a wallet with no NEAR account (#17, D-031). On the devnet, acting as `0x17c5…d025` through the dev-only EIP-1193 test wallet and the relayer, the UI sent five real actions, each read back from chain: cancel offer 7, buy offer 1, exercise series #1 (tUSDC 49.58 → 44.78, wNEAR 16 → 17 inside Intents), buy offer 2, and a refused early reclaim of series #6 (`ERR_NOT_EXPIRED`). Every sheet shows the ERC-191 message decoded. A NEAR account's path is unchanged (Alice's refused reclaim, signed with the moved devnet signer). In mainnet mode, the connect menu shows the NEAR wallet, announced EVM wallets (live) or an honest empty state; it connects, restores on reload, disconnects, and appears in a sheet with no sender. There is no horizontal overflow at 320–1440, axe reports 0 violations on the new surfaces, and the console has 0 errors. The main JS is 408.94 kB; the connect options, review and signing load on demand; the dist carries no devnet key, test wallet or relayer code. 1Click accepts an ERC-191 intent with an invalid signature (201, then `PROCESSING`), so the UI now simulates first. On mainnet, a 1Click ERC-191 payload signed with the test key passes `intents.near`'s signature check (free `simulate_intents`). | Playwright on the devnet and a mainnet-mode dev server, axe-core 4.10.2, curl; output below | pre-commit (D-011) |
| E-020 | 2026-10-26 | The colour pass (D-032) renders and stays legible. Commits and primary keys wear their lever's enamel (green Exercise, brass Claim, blue Write and Lock, red Test the lock), and the Interlock's lamps are green when free and a red ring when bolted. Figures take their state's ink (locked blue, released amber, pays green, receives brass), "Your move" chips carry their enamel, and the stage has blued and brass gels. Every new ink and fill is 5.45:1 or more, axe 4.10.2 reports 0 violations on six surfaces, impeccable detect finds 0 anti-patterns (2 deliberate advisories), and nothing overflows at 390 / 768 / 1024. The gate is green. | Playwright on the devnet, axe-core, impeccable detect, a contrast script; screenshots `.playwright-mcp/color-before-*`, `color-after*` (local); output below | pre-commit (D-011) |
| E-021 | 2026-10-26 | The Lock Dial's heat-blued centre fits and reads at every width (D-033). Every glyph of the readout is inside the blue: margins 3.1 / 14.3 / 16.9 / 4.2 / 11.0 / 41.1 / 3.3 / 3.3px at 320 / 360 / 375 / 390 / 414 / 768 / 1024 / 1440. The scale labels clear the disc by 4.3px or more at 1440 and 2.0px or more at 390. The story's centre clears to lacquer when its lock opens (opacity 0). axe reports 0 violations on the hero and board at 1440 and 390, the console has 0 errors, and the detector finds 0 anti-patterns (its dial-text advisory is a layering false positive, shown below). Iron move chips are outlined. `public/og.png` is re-rendered. The gate is green. | Playwright, axe-core 4.10.2, impeccable detect; output below | pre-commit (D-011) |
| E-022 | 2026-10-27 | The trade card's terms no longer collide on long figures (reported by the user on series #3: "12.345678 tUSDC" ran into "2.50 wNEAR" in 146px columns). Each term is a size container. Both figures share one size fitted to the longer one (14.6px for #3; 22px for short figures and wide cards), and the countdown fits up to "366d 23:59:59". Measured at 1024 / 1280 / 1440 / 1511 / 1920 for series #1 and #3, everything fits. The gate is green and the detector finds 0 anti-patterns. | Playwright measurements; output below | pre-commit (D-011) |
| E-023 | 2026-11-05 | Ready for the first commit, and nothing on mainnet has moved underneath us. The live `intents.near` and `wrap.near` code hashes still match the pins, Intents reports nothing paused, and the organizers' page now answers the pre-window question (D-034). On the tree to be committed: contract gate green (71 unit with the new double-exercise test, 2 + 1 sandbox), wasm 322,988 bytes, web lint 0 and build green, 0 secret-scan hits in 140 files. | Output below | pre-commit |
| E-024 | 2026-11-05 | The deploy is rehearsed and the host checked, with nothing deployed and nothing spent. A fresh clone passes the CI steps. `scripts/run.mjs` runs allow, fund, share, write and three real refusals on the devnet, and both refused exercises refund in full. Its NEP-413 signature over a live 1Click intent passes signature checks in mainnet `simulate_intents`, and a well-formed wrong signature is refused for its signature. The relayer as `vercel build` emits it relays EVM-signed intents end to end on the devnet, after a fix for an import crash that would have hit production. The README's steps were walked in a browser. | Output below | `10-mainnet-runbook` |
| E-025 | 2026-11-05 | The history split by area is the same work, checked commit by commit. Its tree equals the old single commit except for one reworded line in D-034. The contract commit passes fmt, clippy, the wasm build and 71 unit tests. The web layer passes lint and typecheck and fails `vite build` only for want of `index.html`, as its message says. The web app commit passes lint, typecheck and build. A fresh clone at the tip passes every CI step. A reproducible Docker build works on this machine and embeds its commit; its `code_hash` has not yet been compared across two builds. | Output below | `10-mainnet-runbook` |
| E-026 | 2026-11-05 | The contract build reproduces: two Docker builds of pushed commit `1ffcc9f` are byte-identical, 323,125 bytes, `code_hash CPKpW1fWrJmpWXLudZP4yuYxHy9Y36tfzwqgs6zuMTng`, and the wasm names that commit. The private repo exists, with 22 issues numbered as the docs cite them. | Output below | `1ffcc9f` |
| E-027 | 2026-11-05 | The refusal room works on the devnet against byte-identical Intents and wNEAR. `scripts/run.mjs room` sent 27 attempts that reached all 25 refusals the contract names, plus 3 honest calls that went through. Refused attempts moved no money. The app reads all 30 back from chain: 27 refused by name, 3 went through, 0 off their rule. A wrong transaction shows as off its rule, a hash that doesn't exist as unread, and an unrecorded network says so. No overflow at 390 or 1440, 0 axe violations, 0 detector anti-patterns. **Mainnet: not yet sent.** | Output below | `20-refusal-room` |
| E-028 | 2026-11-05 | The invariants hold across 32,768 random steps in 256 sequences, in 12 s. Every action was accepted and all 25 refusals were reached, and the run fails if any wasn't. The money is checked against the `mt_transfer` promises each call actually schedules, and refused calls roll back from a storage snapshot, as on chain. It catches real bugs: all 6 deliberately injected ones failed within 113 steps, including removing the time lock. | Output below | `21-invariants` |
| E-029 | 2026-11-05 | `retire` returns the deposit and can't touch money (D-038). On the real runtime it deleted the account with 12,143 bytes of state, and the owner received the whole balance; without clearing its state first, it fails. In the random run, 255 of 256 sequences wound down to nothing and retired, and the other retired cleanly mid-sequence, so no money got stuck. All 6 bugs injected into `retire` were caught. The room rehearsal now has 28 attempts at all 26 named refusals, plus 3 honest calls. **Not on mainnet.** | Output below | `18-retire` |
| E-030 | 2026-11-05 | The contract with `retire` reproduces and a fresh clone passes. Two Docker builds are byte-identical, 326,736 bytes, `code_hash GGvJPAmHR6RJr5NvN5Au5x16SvWp5ABKshteMfTGo6h`. A clone passes fmt, clippy, the wasm build, 78 unit tests, `sandbox` 3 and `signers` 1, plus web lint, typecheck and build. Those ran at `deaf217`, whose code `git diff` shows is unchanged by the rewrite in D-039. The hash embeds the commit, so mainnet gets its own build. The first CI run on GitHub, on `main`, passed both jobs. | Output below | `18-retire` |

## E-001 output
~~~text
captured 2026-10-20T18:34:04Z
$ pyth-oracle.near get_price_unsafe(BTC/USD)
{"price":"7887689348217","conf":"2256651783","expo":-8,"publish_time":1787699242}
publish_time UTC: 2026-08-25T23:07:22Z
$ pyth-oracle.near get_price(BTC/USD)   # staleness-checked
null
$ pyth-oracle.near get_stale_threshold
60
$ curl -sg https://hermes.pyth.network/v2/updates/price/latest?ids[]=<BTC/USD>
unauthorized  [HTTP 401]
$ last update_price_feeds tx on pyth-oracle.near (NearBlocks)
2026-08-26T15:41:33Z rigel.orbit.tmplr.near update_price_feeds C5DjFq2SJEttB7Lh5bfijZbeGSCTtUt4VyzpLFekitz5
~~~
BTC/USD feed id: `e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`. RPC: https://free.rpc.fastnear.com (`call_function`, finality `final`).

## E-002 output
Template generated with `cargo near new toolchain-check` in `internal/spikes/` (gitignored). Its own `rust-toolchain.toml` (1.93.0) was deleted so the repo pin applies.
~~~text
captured 2026-10-20T19:13:25Z
$ rustc --version   # inside the repo
rustc 1.97.1 (8bab26f4f 2026-07-14)
$ cargo near --version
cargo-near-near 0.22.0
$ rustup target list --installed
aarch64-apple-darwin wasm32-unknown-unknown
$ (outside the repo) rustc --version
rustc 1.89.0 (29483883e 2025-08-04)

$ cargo near build non-reproducible-wasm
     -                  Size: 102.6 KB (102591 bytes)
     - SHA-256 checksum hex : fca88ad0ca6a863149910b5fb98a76786e36d20f76614953a808a20db78fcb50
    Finished cargo near build in 1m 38s

$ cargo test
running 7 tests
test tests::init_contract ... ok
test tests::claim_after_auction_ended ... ok
test tests::bid_successfully ... ok
test tests::claim_before_auction_ended - should panic ... ok
test tests::claim_twice - should panic ... ok
test tests::bid_after_auction_ended - should panic ... ok
test tests::bid_lower_than_current - should panic ... ok
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s
     Running tests/test_basics.rs
running 1 test
test test_contract_is_operational ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 39.54s
cargo test  444.83s user 98.02s system 365% cpu 2:28.64 total
~~~
Resolved dev-deps (Cargo.lock): near-sdk 5.29.1, near-sandbox 0.3.16, near-api 0.8.6.

## E-004 / E-005 output
~~~text
captured 2026-10-20T20:15:55Z (gate) and 2026-10-20T20:17:31Z (tests, after a clippy-only fix)
$ cargo fmt --check
ok
$ cargo clippy --all-targets -- -D warnings
    Finished `dev` profile [unoptimized + debuginfo] target(s)
$ cargo near build non-reproducible-wasm --abi-features abi
     -                  Size: 294.8 KB (294847 bytes)
     - SHA-256 checksum hex : f495b6c74185ea14b0b61702a1d2c78f419a5a59f5b680f1a3463d93fb43daca
$ cargo test -- --test-threads=1
     Running unittests src/lib.rs
running 57 tests
test result: ok. 57 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.59s
     Running tests/sandbox.rs
running 2 tests
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 59.15s
~~~
The sandbox tests are `call_lifecycle_through_mainnet_intents` and `writer_closes_and_cancels_through_mainnet_intents`. Mainnet code is fetched over RPC and must hash to `BtA1BEFNS619KkvXFsgcpQ21Tb5yMm32aaUkn7xNothk` (intents.near) and `DL2f5xmZ44cQRP6vBMt94rvseH5d5KKnAGis2WkTAsh1` (wrap.near). Refusals asserted by exact message: `ERR_INSUFFICIENT_LONGS`, `ERR_EXPIRED` (both refunded in full by Intents), `ERR_NOT_EXPIRED`, `ERR_NOT_SELLER`, `ERR_NOT_INTENTS`.

## E-006 output
Measured in Chromium (Playwright) with DOM checks (`getBoundingClientRect`, `scrollWidth`), not screenshots alone:
~~~text
1440 px, view as alice.sandbox (seeded devnet: 5 series covering traded, put, large figures, reclaimed, released)
  board cells overflow/collide ......... none
  document scrollWidth ................. 1440 (no horizontal scroll)
  Route variant ........................ horizontal shown, vertical hidden
  console errors on a fresh load ....... 0
390 px, view as bob.sandbox
  board cells overflow/collide ......... none
  document scrollWidth ................. 390
  detail sheet Route ................... vertical variant, label text ≈14 px tall
  stacked modal "Write is locked" ...... opens over the detail sheet, signing honestly disabled on devnet
States
  RPC down (http://127.0.0.1:1) ........ "The board is dark" + "Failed to fetch · http://127.0.0.1:1" + Try again
  empty devnet (DEVNET_EMPTY=1) ........ hero "0", "Owes nothing yet", "No series yet" + "Write the first series" → create sheet
Behaviour
  Esc closes the action sheet .......... yes (native dialog)
  series switch ........................ detail updates; Element.startViewTransition supported → scoped transition ran
  prefers-reduced-motion: reduce ....... arm/flow/row animations "none", odometer transition 0s
desktop sheet position ................. centered (450 px each side, 289 px top/bottom) after restoring dialog margin

captured 2026-10-20T21:09:00Z
$ npm run lint
0 problems
$ npm run build
dist/assets/index-CBnZ40SM.css   31.61 kB │ gzip:  7.73 kB
dist/assets/build-DXLr2-Oc.js    53.68 kB │ gzip: 13.55 kB   (near-connect, lazy: mainnet only)
dist/assets/index-BrM7u04s.js   274.94 kB │ gzip: 84.66 kB
✓ built in 2.11s
~~~

## E-007 output
UI actions, each started from the web app as a devnet account (signed by `web/src/lib/devnetSigner.ts`), then checked over RPC (`tx` with `wait_until: FINAL`, views at `final`). Hashes are local to this devnet; full where the trace was inspected, prefixes as the UI showed them otherwise.
~~~text
captured 2026-10-20T21:45Z–21:51Z, devnet http://127.0.0.1:63768 (sandbox 2.13.4, protocol 86)

action (account)                         tx                                              verified effect
deposit 5 NEAR as wNEAR (bob)            23VQX4LEyap2J4YUCFRDeR9b9AnkXobJTp6rhAHC1KWy    1 tx, 3 actions: storage_deposit, near_deposit, ft_transfer_call; 0 failed receipts; Intents wNEAR 2 → 7
withdraw 2 wNEAR + unwrap (bob)          wQ5twkaB1xE1qqP7u311PhgMi4nx4reZANPrPLk1v1V     intents.ft_withdraw: mt_burn, "Transfer 2000000000000000000000000 from intents.sandbox to bob.sandbox"
                                         7MR7J4hAXjvAKMYxeD2dTccjVzXjJjnfA9z1fBJePNAX    wrap.near_withdraw: "Withdraw 2000000000000000000000000 NEAR from bob.sandbox"; Intents 7 → 5, wallet wNEAR 0
withdraw 10 tUSDC (bob)                  5NzxP9D8WGWoSW75PwmAkKcdPnDcnqzR9GAL6BuJDW9t    wallet tUSDC 0 → 10 (already registered: no storage_deposit tx)
move 1 long into Intents (bob)           9CiAy7vdioHuRgYxs9DsRwbbdEu2dqCpKbMPjhp7H5pJ    options.mt_transfer_call → nep245:options.sandbox:1 inside Intents
send 1 long inside Intents (bob→carol)   Hth4BD4RQi…                                     carol nep245:options.sandbox:1 = 1
move 1 long back to Warrant (bob)        4nY1BT4rof…                                     bob ledger longs 0 → 1, inside Intents 1 → 0
exercise 1 (bob)                         65gkXPxVBN…                                     tUSDC 479.34 → 474.54 (paid 4.80), wNEAR 5 → 6 (delivered 1)
exercise with no longs (bob)             8Sx3EkznH75BGgUR99mVtBKkX2cPyHP1qbAga3qUbN8P    REFUSED, trace below; UI showed "Refused by chain ERR_INSUFFICIENT_LONGS" and the lever kicked back
cancel offer 3 (alice)                   8A2SPyHbHA…                                     1 unsold long of series #4 returned to alice's ledger
write series #6 (alice)                  FYcvHREVuF…                                     get_series(6): call, 1 wNEAR per option, strike 5100000, expiry_ns 1792929600000000000 (2026-10-25T12:00Z), collateral_held 3 wNEAR, long_supply 3

$ tx 8Sx3EkznH75BGgUR99mVtBKkX2cPyHP1qbAga3qUbN8P   (intents.sandbox mt_transfer_call, overall SuccessValue)
  log: EVENT_JSON {"standard":"nep245","event":"mt_transfer","data":[{"old_owner_id":"bob.sandbox","new_owner_id":"options.sandbox","token_ids":["nep141:tusdc.…
  failed receipt on options.sandbox: Smart contract panicked: ERR_INSUFFICIENT_LONGS
  log: EVENT_JSON {"standard":"nep245","event":"mt_transfer","data":[{"old_owner_id":"options.sandbox","new_owner_id":"bob.sandbox","token_ids":["nep141:tusdc.…
bob tUSDC inside Intents after the refusal: 474540000 (unchanged by it)
~~~

1Click without a partner key (mainnet API):
~~~text
captured 2026-10-20T21:22Z–22:03Z
$ OPTIONS /v0/{tokens,quote,status,generate-intent,submit-intent,deposit/submit} with Origin: https://warrant.example
HTTP/2 204, access-control-allow-origin: *   (all six)
$ POST /v0/quote  non-dry, INTENTS → Base, 1 USDC, no key
in 1.0 USDC (NEAR) → out 0.997399 USDC (Base), min 987425, ~12s, depositAddress 6f98f969…a662
$ POST /v0/generate-intent  no key, that depositAddress
HTTP 201  {"standard":"nep413","recipient":"intents.near","nonce_bytes":32,
           "message":{"deadline":"2026-10-23T22:33:35.000Z","intents":[{"intent":"transfer","receiver_id":"6f98f9699d…",
           "tokens":{"nep141:17208628f84f…33a1":"1000000"}}],"signer_id":"d0482bffd7…"}}
$ POST /v0/generate-intent  for a quote whose request deadline had passed
HTTP 400  {"message":"Quote has expired"}
$ POST /v0/submit-intent  no key, deliberately invalid signature
HTTP 400  {"message":"Invalid signed intent format"}   (validation, not 401: no auth gate)
$ GET /v0/status?depositAddress=…   (shape the UI reads)
{"status":"PENDING_DEPOSIT","updatedAt":…,"swapDetails":{"refundedAmountFormatted":"0","refundReason":null,
 "originChainTxHashes":[],"destinationChainTxHashes":[],"nearTxHashes":[],…},"quoteResponse":{…}}
~~~
Not yet shown: a valid `submit-intent` and a delivered payout (#11, mainnet).

Rendering, measured in Chromium (Playwright) with DOM checks:
~~~text
account (alice, bob, carol, none) at 1440 / 1024 / 390 ... document scrollWidth = viewport; 0 elements past the right edge;
                                                          0 clipped cells or buttons; claim plates on one line in every row
board with filters at 1440 / 390 ......................... no overflow; filter counts All 6 · Calls 5 · Puts 1 · Locked 4 · Expired 2
deep link /?series=2 on a 390 viewport ................... the series sheet opens on load
header nav Board → Account, back, forward, hard reload ... URL and view stay in step; /account reload renders the account
switching account (alice → bob) .......................... "reading the chain" under the new name, then bob's balances; never alice's
payoff chart, series #1 (call) ........................... strike 4.80, premium 0.42 (best offer), break-even 5.22; hover at 7.488 → +2.268
payoff chart, series #2 (put) ............................ strike 4.20, premium 0.35, break-even 3.85; profit wash left of break-even
console errors on fresh loads ............................ 0
~~~

Gate:
~~~text
captured 2026-10-20T22:04:42Z
$ npm run lint
0 problems
$ npm run build
dist/assets/index-C1ovXyej.css           38.38 kB │ gzip:   8.95 kB
dist/assets/devnetSigner-KVwST78R.js      1.60 kB │ gzip:   0.87 kB   (lazy; loaded only on the devnet path)
dist/assets/build-C6zqh1ML.js            53.68 kB │ gzip:  13.55 kB   (near-connect, lazy: mainnet only)
dist/assets/index-Ca_pn4kg.js           338.29 kB │ gzip: 101.00 kB
✓ built in 199ms
$ ls dist/account                        index.html   (shell copy for /account reloads, D-019)
$ grep -rl 'ed25519:3tgdk2' dist         (nothing: the sandbox key is absent from the production build)
~~~

## E-008 output
~~~text
captured 2026-10-21T06:50Z–07:13Z, devnet http://127.0.0.1:63768 and live 1Click (mainnet API)

review panel (carol.sandbox, registered on wrap.sandbox)
  deposit 2 NEAR as wNEAR ... 1 transaction · 2 actions: near_deposit 2.00 NEAR; ft_transfer_call 1 yocto
                              {receiver_id: intents.sandbox, amount: 2000000000000000000000000 · 2.00 wNEAR, msg: ""}
                              (no storage_deposit: storage_balance_of answered non-null)
  withdraw 1 wNEAR + unwrap . 2 transactions: intents.sandbox ft_withdraw {token: wrap.sandbox, receiver_id: carol.sandbox,
                              amount 1000000000000000000000000 · 1.00 wNEAR, memo: null, msg: null}; wrap.sandbox near_withdraw
  test the lock (bob, #1) ... intents.sandbox mt_transfer_call 1 yocto {receiver_id: options.sandbox, token_id: nep141:tusdc.sandbox,
                              amount 4800000 · 4.80 tUSDC, msg {"action":"exercise","series_id":"1","amount":"1"}}
  JSON view ................. the same transaction with gas 300000000000000 and deposit "1", as passed to the signer

payoff readout
  series #1 call (strike 4.80, best offer 0.42) .. idle "Profits if 1 wNEAR is worth more than 5.22 tUSDC at expiry."
                                                  chips: Max loss −0.42 · Break-even 5.22 · Max profit unlimited
                                                  pinned break-even → 0.00 at 5.22; max loss → −0.42 at 4.80 (writer +0.42)
  series #2 put (strike 4.20, best offer 0.35) ... "worth less than 3.85"; Max profit +3.85; hover at 1.68 → +2.17
  chart top before/after hover ................... 354/354 px (1440), 520/520 px (390): no layout shift

1Click components, mounted in the dev page with live data (quote 22b19249…7510, INTENTS → Base, 1 USDC)
  MessageReview ... recipient intents.near · signer_id d0482bff… · deadline 2026-10-24T07:41:02.000Z ·
                    intent transfer to 22b192…7510 (1Click's deposit account for Base) · 1000000 · 1.00 USDC
  Tracker ......... Signed and submitted 07:12:42 UTC → "Waiting for 1Click to see the transfer" (status PENDING_DEPOSIT)
                    → Routing → Delivered on Base; the compact variant summarises the current step
  (harness record removed from localStorage afterwards; success/refund states unverified until #11)

$ npm run lint && npm run build    (captured 2026-10-21T07:13:15Z)
0 problems
dist/assets/index-Bq_hNTGh.css   39.89 kB │ gzip:   9.22 kB
dist/assets/index-DOKH5Tgm.js   350.61 kB │ gzip: 104.28 kB
dist/account/index.html present; sandbox key absent from dist
~~~

## E-009 output
~~~text
captured 2026-10-21T07:15Z–07:35Z, devnet http://127.0.0.1:63768 (Chromium, Playwright DOM checks)

board, alice, 1440 / 390 ......... scrollWidth 1440 / 390; 0 elements past the right edge
account, alice, 1440 / 390 ....... scrollWidth 1440 / 390; 0 elements past the right edge
hero station figure (1440) ....... "6,263.00" scrollWidth 361 = clientWidth 361 at 57.76px (fitFigure, container units)
account station figure (1440) .... "2,734.00" scrollWidth 361 = clientWidth 361 at 51px
series Interlock (1440, bob, #1) . 7 levers in 1 row; 0 clipped plate names; computed plates:
                                   Buy (free, iron) oklch(0.955 0.008 150) white; the other six (locked) oklch(0.29 0.02 170) dark
mobile board row #3 .............. long strike "12.345678 tUSDC" wraps under its plate; no collision with "89d …"
refusals panel ................... stamps turn refuse red on scroll; ERR codes in refuse-lit
$ impeccable detect --scope type web/src     0 findings
$ impeccable detect --scope layout web/src   0 findings
$ npm run lint                               0 problems
$ npm run build                              index.css 49.32 kB (gzip 10.80) · index.js 358.12 kB (gzip 106.20); sandbox key absent from dist
~~~

## E-010 output
~~~text
captured 2026-10-21T07:35Z–07:41Z, Chromium via Playwright; reader font size set through CDP Page.setFontSizes

default 16px · 390 / 1024 / 1440, board and account ... root 15px, body 16px, scrollWidth = viewport, 0 overflow
reader 20px  · 390 / 1024 / 1440, board and account ... root 18.75px, body 20px, scrollWidth = viewport, 0 overflow
reader 24px  · 390 / 1024 / 1440, board and account ... root 22.5px, body 24px, scrollWidth = viewport, 0 overflow
  (fixed on the way: brand row and filter segments now wrap; refusal cards use minmax(0,1fr) with breakable ERR codes;
   ledger cells stack the station name above the figures on phones)

computed roles at default (1440, alice, series #1)
  hero display ......... Archivo 89.28px, wdth 125 / wght 800, lh 0.88, −3.12px, balance
  thesis claim ......... Archivo 24.75px, wght 540, lh 1.42, +0.10px, balance
  refusal body (panel) . Archivo 16px, weight 430, lh 1.55, +0.096px, pretty
  track label / value .. 11.5px; the value is Martian Mono only when it carries digits
document.fonts ........... "Archivo Fallback", "Martian Mono Fallback" registered
fallback metrics (measured vs loaded faces) .. Archivo↔Arial size-adjust 98.71%, ascent 89.15%, descent 21.28%;
                                              Martian Mono↔Courier New 116.65%, ascent 85.73%, descent 17.15%
$ npm run build   → index.html preloads archivo-latin-standard-normal-DY7AcnAa.woff2, martian-mono-latin-standard-normal-1TqSgyfh.woff2
$ npm run lint    → 0 problems
$ impeccable detect --scope type / layout web/src → 0 / 0 findings
~~~

## E-003 output
Claim: the live `intents.near` is v0.4.5, built with cargo-near 0.22.0 on rust 1.97.1 with near-sdk 5.29.1, and **IMT is not compiled in**. Captured 2026-10-20.
~~~text
$ intents.near contract_source_metadata()          # NEP-330 view, mainnet
{"version":"0.4.5","link":"https://github.com/near/intents/tree/16d04f6ec4401263f8914638710260da50bb46b0",
 "standards":[{"standard":"dip4","version":"0.1.0"},{"standard":"nep245","version":"1.0.0"},{"standard":"nep330","version":"1.3.0"}],
 "build_info":{"build_environment":"sourcescan/cargo-near:0.22.0-rust-1.97.1@sha256:7467038b…",
  "build_command":["cargo","near","build","non-reproducible-wasm","--locked","--features=contract","--abi-features=abi,contract"],
  "contract_path":"contracts/defuse", …}}

$ gh api repos/near/intents/commits/16d04f6…        # deployed commit
commit date: 2026-10-07T17:51:48Z  msg: fix(verifier): remove notifications on deposits (#374)

$ contracts/defuse/core/src/intents/mod.rs @16d04f6
#[cfg(feature = "imt")]  ImtMint(ImtMint),
#[cfg(feature = "imt")]  ImtBurn(ImtBurn),

$ contracts/defuse/Cargo.toml [features] @16d04f6
contract = ["defuse-near-promise/near-contract", "dep:bitflags", "dep:defuse-bitmap", "dep:defuse-borsh-utils", "dep:defuse-map-utils", "dep:defuse-wnear"]
imt = ["defuse-core/imt"]
far = ["imt"]
(no `default` feature set)

$ Cargo.lock @16d04f6
name = "near-sdk"  version = "5.29.1"
~~~
Conclusion: deployed with `--features=contract` only, and `contract` doesn't enable `imt`, so `ImtMint` isn't in the deployed wasm.

## E-011 output
Captured 2026-10-21 on the seeded devnet (Playwright, Chromium), viewer `alice.sandbox`.
~~~text
Lock Dial (1440×900, fresh load)
  dial box (document y) ........ 337 → 787, so the whole dial is above the fold; 450px wide at 1024 and 1440
  next-release marker ........... aria-label "Series 2, put: 16.80 tUSDC locked until 2026-10-22 20:43 UTC. Open it on the board."
  click → URL ?series=2, board top at 90px (under the sticky header), detail heading "#2"
  reduced motion ................ .dial animation "none", seconds hand display "none", centre shows 6,263.00 at 250ms

Levers (series #1, alice is the writer)
  hover free lever ............... rotate(-9deg)
  drag Exercise down 70px ........ rotate(-38deg) → sheet "Exercise · series #1"
  drag Reclaim (locked) 70px ..... -4.96 → -6.55 → -7.20 → -7.70 → -8.00 (rubber band, capped) → data-bumped "true" → sheet "Reclaim is locked"
  drag ending off the lever, then a click → the click opens "List · series #1" (no swallowed click)
  bug found and fixed: set() let a running hover spring fight the hand; after release the arm flew to +102deg and no sheet opened.
    With jump(): the arm holds at -38deg, then -29, -23, -15, -8, -1, +3, +5, +4, +2, +1, 0 (one small overshoot), and the sheet opens.
  refusals band, scrolled in ..... kicks staggered ~320ms per card (peaks -9 to -11deg), each plate lit red for ~700ms; all three stamps red
  hand pull on a refusal lever ... capped at -8deg, data-bumped + data-refused "true", then settled ("none", "false", "false")

Tooltip (Radix), hover over locked Reclaim
  trigger keeps data-state "locked"; aria-describedby set while open
  innerText: "RECLAIM | locked | After expiry, take back the collateral no one exercised. | until 27 Oct 20:43 UTC. Pull it anyway and the chain refuses: ERR_NOT_EXPIRED"
  box 1166…1421 px in a 1440 viewport (collision padding keeps it on screen)

Rolling figures (NumberFlow), Chromium accessibility tree via CDP
  role "image", names "999.99013…", "0.00", "2,734.00": the value, not separate digits

Action sheet (native <dialog>), click on a free lever (opens after the 150ms throw)
  entry: open=true at opacity 0.00 / translate 16px, then 0.50 / 8.06px, settling to 1 / 0
  exit (Esc): open=false, display "block" while opacity 1.000 → 0.272 → 0.073 → 0.017 → 0.001, then display "none"

Reader font sizes (CDP Page.setFontSizes), board ?series=1 and /account
  16, 20, 24px × 390, 1024, 1440: documentElement.scrollWidth equals the viewport in every case
  custody station names at 390 truncated at 24px before the fix (two read "WA…"); after it, all fit at 16, 20 and 24px

$ npm run lint       → 0 problems
$ npm run typecheck  → 0 errors
$ npm run build
  dist/assets/index-*.js        387.67 kB │ gzip: 115.60 kB   (was 588.55 kB before the lazy split)
  dist/assets/Lever-*.js        145.84 kB │ gzip:  48.46 kB   (lazy)
  dist/assets/LeverFrame-*.js    56.61 kB │ gzip:  20.18 kB   (lazy)
sandbox signer key in dist ...... none

$ impeccable detect web/src                → 1: overused-font (Mona Sans; one family by choice, D-025)
$ impeccable detect <board> 1440×900       → text-overflow ×6 (writer names truncate by design, full name in title), nested-cards ×1 (the control well inside the trade card)
$ impeccable detect <board> 390×844        → text-overflow ×6 (same)
$ impeccable detect <account> 1440 / 390   → 0 / 0
~~~

## E-012 output
Captured 2026-10-21 on the seeded devnet (Playwright, Chromium), viewer `alice.sandbox`. Scroll positions are page y; the steps start at y 1323.
~~~text
1440×900, scrolled in 40px steps (step index · O = open · R = Reclaim refused · @ dial top)
  723:0@600  883:0@440  1043:0@280  1203:0@120  1363:0@108  1523:1@108  1683:1R@108  1843:1R@108
  2003:1@108  2163:1@108  2323:2@108  2483:2O@108  2643:2O@108  2803:2O@50 …            (before the timing fix)
  after giving the clock its own scroll reading and opening at 0.80:
    first "Open" at the last step (index 2); open while pinned for 420px (was 280px, and 60px before that)
  states seen: levers ["free","locked"] → ["free","locked/refused"] + "Refused by chain ERR_NOT_EXPIRED" → ["locked","free"] + "Open"

390×844
  pinned strip (dial + two levers side by side): 204px tall (was 388px stacked); scrollWidth 390
  steps read 0 → 1 → 2 while the strip stays pinned; "Open" at the last step

Reduced motion (1440)
  lock angle by step: rotate ≈ 186.5deg (a week) → ≈ 25.2deg (the last hour) → none (the index); .story-step transition 0s

Header "How it works" → #how, focus on #how; section top 0 under the 56px sticky header, then with scroll-mt-16: section top 60, heading top 165

Payoff table twin, series #6 (no offer, so break-even = strike = 5.1)
  before: dev log "Encountered two children with the same key, `5.1`" about once a second
  after the dedupe: no "same key" entries

$ npm run lint       → 0 problems
$ npm run typecheck  → 0 errors
$ npm run build
  index-*.js       379.95 kB │ gzip: 113.10 kB   (initial, with jsx-runtime 8.24 kB and the rolldown runtime)
  react-*.js       132.00 kB │ gzip:  43.52 kB   (Motion, shared by the levers and the story; not modulepreloaded)
  LockStory-*.js    12.77 kB │ gzip:   5.39 kB   (lazy)
  Lever-*.js        15.11 kB │ gzip:   6.40 kB   (lazy)
  LeverFrame-*.js   56.66 kB │ gzip:  20.20 kB   (lazy)
~~~

## E-013 output
~~~text
# Devnet seed (tests/devnet.rs): the three refusals, asserted on their receipts, written to web/.env.development.local
VITE_REFUSAL_TXS=reclaim-early:carol.sandbox:<hash>,exercise-expired:carol.sandbox:<hash>,exercise-unheld:carol.sandbox:<hash>

# tx RPC on the devnet (wait_until NONE), per refusal: our receipt and Intents' refund log
reclaim-early     options.sandbox Failure … "Smart contract panicked: ERR_NOT_EXPIRED"      (no transfer in)
exercise-expired  options.sandbox Failure … "ERR_EXPIRED"            refund log: nep245 mt_transfer options.sandbox → carol.sandbox 5000000 nep141:tusdc.sandbox memo "refund"
exercise-unheld   options.sandbox Failure … "ERR_INSUFFICIENT_LONGS" refund log: … 4800000 … memo "refund"

# Mainnet archival vs regular RPC, tx CGEu9xLm16ZYTfScvtXb2eRDV1aeaM8c1XTsA9JLjswP (block 150,000,000)
https://archival-rpc.mainnet.fastnear.com: ok FINAL receipts 12   (CORS: access-control-allow-origin *)
https://free.rpc.fastnear.com:              error UNKNOWN_TRANSACTION

# Playwright, devnet, 1440×900 unless noted
deep link ?series=1          → #board, board top 90px under the header
#refusals link               → section top 52px (lazy chunk; settleHash)
series route (1440)          → min text 11.5px, no overflow; columns 75/88/106/88/75px
series route (390 sheet)     → min text 11.5px
exercise sheet (alice, holds 7, 1.36 tUSDC)
  1    → "Needs 4.80 tUSDC; your Intents balance is 1.36 tUSDC. Deposit first."  (submit disabled)
  99   → "You hold 7 longs here. Exercise 7 or fewer."
  1.5  → "Whole options only: 1, 2, 3…"
buy sheet (alice, own offer only) → "The only open offers on this series are yours. Cancel one from the series' offers instead."
write sheet → 1 week preset 2026-10-28 17:05 UTC; min/max set; 2020-01-01 → "Expiry must be 2 minutes to 366 days away."; 100,000 → "Needs 100,000.00 wNEAR; your Intents balance is 2,737.00 wNEAR. Deposit first."
refusal cards → carol.sandbox · 21 Oct 16:58 UTC; refunds 5.00 / 4.80 tUSDC back to the sender; reclaim: nothing sent in
send one yourself (bob) → Test the lock → "REFUSED BY CHAIN ERR_INSUFFICIENT_LONGS · 9yv5pauMVi… · anything sent through Intents was refunded."
phone buy (bob, #2, docked key) → "Done on chain · 8A7rEc5sUQ…"; offer 4 left → 3 left (read back)
story contrast (step 2 active) → inactive h3 6.53:1, inactive body 4.83:1, active 17.34 / 6.53; stage names 17.34:1
backing chips → "wNEAR … = 6,261.00 locked + 2.00 released"; "tUSDC … = 16.80 locked + 9.30 proceeds"
board rows → no overflow or spill at 1024 (6 cols), 1280 (5 cols), 1440 (6 cols)
targets (390) → dismiss 44×44; dial markers 44px hit area; filter chips and offer actions 44px hit areas
idle long frames, board in view, 5 s → [114 ms]   (was about one per second)
reader fonts (CDP Page.setFontSizes), page overflow px: 16@390/1024/1440 0/0/0 · 20@… 0/0/0 · 24@… 0/0/0
  (before the story fix: 24@390 overflowed 23px: the pinned strip's levers and the caption's file path)
story strip at 390: 16px sticky 204px tall · 20px and 24px static (wraps; @media max-width 21em) · 16px@320 static
axe-core 4.10.2 → board 1440 [], exercise sheet [], write sheet [], account [], board 390 []
impeccable detect (URL, 1440 / 390) → low-contrast 0; text-overflow 5 (truncated writer names, titled); nested-cards 3 (route stations in the control well); stripes 1 (dial texture)

# Gate
npm run lint → 0 warnings; npm run build → tsc ok, main 389.83 kB (116.39 kB gzip)
devnet key prefix / VITE_SANDBOX_SIGNER_KEY / devnet hashes in dist → 0 / 0 / 0
cargo fmt --check ok; cargo clippy --all-targets -D warnings ok; cargo test → 57 passed; sandbox 2 passed (44.2s); devnet 1 ignored
(contract source unchanged: the wasm build was not re-run)
~~~

## E-014 output
~~~text
# Critique re-run (dual agent, after D-027): Nielsen 29/40 (was 27/40); audit 15/20 (unchanged)
#   A: P1 board composition at 1440; P1 metaphor + raw units at signing; P2 dial labels; P2 "You" lamps; P2 edges
#   B: real (minor): next-lock label over the printed scale; phone writer names cut. Deliberate: nested-cards ×3, stripes. FP: low-contrast ×12 (sheet over the band)
# Perf, production bundle + devnet config, same script as the first audit
desktop 1×: FCP 136 LCP 220 CLS 0, long tasks 2 (9ms); idle p95 8.8ms, 0 frames over 33ms
phone 4×:   FCP 128 LCP 268 CLS 0, long tasks 6 (313ms; was 354); idle 1 frame over 33ms (was 4); scroll 1 (was 3)

# After D-028 (Playwright, devnet)
1440 layout   card 516×472 · list 737×505 · bench 1290×462, 64px below · page overflow 0
your move     alice: Claim 4.80 tUSDC | Buy at 0.35 | List · 2,500 held | Claim 4.50 tUSDC | —
dial readout  rest "Next opens in … #2 · 16.80 tUSDC · 23 Oct 16:55" → hover "#1 opens in … #1 · 11.00 wNEAR · 28 Oct 16:55"; ring labels 0
write commit  "LOCK 1.00 wNEAR UNTIL 28 OCT 18:07 UTC"; msg rows action=create, kind=call, underlying=wNEAR · nep141:wrap.sandbox, quote=tUSDC · nep141:tusdc.sandbox, underlying_per_option=1.00 wNEAR, strike_per_option=5.50 tUSDC, expiry_ns=2026-10-28 18:07 UTC · in 7 days
bob exercise  primary "Exercise · pay 4.80 tUSDC"; commit "EXERCISE 1 · PAY 4.80 tUSDC"; count 2 → review aria-disabled, "Not sendable yet; see above.", "EXERCISE 2 · PAY 9.60 tUSDC" disabled
visitor buy   gate offers alice.sandbox | bob.sandbox | carol.sandbox; choose bob → sheet stays open, "BUY 1 · PAY 0.35 tUSDC" enabled, ?as=bob.sandbox
skip link     first Tab "Skip to the board" → Enter → activeElement main#board
overflow      390 bob 0 · 390 <64-hex> 0 · 1024 0 · 1280 0 · 1440 0; truncated writer lines 0 at 390/1024/1440
axe 4.10.2    board 1440 [] · bob exercise sheet [] · phone visitor sheet []
detect (URL)  1440 {nested-cards 3, stripes 1} · 390 {stripes 1} · account 1440 {}
console       0 errors, 0 warnings on four clean loads (board with series, bob, visitor, account)
reader fonts  page overflow 0 at 20px and 24px × 390 / 1024 / 1440 (series 1 selected; the phone sheet open at 390)
gate          lint 0 · typecheck ok · build ok (396.9 kB / 118.07 kB gzip) · key in dist 0 · cargo fmt ok · clippy ok
~~~

## E-015 output
~~~text
# Critique run 3 (fresh dual-agent; headless Chrome via Puppeteer because the Playwright MCP was down at session start)
A: 28/40 (Consistency 3 → 2: Claim / Withdraw / Proceeds; lamp colours). P1 exercise without moneyness; P1 funding dead-end.
B: no real findings. Deliberate: overused-font (fallback alias), nested-cards ×3, stripes, all-caps-body. FP: low-contrast ×12 (sheet over band), text-occlusion ×3 (closed details).
Perf (Playwright, same script, production bundle + devnet config): desktop LCP 156/172ms (warm), CLS 0, no long tasks;
  phone 4× LCP 216ms, CLS 0, 4 long tasks, blocking 178ms (354 → 313 → 178); idle 2 frames > 33ms in 4s.

# After D-029 (Playwright, devnet)
rows      #4 "0.00 wNEAR returned · 2 lapsed" (no offer) · #5 "2.00 wNEAR released · 2 lapsed" · live rows unchanged
lamps     free: oklch(0.2 0.013 262) ×6 · Reclaim (bolted): transparent · Buy caption "only your offers"
exercise  count 2 → field valid; "No reference price on this devnet…"; "This needs 9.60 tUSDC; your Intents balance is 1.36 tUSDC."; [Deposit 8.24 tUSDC →]; commit disabled
top-up    deposit sheet amount 8.240000 (now trimmed to 8.24); "Back to exercise · series #1" → "Exercise · series #1", count "2"
buy       "The only open offers on this series are yours: buying one only pays you back. Cancel it instead." → [Cancel your offer 1] → "Cancel offer 1"
proceeds  "Claim proceeds · series #1" / "CLAIM 4.80 tUSDC"; test the lock "Reclaim is locked · series #1"
phone     hero 906px · story 1,614px · board top 2,731px · strip "2 writers → NEAR Intents → 2,515 longs open" · verdict "Backed 1:1 holds ≥ owes · details"
sheet     order: header · terms · Offers · position · Control panel · payoff · dock; axe []
sent      bob Buy 1 · pay 0.35 → "Done on chain · DYe2LposM8…"; submit disabled; "Sent and settled. Reopen the sheet to send another."
axe       board 390 []; console errors 0
detect    src {overused-font 1} · 1440 {nested-cards 3, stripes 1} · 390 {stripes 1}
gate      lint 0 · typecheck ok · build 404.07 kB / 119.81 kB gzip · key in dist 0 · cargo fmt ok
~~~

## E-016 output
~~~text
# Spike: internal/spikes/any-chain-signers (sandbox; mainnet intents.near BtA1BE… v0.4.5 + wrap.near, hash-pinned; options built from contracts/options unchanged)
$ CARGO_TARGET_DIR=contracts/options/target cargo test --test signers -- --nocapture
evm wallet 0x17c5185167401ed00cf5f5b2fc97d9bbfdb7d025          (view_account on the sandbox: does not exist)
relay  create (transfer + msg)             11.69 TGas  0.00117 NEAR   -> series 1 writer = 0x17c5…; longs 2; collateral 2 wNEAR
refused write into someone else's series  ERR_NOT_WRITER             -> wNEAR in Intents unchanged (refunded in full)
relay  refused write (refunded)            11.52 TGas  0.00115 NEAR
relay  buy (transfer + msg)                18.18 TGas  0.00182 NEAR   -> 1 long of series 2; Alice +0.1 tUSDC in Intents
relay  exercise (transfer + msg)           17.73 TGas  0.00177 NEAR   -> pays 2 tUSDC, +1 wNEAR inside Intents
refused exercise without the option       ERR_INSUFFICIENT_LONGS     -> tUSDC unchanged (refunded in full)
relay  refused exercise (refunded)         11.57 TGas  0.00116 NEAR
relay  auth_call -> on_auth                 5.88 TGas  0.00059 NEAR
on_auth received [{"predecessor_id":"intents.sandbox","signer_id":"0x17c5185167401ed00cf5f5b2fc97d9bbfdb7d025","msg":"{\"action\":\"reclaim\",\"series_id\":\"1\"}","attached_deposit":"0"}]
refused v = 27/28 left as is              invalid signature
refused replayed payload                  nonce was already used
refused verifying_contract of another network wrong verifying_contract
relay  plain transfer, versioned nonce      5.17 TGas  0.00052 NEAR
relayer total for 7 intents: 81.74 TGas, 0.00817 NEAR at the minimum gas price
test evm_wallet_acts_on_warrant_through_signed_intents ... ok      (simulate_intents preview of the create: intents_executed 1)
test result: ok. 1 passed; 0 failed; finished in 51.52s

# 1Click, live mainnet API, no key (2026-10-26)
POST /v0/quote dry, USDC on Base -> recipient 0x17c5… recipientType INTENTS, amount 2000000
  -> amountInFormatted 2.0, amountOutFormatted 1.999851, timeEstimate 35
POST /v0/quote (non-dry), USDC on NEAR depositType INTENTS -> USDC on Base, refundTo 0x17c5… refundType INTENTS
  -> depositAddress 38646566…2d0d, amountOutFormatted 1.997196, timeEstimate 12
POST /v0/generate-intent {type swap_transfer, standard erc191, signerId 0x17c5…, depositAddress} -> HTTP 201
  {"intent":{"standard":"erc191","payload":"{\"verifying_contract\":\"intents.near\",\"signer_id\":\"0x17c5…\",\"deadline\":\"2026-10-29T16:23:47.000Z\",\"nonce\":\"Vij2xgAlKBKzAP46E7AM4xi4G3lLiID860US4dW8Nv8=\",\"intents\":[{\"intent\":\"transfer\",\"receiver_id\":\"38646566…2d0d\",\"tokens\":{\"nep141:17208628…33a1\":\"2000000\"}}]}"}}
  nonce bytes: 5628f6c6 | 00 | salt 252812b3 | deadline 00fe3a13b00ce318 (i64 LE ns) | 15 random  (versioned V1, mainnet salt)
Not signed, not submitted.
~~~

## E-017 output
~~~text
$ cd contracts/options
$ cargo fmt --check                                  -> ok
$ cargo clippy --all-targets -- -D warnings          -> Finished, 0 warnings
$ cargo near build non-reproducible-wasm --abi-features abi
  SHA-256 checksum bs58: HCXeZxvbMMCFrGCmQ5mHGeQkpZkSECVjwiC44L5oG9g1 · wasm 323.0 KB (was 294.8 KB)
  ABI: 29 functions; on_auth {"kind": "call", "modifiers": ["payable"]} args [signer_id, msg]
$ cargo test
  unittests src/lib.rs   ok. 70 passed (new: on_auth_refused_unless_called_by_intents, on_auth_without_a_signed_action_refused,
                         signed_list_and_cancel_act_for_the_signer, signed_cancel_of_someone_elses_offer_refused,
                         signed_close_acts_for_the_writer, signed_withdraw_pays_the_writer, signed_withdraw_without_proceeds_refused,
                         signed_reclaim_before_expiry_refused, signed_reclaim_after_expiry_pays_the_writer,
                         signed_reclaim_of_someone_elses_series_refused, signed_retry_without_owed_refused,
                         signed_transfer_call_moves_the_signers_longs, signed_transfer_call_beyond_holdings_refused)
  tests/devnet.rs        ok. 0 passed; 1 ignored (run manually)
  tests/sandbox.rs       ok. 2 passed (41.72s)
  tests/signers.rs       ok. 1 passed (35.01s): wallet_without_near_account_runs_a_writers_lifecycle
    0x17c5185167401ed00cf5f5b2fc97d9bbfdb7d025 (view_account: no NEAR account), relayer carol.sandbox
    create 3 calls (transfer + msg)      -> writer = 0x17c5…, longs 3
    list 2 @ 0.1 tUSDC (auth_call)       -> 2 escrowed; bob buys 1 -> 0.1 tUSDC to the 0x account inside Intents
    cancel_offer (auth_call)             -> longs back to 2
    mt_transfer_call -> intents          -> nep245:options.sandbox:1 balance 1 in Intents, ledger 1
    bob exercises 1; withdraw_proceeds   -> 0x account tUSDC 2.1
    reclaim before expiry (auth_call)    -> ERR_NOT_EXPIRED; collateral_held still 2 wNEAR
    alice calls on_auth directly         -> ERR_NOT_INTENTS
    reclaim after expiry (auth_call)     -> 0x account wNEAR 3; reclaimed, collateral_held 0
~~~

## E-018 output
~~~text
# Devnet: cargo test --test devnet -- --ignored --nocapture (RPC 127.0.0.1:56331); npx vite --port 5179 (mounts /api/relay with relayer.sandbox)
$ node scripts/relay-check.mjs http://localhost:5179      (third run; the first two created series #6, #7 and offers #4, #5)
wallet (no NEAR account)                     0x17c5185167401ed00cf5f5b2fc97d9bbfdb7d025
wNEAR inside Intents                         18
200 write (transfer + create msg)            series #8, writer 0x17c5185167401ed00cf5f5b2fc97d9bbfdb7d025, tx 8uFFzNAxG9FttJRiBQGusTRHsgn7vpDSqcHGxREarX26
200 list (auth_call -> on_auth)              offer #6, seller 0x17c5185167401ed00cf5f5b2fc97d9bbfdb7d025
200 relayed, refused on chain                ERR_NOT_WRITER, wNEAR unchanged, tx A91GtahpuZmtjKE9x7Ay2Gr4di92znFtXjcB1oahFVVM
400 a transfer to another account with a msg Every intent must be a Warrant action.
400 a plain wNEAR transfer out               Every intent must be a Warrant action.
400 an auth_call to another contract         Every intent must be a Warrant action.
400 another network's verifying_contract     verifying_contract must be intents.sandbox.
400 a deadline an hour out                   The deadline must be within 15 minutes.
422 v left at 27/28                          Intents would refuse it: wasm execution failed with error: HostError(GuestPanic { panic_msg: "invalid signature" })
422 the first write, replayed                Intents would refuse it: wasm execution failed with error: HostError(GuestPanic { panic_msg: "nonce was already used" })
405 GET                                      POST a signed intent.
relay check passed
# Production bundle (npm run build): no relayer code or key in dist
dist/assets/index-DGIGRol0.js 404.19 kB │ gzip 119.84 kB · dist/assets/devnetSigner-BGM809Xi.js 1.65 kB (lazy)
grep dist: the relay key 0 files · RELAY_SECRET_KEY 0 · RELAY_ACCOUNT_ID 0 · simulate_intents 0 · execute_intents 0 · "Only erc191 payloads" 0
typecheck 0 · lint 0 warnings
~~~

## E-019 output
~~~text
# Devnet (RPC 127.0.0.1:56331, UI :5179), acting as 0x17c5185167401ed00cf5f5b2fc97d9bbfdb7d025 (devnet test wallet → /api/relay)
account 1440   hero "0x17c5…d025"; stations EVM wallet "on its own chain" · deposit "through 1Click" · Intents 16.00 wNEAR + 50.00 tUSDC; ledger wallet cells "on your wallet's chain", no Send on tokens
cancel offer 7 review: ERC-191 · auth_call WARRANT · action cancel_offer, offer_id 7 → "Done on chain · An1V5XeY6W…"; get_offer(7) null; longs(series 9) 1
  (first try surfaced "The number 1793036147006.6 cannot be converted to a BigInt": chainNow() is fractional; fixed with Math.floor)
buy offer 1    review: transfer WARRANT · tokens 0.42 tUSDC · msg buy/offer 1/1 option → "Done on chain · C1JafPsVUn…"; longs(series 1) 1; tUSDC 50.00 → 49.58; offer 1 remaining 1
exercise #1    review: tokens "4.80 tUSDC · nep141:tusdc.sandbox · 4800000", msg exercise → "Done on chain · 9eUuCvSYH8…"; longs 0; tUSDC 44.78; wNEAR 17.00
refusal band   "Send one yourself" → "Reclaim is locked · series #6" → Test the lock → "Refused by chain ERR_NOT_EXPIRED · 8pm6t8T45k… The collateral is locked until expiry."
after split    buy offer 2 (lazy review + signing) → "Done on chain · E2gzK11Pp7…"
NEAR path      alice: "What you'll sign · 1 transaction" → Test the lock → "Refused by chain ERR_NOT_EXPIRED · 9Jb2Urbode…"
relay check    node scripts/relay-check.mjs (chain-time deadlines): passed; series #9, offer #7

# Mainnet mode (VITE_NETWORK=mainnet on the devnet's chain, :5181)
connect menu   none: "NEAR wallet | No EVM wallet in this browser…"; an announced wallet appears live with its icon
connect        → header "0x17c5…d025 | EVM | Disconnect"; localStorage warrant.evm-wallet = test.evm-wallet
reload         restored without a prompt (header shows 0x17c5…d025 · EVM); Disconnect → "Connect wallet", remembered null
sheet gate     Write a series with no one connected: "Connect a wallet to send this. | NEAR wallet | Test EVM wallet …"
menu gutters   320 16..304 · 390 16..336 · 640 136..456 · 768 136..456 · 1024 519..839 · 1280 775..1095 · 1440 890..1210 (all ≥ 16px)
overflow       scrollWidth = viewport at 320/390/640/768/1024/1280/1440 on the mainnet-mode board and on the devnet board and account as the 0x wallet
               (before the fix: 808 at 768, the refusals band's error word in a 95px column)
axe 4.10.2     connect menu [] · sheet gate [] · ERC-191 review []
console        0 errors, 0 warnings: devnet board and account as 0x, devnet board as alice, mainnet-mode board

# Build (npm run build)
dist/assets/index-UvblHf0_.js 408.94 kB │ gzip 121.47 kB (was 404.19 / 119.84); lazy: Connect 4.48 kB, SignedReview 4.48 kB, signedIntents 1.98 kB
grep dist: devnet key 0 · "Devnet test wallet" 0 · "Ethereum Signed Message" 0 · RELAY_SECRET_KEY 0 · execute_intents 0
gate: lint 0 · typecheck ok · cargo fmt ok · clippy ok · cargo test: 70 unit · sandbox 2 · signers 1

# 1Click (live, no key) and mainnet intents.near (free view)
submit-intent erc191, invalid signature → HTTP 201 {"intentHash":"8qTcizXyvmdbfhMecJxgd8sXPJpZNPvUaQE1E8ARRyWw"}
status (deposit 8263478a…19b6), polled 4 × 15 s → PROCESSING 2026-10-26T17:40:03Z every time
simulate_intents on intents.near, a 1Click erc191 payload signed with the test key → "insufficient balance or overflow" (signature accepted; the wallet holds nothing)
same payload, junk signature → "public key 'secp256k1:YtNX…' doesn't exist for account '0x17c5185167401ed00cf5f5b2fc97d9bbfdb7d025'"
~~~

## E-020 output
~~~text
# Contrast (WCAG, computed from OKLCH)        on white   white on   iron on
lock          oklch(0.50 0.20 264)              6.29       6.29       2.88
live-ink      oklch(0.47 0.12 158)              6.35       -          -
live-deep     oklch(0.50 0.14 158)              5.45       5.45       -       (Exercise key, white lettering)
release       oklch(0.80 0.15 80)               -          -          9.55    (Close/Reclaim key, iron lettering)
release-ink   oklch(0.50 0.11 72)               6.13
deliver       oklch(0.68 0.12 58)               -          -          6.08    (Claim key, iron lettering)
deliver-ink   oklch(0.50 0.10 55)               6.21
refuse        oklch(0.57 0.21 27)               4.96       4.96       -       (Test the lock key)
refuse-ink    oklch(0.50 0.19 27)               6.62

# Found while verifying
sheet header wash, live: computed linear-gradient(oklch(0.956 0.0165 17.38) …) = pink → mixed in oklab → oklab(0.9648 0.007 0.011) (warm-neutral, no hue drift)
impeccable detect, board as bob: [low-contrast] 4.1:1 #423227 on #cf8447 (note at 75% opacity on brass) → full ink
  [low-contrast] 4.0:1 #f9fafb on #238c5d (white 14% tile over green) → unfilled framed tile
  [dark-glow] ×2 zero-offset/colored glow on refused night plates → neutral fall-off shadow
  [low-contrast] 2.4:1 #afb5bc on #d72828 (stamp mid-transition) → refusal stamp without transition
  after: 0 anti-patterns (advisory: nested-cards, repeating-stripes-gradient, both deliberate)
account stage: [advisory low-contrast] 4.45:1 panel-ink-3 over the blued gel → panel-ink-3 0.53 → 0.50; after: 0

# axe 4.10.2 (wcag2a/aa, 21a/aa)
board as alice [] · Claim sheet [] · board as bob [] · Exercise sheet [] · account as alice [] · refusals band []
# overflow (scrollWidth = viewport)
390 board 390 · 390 account 390 · 768 board 768 · 768 account 768 · 1024 board 1024 · 1024 account 1024
# gate
lint 0 · typecheck ok · build: index.js 409.27 kB (gzip 121.60) · index.css 75.59 kB (gzip 15.87) · devnet key in dist 0
~~~

## E-021 output
~~~text
# readout inside the blued disc (text-range glyph boxes vs the disc circle; sr-only and hidden text excluded)
320 dial 288px worst +3.1px ("LOCKED IN INTENTS", series line hidden)   360 dial 328px +14.3px   375 dial 343px +16.9px
390 dial 358px +4.2px ("LOCKED IN NEAR INTENTS", series line hidden)   414 dial 382px +11.0px
768 dial 708px +41.1px · 1024 dial 450px +3.3px · 1440 dial 450px +3.3px (series line shown); scrollWidth = viewport at every width
# found on the way
labels at r=350: "3mo"/"1mo" touched the disc (-0.2px at 1440, -2.2px at 390) → r=358 and tenors 1M/3M → min clearance 4.3px (1440), 2.0px (390)
"Locked in NEAR Intents" at 320/360 overflowed the chord (143px line, 118px chord) → kicker drops "NEAR" on dials <350px
@container (max-width: 21.5rem) matched 322px, not 344px: this root is 15px → breakpoints in px
# what lies beneath each line (document.elementsFromPoint at its left end, middle, right end)
1440 and 390: kicker, figure, unit, "Next opens in", clock, series line → dial-blued/dial-blued/dial-blued
inks: oklch(0.985 0.004 255) · oklch(0.93 0.03 255) · oklch(0.92 0.1 88); worst-lit contrast 5.64 / 4.80 / 4.62:1 (computed)
detector advisory "#dbe9fc on #f9fafb" = ice ink measured against the page, not the sibling disc: a layering false positive
# story dial
before the lock opens: data-open=false, blue centre, "Locked" in white; after: data-open=true, .dial-blued opacity 0, "Open" in iron
# axe 4.10.2: hero 1440 [] · board 1440 [] · hero 390 [] · board 390 [] · console 0 errors/warnings
# impeccable detect: hero 0 anti-patterns · board as bob 0 anti-patterns
# gate: lint 0 · typecheck ok · build index.js 409.48 kB (gzip 121.64) · index.css 76.91 kB · devnet key in dist 0
# public/og.png: re-rendered from scripts/og.html at 1200×630 (PNG RGB), blued "Locked" centre
~~~

## E-022 output
~~~text
# text width / cell width, font size: holder pays · holder receives · countdown · worst-case "366d 23:59:59" probe
before (user's screenshot, ~1511px): "12.345678 tUSDC" at 22px ≈ 201px in a 146px cell → overlapped "2.50 wNEAR"
1440 #3   135/146 14.6px · 92/146 14.6px · clock 111/146 14.6px · probe 120/146 fits
1440 #1   131/146 22.0px · 137/146 22.0px · probe 120/146 fits
1511 #3   135/146 14.6px · 92/146 14.6px · probe 120/146 fits     1920 #3 same
1024 #3   201/296 22.0px · 137/296 22.0px · probe 156/296 fits   1280 #3 201/434 22.0px · 137/434 22.0px
gate: lint 0 · typecheck ok · build index.js 409.71 kB · devnet key in dist 0 · impeccable detect (series #3) 0 anti-patterns
~~~

## E-023 output
~~~
# 2026-11-04 23:12 UTC (2026-11-05 local), RPC free.rpc.fastnear.com
view_account d0482bff…4148              UNKNOWN_ACCOUNT  (unfunded, #1)
view_account intents.near code_hash     BtA1BEFNS619KkvXFsgcpQ21Tb5yMm32aaUkn7xNothk  (pinned)
view_account wrap.near    code_hash     DL2f5xmZ44cQRP6vBMt94rvseH5d5KKnAGis2WkTAsh1  (pinned)
intents.near pa_all_paused              null  (nothing paused)
EXPERIMENTAL_protocol_config            storage_amount_per_byte 1e19, protocol 87
gas_price                               100000000
view_account warrant.near               exists, empty code (not ours)
view_account warrant-options.near       UNKNOWN_ACCOUNT  (free, D-035)
1Click /tokens                          wNEAR 4.04, USDC 0.999682
GET nearhackathon.com/api/applications  {"count":128}

# Gate on the tree to be committed
cargo fmt --check                       ok
cargo clippy --all-targets -D warnings  ok
cargo near build … --abi-features abi   322988 bytes
cargo test -- --test-threads=1          70 unit; sandbox 2; signers 1; devnet ignored; all ok
cargo test --lib, after adding exercising_the_same_longs_twice_refused: 71 passed
npm run lint                            0 warnings
npm run build                           index.js 409.71 kB, index.css 77.02 kB

# Secret scan of every file `git add` would take (literal dev key and seed phrase, key-shaped
# strings, tokens, JWTs, env assignments)
140 files scanned; 0 hits
ignored as expected: web/.env.development.local internal contracts/options/target web/dist see.md
~~~

## E-024 output
~~~
# Fresh clone of 6-first-commit, the CI steps in order, no keys
fmt ok · clippy ok · cargo near build: 322996 bytes
unit 71 passed · sandbox 2 passed (171 s, bytecode fetched from mainnet, hashes checked) · signers 1 passed
npm ci · npm run build: index.js 409.71 kB

# node scripts/run.mjs --devnet …, real transactions on the seeded devnet
allow    allow nep141:wrap.sandbox: 6yMDYdAki4hNV4mikYDsC3LavA1KEezGakVTqCRm6JUe
fund 1   writer wNEAR inside Intents: 9000000000000000000000000
share 1  holder USDC inside Intents: 440340000
write    series 6: 3 longs, 300000000000000000000000 locked, offer of 2
refusals reclaim-early: ERR_NOT_EXPIRED RpUbtRWQham245feGuzRJc6XjeJR6dPj9AdPsUFE6WW
         exercise-expired: ERR_EXPIRED 8t2fifgq8u2sYQkmoLzUqvfVtUg8gsXSeXZ6tTjg71sx
         exercise-unheld: ERR_INSUFFICIENT_LONGS Big8CAiJpkSsBXjVaLKntzdnCaJcLVpEVyHXCMNJ4YCZ
         both refused exercises refunded in full
         reclaim series 7: CKDgv7mPnuoPZ4L5Xqoo8zkaVpkTy6hZn9yEnmYDtkxT
writer wNEAR afterwards: 9.0 − 0.3 (series 6) − 0.1 (series 7) + 0.1 (reclaimed) = 8.7, as read

# node scripts/run.mjs swap-check, on mainnet: a live quote and generate-intent, signed locally, simulated only
quote: 0.1 wNEAR → 0.400908 USDC
simulate_intents refused: "insufficient balance or overflow"     (past the signature: the account is unfunded)
control, a well-formed 64-byte wrong signature:  "invalid signature"

# vercel build --prod (local, uploads nothing): functions/api/relay.func, runtime nodejs24.x
before the fix: api/relay.js imports "../relay/relay.ts", which isn't in the function
after rewriteRelativeImportExtensions: "../relay/relay.js", and so on down the tree
unconfigured host: POST /api/relay → 503 {"error":"The relayer isn't configured on this host."}

# node scripts/relay-check.mjs against the emitted function, serving the devnet
200 write (transfer + create msg)            series #8, writer 0x17c5185167401ed00cf5f5b2fc97d9bbfdb7d025
200 list (auth_call -> on_auth)              offer #5
200 relayed, refused on chain                ERR_NOT_WRITER, wNEAR unchanged
400 a transfer to another account with a msg · a plain wNEAR transfer out · an auth_call to another contract
400 another network's verifying_contract · a deadline an hour out
422 v left at 27/28 · the first write, replayed
405 GET
relay check passed

# The README's steps in a browser (Playwright, 1440 × 900)
/?as=alice.sandbox       board, dial, three recorded refusals; 0 console errors, no overflow
Send one yourself → Test the lock    "Refused by chain ERR_NOT_EXPIRED · DL1CyiWQ7y…"
/account?as=bob.sandbox  account page for bob.sandbox, no overflow
~~~

## E-025 output
~~~
git diff 812187a (old single commit) 397038e (split tip), and 6d21b4d 706778b (old and new tips)
 docs/DECISIONS.md | 2 +-     (D-034's consequence line, in both)

8462073 feat(contract)    fmt 0 · clippy --all-targets 0 · wasm build 0 · cargo test --lib 0, 71 passed
6db5192 feat(web) layer   npm ci 0 · lint 0 · typecheck 0 · vite build 1, "Cannot resolve entry module index.html"
37e1f46 feat(web) app     lint 0 · typecheck 0 · build 0
52d7dd9 test(contract)    contracts/ identical to the tip, so the fresh clone's run below covers it

Fresh clone of 10-mainnet-runbook at b459a15
contracts   fmt 0 · clippy --all-targets 0 · wasm build 0 · cargo test -- --test-threads=1 0
            71 passed · devnet 1 ignored · sandbox 2 passed · signers 1 passed
web         npm ci 0 · lint 0 · typecheck 0 · build 0

cargo near build reproducible-wasm, at 42a6209 (the commit before the split), 426 s in Docker
image       sourcescan/cargo-near:0.22.0-rust-1.97.1@sha256:7467038b…2234
wasm        323125 bytes
snapshot    git+https://github.com/emmanuelist/warrant?rev=42a6209114aa2ff057e6110051c78d59cefff2d7
code_hash   BRavJ4DHsU97Zc7vxZk2zEBtJ77wccdBQm1SJH5QQbfL
~~~

## E-026 output
~~~
commit 1ffcc9f1a239463e18fd32eada1ed8a16847410e, cargo near build reproducible-wasm, twice, in Docker
build 1 exit 0 · 151s   CPKpW1fWrJmpWXLudZP4yuYxHy9Y36tfzwqgs6zuMTng 323125
build 2 exit 0 · 147s   CPKpW1fWrJmpWXLudZP4yuYxHy9Y36tfzwqgs6zuMTng 323125
cmp: BYTE-IDENTICAL across two builds
git+https://github.com/emmanuelist/warrant?rev=1ffcc9f1a239463e18fd32eada1ed8a16847410e

gh repo view emmanuelist/warrant   PRIVATE, default branch main, created by the user 2026-11-05T00:29:18Z
gh issue list --state all          #1 to #22, numbers as docs/ISSUES.md had them; 8 closed with evidence
~~~

## E-027 output
~~~
node scripts/run.mjs --devnet write && node scripts/run.mjs --devnet room
buy-overflow           ERR_OVERFLOW                   Ba6cL3q5K886vrt5DwJHdpuTcex8aESg6nKdwrZqx6zD
reclaim-early          ERR_NOT_EXPIRED                9ydMcTtxL2wn26itZw2JiJTxyPwrhjoFF1uXwW2fZfzy
reclaim-stranger       ERR_NOT_WRITER                 GCCj2SMBhnKnuNVFa22ukcp2TLr1k4qSMWPpKdTjffpB
close-unheld           ERR_INSUFFICIENT_LONGS         EqHBVNeGFxqFkWZQrGoM3kqDYW1M3Huc7jVFCiT2khRV
forge-deposit          ERR_NOT_INTENTS                6DQScMb8Ccnj5ACiAXANYsShMdNYMifkUPA3LHV5y2TB
forge-signature        ERR_NOT_INTENTS                GfW6zgtSYv5rheB95fJNUYxXSwnU6qEogWnGzNAiA8oz
allow-stranger         ERR_NOT_OWNER                  61gWVYeqqmgVoNuySF1zeSayKA18KynqbLTfTN2s3qZF
cancel-stranger        ERR_NOT_SELLER                 7vAHyTw7Bh1QnP2kdkZKcaVYS6m2KKNQ9ZDsTfkgrdxV
exercise-unheld        ERR_INSUFFICIENT_LONGS         3LDDgfx7eCvCxARnBWeZDTB7BZZdPEPPhkigiTZB2PRn
exercise-underpaid     ERR_INSUFFICIENT_PAYMENT       48ncAhdXVV8mMdSM5ASuEK6mBBHJwmhwGU87276tTiZi
exercise-wrong-token   ERR_WRONG_TOKEN                A2dt2vRmxZejcxmW7x8HVMYShJrpc4gNjPXymrDgcZvC
exercise-unknown       ERR_UNKNOWN_SERIES             638aDKLgBkn69iv4rB1PvWDxr8vL67Ao18Xpcx7J1GbV
exercise-zero          ERR_ZERO                       FVMXugMSyHFEW11Ykush5yFau7968pJLPVnHnAN94cQE
buy-too-many           ERR_OFFER_AMOUNT               6BT3stLhFQsuKzgvKRTZBEecJxoXeBt9w5EWWMTi5cy
buy-unknown            ERR_UNKNOWN_OFFER              7qDyNkCkkR3opkwfjAH5y6PfjFQyR8bJxhYcosRTbQWG
create-below-min       ERR_BELOW_MIN                  GajfN1BdZMB6FwW1Q4QryzeaNjHdVxnMqCE6MCqoJRDJ
create-bad-expiry      ERR_BAD_EXPIRY                 Crz2uhbv5WrkkFNzQyMgD1DxC3erL4xdkhhCxwt8nvzd
create-unlisted        ERR_TOKEN_NOT_ALLOWED          Fig4Cd6tGHxzHtG7deuAhDEU6xkGgnqnoE1rXN8yBYJ6
create-same            ERR_SAME_TOKEN                 GXLz8WkTYJWRxX3akz9Mp8SJbX7fYHfCYQqzpWfXStvZ
bad-msg                ERR_BAD_MSG                    ESRY4jepMUjxry5HCMhXEaePsun97nUfbi8BcyHZ67Xt
batch                  ERR_BATCH_NOT_SUPPORTED        7NSkX8m1SqQiJg225QLvuPvCeT8m96HWk8JnducvxoJE
transfer-self          ERR_SELF_TRANSFER              AYE8baNaPdzRT8uRnPSyD7qD2gQkjKar5gnKD6r5gqt1
transfer-approval      ERR_APPROVALS_NOT_SUPPORTED    CLE3XKoSMGyVHpeWcyXzn1phoSbBxAEtEcdBpMb4z5Uv
batch-mismatch         ERR_LENGTH_MISMATCH            DXacSVVgmJ1rtVXhqXdkZAhjETTJJGnSxb8oX3buwCV5
retry-nothing          ERR_NOTHING_TO_PAY             3h5V4W7qLktNAvnfkcWVCxRGRRNQDyvwZUr5F17kpuAM
every refused attempt so far refunded in full, the contract's balances unchanged
honest-buy             went through                   GyJm1EfgryKBmpBMVsLceBeY63mM2WibDvTFEjXK7Nwb
honest-exercise        went through                   GaCsF3obM1D8ioDxkt6zMy4PghpzmCfN6ukCivjCQDJ6
exercise-expired       ERR_EXPIRED                    ui5kGr4GPyNtwiwuSxQYJBZgP1RPoyAaQtNbygnTRoc
honest-reclaim         went through                   HZfjeV5j5HGV6HB9FXGcTCiRgKEVHC4mmrhGhb5wPNdd
reclaim-twice          ERR_ALREADY_RECLAIMED          4crfuctV9yNAMu1Hin9V653NGvwaLVEtRq7oaPZVaW12
30 attempts ended as room.json says

Playwright, /?as=alice.sandbox#refusal-room
1440   tally refused 27 · honest 3 · off 0 · unread 0 · 25 distinct codes · 3 columns · no overflow · 0 console errors
390    the same tally · 1 column · no element past the viewport · axe on #refusals: 0 violations
Off-rule test (a row pointed at the honest buy's hash):  "went through, expected ERR_NOT_EXPIRED" · "1 off their rule"
Unknown hash test:                                       "couldn't read it just now" · "1 couldn't be read just now"
Nothing recorded:                                        every row "not recorded yet", the read button disabled, the intro says so
impeccable detect: 0 anti-patterns; advisories are the dial's known layering false positives, nested cards and stripes
~~~

## E-028 output
~~~
cargo test --lib invariants -- --nocapture
32768 steps across 256 sequences; 2683 payouts landed, 402 failed and stayed owed
accepted: buy 669 · cancel_offer 384 · close 498 · create 3268 · exercise 1306 · list 1029 · mt_transfer 404
          reclaim_collateral 280 · retry_payout 118 · withdraw_proceeds 258 · write 1598
refused:  ALREADY_RECLAIMED 96 · APPROVALS_NOT_SUPPORTED 225 · BAD_EXPIRY 673 · BAD_MSG 165 · BATCH_NOT_SUPPORTED 535
          BELOW_MIN 441 · EXPIRED 1860 · INSUFFICIENT_LONGS 3036 · INSUFFICIENT_PAYMENT 415 · LENGTH_MISMATCH 542
          NOTHING_TO_PAY 2040 · NOT_EXPIRED 1655 · NOT_INTENTS 1114 · NOT_OWNER 501 · NOT_SELLER 79 · NOT_WRITER 940
          OFFER_AMOUNT 172 · OVERFLOW 35 · SAME_TOKEN 321 · SELF_TRANSFER 830 · TOKEN_NOT_ALLOWED 349 · UNKNOWN_OFFER 3628
          UNKNOWN_SERIES 2526 · WRONG_TOKEN 698 · ZERO 80
test result: ok. 1 passed

Checked after every accepted step:
  each series fully backed until reclaimed; proceeds = exercised x payment - withdrawn
  every long in someone's hands or in escrow behind an offer
  the contract's balance inside Intents = collateral + proceeds + owed, per token, to the unit
  collateral leaves only by exercise before expiry, the writer closing before expiry, or the writer reclaiming after
  every scheduled payout goes to the account entitled to it
  a panic that isn't a named ERR_* fails the run

Injected bugs (each reverted; contract source unchanged):
time lock removed                    seed 1 step 27: series 2 reclaimed before expiry
anyone may reclaim                   seed 1 step 113: reclaim_collateral paid the wrong account
exercise after expiry allowed        seed 1 step 75: series 3 exercised after expiry
one unit of collateral lost          seed 1 step 13: exercise panicked with something other than a named refusal: attempt to subtract with overflow
exercise refunds one too many        seed 1 step 13: nep141:usdc.near inside Intents doesn't match the books
the premium goes to the buyer        seed 1 step 43: buy paid the wrong account
~~~

## E-029 output
~~~
cargo test --test sandbox retire -- --nocapture          (30 series, on the real runtime)
retired with 12143 bytes of state beyond the code; the owner received 20.01 NEAR
test retire_returns_the_deposit_once_nothing_is_held ... ok
Same test with the three clear() calls removed: fails, "retire had failed receipts"

cargo test --lib invariants -- --nocapture
32678 steps across 256 sequences; 5730 payouts landed, 338 failed and stayed owed; 255 wound down to nothing and retired
accepted: buy 602 · cancel_offer 312 · close 468 · create 2896 · exercise 1178 · list 888 · mt_transfer 349
          reclaim_collateral 283 · retire 256 · retry_payout 85 · withdraw_proceeds 249 · write 1450
refused:  all 26 named refusals reached, ERR_CANNOT_RETIRE 1277

Injected into retire.rs (each reverted):
retire ignores collateral          seed 14 step 50: retired holding 4 nep141:usdc.near; retire_while_holding_collateral_refused fails
retire ignores proceeds            seed 190 step 86: retired holding 4 nep141:usdc.near; retire_with_unclaimed_proceeds_refused fails
retire ignores its date            seed 6 step 10: retired before its date; retire_before_its_date_refused fails
retire ignores owed payouts        retire_with_a_payout_owed_refused fails
retire ignores payouts in flight   retire_with_a_payout_in_flight_refused fails
retire pays the caller             seed 1 winding down: retire must only delete the account, for the owner

node scripts/run.mjs --devnet room
retire-holding         ERR_CANNOT_RETIRE              JCdnBH7cky7kGU2cSioPsUHwBTkEEgTf53p9Hz4tSzp6
every refused attempt so far refunded in full, the contract's balances unchanged
31 attempts ended as room.json says

Playwright: tally 28 refused, 3 went through, 26 distinct codes, 0 off, 0 unread
390, 768, 1440: no overflow · axe on #refusals: 0 violations · 0 console errors

Gate: fmt, clippy -D warnings, wasm 326615 bytes, 78 unit, sandbox 3, signers 1; web lint 0, typecheck, build
~~~

## E-030 output
~~~
=== reproducible, twice, at deaf21711920aac77f124a1fba30b5cbcd7fe501
build 1 exit 0 · 190s   GGvJPAmHR6RJr5NvN5Au5x16SvWp5ABKshteMfTGo6h 326736
build 2 exit 0 · 182s   GGvJPAmHR6RJr5NvN5Au5x16SvWp5ABKshteMfTGo6h 326736
BYTE-IDENTICAL across two builds

=== fresh clone
fmt 0 · clippy --all-targets 0 · wasm build 0 · all tests 0
78 passed · devnet 1 ignored · sandbox 3 passed · signers 1 passed
npm ci 0 · lint 0 · typecheck 0 · build 0

=== GitHub Actions
run 41988517094, push to main at bf3639f: contracts success, web success
~~~

