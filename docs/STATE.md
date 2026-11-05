# State
_Last verified: 2026-11-05 (rows dated 2026-11-05; the rest carry their date) · repo: public `emmanuelist/warrant` since 2026-11-05 (E-037, D-047)_

**Name:** Warrant (D-014). **Thesis:** Options that can't default and need no oracle: the collateral is locked inside NEAR Intents until expiry.
**Milestone:** M4, submitted 2026-11-05 (E-039); only the phone check is left. M1, M2 and M3 met on 2026-11-05 · **Results:** by 2026-11-18 23:59 UTC
**Live:** https://warrant-options.vercel.app · contract `warrant-options.near` (E-031), [source verified and locked on NearBlocks](https://nearblocks.io/address/warrant-options.near/contract/code) (E-037)
**Next action:** re-scan rivals on 2026-11-07 (#12). Keep the repo public, the post up and the hosted demo live to 2026-11-25 (Q-012), and check the relayer's allowance before judging ends. Never submit again: a mistake goes through https://nearhackathon.com/request-changes. From 2026-11-26: the wind-down and the return of funds (#25).

Claude provides the wallet and records the video. The user only funds, posts on X and confirms the payload (D-036). The demo winds down from 2026-11-26 (#25). What the proof has to beat: D-037 (#18, #22).
**Waiting on the user:** opening the post's links on a phone with Wi-Fi off (M4). What was submitted is in `internal/submission/`, and the funds' destination is theirs to give at return time.

Vercel hosts the page and relayer. Deploy with `vercel build --prod --yes` and `vercel deploy --prebuilt --prod --yes` in `web/`; `vercel link` leaves a `web/.env.local` and `web/.gitignore` to delete. Narration uses an ElevenLabs key read at run time and never copied here (the user agreed to both, 2026-11-05).

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| **Submitted (2026-11-05):** sent by the user through the hackathon's form, which says "Submission received". The HTTP status wasn't visible | The form's page, the public count (159, then 161) | E-039 |
| **The repo is public (2026-11-05):** a clone with no credentials passes `verify.mjs` and rebuilds the tag to the deployed hash. Nothing that opening exposes holds a secret, though six old commits stay readable. SourceScan rebuilt it on its own, and NearBlocks says "Contract Source Code Verified" and "Contract Locked: Yes" | Anonymous requests and clone, `cargo near build reproducible-wasm`, the verifier contract, NearBlocks in a browser | E-037, D-047 |
| **The owner's key replaced (2026-11-05):** a copy left this machine, so the old key is gone from the account and `intents.near` no longer trusts it. The new key signs on both, and no balance moved | RPC on three nodes, `has_public_key`, `run.mjs swap-check` | E-036, D-046 |
| **Nobody holds the keys (2026-11-05):** the contract's account has no keys on three nodes, its `code_hash` is unchanged, and `verify.mjs` says so. Writing a series now takes about $20 of collateral, two small series have offers on the board, and the Write form opens at the minimum. `retire` would leave about 1.7 KB of state | `near account list-keys`, `scripts/verify.mjs`, RPC, Playwright on the production build | E-035, D-045 |
| **The post on X, with the film (2026-11-05):** [public](https://x.com/emmanuelcesc/status/2118396029271974299) with the required wording, both tags and both links, and the copy X serves ends on the corrected closing card | X's public embed endpoint, ffmpeg on X's copy | E-038 |
| **The film (2026-11-05):** the whole story in one continuous run on mainnet, on one series, with the chain's clock opening the lock on camera; 2:19.5, under X's 2:20 limit. Its keys chapter is the real output after the lock. The user watched it and asked for no changes; one line of the closing card was corrected after that (E-037) | `internal/film/scripts/shoot.mjs`, `render.ts`, `score.ts`, ffmpeg QA | E-034, D-044 |
| **Anyone can check it (2026-11-05):** `node scripts/verify.mjs` reads the claims off mainnet and Base with no key; a clean clone of `mainnet-v0.1.0` rebuilds to the deployed `code_hash`; a position moved between accounts as an Intents asset | `scripts/verify.mjs`, `cargo near build reproducible-wasm`, the hosted page | E-033 |
| **The round trip on mainnet (2026-11-05):** a wallet with no NEAR account paid in from Base, bought, exercised, wrote a put and was paid on Base, through the hosted page and relayer, every leg on its own explorer. Signed by a local signer in the browser, not an extension | Hosted page in a scripted browser, Base and NEAR receipts | E-032 |
| **Live on mainnet (2026-11-05):** the contract with a series and its collateral inside Intents; 31 of 31 refusal-room attempts as `room.json` says, read back by the hosted page; a real 1Click swap; a purchase on the hosted page signed in a real wallet (Intear through near-connect) | `scripts/run.mjs`, RPC read-back, the page itself | E-031 |
| What only mainnet shows, fixed (2026-11-05): gas is charged up front, so calls ask for 90 TGas and the relayer 70 per intent; four public nodes with failover when one rate-limits; the chart crash once 1Click has a price; a fallback for render errors; 1Click's empty explorer links | Devnet room at 60 TGas, `web/scripts/relay-check.mjs`, Playwright on the production build | E-031, E-032, D-041, D-042 |
| CI on GitHub: both jobs green on `main` (2026-11-05) | [run 41988517094](https://github.com/emmanuelist/warrant/actions/runs/41988517094) | E-030 |
| The history split by area, each commit checked, a fresh clone green; two reproducible Docker builds of the previous contract byte-identical (2026-11-05) | Gate per commit, `cargo near build reproducible-wasm` | E-025, E-026 |
| Refusal room on the devnet (D-037, 2026-11-05): 28 real attempts reach all 26 named refusals, 3 honest calls go through, refused attempts move no money, and the app reads all 30 back from chain | `scripts/run.mjs room`, Playwright, axe-core, impeccable detect | E-027, E-029 |
| The deploy rehearsed, nothing spent (2026-11-05): a fresh clone passes the CI steps; every `scripts/run.mjs` step runs on the devnet with real refusals refunded in full; a NEP-413 signature over a live 1Click intent passes mainnet `simulate_intents`; the relayer as `vercel build` emits it passes the relay check on the devnet; the README's steps work in a browser | `scripts/run.mjs`, `swap-check`, `web/scripts/relay-check.mjs`, Playwright | E-024 |
| Rules re-read: Q-001 counts code from 2026-10-19 (D-034). Live `intents.near` and `wrap.near` still match the pinned hashes, and Intents reports nothing paused (2026-11-05) | curl, RPC | E-023 |
| Options contract: fmt + clippy `-D warnings`, 78 unit tests, sandbox suites `sandbox` (3) + `signers` (1); 326.6 KB wasm with `on_auth` and `retire` (2026-11-05) | Gate | E-004, E-013, E-017, E-023 |
| Invariants across about 32,000 random steps, every action and all 26 refusals reached, the money checked against scheduled transfers, every sequence wound down to nothing; 12 of 12 injected bugs caught (2026-11-05) | `cargo test invariants -- --nocapture` | E-028, E-029 |
| `retire` returns the deposit and can't touch money (D-038), on the real runtime with over 10 KB of state (2026-11-05). **Not on mainnet** | `cargo test --test sandbox retire` | E-029 |
| Wallets with no NEAR account (D-030), 2026-10-26. In the sandbox: a `0x` key writes, lists, cancels, moves a long into Intents, claims, is refused an early reclaim, and reclaims after expiry, through relayed `erc191` intents. The relayer refuses anything but Warrant actions. Through the UI on the devnet, as `0x17c5…d025`: cancel, buy, exercise and a refused early reclaim, each read back from chain. The connect menu, sheet gate and ERC-191 review show no overflow at 320–1440 and 0 axe violations | `cargo test --test signers`, `node web/scripts/relay-check.mjs`, Playwright | E-016, E-017, E-018, E-019 |
| Full lifecycle against byte-identical mainnet Intents + wNEAR (sandbox), 2026-11-05 | `cargo test --test sandbox` | E-005, E-013, E-023 |
| Every web action sent through the UI on the devnet (2026-10-21 to 26): wrap-and-deposit, withdraw (+unwrap), positions into/out of/inside Intents, exercise, a refused exercise refunded in full, cancel offer, write a series, a Buy from the phone's docked primary key | Playwright + RPC traces | E-007, E-013 |
| Web gate, 2026-11-05: lint 0 warnings, typecheck, production build (main JS 413.64 kB) | `npm run lint`, `npm run build` | E-023 |
| Web app renders from chain with no overflow at 390 / 1024 / 1280 / 1440 (and a 64-hex account at 390), and with reader fonts of 20 and 24px at 390/1024/1440; no devnet key, test wallet or relayer code in `dist` (2026-10-26) | Playwright DOM checks, gate | E-006, E-011, E-013, E-014, E-019 |
| 1Click without a partner key: non-dry quotes, `generate-intent` (201), `submit-intent` validates (400, not 401), CORS `*` (2026-10-20 to 26) | curl | E-007 |
| Reference patterns (D-021): "What you'll sign" in every sheet, payoff readout with landmark chips, 1Click step timeline and NEP-413 message review (2026-10-21) | Playwright on the devnet + live 1Click | E-008, E-013 |
| Studio light (D-024, D-025), "How the lock holds" (D-026), colour pass and heat-blued dial (D-032, D-033), series terms that fit long figures: 0 axe violations, 0 detector anti-patterns, no overflow (2026-10-26/27) | Playwright, axe-core, impeccable detect | E-011, E-012, E-020, E-021, E-022 |
| Critique fixes (D-027 to D-029): refusal cards read back from chain by hash, plus a real "Send one yourself"; "Your move" in words; exercise net + demotion; inline top-up; latest critique 28/40, audit 16/20 (2026-10-21 to 26) | Playwright, axe-core, impeccable detect | E-013, E-014, E-015 |
| Archival RPC reads old mainnet transactions (`archival-rpc.mainnet.fastnear.com`, CORS `*`); the regular RPC can't (2026-10-21) | curl | E-013 |
| Toolchain: rustc 1.97.1 (project-local) + cargo-near 0.22.0 (2026-11-05) | version commands | E-002 |

## Deployed
| What | Network | Address / URL | Last checked |
|---|---|---|---|
| Options contract, `code_hash DADQfyxqwetsaZBh5n7JEQ8MnwZKQiqzCxaS465svgYz`, tag `mainnet-v0.1.0`, **no access keys**, about 3.5 NEAR until `retire` | mainnet | `warrant-options.near` | 2026-11-05 |
| Page and relayer | Vercel | https://warrant-options.vercel.app, `/api/relay` | 2026-11-05 |
| Owner and writer, key replaced 2026-11-05 (D-046), key file on this machine and, by the user's word, in their backup | mainnet | `d0482bff…4148`: about 0.23 NEAR; inside Intents 0.05 wNEAR, 0.31 USDC; wrote series 1, 10 and 11 | 2026-11-05 |
| Demo holder (Intear wallet, D-040), the film's writer | mainnet | `e96016e5…da50`: about 0.12 NEAR; inside Intents 0.05 wNEAR, 0.52 USDC | 2026-11-05 |
| Demo EVM wallet, key in `~/.near-credentials/warrant-evm/` | Base + Intents | `0x05db…7b0b`: 0.43 USDC and gas on Base; inside Intents 0.32 USDC; wrote series 3 and holds the last long of series 1 | 2026-11-05 |
| Relayer, function-call key on `intents.near` / `execute_intents` | mainnet | `f6464d4e…90ec`: about 0.18 NEAR, allowance about 0.13 (D-042) | 2026-11-05 |

## Broken or unverified
- A real EVM extension's prompt (MetaMask shows the ERC-191 JSON as text): unexercised, and hard to drive headless. The round trip was signed by a local signer in the browser. Solana and passkey signers are not built (D-030).
- Other near-connect wallets: only Intear is exercised (D-040).
- The `retry_payout` UI path: needs a failed payout to appear; the contract path is unit-tested (E-004).
- The exercise net as the primary move's sentence: the sheet's "nets +" and "loses" are both verified on mainnet (E-032, E-034), this one needs a viewer whose primary move is exercising.
- `retire` on mainnet: can't run before 2026-11-26.
- What a full storage balance blocks beyond new writes (D-035).
- Design debt (P3): material colours are literal oklch values; the route's stations trip the detector's nested-cards rule (deliberate, inside the control well); no sorting, search or batch claims on the board (the critique's Flexibility 2/4).

## Open questions
- Can one project place in several tracks? (user → NEAR Discord or Telegram, #3). The page only confirms multi-track tagging.
