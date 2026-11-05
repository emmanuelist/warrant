# Decisions
Append-only. To change a decision, add a new entry that supersedes it.

## D-001 · Build options on NEAR Intents for the `defi` track (+`open`) · 2026-10-20 · accepted
**Context:** NEAR HACKATHON has 13 tracks with $10K/$3K/$2K each and a $55K grand prize. The jury is mostly investors plus Claude Code and Codex. Solo builder, 14 build days. The user asked to optimize purely for winning, not for prior experience.
**Decision:** Build fully collateralized options whose collateral, premiums and payouts live inside `intents.near`. Collateral can come from any 1Click chain and payouts can go to any chain. Positions are Intents assets.
**Alternatives:**
- Agent swarm settlement (scored 18 vs 22). Runner-up, and the switch target under the kill rule.
- Agent charter / autonomous business (18). OutLayer already ships agent custody with caps, whitelists and multisig, and the agent tracks are the most crowded.
- Shared budgets on Sputnik/Trezu (13).
- Investment Thesis. Zero cost, but a lower ceiling. Recorded as the zero-spend fallback after the user's cost concern on 2026-10-20.
**Consequences:** Mainnet is required for the Intents path. Kill rule: if custody fails by 2026-11-03, switch to swarm settlement. On 2026-11-07, if 3 or more options-on-Intents entries exist, lead with the Intents-native position token.
**Evidence:** internal/research/DOSSIER.md §4–7 (saturation, candidates, feasibility, scoring); docs/CONTEXT.md.

## D-002 · Physical settlement, no price oracle · 2026-10-20 · accepted
**Context:** Pyth on NEAR has served no update since 2026-08-26, and its stored BTC/USD price is from 2026-08-25. Hermes requires an API key (HTTP 401), and the free-tier terms are unconfirmed. `priceoracle.near` returns null outside an `oracle_call`.
**Decision:** The holder exercises by paying the strike in the quote asset and receives the underlying from the locked collateral. If the option isn't exercised by expiry, the writer reclaims the collateral. No oracle anywhere.
**Alternatives:** Cash settlement with a Pyth push adds a gated, currently stale dependency and a per-settlement fee. A Rhea oracle requires the `oracle_call` flow with whitelisted reporters.
**Consequences:** Calls are covered by the underlying, and puts are secured by the quote asset. To exercise, the holder needs the strike amount, which can be funded from any chain via 1Click. Revisit only if a judge-facing need for cash settlement appears and an oracle is live.
**Evidence:** E-001.

## D-003 · Stack · 2026-10-20 · accepted
**Context:** We need to call `intents.near` (written in Rust with near-sdk) and implement NEP-245/NEP-141 receivers.
**Decision:**
- **Contract:** Rust, near-sdk and near-contract-standards 5.29.1, cargo-near 0.22.0, rustc 1.95.0 pinned in `rust-toolchain.toml` (project-local). Tests are unit tests plus near-workspaces 0.23.0 sandbox tests.
- **Frontend:** TypeScript + React + Vite, single screen, static deploy. Wallet via `@hot-labs/near-connect`. 1Click over REST (read the `@defuse-protocol/one-click-sdk-typescript` `.d.ts` before adopting it).
- **Ops:** near-cli-rs 0.30.1 plus scripts.
- **Version rule:** frontend packages are pinned at scaffold to exact versions published ≥ 7 days earlier. TypeScript 7.0.2 and React 19.3.1 were published on 2026-10-20.
**Alternatives:** A server framework (Next.js) is unnecessary because there are no server secrets on the core path. Changing the global Rust toolchain was rejected because it would affect the user's other projects.
**Consequences:** Reproducible WASM builds need Docker (M3 evidence). near-sdk 5.29.1 was published 2026-10-19; if builds break, try the previous patch and record it here.
**Evidence:** crates.io and npm metadata, near-sdk-rs README (MSRV), cargo-near release `cargo-near-v0.22.0`, all checked 2026-10-20 (docs/CONTEXT.md).

## D-004 · On-chain operations and funds · 2026-10-20 · accepted
**Context:** The user wants Claude to run accounts, the spike and demo trades, with the user only funding. The user is cost-sensitive.
**Decision:**
- Claude operates the implicit dev account `d0482bffd77daa246ff50cd36cd8c8392548a0cf0fc7d6ccd887a3675f084148`. Its key is in `~/.near-credentials/implicit/` (chmod 600) and is never printed or committed.
- The user funds 5 NEAR.
- Mainnet is used only for the Intents path; everything else runs on sandbox or testnet. Demo trades are ≤ $2 each.
- Claude asks before any single spend above $5.
- After 2026-11-18, withdraw all tokens and Intents balances first, verify the user's personal wallet exists on-chain, then delete the account with that wallet as beneficiary. Never use an exchange address.
- The X post and the submission are the user's actions.
**Alternatives:** The user deploys from their own wallet, which they rejected as too hands-on.
**Consequences:** Expected return is about 4.5–4.7 NEAR plus about $1 of USDC on Base. Measured costs are in docs/CONTEXT.md.

## D-005 · Repository history starts inside the build window · 2026-10-20 · accepted (revisit on organizer answer, #3)
**Context:** The rules say "Build your project during the hackathon" without saying how it's checked. AI judges can read git history.
**Decision:** Planning files exist on disk now. `git init` is done, but the first commit happens no earlier than 2026-11-01 00:00 UTC. Spike code lives in `internal/spikes/` (gitignored). No product code before the window.
**Alternatives:** Committing docs now gives earlier history but risks a judge reading pre-window commits as a rule breach.
**Consequences:** Until 2026-11-01 there is no git history, so sessions rely on the files on disk. If organizers confirm pre-window prep is fine, supersede this entry and commit.

## D-006 · Cuts for a solo build · 2026-10-20 · accepted
**Context:** One person, 13 build days plus a 1-day buffer.
**Decision:** The market-maker agent is cut unless M2's exit criteria are met by 2026-11-08 23:59 UTC. The frontend is one screen. Cash settlement is cut (D-002).
**Alternatives:** Keeping the agent for the `agents` tag and grand-prize narrative would put the M2 core claim at risk.
**Consequences:** We tag `defi` + `open` only, unless the agent ships.

