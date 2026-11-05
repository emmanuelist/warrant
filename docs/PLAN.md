# Plan
Deadline: **2026-11-14 23:59 UTC** (source: https://nearhackathon.com/HACKATHON.md, "Facts"). Internal target: **2026-11-13 23:59 UTC**.
Submissions open 2026-11-01 00:00 UTC. Code counts from the announcement on 2026-10-19 (Q-001, D-034).

| # | Milestone | Exit criteria (a stranger could check these) | Due | Status |
|---|---|---|---|---|
| M0 | Research locked | Decisions D-001 onward recorded. Toolchain ready (#5, done). Custody proven: collateral arrives via `mt_transfer_call` → our `mt_on_transfer`, and the contract pays out with `mt_transfer` (D-009). **Done in sandbox against byte-identical mainnet Intents (E-005, D-013).** Organizer answers recorded. Name and thesis set. | 2026-11-03 23:59 UTC (kill date) | done, except #3's several-tracks question (p2). Q-001 answered the other (D-034) |
| M1 | Walking skeleton | Options contract deployed on mainnet with a series created and collateral credited inside `intents.near`. A deployed web page reads that series from chain and sends one real transaction. Contract CI green. | 2026-11-05 23:59 UTC | **done 2026-11-05** (E-031) |
| M2 | Core claim | On mainnet with real funds via Intents: write, then buy (premium), then exercise (holder pays strike, receives underlying), and a separate series expires so the writer reclaims. A position is transferred between accounts as an Intents asset. One payout lands on Base. All three refusals (early reclaim, unauthorized exercise, late exercise) are shown as failed txs. Sandbox tests cover each failure path. | 2026-11-10 23:59 UTC | **done 2026-11-05** (E-031, E-032, E-033) |
| M3 | Proof surface | README with "do X → see Y" steps a judge can follow. Every README claim has an EVIDENCE entry. Demo video (< 3 min) recorded from real mainnet runs. X post drafted. | 2026-11-12 23:59 UTC | all built (E-033, E-034, E-035); the user's look at the film is left |
| M4 | Submitted | Repo public. X post published by the user. Payload confirmed by the user, and `POST /api/applications` returns 201. Repo and demo links checked from a phone on cellular. | 2026-11-13 23:59 UTC | not started |

Checkpoint: **2026-11-07** saturation re-scan (`gh search repos --created ">=2026-11-01"` plus `GET https://nearhackathon.com/api/applications` for the count). The dossier's kill rule applies.

## Cut list
Things deliberately not being built. Each entry links the DECISIONS entry that cut it.
- Cash settlement and any price oracle (Pyth, Rhea): D-002
- Market-maker agent: D-043 (its gate opened, and it stays out)
