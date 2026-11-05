# State
_Last verified: 2026-11-05 (rows dated 2026-11-05; the rest carry their date) · repo: private `emmanuelist/warrant`, opens when the build is finished (D-039)_

**Name:** Warrant (D-014). **Thesis:** Options that can't default and need no oracle: the collateral is locked inside NEAR Intents until expiry.
**Milestone:** M1, due 2026-11-05 23:59 UTC · **Deadline:** 2026-11-14 23:59 UTC · 9 days left on 2026-11-05
**Live:** https://warrant-options.vercel.app · contract `warrant-options.near` (E-031)
**Next action:** the proof surface: the README in the structure D-037 asks for (#13), then the film (#22). Re-scan rivals on 2026-11-07 (#12).

Claude provides the wallet and records the video. The user only funds, posts on X and confirms the payload (D-036). The demo winds down from 2026-11-26 (#25). What the proof has to beat: D-037 (#18, #22).
**Blocked on (the user's):** nothing right now. The funding (#24) arrived.

Vercel hosts the page and relayer. Deploy with `vercel build --prod --yes` and `vercel deploy --prebuilt --prod --yes` in `web/`; `vercel link` leaves a `web/.env.local` and `web/.gitignore` to delete. Narration uses an ElevenLabs key read at run time and never copied here (the user agreed to both, 2026-11-05).

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
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
| Web gate, 2026-11-05: lint 0 warnings, typecheck, production build (main JS 409.71 kB) | `npm run lint`, `npm run build` | E-023 |
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
| Options contract, `code_hash DADQfyxqwetsaZBh5n7JEQ8MnwZKQiqzCxaS465svgYz`, tag `mainnet-v0.1.0`, one full-access key until #18 | mainnet | `warrant-options.near` | 2026-11-05 |
| Page and relayer | Vercel | https://warrant-options.vercel.app, `/api/relay` | 2026-11-05 |
| Owner and writer | mainnet | `d0482bff…4148`: about 0.23 NEAR; inside Intents 0.25 wNEAR, about 0.12 USDC, and 0.9 USDC of proceeds to claim | 2026-11-05 |
| Demo holder (Intear wallet, D-040) | mainnet | `e96016e5…da50`: about 0.13 NEAR; inside Intents 0.10 wNEAR, 0.01 USDC; 1 long | 2026-11-05 |
| Demo EVM wallet, key in `~/.near-credentials/warrant-evm/` | Base + Intents | `0x05db…7b0b`: 0.30 USDC and gas on Base; inside Intents about 0.03 USDC; wrote series 3 | 2026-11-05 |
| Relayer, function-call key on `intents.near` / `execute_intents` | mainnet | `f6464d4e…90ec`: about 0.19 NEAR, allowance about 0.145 (D-042) | 2026-11-05 |

## Broken or unverified
- A real EVM extension's prompt (MetaMask shows the ERC-191 JSON as text): unexercised, and hard to drive headless. The round trip was signed by a local signer in the browser. Solana and passkey signers are not built (D-030).
- Other near-connect wallets: only Intear is exercised (D-040).
- The `retry_payout` UI path: needs a failed payout to appear; the contract path is unit-tested (E-004).
- The exercise net as the primary move's sentence: the sheet's version is verified on mainnet (E-032), this one needs a long in the money.
- `scripts/mainnet-deploy.sh lock`: its near CLI chain is checked with `--help` but never sent (#18).
- `retire` on mainnet: can't run before 2026-11-26.
- What a full storage balance blocks beyond new writes (D-035).
- Design debt (P3): material colours are literal oklch values; the route's stations trip the detector's nested-cards rule (deliberate, inside the control well); no sorting, search or batch claims on the board (the critique's Flexibility 2/4).

## Open questions
- Can one project place in several tracks? (user → NEAR Discord or Telegram, #3). The page only confirms multi-track tagging.
- Lock the contract account before submission? With `retire` it costs only gas, about 4.7 of the 5 NEAR comes back from 2026-11-26, and it makes "can't default" checkable in one command (D-035, D-038, #18). I recommend yes; the user confirms at M3.
