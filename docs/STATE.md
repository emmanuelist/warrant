# State
_Last verified: 2026-11-05 (rows dated 2026-11-05; the rest carry their date) · git: local commits only, no remote yet (#6)_

**Name:** Warrant (D-014). **Thesis:** Options that can't default and need no oracle: the collateral is locked inside NEAR Intents until expiry.
**Milestone:** M1, due 2026-11-05 23:59 UTC · **Deadline:** 2026-11-14 23:59 UTC · 9 days left on 2026-11-05
**Next action:** the first mainnet deploy (#10) as soon as #1 is funded, in this order:
1. `cargo near build reproducible-wasm` in `contracts/options`, from a clean commit that will be pushed and tagged, not squashed (its SHA is what NEP-330 names).
2. `scripts/mainnet-deploy.sh contract`, then `holder` and `relayer`. Then `node scripts/run.mjs` with `allow`, `fund 0.85`, `swap 0.3`, `share 0.5`, `write`, `refusals`.
3. Add the printed `VITE_REFUSAL_TXS` to `web/.env.production`, then host the page and relayer (`scripts/mainnet-deploy.sh host`) and send one real transaction from the page.
4. The first real 1Click payout to Base (#11).

Claude provides the wallet and records the video. The user only funds, posts on X and confirms the payload (D-036). The demo winds down from 2026-11-26 (#25). What the proof has to beat: D-037 (#11, #18, #20, #21, #22).
**Blocked on (all the user's):**
1. **#24:** 5 NEAR to `d0482bffd77daa246ff50cd36cd8c8392548a0cf0fc7d6ccd887a3675f084148`, on the NEAR Protocol network. Blocks M1. The account is still `UNKNOWN_ACCOUNT`. A background check watches for it.
2. **#6:** permission to create the private repo and push. The harness's permission layer refused `gh repo create --private` + `git push` as an upload, so nothing has left this machine. CI, also part of M1, can't run until this lands.
3. **#10:** the web app and relayer go on Vercel.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| The history split by area, each commit checked, a fresh clone green; a reproducible Docker build works (2026-11-05) | Gate per commit, `cargo near build reproducible-wasm` | E-025 |
| The deploy rehearsed, nothing spent (2026-11-05): a fresh clone passes the CI steps; every `scripts/run.mjs` step runs on the devnet with real refusals refunded in full; a NEP-413 signature over a live 1Click intent passes mainnet `simulate_intents`; the relayer as `vercel build` emits it passes the relay check on the devnet; the README's steps work in a browser | `scripts/run.mjs`, `swap-check`, `web/scripts/relay-check.mjs`, Playwright | E-024 |
| Rules re-read: Q-001 counts code from 2026-10-19 (D-034). Live `intents.near` and `wrap.near` still match the pinned hashes, and Intents reports nothing paused (2026-11-05) | curl, RPC | E-023 |
| Options contract: fmt + clippy `-D warnings`, 71 unit tests, sandbox suites `sandbox` + `signers`; 323.0 KB wasm with `on_auth` (2026-11-05) | Gate | E-004, E-013, E-017, E-023 |
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
| Nothing on mainnet. Owner `d0482bff…4148` is unfunded and contract account `warrant-options.near` doesn't exist yet (D-035). | mainnet | `UNKNOWN_ACCOUNT` for both | 2026-11-05 |
| Nothing hosted. | | | 2026-11-05 |
| Local key files only, unfunded: holder `e96016e5…da50`, relayer `f6464d4e…90ec` (`~/.near-credentials/warrant-*`) | mainnet | `UNKNOWN_ACCOUNT` | 2026-11-05 |

## Broken or unverified
- Mainnet signing through near-connect (`signAndSendTransaction(s)`, `signMessage`) is unexercised: only mainnet has wallets (#10).
- 1Click: a `submit-intent` that moves funds (NEP-413 or ERC-191; the NEP-413 signature itself passes `simulate_intents`, E-024), a delivered payout to Base, and a real deposit from another chain (#11, after #10). 1Click doesn't check ERC-191 signatures at submit (E-019); the UI simulates first.
- A real EVM wallet's prompt (MetaMask shows the ERC-191 JSON as text) and the relayer on mainnet with a function-call key: unexercised until #10. Solana and passkey signers are not built (D-030).
- The `retry_payout` UI path: needs a failed payout to appear; the contract path is unit-tested (E-004).
- The refusals band on mainnet: no recorded hashes until #10; its cards say so until then. The archival read path is verified by curl, not yet through a mainnet build.
- The exercise net (1Click reference price) runs only on mainnet: the devnet has no price, so that path is unverified until a mainnet build (#10).
- `scripts/mainnet-deploy.sh`: its near CLI chains are checked with `--help` at every level but never sent (no funds). The hosted function has run only locally, as `vercel build` emits it.
- What a full storage balance blocks beyond new writes (D-035).
- Design debt (P3): material colours are literal oklch values; the route's stations trip the detector's nested-cards rule (deliberate, inside the control well); no sorting, search or batch claims on the board (the critique's Flexibility 2/4).

## Open questions
- Can one project place in several tracks? (user → NEAR Discord or Telegram, #3). The page only confirms multi-track tagging.
- Lock the contract account before submission? It keeps about 3.4 NEAR for good (D-036), and it makes "can't default" checkable in one command (D-035, #18). I recommend yes; the user decides at M3.
