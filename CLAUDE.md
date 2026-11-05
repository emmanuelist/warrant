# Warrant: build rules and pinned context

**Options that can't default and need no oracle: the collateral is locked inside NEAR Intents until expiry.** (D-014. Use this sentence verbatim on every surface.)

Built for NEAR HACKATHON, `defi` track (+`open`). Solo builder. Deadline **2026-11-14 23:59 UTC**.
Research and strategy are in `internal/research/DOSSIER.md` (gitignored). Read it for the *why*, never for current state.

## Repo layout

```text
contracts/options/   near-sdk-rs options contract + sandbox tests
web/                 frontend (Vite + React + TS) and the relayer (web/relay, web/api)
scripts/             ops scripts: deploy, demo runs, measurements
docs/                STATE, PLAN, DECISIONS, EVIDENCE, CONTEXT, SPEC, DESIGN
internal/            dossier, raw captures, spikes: gitignored, never commit
```

## Pinned versions (D-003)

| | |
|---|---|
| rustc | 1.97.1 via `rust-toolchain.toml` (D-008: the same toolchain that built the live `intents.near`). Project-local only; never change the global default. |
| near-sdk / near-contract-standards | 5.29.1 |
| Sandbox tests (D-010) | near-sandbox 0.3.16 + near-api 0.8.6 + cargo-near-build 0.11.0 (NEAR's `cargo near new` template stack) |
| cargo-near | 0.22.0 |
| near CLI | near-cli-rs 0.30.1 |
| Node | >= 22 |
| Frontend (D-016) | web/package.json, exact pins: React 19.3.0, Vite 8.3.4, Tailwind 4.3.3, TypeScript 6.0.3 (**not 7.x**: typescript-eslint needs <6.1), eslint 10.12.0 (**not 9.x**: EOL), near-connect 0.11.4; behaviour libraries (D-024): motion 14.2.0, @number-flow/react 0.6.2, @radix-ui/react-tooltip 1.4.1, @phosphor-icons/react 2.1.10; dev-only, never bundled (D-031): @noble/curves 2.4.0, @noble/hashes 2.4.0 |

## Rules

1. **No mocks, no fake data, no demo mode.** Every rendered value comes from mainnet: contract state for series and positions, `intents.near` for balances, 1Click for cross-chain status. The UI shows state read back from the chain after a transaction, never an optimistic guess.
2. **Verify every contract call and SDK method before writing it**, against `docs/CONTEXT.md`, the installed types or crate docs (docs.rs for the pinned version), or the `near/intents` source. If you can't verify a call, stop and say so. Hallucinated SDK surfaces are the most expensive failure in this build.
3. **Milestone-gated.** Build the current milestone in `docs/PLAN.md` only.
4. **Money is integers.** Amounts are `u128` in the token's smallest unit (yoctoNEAR, 1e-6 USDC) end to end. Convert at the UI boundary only. Never a float on-chain.
5. **Tests cover the failure paths**, not just the happy path: early reclaim refused, unauthorized exercise refused, late exercise refused, double exercise refused, wrong-token deposit refunded.
6. **No secrets in the repo.** Keys stay in `~/.near-credentials/`. `.env.example` lists names only. Never print a private key or seed phrase.
7. **No silent scope cuts.** Every cut is a DECISIONS entry with its technical reason.
8. **Mainnet spend (D-004):** mainnet only for the Intents path, with demo trades ≤ $2 each. Ask the user before any single spend above $5 or anything touching their personal wallet. Claude's own dedicated account signs the demo, so no step needs theirs (D-036).
9. **Outward-facing actions belong to the user.** Claude drafts the X post (it must tag `@NEARProtocol` and `#NEARHackathon`) and the submission payload. The user publishes the post and confirms the exact payload before `POST /api/applications`. A mistake in a saved submission goes through https://nearhackathon.com/request-changes, never a second submission.
10. **Build window (D-034):** the organizers count code from the announcement on 2026-10-19 (Q-001), and this project starts 2026-10-20. Say so plainly; never claim or imply the code post-dates 2026-11-01. Spike code stays in `internal/spikes/`.

## Verification before any gate

```bash
cd contracts/options
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo near build non-reproducible-wasm --abi-features abi
cargo test            # unit + near-sandbox integration tests (tests/sandbox.rs uses mainnet bytecode)
```

All green. CI (`.github/workflows/ci.yml`) runs the same steps.

```bash
cd web
npm run lint          # zero warnings
npm run build         # tsc + vite build
```

Local UI against real chain state: `cargo test --test devnet -- --ignored --nocapture` in `contracts/options` (writes `web/.env.development.local`, including the sandbox's public genesis key so the UI can sign as any devnet account, D-017), then `npm run dev` in `web/` and open `/?as=alice.sandbox` (board) or `/account?as=bob.sandbox` (account). UI design rules: docs/DESIGN.md.

## Current state
@docs/STATE.md

## Where things live
| Concern | File |
|---|---|
| Milestones and exit criteria | docs/PLAN.md (GitHub milestones mirror it once the remote exists) |
| Work items | GitHub issues (`gh issue list --repo emmanuelist/warrant --milestone "<current>"`) |
| Why we chose what we chose | docs/DECISIONS.md (append-only) |
| Proof that things work | docs/EVIDENCE.md (append-only) |
| Verified facts about dependencies, and traps | docs/CONTEXT.md. Read it before touching any integration. |
| Research and strategy | internal/ (gitignored) |

## Operating protocol
- **Start:** read the open issues for the current milestone and the last 3 entries of docs/DECISIONS.md. Say the next action back before starting.
- **Work:** one issue at a time, on a branch `<issue>-<slug>`. Each PR says `Closes #<n>` and carries its evidence.
- **Finish** (or `/foundation handoff`): append EVIDENCE and DECISIONS, update CONTEXT with anything verified, close issues with evidence links, rewrite docs/STATE.md, commit.
- **Truth rule:** never write a claim into STATE, README, an issue or a PR that wasn't verified this session. Write "unverified" instead.
- **Decisions:** never relitigate an accepted decision without new evidence. Supersede it with a new entry.