## D-007 · GitHub: private repo created at the window, public before submission · 2026-10-20 · accepted
**Context:** The skill asks for a remote and a visibility choice. D-005 keeps all history inside the build window. A public repo shows the design to competitors, but judges need it public by 2026-11-14 23:59 UTC.
**Decision:** The user approved this on 2026-10-20. On 2026-11-01, create a **private** GitHub repo with the first commit, then set up labels, milestones and issues (migrating docs/ISSUES.md). Make it **public on 2026-11-13**, before the X post and the submission.
**Alternatives:** Public from day one (build in public) would show the open options lane to others during the window.
**Consequences:** No CI runs until 2026-11-01. The public flip is a p0 step in M4 (#11).

## D-008 · Build with rustc 1.97.1 · 2026-10-20 · supersedes the rustc line of D-003
**Context:** D-003 pinned 1.95.0 (near-sdk's stated MSRV). The NEP-330 metadata of the live `intents.near` shows it was built with `cargo-near 0.22.0` on **rust 1.97.1**, using **near-sdk 5.29.1** (its Cargo.lock at the deployed commit). NEAR's own `cargo near new` template pins 1.93.0, which conflicts with the README's MSRV of 1.95.
**Decision:** Pin `rust-toolchain.toml` to **1.97.1**, the exact combination behind a production mainnet contract. It stays project-local.
**Alternatives:** 1.95.0 (MSRV) is valid, but the mainnet-deployed combination is the stronger evidence.
**Consequences:** CI reads the version from `rust-toolchain.toml`. If a build breaks, compare against intents.near's build environment in docs/CONTEXT.md.
**Evidence:** E-002, E-003.

## D-009 · Collateral moves inside Intents; positions are our own NEP-245 tokens · 2026-10-20 · accepted
**Context:** IMT is behind a compile-time `imt` feature that the deployed `intents.near` (v0.4.5) was not built with (E-003). Third-party NEP-245 deposits into Intents are permissionless (155 such IDs, including a bare implicit account). `mt_transfer_call` notifies the receiver contract via `mt_on_transfer` and refunds whatever it returns. Deposit notifications on `ft_on_transfer` were removed in the deployed commit ("remove notifications on deposits", #374).
**Decision:**
- **Collateral in:** the writer calls `intents.near.mt_transfer_call(receiver_id = our contract, token_id, amount, msg = <action JSON>)` with 1 yocto. Our contract's `mt_on_transfer` (predecessor must be `intents.near`) records the write and returns the unused amounts for refund.
- **Settlement:** payouts are `intents.near.mt_transfer` from our contract (1 yocto) to the holder or writer. Funds never leave the Intents ledger. Users withdraw to any chain through Intents or 1Click.
- **Positions:** NEP-245 tokens issued by our contract, which holders can deposit into Intents and trade or transfer there.
**Alternatives:** IMT positions are impossible on today's deployment. Routing collateral through our own `ft_on_transfer` and re-depositing would add a hop and a failure point.
**Consequences:** The custody spike (#2) tests this exact path. If IMT ships on mainnet later, revisit the position format.
**Evidence:** E-003; docs/CONTEXT.md "NEAR Intents interface".

## D-010 · Integration tests use NEAR's current template stack · 2026-10-20 · supersedes the near-workspaces line of D-003
**Context:** D-003 named near-workspaces 0.23.0 for sandbox tests without running it. NEAR's own `cargo near new` template (cargo-near 0.22.0) instead uses **near-sandbox** (resolved 0.3.16) + **near-api** (0.8.6) + `cargo-near-build` 0.11.0 + tokio + testresult. That stack deployed the template wasm to a local sandbox and passed on this machine (E-002).
**Decision:** Scaffold `contracts/options` with `cargo near new` and keep its test stack and release profile (`opt-level = "z"`, `lto = true`, `panic = "abort"`, **`overflow-checks = true`**, which we keep for a money contract). Delete the template's own `rust-toolchain.toml` (1.93.0), nested `.git`, and `.github/workflows/*` (it ships deploy jobs). Our root `rust-toolchain.toml` and CI apply instead.
**Alternatives:** near-workspaces 0.23.0 is still published, but unverified here and not what NEAR's template uses today.
**Consequences:** Sandbox tests take about 40s each (the first build about 2.5 min). CI's `cargo test` downloads the sandbox binary.
**Evidence:** E-002.

## D-011 · Build starts now; commits start 2026-11-01 · 2026-10-20 · supersedes D-005's "no product code before the window"
**Context:** On 2026-10-20 the user instructed: start building the full product now, and commit only from 2026-11-01. The rule text is "Build your project during the hackathon", with no stated enforcement. Mainnet transactions are publicly timestamped regardless of git history.
**Decision:**
- Build the product now on the local sandbox and testnet.
- **No mainnet deployment of product code before 2026-11-01.** The custody spike (#2) is research and may run earlier.
- First commit and private remote on 2026-11-01 (D-007).
- Nothing we publish (README, X post, submission) will claim the code was written entirely after 2026-11-01.
- **Recommendation to the user:** a one-line README disclosure ("design and prototyping began 2026-10-20") unless organizers confirm pre-window work is fine (#3).
**Alternatives:** Waiting until the window (D-005 as written). The user rejected it.
**Consequences:** On 2026-11-01 the first commit will contain pre-window work. If a judge asks, the honest answer is in DECISIONS.

## D-012 · Contract design: single-writer series, American exercise, offers, owed-ledger · 2026-10-20 · accepted
**Context:** Pooled multi-writer series need pro-rata assignment, and early closes then transfer value between writers. A solo build can't carry that risk.
**Decision:**
- **One writer per series.** Fully collateralized. Physical settlement (D-002). American exercise until `expiry_ns`.
- **Writes, purchases and exercises** arrive as `intents.mt_transfer_call` to our `mt_on_transfer` (D-009).
- **Primary sales** are fixed-price offers with longs escrowed in the contract.
- **Positions** are NEP-245 tokens. Types and events come from `defuse-nep245` (git, pinned to deployed commit `16d04f6`, the same crate `intents.near` uses).
- **Token allowlist** with a minimum collateral per write, set by the owner, to limit storage-spam.
- **Failed payouts** are credited to an owed-ledger and retried by the recipient.
- Full spec: docs/SPEC.md.
**Alternatives:** Pooled series with an assignment index (fungible across writers). Cut: complexity and rounding risk.
**Consequences:** Positions are fungible within a series, not across writers. Known limitation: NEP-245 transfers to fresh accounts consume the contract's storage (no NEP-145 registration). Documented in SPEC "Limitations".

## D-013 · Kill rule passed in sandbox; the paid pre-window spike is dropped · 2026-10-20 · supersedes #2's mainnet spike plan
**Context:** The kill rule (D-001) asked whether a contract can custody and pay out balances inside `intents.near`. E-005 runs our real contract against **byte-identical** mainnet `intents.near` (hash-pinned) and proves every custody path. That includes deposit via `mt_transfer_call`, payouts via `mt_transfer`, refunds on refusal, and NEP-245 positions moving through Intents.
**Decision:** The kill rule passes, so the build stays (no switch to the runner-up). The throwaway mainnet spike is dropped. The first mainnet transactions will be the real deployment on 2026-11-01 (M1), so there's no product footprint on mainnet before the window (D-011). Funding (#1) is needed by 2026-11-01, not before.
**Alternatives:** Spending ~3 NEAR on a pre-window mainnet spike adds only mainnet config confidence (pause flags, live state), and M1 checks that anyway.
**Consequences:** Residual mainnet-only risks are the live Intents pause state, 1Click JWT requirements, and RPC behavior. They're checked in M1 with the first real transactions.
**Evidence:** E-004, E-005.

## D-014 · Name: Warrant. Thesis fixed verbatim · 2026-10-20 · accepted
**Context:** `/hackathon thesis`: one distinctive word, plus one falsifiable claim used verbatim on every surface. The user approved it on 2026-10-20.
**Decision:** The product is **Warrant**. A warrant is the right to buy an asset at a fixed price, and "to warrant" means to guarantee (every option is fully backed). The thesis, verbatim on the repo description, README subtitle, submission form and demo close:
> **Options that can't default and need no oracle: the collateral is locked inside NEAR Intents until expiry.**
Each clause is demonstrable: early collateral withdrawal is refused (can't default); settlement is physical (no oracle); the contract's Intents balance is one click away (inside NEAR Intents). "From any chain" stays out until the Base payout is shown (#11).
**Alternatives:**
- Writ (runner-up: elegant, but reads as law rather than finance).
- Ballast (taken by at least three crypto projects).
- Holdfast and Surety (describe only the guarantee, not the option).
**Consequences:** Code paths keep the functional name `options` (`contracts/options`, crate `options`, event standard `intents_options`) to avoid churn and stale evidence paths. The brand appears in docs, the UI and the submission.

## D-015 · Visual material: the signal-box interlocking · 2026-10-20 · accepted
**Context:** A new product (premium-product-design, Mode A). The obvious material for options (engraved certificates, guilloche, wax seal, vault door) was already used by Covault, the same builder's options product on Stacks.
**Decision:**
- Derive the material from "what does can't-default feel like": a railway interlocking, where conflicting moves are mechanically impossible.
- Signatures:
  - the Interlock (lever frame = the contract's state machine for this viewer, lock captions = the contract's refusals in the contract's own check order)
  - the Route (funds resting inside the Intents block)
  - the locked amount as a rolling hero figure
- Light enamel board, Archivo (width axis) + Martian Mono.
- Full system: docs/DESIGN.md.
- The user later asked to go beyond the skill's bounds for an exceptionally polished site, so the elevation pass (refusals section, odometer, arming, flow, scoped view transitions) is recorded in DESIGN.md "Elevation pass".
**Alternatives:** Engraved certificate (Covault's identity); a generic dark DeFi dashboard (template).
**Consequences:** Every new UI element must justify itself in this vocabulary (free/locked/released, lever enamels). Don't relitigate without new evidence from renders or judges.

## D-016 · Frontend pins differ from D-003's candidates · 2026-10-20 · refines D-003
**Context:** Peer ranges checked at scaffold time.
**Decision:**
- **TypeScript 6.0.3, not 7.x:** typescript-eslint 8.71.2 requires `typescript >=4.8.4 <6.1.0`.
- **eslint 10.12.0, not 9.x:** npm marks eslint 9.39.5 "no longer supported", and the rig rules forbid EOL versions. `@eslint/js` (9.x only) is dropped.
- **Radix dropped:** native `<dialog>` with `showModal()` covers focus, Esc and top layer (modern-web-guidance).
- **Exact pins:** react/react-dom 19.3.0, vite 8.3.4, tailwindcss 4.3.3, @hot-labs/near-connect 0.11.4, fontsource Archivo / Martian Mono 5.3.0. Every pin was published at least 7 days before 2026-10-20.
**Consequences:** web/package.json is the source of truth for versions. CI runs lint + build (which includes `tsc`).

## D-017 · A devnet signer, so every UI action runs for real before mainnet · 2026-10-20 · refines DESIGN.md "Data truth"
**Context:** Wallets exist only on mainnet and testnet (CONTEXT.md, web traps), so the devnet board could show actions but not send them. That left every transaction the UI builds (args, deposits, gas, multi-action batches) and the authored moment (a refused pull) unexercised until mainnet, where mistakes cost real money.
**Decision:**
- `tests/devnet.rs` writes the sandbox's **public** genesis key (`near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY`, which every devnet account shares) into `web/.env.development.local` as `VITE_SANDBOX_SIGNER_KEY`.
- `web/src/lib/devnetSigner.ts` (lazy chunk, ~1.6 KB) signs borsh `Transaction`s with WebCrypto Ed25519 and sends them with `send_tx` (`wait_until: FINAL`). The header's "View as" becomes "Act as".
- Read only when `VITE_NETWORK=sandbox`. Production builds load no `.env.development.*`, so the key can't reach `dist` (checked: E-007).
**Alternatives:** near-api-js just for the devnet (heavy dependency for a dev path); keep the devnet read-only (leaves the UI's calls unproven until mainnet).
**Consequences:** Every action in the UI was executed against byte-identical mainnet Intents (E-007). Mainnet signing still goes through near-connect and is verified only after the deploy (#10).

## D-018 · Cross-chain through 1Click, without a partner key · 2026-10-20 · resolves the JWT question in D-013 and #11
**Context:** Live checks (E-007): quotes, `generate-intent` and `submit-intent` all answer without a key; the docs say unauthenticated quotes carry an extra fee; CORS is `*`.
**Decision:**
- The browser calls 1Click directly. No backend, no key to protect.
- **In from another chain:** non-dry `ORIGIN_CHAIN` quote (recipient = the viewer, `recipientType: INTENTS`), show the deposit address, poll `/v0/status`, optional `/v0/deposit/submit`.
- **Out to another chain:** non-dry `INTENTS` quote, `generate-intent` (NEP-413), the wallet signs a message (`signMessage`), the signature is converted to `ed25519:<base58>`, then `submit-intent`. If Intents doesn't know the wallet's key (`has_public_key`), one `add_public_key` transaction comes first (named accounts).
- Transfers started in the browser are remembered in `localStorage` (deposit address and labels only); status is always read live.
**Alternatives:** A partner key behind a backend (adds a server, saves only the extra fee on demo amounts); on-chain `mt_transfer` to the deposit address (undocumented for `INTENTS` quotes).
**Consequences:** The fee is inside every quoted `amountOut`, and the UI says so. Mainnet-only: on the devnet those tabs say why they're off. A valid `submit-intent` and a real Base payout remain to be shown (#11).

## D-019 · Two views and deep links, no router library · 2026-10-20 · accepted
**Context:** "Full-fledged" needs an account surface beside the board, shareable series links (the X post), and reloads that work on any static host.
**Decision:** `/` (board) and `/account` via the History API (`web/src/lib/route.ts`, ~90 lines), root View Transitions where supported; `?series=<id>` selects a series (and opens its sheet on phones); `?as=` keeps the devnet account. The build emits `account/index.html` (a copy of the shell), so no host rewrite rules are needed. Link-preview tags get an absolute `og:image` only when `VITE_SITE_URL` is set.
**Alternatives:** react-router (a dependency for two routes); hash routes (clash with the `#board` / `#refusals` anchors).
**Consequences:** Adding a third view means adding its shell copy in `vite.config.ts`.

## D-020 · Account page: the custody route as columns; a payoff chart with no oracle · 2026-10-20 · extends D-015
**Context:** The account surface has to answer "where is my value, and what can I do with it" in the interlocking's vocabulary, not as a generic portfolio dashboard.
**Decision:**
- The account ledger's columns **are** the stations of the route: your wallet → NEAR Intents (yours) → Warrant (committed), with the track arrows (deposit/withdraw, lock·pay/release·deliver) as column heads. Rows are tokens, then positions. Every action sits in the station it moves value out of. On phones the stations collapse to one word each.
- Writer claims use the lever plates themselves (enamel when free, spare white with the lock caption when not), and a locked plate opens "Test the lock" exactly like the board.
- Each series gets a payoff-at-expiry chart built by the dataviz method: one 2px line, solid hairline axes, a 10% `live` wash only where the holder profits, direct labels (strike, break-even, max loss), a snapping crosshair with keyboard control, and a table twin. The premium is the best open offer. On mainnet a dashed 1Click reference price is drawn and labelled as a reference; it never settles anything.
**Alternatives:** A card-per-asset portfolio (template, and it hides the custody story); a chart with a live price feed (contradicts the thesis).
**Consequences:** New account features must live in a station column or under it. Renders: docs/renders/account-*.png, payoff-*.png.

## D-021 · Borrow three professional patterns: read the call, lead with the readout, track by step · 2026-10-21 · extends D-020
**Context:** The user asked which professional products to study. Captured and studied (DESIGN.md "References"): Robinhood's P/L chart, Wise's transfer tracker (documented behaviour; no public screenshot exists), Safe{Wallet}'s transaction review, Deribit's options chain.
**Decision:**
- **Safe → "What you'll sign"** in every sheet: each transaction's receiver with its role, each method with its deposit and decoded args (Warrant's `msg` as the action it encodes), a Decoded/JSON toggle of exactly what goes to the wallet, and "compare with your wallet". Forms now build their exact calls up front (NEP-145 registration is read as you type), so the panel shows what `send` signs, not a summary of it. The cross-chain withdrawal generates its NEP-413 message at quote time and shows it decoded before signing.
- **Robinhood → the payoff readout leads:** a plain sentence at rest ("Profits if 1 wNEAR is worth more than 5.22 tUSDC at expiry"), the value under the crosshair while exploring, and Max loss · Break-even · Max profit chips that snap to those points. Break-even is computed with integers (`web/src/lib/payoff.ts`) and also appears on the Buy sheet.
- **Wise → a step timeline** for 1Click transfers: plain step names (progressive while waiting), 1Click's own `updatedAt` for each step as first seen, "send before" and "usually ~N s" estimates, and refund/failure steps that say where the money went.
- **Deribit:** deferred. A chain layout pays off only with many strikes per expiry on mainnet.
**Alternatives:** Adopting a reference's look (Robinhood's green/orange, Deribit's dark terminal): rejected, the interlocking stays (D-015).
**Consequences:** Every new sheet must pass its calls through `Review`. Mainnet-only paths (message review, timeline end states) were rendered with live 1Click data in a dev harness; their success and refund states are confirmed only after #11.

## D-022 · The control panel as a second surface; type roles; no eyebrows · 2026-10-21 · supersedes D-015's depth and colour-dosage rules
**Context:** The user judged the full build "completely flat". It was: D-015's rules (no cards, no shadows, colour only as small accents) left about 2% of the page in colour. About twelve ad-hoc type sizes sat between 10 and 15px, and every section had the same cadence on one surface. impeccable's craft floor also ruled out patterns the build used: eyebrow labels above headings, uninformative section numbers, the big-number-plus-side-stats hero, and a coloured left bar for selection.
**Decision:**
- Keep the interlocking world (D-015). Add its own dark surface, the illuminated mosaic NX panel (tokens in DESIGN.md), for the openings, the series instruments and the refusals. Enamels gain lit variants for the panel.
- The hero is the thesis in display type plus the Route at system scale (Writers ⇄ NEAR Intents ⇄ Holders, lit from chain totals), with the locked amount inside the white station plate; the account page opens the same way at account scale.
- On the panel, locked lever plates go dark and free ones keep their enamel (iron shows white), so the free levers light up.
- Type roles replace ad-hoc sizes (prose 16px, rem 15px); no eyebrows, no section numbers; selection is a ring, plus a phase lamp per row; browser surfaces themed.
**Alternatives:** A dark theme toggle (a theme is a mood; the panel is a material object with a job), or brighter accents on the existing light page (more chips, still flat).
**Consequences:** DESIGN.md "Tokens", "Typography", "Space, surface, depth" and "Layout" are rewritten; "Depth pass" records why. Renders: docs/renders/v3-*.png.

## D-023 · Type follows the reader: rem roles on a percentage root, metric-matched fallbacks, preloaded faces · 2026-10-21 · refines D-022
**Context:** The user asked "what of typography?" after D-022. The typeset assessment, run with computed values, found:
- A hard 15px root and px roles that ignored the reader's own font-size setting.
- One-off headline clamps instead of named roles.
- No balanced wrapping, and uncompensated light-on-dark text.
- Monospace used for words, not just data.
- Unpreloaded faces swapping in over a fallback with different metrics.
**Decision:**
- Root at 93.75% (15px by default) with every role in rem.
- Named display roles (`display-1/2/3`, `claim`, `h2`).
- `text-wrap: balance` on headings and `pretty` on paragraphs.
- Weight 430 with extra tracking and leading on the panel.
- Monospace only where the text contains data.
- The build preloads the two Latin woff2 files.
- "Archivo Fallback" and "Martian Mono Fallback" faces use size-adjust and ascent/descent overrides measured in Chromium against the loaded faces.
**Alternatives:** Keep the px root (simplest, but fails readers who enlarge text); fontaine-style automatic fallbacks (another dependency for two faces measured once).
**Consequences:**
- Breakpoints are in rem, so a larger reader font moves the page to its tablet or phone layout earlier, which is the intended behaviour.
- Verified with Chromium's real default-font setting at 16, 20 and 24px across 390, 1024 and 1440 (E-010).

## D-024 · Behaviour off the shelf: Motion, NumberFlow, Radix Tooltip, Phosphor; the levers load after first paint · 2026-10-21 · extends D-016
**Context:** The user asked whether libraries could lift the UI ("idea and execution do not do it alone without the best UI"). Take behaviour off the shelf, keep the look ours.
**Decision:** Four libraries, each for one job (exact pins, all published at least a week before adoption):
- **motion 14.2.0:** the physical levers (`Lever.tsx`). Springs for arming, hover lift, drag-to-throw, the bolt's rubber-band stop and the refusal kick; click and keyboard keep working. The drag writes with `MotionValue.jump()` so the hand overrides any spring still running.
- **@number-flow/react 0.6.2:** chain figures roll to new values (dial and station figures, custody balances) and countdowns tick digit by digit. The exact decimal goes in as a string; no float touches an amount.
- **@radix-ui/react-tooltip 1.4.1:** lever help (what it does; when bolted, the lock and the exact `ERR_*`), portalled into a modal's top layer when the frame is inside one.
- **@phosphor-icons/react 2.1.10:** external-link, caret, arrow and copy/check icons replace text glyphs; external links also say "(opens in a new tab)" to screen readers.
- Motion and Radix (about 170 kB minified) are used only by the levers, which sit below the fold, so `LeverFrame` and `Refusals` are lazy chunks. The main chunk went from 588 kB to 388 kB (115 kB gzip), under Vite's warning.
**Alternatives:** Styled kits (MUI, Chakra, shadcn defaults): someone else's identity. Hand-rolled springs and tooltips: weaker behaviour and accessibility for the same code size.
**Consequences:** The hero must not import Motion: the dial's tilt is a small rAF ease on CSS variables. Figures under reduced motion show their value at once.

## D-025 · Studio light: the vault's time lock replaces the signal box · 2026-10-21 · supersedes D-015's material, D-022's surfaces and D-023's faces
**Context:** The user's verdict on the signal-box build: "what you have built UI-wise is not making me feel it", asking for "Web3 / DeFi / crypto application: premium, cinematic, interactive". When Claude proposed a dark, lume-on-black world, the user corrected: "not all DeFi apps are dark".
**Decision:**
- **Material:** a bank vault's time lock, which can't be opened early, not even by its owner: the thesis as an object. Shot in studio light: a polished bezel, white lacquer with a sunburst, blued-steel markers and bolts, a sapphire glare, film grain.
- **Signature 3, the Lock Dial:** the hero's centre and the system route's station. Every live series sits on a log-time ring by when its lock opens, a blued arc runs to the next one, markers open their series, and the centre holds the locked total and the clock to the next release. It tilts toward the pointer, the light turns on the bezel, and it sets itself on load. The Interlock and the Route stay, rebuilt in the new material (white keys with lit dots; bolts across locked slots; the vault as the Route's one dark object).
- **Light by default; one night band.** The refusals and the footer re-light the same token roles dark through a `.night` scope, so no component chooses a theme.
- **Type:** Mona Sans alone carries the voice (expanded for headlines and dial printing, normal width for reading), with Atkinson Hyperlegible Mono for figures. Big Shoulders and the condensed signage are gone. D-023's rem roles, 11px floor and metric-matched fallbacks stay.
- **Surfaces:** pills, soft radii, layered studio shadows, cards where something is raised (the series list as one card, the trade card, sheets), a glass header on wide screens.
- **Link preview:** the verbatim thesis beside the real dial face (`DialFace`, no chain figures).
**Alternatives:** Dark "cinematic crypto" (the user rejected dark-by-default); keeping the signal box with more effects (the material itself read as retro); a 3D WebGL hero (heavier, harder to keep true to chain data, and the dial in CSS/SVG already turns with the light).
**Consequences:** DESIGN.md is rewritten for the new world. Renders: docs/renders/v4-*.png. The design detectors' remaining notes are deliberate (truncated writer names carry a title; Mona Sans is a deliberate single family).

## D-026 · No effect kits or second animation system; one scroll-told section, "How the lock holds" · 2026-10-21 · extends D-024, D-025
**Context:** The user shared a frontend toolkit guide (`see.md`: Motion, GSAP, Aceternity UI, Magic UI, React Bits, shadcn/ui, React Three Fiber, stock imagery, Next.js) and asked for a verdict. Its principles and validation workflow were already in use; its one real gap for Warrant was scroll storytelling. An inspiration pass followed (DESIGN.md "References").
**Decision:**
- Skip the effect kits (spotlights, glowing cards and shimmer buttons read as template to judges), GSAP (a second animation system beside Motion and CSS), React Three Fiber and Spline (three.js alone outweighs the whole main bundle; canvas text is invisible to assistive tech), stock photos, Lottie and generated blobs (they contradict "every figure is read from chain"), shadcn/ui (native dialogs and Radix already do its job) and a move to Next.js (risk three weeks out).
- Add one section, **"How the lock holds"**, from the pass: Mercury's and Apple's pinned scroll stage, Increase's mechanism in motion, Morpho's code as proof. Three steps (Written, Holding, At expiry) each quote the contract line that enforces them (`series.collateral_held = locked;`, `require!(series.is_expired(now), ERR_NOT_EXPIRED);`, `now_ns >= self.expiry_ns`). Beside them the dial is pinned, and scroll runs one lock's clock: it drops in a week out, travels while a Reclaim pull is refused, and at the index the interlock flips. Built with Motion's `useScroll`, lazy-loaded with the levers' shared Motion chunk. A diagram of the contract, so it shows no chain figures.
**Alternatives:** A scroll-scrubbed video (heavy, and not true to the product's own object); scroll-driven CSS alone (the steps need state, and the clock needs its own reading of the scroll); a static "how it works" grid of three cards (template, and no sense of time passing).
**Consequences:** The header gains a "How it works" link. Renders: docs/renders/v4-story-*.png.


## D-027 · Critique fixes: refusals read back by hash, a primary move ahead of the Interlock, expiry presets with a dial preview · 2026-10-21 · extends D-021, D-025, D-026
**Context:** A dual-agent impeccable critique scored the web app 27/40, and the audit 15/20. Two P1s:
- sheets let you sign transactions the UI already knew would fail;
- the refusals band claimed a live pull ("Pull again") that only replayed an animation.

Three P2s: nothing navigated to the board; the trade card was flat, and its route rendered at 6.5–8.7px on desktop; several labels misled. The user chose, for the three product questions: real hashes plus "Send one yourself"; a primary action ahead of the Interlock; expiry presets with a dial preview. They also asked about colour; the payoff chart's sign colours follow.

**Decision:**
- **Refusals band.** Each card reads a real refused transaction back from chain by its hash (`tx` RPC). It shows:
  - the contract's `ERR_*`, from its failed receipt;
  - Intents' refund, from its NEP-245 `mt_transfer` with memo "refund";
  - the sender and the block's time.
  The hashes are pointers in `VITE_REFUSAL_TXS` (`id:signer:hash`). `tests/devnet.rs` writes them on the devnet; the demo run writes them on mainnet. Old hashes need an archival node (`config.archivalRpcUrl`; FastNear archival on mainnet). "Send one yourself" opens Test the lock on a lever that is bolted for this viewer. "Replay" only replays the kick. A card with no recorded hash says so.
- **Trade card.** The viewer's likely move becomes one primary key above the Interlock, which stays the full set: claims for the writer, Exercise for a holder, the best offer for anyone else. Offer rows get Buy or Cancel. On a phone the key docks at the bottom of the series sheet. The series Route is rebuilt from the system route's HTML parts, so every figure stays at 11px or more.
- **Sheets.** Counts are bounded by holdings, the offer, and the Intents balance (shown, with Max). Errors are tied to their field. Your own offers point to Cancel. Write bounds the expiry to the contract's window: 1 minute to 366 days, taken as 2 minutes at the near end to leave time to sign. It offers 1 hour / 1 day / 1 week / 1 month presets and a dial showing where the new lock lands.
- **Colour.** The payoff's sign uses the state hues: `--gain` (the live green) and `--loss` (the refuse red). Never as text; always with position and a label. Its line splits exactly at zero. Plates on green take dark ink. Story steps dim by ink, never by transparency.

**Alternatives:**
- Rewording the band only: no live proof.
- A live pull from the band itself: it needs a lever bolted for that viewer anyway, so it routes through Test the lock.
- Levers as the only way to act: seven equal keys.
- Dragging on the dial to set expiry: more distinctive, much more build; the preview keeps the dial in the decision.
- Compacting the board's figures to fit 1280px: DESIGN.md keeps 6 fractional digits.

**Consequences:**
- The devnet sandbox keeps its whole history (`gc_num_epochs_to_keep` 100,000; the default keeps about two minutes).
- The mainnet demo run (#10) must send the three refusals and set `VITE_REFUSAL_TXS` for the production build.
- Between 1280 and 1440px the board folds its best-offer column into "Locked · open".
- The running clocks subscribe to a one-second chain-clock store; the rest of the app updates on chain reads and at the next expiry.

## D-028 · Second critique: a pinned card with a bench below, commits that say what moves, "Your move" in words, a dial readout · 2026-10-21 · extends D-027
**Context:** The re-run critique scored 29/40, up from 27; the audit stayed at 15/20. Two P1s remained:
- At 1440 the trade card was 1,458px tall beside a 379px list, so it couldn't stay pinned and about 760px of the left column sat blank.
- The signing moment spoke metaphor and raw units: "Pull · Buy", and Write's review printed `expiry_ns` in nanoseconds.

Three P2s: dial labels collided with the printed scale; the "You" lamps were a code; and edges broke (a 64-hex account overflowed a phone, and a visitor's sheet dead-ended). The user chose:
- the card fits, with a band below;
- verb plus amount;
- your move, in words.

**Decision:**
- **Layout (≥ 1024px).**
  - The pinned card holds what you act on: the terms, the likely move, the offers (four shown, the rest counted) and your position.
  - A full-width bench below the list and card holds the series' machinery: the route of funds and the Interlock, beside the payoff chart.
  - The phone's series sheet keeps everything in one column, with the move docked.
- **Commit language.** A commit button names the verb and what moves: "Exercise 1 · pay 4.80 tUSDC", "Lock 1.00 wNEAR until 28 Oct 18:07 UTC". "Pull" stays on the levers and on Test the lock. The review decodes Warrant's `msg` into labelled rows (amounts in their tokens; expiry in UTC and "in 7 days"); JSON keeps the raw values. While a count can't be sent, the review stays in place, dimmed, instead of collapsing.
- **"Your move".** The board's last column says the viewer's likely move ("Claim 4.80 tUSDC", "Buy at 0.35", "Exercise · 7 held"), with its lever's lamp, and shows on phones too. The seven-lamp strip lives only in the Interlock. From 1280px the best offer folds into "Locked · open", since the move already names it for a buyer.
- **The dial's readout.** Lock markers carry no labels on the ring. The centre reads out the lock you point at or focus, and otherwise the next to open: "#2 · 16.80 tUSDC · 23 Oct 16:55" under its clock. Nothing can cover the printed scale or the total.
- **Edges and access.**
  - A sheet with no one to send it offers the devnet's accounts (`VITE_DEVNET_ACCOUNTS`, holders included) or a wallet connect inline.
  - Long account IDs are shortened everywhere.
  - A skip link lands on the board or the account.
  - Countdowns are spoken as words.
  - Chart text is at 11px.
  - Account actions have 44px hit areas.
  - Phone rows give the writer a full-width line.

**Alternatives:**
- Flip the split to 5/7: the card stays long, and the list loses columns.
- Keep "Pull" with amounts: the metaphor still sits on the irreversible step.
- A time-to-release mark per row instead of a move: more distinctive, but it repeats the dial and still hides what you can do.
- Labels outside the ring with leader lines: they collide with the hero's route tracks.

**Consequences:** `Detail.tsx` splits into `DetailCard`, `DetailBench` and `DetailSheet` over one shared view of the series. `tests/devnet.rs` writes `VITE_DEVNET_ACCOUNTS`. The board's lamp legend is gone.

## D-029 · Third critique: whether exercising pays, an inline top-up, lamps that show state, a shorter phone · 2026-10-21 · extends D-027, D-028
**Context:** The third run (a fresh reviewer) scored 28/40; the trend is 27 → 29 → 28. The audit rose to 16/20 on performance. The P1s:
- Exercise was recommended to every holder without checking that it pays.
- A short balance dead-ended as a red count error saying "Deposit first." with nowhere to go.

The P2s: the levers and the board contradicted the sheets; lamp colours broke "blue means locked"; and on a phone the board was about four screens away. The user chose:
- show the net and demote Exercise when it loses;
- an inline top-up;
- lamps that show state only;
- compress the phone hero and reorder the sheet.

**Decision:**
- **Whether exercising pays.** On mainnet, the card and the Exercise sheet show 1Click's reference price (indicative, never used for settlement) and what one option would net (`lib/reference.ts`). When the net is negative:
  - the sheet warns;
  - `likelyMove` offers List first;
  - the board's "Your move" follows.
  The devnet has no price feed, and both say so.
- **Top-up in place.** A short balance is a gap, not a field error:
  - a notice shows what's needed against what's held, with "Deposit <shortfall>";
  - the deposit sheet opens pre-filled;
  - "Back to …" returns to the same action with the count, or Write's whole draft, as typed.
- **Lamps show state.** Lit means free for you, hollow means bolted, in one ink. Function colour stays only on the sheet's header plate, so blue means locked everywhere again.
- **Honest board.**
  - Buy on your own offer stays free (the contract allows it), captioned "only your offers"; its sheet routes to Cancel.
  - Expired series show no offers. The series panel marks its offers "closed at expiry".
  - The amount's word follows the phase (locked / released / returned) and longs read "lapsed" after expiry.
  - One verb, "Claim", for proceeds.
  - "Test the lock" titles name the series.
  - The story's stamp is outlined and worded as a diagram ("The chain would refuse").
- **No re-send.** A sheet reads its series live from the chain, and once a send settles it stops with "Sent and settled. Reopen the sheet to send another."
- **Phone.**
  - The hero folds Writers → Intents → Holders into one line under the dial, and the backing chips into one "Backed 1:1" verdict (per-token proof one tap away).
  - The story's steps are shorter.
  - The series sheet shows terms, offers and position before the route and levers.

**Alternatives:**
- Never recommend Exercise: hides the right a holder paid for.
- Only a link to the account page: you leave the sheet and lose what you typed.
- Keep function colours with a key: the clash with the state colours stays.
- Reorder only the phone sheet: the board would still be about four screens away.

**Consequences:**
- `Payoff.tsx`'s reference hook moved to `lib/reference.ts`, shared by the card, the sheet and the board.
- The mainnet path for the exercise net is unverified until a mainnet build (#10).

## D-030 · Wallets from other chains act on Warrant through signed intents · 2026-10-26 · accepted · extends D-001, D-018
**Context:** NEAR's launch article links Illia Polosukhin's idea list, whose distribution advice is to "support every wallet". Aurora's Intents Connect can't do that for Warrant, because NEAR is not yet a destination ("Coming soon"). `intents.near` itself verifies EVM (`erc191`), Solana (`raw_ed25519`), passkey (`webauthn`), TON, Stellar and Tron signatures, and a signer's Intents account is its own address. The spike (E-016) ran in the sandbox against mainnet bytecode and an unchanged Warrant:
- an EVM key with no NEAR account writes, buys and exercises through relayed `transfer`+`msg` intents;
- refusals are refunded in full;
- `auth_call` reaches `on_auth` with the signer's address.

1Click quotes deposits into a `0x` Intents account and generates `erc191` exits. The user chose full adoption.

**Decision:**
- **Contract (#15).** `on_auth(signer_id, msg)` is accepted only from `intents.near`. It runs the direct actions with `signer_id` as the actor: list, cancel_offer, close, withdraw_proceeds, reclaim_collateral, retry_payout, and moving longs into Intents. The direct methods keep working for NEAR accounts, and both paths share one implementation. Tests cover the failure paths: a caller other than Intents, a bad `msg`, and every existing refusal through `on_auth`.
- **Relayer (#16).** A small stateless handler takes one signed payload and sends it only if it touches Warrant alone: a `transfer` with a `msg` to the options contract, or an `auth_call` to it. It must also name this network's `verifying_contract`, carry a near deadline, and pass a `simulate_intents` preview. It sends `execute_intents` with a function-call key limited to `intents.near` / `execute_intents` and a capped allowance. It decides nothing and holds no funds. Hosting is decided together with the web hosting at #10; it is outward-facing, so it's the user's call. On the devnet the UI relays with a devnet account (D-017).
- **UI (#17).** An EVM wallet (EIP-6963 discovery, `personal_sign`) is a viewer like a NEAR account, and its account is its lowercase `0x` address. Each sheet:
  - builds the intent;
  - shows the exact payload in "What you'll sign";
  - subtracts 27 from v;
  - uses a V1 nonce (salt from `current_salt`);
  - reads the result back from chain.

  Deposits and exits go through 1Click: `recipientType: INTENTS`, and `generate-intent` with `standard: erc191`.
- **Order:** #15 → #16 → #17. EVM first. Solana and passkeys only if time remains, and nothing published claims them until then.

**Alternatives:**
- Holders only, with no contract change. A `0x` writer couldn't reclaim collateral, so writing would have to stay NEAR-only.
- Aurora Intents Connect: no NEAR destination yet.
- Not now. That leaves the idea list's advice and the strongest cross-chain demo beat unused.

**Consequences:**
- The relayer has a hot key, limited to one method with a capped allowance and never in the repo (rule 6).
- New unverified items: a real wallet's signature in the browser, a valid 1Click `erc191` `submit-intent`, and the relayer on mainnet.
- About 2.5–3 build days inside M2. The README names the signing standards used, as the launch article asks.

## D-031 · EVM wallets in the interface · 2026-10-26 · accepted · extends D-030, D-017, D-027
**Context:** #17 built D-030's interface. These choices were made while building and verifying it.

**Decision:**
- **One seam.** `send()` turns an EVM account's calls into intents (`intentOf`), has the wallet `personal_sign` them, and has the relayer send them, so every sheet and the account page work unchanged. Calls with no intent form are hidden for an EVM account rather than refused: wrap-and-deposit, withdraw to a NEAR wallet, and plain token sends inside Intents.
- **Connect.**
  - "Connect wallet" opens a small menu: the NEAR wallet, then each EIP-6963 wallet with its own icon, or an honest "No EVM wallet in this browser". One sentence states the model.
  - The same options appear inside a sheet that has no one to send it.
  - One connection at a time. An EVM session is restored on reload without a prompt.
  - An EVM account carries an "EVM" text label. No new colour: colour stays with the mechanic.
- **Review.** "What you'll sign · a message (ERC-191), not a transaction" shows the signer, Intents, and each intent decoded, with amounts read in their token and then exactly as signed, plus the deadline and nonce rules. The JSON view is the exact envelope.
- **Money in and out.** An EVM account deposits and withdraws through 1Click only, and its wallet station reads "on its own chain". 1Click doesn't check ERC-191 signatures at submit, so the UI simulates the signed exit on Intents first.
- **Clock.** The UI and the relayer set and check deadlines in chain time, because a seeded devnet runs ahead of the wall clock.
- **Devnet.** An EIP-1193 test wallet for the tests' public key, served by the dev server only (like D-017's genesis key), lets the board act as the funded 0x wallet through the production path.
- **Weight.** The connect options, the ERC-191 review and the signing module load on demand. The main chunk grows 4.8 kB (404.2 → 408.9 kB).
- **Found while verifying.** At 768px a refusal card's text column was 95px wide, and an RPC error word widened the page. The cards now go three-across from 1024px, and their status lines wrap anywhere.

**Alternatives:**
- A sheet for connecting: heavier than a menu for a two-choice task.
- wagmi or viem for the EVM side: a large dependency for discovery and one RPC method.
- Signing for the devnet's 0x account inside the app without EIP-1193: it would skip the path real wallets take.

**Consequences:**
- Unverified until mainnet: a real wallet's prompt (MetaMask shows the JSON as text), a valid ERC-191 exit through 1Click (#11), and the relayer's hosting (#10).
- Dev-only dependencies, exact-pinned and never bundled: `@noble/curves` and `@noble/hashes` 2.4.0.

## D-032 · Colour worn generously: enamel actions, signal lamps, state inks, studio gels · 2026-10-26 · accepted · supersedes D-029's "lamps in one ink" and DESIGN's "the primary action is a black pill"
**Context:** The user's verdict: "You haven't been using colors well in the UI. It's not decorative enough." Measured before the change, the interface was about 90% neutral. Colour appeared only as small accents: blue LOCKED chips and dial markers, the sheet's header plate, dashed tracks, and red stamps in the night band. The two rules that drained it were "the primary action is a black pill" and lamps "in one ink" (D-029).

**Decision:** No new hues: the palette stays the mechanic's (lock, live, release, deliver, refuse, iron). It is applied generously:
- **Enamel actions.** The sheet's commit, the card's primary key and the header's Write wear the enamel of what they do: lock (Write), live (Exercise), release (Close, Reclaim), deliver (claims), iron (trades and transfers), refuse (Test the lock).
- **Signal lamps.** Lit green when a lever is free, a red ring when it's bolted (the chain would refuse it). They carry state, not function, so blue keeps meaning locked; the cause D-029 fixed stays fixed.
- **State inks.** Locked collateral in blued steel, released in amber; on the card, what a holder pays in green, what they receive in brass, the closing clock in blue; on the account, proceeds in brass and owed amounts in red. "Your move" is a chip in its lever's enamel.
- **Atmosphere with meaning.** The stage has two studio gels, blued steel from the writers' side and brass from the holders' side, as the route flows across it. Terminals are lettered by side. Sheet headers are washed in their action's enamel. The refusals band gets a red warning light, and the footer a brass hairline.
- **Legibility.** New text inks (6:1 or more) and a deep green that carries white (5.45:1). Tints mix in OKLab, because OKLCH dragged them to pink. A refusal's stamp lands without a transition.

**Alternatives:**
- New hues or gradients: rejected; colour must keep meaning the mechanic.
- Colour by option kind (call or put): rejected; a kind isn't a state.
- Lever rods painted by function, as in a real signal box: rejected; they compete with the blue bolts and the lamps.

**Consequences:**
- Verified on the devnet: axe 0 violations on six surfaces, impeccable detect 0 anti-patterns (the two deliberate advisories remain), no overflow at 390 / 768 / 1024, and contrast computed for every new ink and fill.
- The detector's checks also caught two pre-existing night-band issues, fixed here: the refused plates' zero-offset red halo, and their 85%-white numeral.

## D-033 · The Lock Dial's heat-blued centre; outlined iron chips · 2026-10-26 · accepted · extends D-032, D-026
**Context:** After D-032 the user asked for my view. My verdict: the hero object, the first thing a judge sees, was still grey steel, because the colour sat at the stage's edges. The "Buy" chips also read as disabled. Painting the levers by function was the literal signal-box look the user rejected on 2026-10-21. The user agreed: dial and chips, no lever paint.

**Decision:**
- **The dial.** The Lock Dial's centre is heat-blued steel inside the printed scale, with a sunburst that catches the turning light and a polished edge.
  - The total is in white, the labels in ice, and "Next opens in" in gold: opening is release, and gold on blue is the watchmaker's pair.
  - The highlight is capped so text keeps 5.6 / 4.8 / 4.6:1 at its brightest.
  - In the scroll story the blue clears to lacquer when the lock opens.
  - The same face draws the hero, the story, the Write sheet's preview and the link preview; `public/og.png` was re-rendered.
- **Fit.**
  - The scale moves out to clear the disc (label radius 358).
  - The month tenors read 1M and 3M, as traders write them.
  - On dials under 420px the readout drops its series line; under 350px the kicker drops "NEAR".
  - Every glyph of the readout is measured inside the blue from 320 to 1440px.
- **Chips.** An iron move ("Buy", "List") is an outlined chip, not a grey fill.

**Alternatives:**
- Lever rods painted by function: rejected (D-032).
- A larger disc: rejected; the printed scale would lose its ring.

**Consequences:**
- The detector's contrast advisory on the dial's text is a false positive from layering: the disc is a sibling layer, not the text's background. `elementsFromPoint` shows the disc under both ends and the middle of every line at 390 and 1440.
- Container-query breakpoints are in px; see docs/CONTEXT.md on `rem`.

## D-034 · The organizers count code from 2026-10-19; the rules page grew · 2026-11-05 · accepted · supersedes D-005 and the window rules of D-011
**Context:** HACKATHON.md, re-read on 2026-11-05 (`internal/research/raw/nearhackathon-HACKATHON.md-2026-11-05.md`), now has a Rules section, Q-000 to Q-017. Q-001 answers what #3 asked: "Code before 2026-11-01? Yes, from the announcement on 2026-10-19 … The window runs from then to 2026-11-14. Earlier commits are baseline." This project's earliest files are dated 2026-10-20, so all of its code is inside that window.

**Decision:**
- **The build-window rules end.** CLAUDE.md rule 10 is rewritten. The README says it as a plain fact: built from 2026-10-20, inside the window the organizers set (Q-001); git history starts on 2026-11-05, and docs/DECISIONS.md and docs/EVIDENCE.md are the dated record. D-011's line stands: nothing we publish claims the code post-dates 2026-11-01.
- **#3 narrows.** Its other question stays open: the page lets a project tag every track it fits, but doesn't say whether it can place in several.
- **Adopted from the new rules:**
  - A LICENSE file (Q-014): MIT. The team keeps all rights (Q-013).
  - The README lists libraries, templates and AI code (Q-005).
  - Claude Code and Codex screen for reproducibility and features, and humans decide (Q-017), so a fresh clone must pass the gate with no keys.
  - The hosted demo stays up to 2026-11-18, ideally 2026-11-25 (Q-012). Screenshots alone are not enough without an openable demo.
  - The X post tags `@NEARProtocol` and `#NEARHackathon`, leads with the user's problem, shows one complete moment, says concretely what NEAR enables, and gives a next step.
  - A mistake in a saved submission goes through https://nearhackathon.com/request-changes. A repository can be submitted once (409).
  - Mainnet costs aren't reimbursed by default (Q-008).

**Alternatives:**
- Keep D-011's disclosure as a caveat: rejected, there's nothing left to disclose. A plain fact reads better than an apology.
- Spread the first commit over made-up dates: never.

**Consequences:** The work since 2026-10-20 enters git in one day, split by area rather than by when it was written, and every commit carries its real date. That's allowed and is explained above.

## D-035 · The contract gets its own account, and "who holds the keys" gets an answer on chain · 2026-11-05 · accepted · supersedes "on the dev account" in D-004 and #10
**Context:** Preparing #10 raised the question a judge will ask: who holds the keys? Collateral inside `intents.near` belongs to the contract's account. A full-access key on that account can deploy new code, and new code can move the collateral. So until nobody holds such a key, "can't default" holds only as far as the key holder behaves. Nothing in SPEC or DECISIONS covered this. The dev account can't simply be locked, because it pays for everything else. And a 64-hex id reads badly in a wallet's prompt and in every position's Intents token id.

**Decision:**
- **Account.** The contract lives at `warrant-options.near` (free on 2026-11-05; `warrant.near` is taken), created by the dev account through `near.create_account`.
- **Owner.** `owner_id` is the dev account. The owner can only edit the allowlist for future series (`allow_token`, `disallow_token`). No method moves collateral for it.
- **Lock before submission (#18).** After the last redeploy, delete every key on the contract account. A judge checks it with one command: `near account list-keys warrant-options.near network-config mainnet now` lists none. A locked account still accepts plain transfers, so anyone can top up its storage.
- **The lock's cost is the user's call.** The code's storage stake of about 3.3 NEAR (about $13 at $4.04) can never be recovered from a locked account, which is above the $5 line in rule 8. Decide at M3.
- **Until it is locked,** the README's limits section says the deployer still holds a key.
- **Reproducible build.** Mainnet gets the output of `cargo near build reproducible-wasm`, so NEP-330 metadata names the commit and a rebuild reproduces the on-chain `code_hash`.

**Alternatives:**
- Deploy on the dev account: it couldn't be locked without stranding what it holds.
- A DAO or timelock as upgrade authority: still an authority, and more to build for nothing a fixed-terms contract needs.
- Lock immediately: any bug would then cost a new account and a second stake.

**Consequences:**
- #10 targets `warrant-options.near`; positions read `nep245:warrant-options.near:…` inside Intents.
- After locking, a bug means a new account for new series. Old series keep running on the old code.
- The contract pays for storage (SPEC), and its spare balance is finite. Filling it would refuse transactions that add state until someone tops it up. What that blocks beyond new writes is **unverified**, and the README states it as a limit.

## D-036 · Claude provides the wallet and records the demo · 2026-11-05 · accepted · extends D-004, D-035
**Context:** On 2026-11-05 the user asked Claude to provide the wallet that proves wallet signing, and to record the demo of the whole product working live, without them intervening.

**Decision:**
- **Wallet.** The user's personal wallet is not involved. The holder account, whose key Claude generated and funds with pennies, signs through a real near-connect wallet driven in a scripted browser. near-connect's manifest lists Meteor, Intear and MyNearWallet on the web, and a `near-cli` entry. Which one works is **unverified** until tried. A home-made wallet wouldn't prove compatibility with real ones, so it doesn't count.
- **Video.** Claude records it from real mainnet runs in a scripted browser and adds captions with ffmpeg, under 3 minutes (#13). Nothing is staged: real wallet, real hashes.
- **What stays with the user.** The organizers reserve two steps for the human: the post on X ("the human posts it and gives you the link") and confirming the exact payload ("only after the human has confirmed the exact payload"). The same page says "The human records a demo". Claude makes the video and the user publishes it, and the user was told this.
- **Winding down (#25).** The hosted demo should stay up to 2026-11-25 (Q-012), so the demo series expire on 2026-11-26. Then everything is reclaimed, withdrawn from Intents and unwrapped, and the holder and relayer accounts are deleted into the dev account.
- **What the lock costs.** Roughly 3.4 NEAR stays in a locked account for good, once its spare balance is swept out before the keys go. This refines D-035's "about 3.3". Still the user's call at M3.

**Alternatives:**
- The user's own wallet: they declined it.
- A home-made near-connect wallet: real signing, but it proves nothing about real wallets.

**Consequences:**
- CLAUDE.md rule 8 still caps spends. No step asks for the user's wallet.
- The demo's collateral stays locked until 2026-11-26 unless a series is closed first.

## D-037 · What the proof has to beat · 2026-11-05 · accepted · extends D-006, D-036
**Context:** The builder's earlier entries, Setoff (a winner of Arc Microgrants, film 1:43) and Valuta (film 2:10), set the bar for this one. I read both READMEs and film pipelines and looked at the films frame by frame.
- **The bar they set:** a refusal room (Setoff: 17 attempts, 15 refused by name, 2 controls), "Proof: nothing here is a mockup" and "Limits" sections, a verified contract with no admin key, and a film whose figures come from the chain and whose takes fail if they miss their moment. The pipeline is Playwright as the camera, ElevenLabs narration with forced-aligned captions, an ffmpeg score on a beat grid, and Remotion for the frame.
- **Where they can be beaten:** footage is captured at 1600×900 and device scale 1 through Playwright's recorder and looks soft at 1080p. The camera never moves and stays on one page for long stretches. The wallet on camera is an injected demo signer. Everything happens on one chain.

**Decision:** Port the pipeline (the user's own code) and go past it at these points. Each one is real proof, not decoration.
- **Refusal room (#20).** Every refusal the contract names that mainnet can reach, as a real failed transaction anyone can open, plus honest controls that go through, all read back from chain by hash with a live count. The contract names 25. Setoff's were read-only calls; here that isn't possible, because a view call can't attach a deposit and our methods stop at "Requires attached deposit of exactly 1 yoctoNEAR" before any refusal (probed on `wrap.near` and `intents.near`, 2026-11-05). About 0.05 NEAR in gas.
- **One complete moment from another chain (#11).** A wallet with no NEAR account deposits USDC from Base, buys an option, exercises it, and is paid on Base. It's the track's own line, "settle across chains through NEAR Intents", and it doesn't port.
- **The film (#22).** Under 3:00, aiming for 2:00 to 2:30, because longer isn't better.
  - Capture at device scale 2, so figures stay sharp after YouTube re-encodes. The method gets tested at the first shoot.
  - Camera moves measured from element rectangles, so a push-in can't crop the figure, which is why the earlier films dropped zoom.
  - The authored moment: same lever, same wallet. Reclaim is refused, the dial runs out on a real short-dated series, and the same press pays.
  - Shots beyond the app: the real wallet prompt, NearBlocks, BaseScan, `near account list-keys`.
  - A bolt on each refusal and a vault release at expiry, synthesized like the earlier scores.
  - Figures from a facts file read off mainnet, and a take that misses its moment fails.
- **Nobody to switch it off (#18).** The track says "no custodian, nobody to switch it off". A locked account and a reproducible build are that line, provable with two commands. I recommend locking; it's still the user's call (D-036).
- **Invariants (#21).** Randomized operation sequences with the backing invariant checked after each step, and counters that prove each path was reached.
- **README (#13).** Setoff's proven structure, with this project's proofs.

**Alternatives:**
- A longer film or more chains: rejected. The organizers' own advice is "Show one complete moment".
- New product surface before M2: rejected. The market-maker agent stays gated by D-006.

**Consequences:**
- #20, #21 and #22 are added, and #11 becomes the round trip.
- The contract account starts with 3.5 NEAR, not 3.7. That leaves about 26.9 KB of state beyond the code, against about 3.5 KB for 5 series and 3 offers on the devnet, and pays for the round trip inside the 5 NEAR.
- Narration uses ElevenLabs, with a key that stays out of this repo. macOS `say` proves the pipeline without one.

## D-038 · The contract can retire itself, so locking it costs almost nothing · 2026-11-05 · accepted · supersedes the lock's cost in D-035 and D-036
**Context:** D-035 planned to delete every key on the contract account, which D-036 estimated would keep about 3.4 NEAR forever. That is most of the demo's budget, gone however the entry does. An account with no keys can only get its deposit back through its own code. Nothing is deployed yet, so the code can still change.

**Decision:** Add `retire()` (docs/SPEC.md, "Retiring"), then lock as planned.
- **When:** anyone, from `retire_after_ns`, set at init to 2026-11-26 00:00 UTC, the day the demo series expire. Until then nobody can remove the contract, whatever it holds.
- **Only when it can't cost anyone anything:** every series has paid out its collateral and proceeds, and no payout is owed or in flight. Otherwise it refuses with `ERR_CANNOT_RETIRE`.
- **What it does:** moves no tokens, clears its series, offers and allowlist, and deletes the account in the owner's favour.
- **The result:** the key list stays the proof that nobody can change the code, and the deposit comes back. About 4.7 of the 5 NEAR budget returns: gas, swap spreads and the small Base payout are the loss. Locking (#18) now costs only gas. I recommend it, and the user still confirms it at M3.
- **Said out loud:** the app, the README and the SPEC all describe `retire`, so a judge reads about it rather than finds it.

**Alternatives:**
- The plain lock: the strongest reading of "nobody to switch it off", but it gives up most of the demo's budget.
- No lock: free, but a key holder could deploy new code and take the collateral, which is what the thesis says can't happen.
- `retire` for the owner, with no date: the owner could switch the contract off at any empty moment. Anyone-with-a-date gives nobody that power.

**Consequences:**
- A judge will see a function that deletes the contract. Its guards are tested by unit tests, a run on the real runtime, the random sequences and injected bugs (E-029), and one more attempt joins the refusal room.
- Every random sequence must now wind down to nothing and retire, which also proves no money can get stuck.
- A writer who never reclaims keeps the contract from retiring, and the deposit stays until they do. That is no worse than the plain lock, and nobody's money is at risk.
- The contract changed, so the artifact in E-026 is superseded. Mainnet gets a new double build.

## D-039 · The repo opens when the build is finished, not on a fixed date · 2026-11-05 · accepted · supersedes the date in D-007
**Context:** D-007 kept the repo private until 2026-11-13, so rivals couldn't read the design during the window. On 2026-11-05 the user said not to wait for that date, because others are already showing their builds on X, but to finish first and then open it. The rules only ask that it be public by the deadline.

**Decision:** Open it as soon as the product is live on mainnet and its proof is ready, whichever day that is, and no later than 2026-11-13. The record is already prepared for that:
- **It was written for a private repo, so personal notes came out.** They now live in the gitignored `internal/`. The commits not yet on `main` were rewritten. The code is identical, checked with `git diff` against the old tip, but their hashes changed, so `1ffcc9f` in E-026 and the branch hashes in E-025 no longer resolve.
- **Two issues were replaced, because GitHub keeps an issue's edit history.** #24 replaces #1 (funding), and #25 replaces #19 (winding down). Older entries that cite #1 or #19 mean those.
- **Every commit on every branch gets scanned for secrets** again right before the flip.

**Alternatives:**
- Opening now: a first look would land on a repo that says "not on mainnet", and rivals could read an unfinished plan.
- Holding until 2026-11-13: it gives up days of visibility while others are already showing their builds.

**Consequences:** PRs merge with merge commits, not squash, so any commit a deployed contract names stays in `main`'s history.

## D-040 · Intear is the wallet that proves signing · 2026-11-05 · accepted · extends D-036
**Context:** D-036 has Claude drive a real near-connect wallet from its own account. Two of the obvious choices fail. MyNearWallet now says "Sending, staking and app approvals have ended". Meteor's site answers an automated browser with Cloudflare's "you have been blocked".

**Decision:** Use Intear Wallet, which near-connect lists, for the demo holder. It's open source, imports an existing account by private key, and shows a real approval prompt naming the requesting site, the receiver, the method, the gas and the deposit. Its terms are ordinary self-custody terms and say nothing against scripted use. The key lives only in a gitignored browser profile.

**Alternatives:**
- Getting past Meteor's block: it's the site's call, and evading it isn't something to build a demo on.
- near-connect's NEAR CLI wallet: official, and it remains the fallback, but a pasted command says less about what a user sees than a wallet prompt does.

**Consequences:** The film shows Intear's prompt. An EVM wallet's prompt is still unexercised in a real extension.

## D-041 · Calls ask for 90 TGas, the relayer for 140 and two intents at most · 2026-11-05 · accepted · narrows D-030
**Context:** A transaction is charged 0.001 NEAR per TGas up front. The default of 300 TGas shut out any wallet with under 0.3 NEAR free, and the relayer's key, with its 0.15 NEAR allowance, could never have sent anything. The devnet couldn't show this, because its accounts are rich.

**Decision:** Calls ask for 90 TGas and the relayer for 140, which fits the allowance. The whole refusal room passes at 60, and two relayed exercises burn 30.4. The relayer takes at most two intents per payload, down from four, because four exercises need more gas than the allowance covers. The UI only ever sends one, so nothing a person can do changes.

**Alternatives:**
- A larger allowance and more NEAR on the relayer: it pays for gas nobody uses, and costs more if the key leaks.
- A per-action gas table: more to get wrong for no gain, since unused gas comes back.

**Consequences:** A NEAR wallet needs about 0.1 NEAR free to act, and the sheet says so below that. A NEAR deposit keeps 0.15 back.

