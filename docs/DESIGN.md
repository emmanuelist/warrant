# Warrant: design direction and system

Single home for how Warrant looks and behaves. Product truth is in SPEC.md; this file decides how that truth is shown. Current world: **studio light, the vault's time lock** (D-025, 2026-10-21), which replaced the signal-box interlocking (D-015).

## Discovery

**Product.** Options that can't default and need no oracle: the collateral is locked inside NEAR Intents until expiry.
- Writers lock collateral, sell longs, collect premiums and strike payments, and reclaim unexercised collateral after expiry.
- Holders buy longs, move them through Intents, and exercise before expiry (pay the strike, receive the asset).

**What matters most on screen**, in order:
1. That collateral is locked, how much, and until when.
2. What each viewer can and cannot do right now, and why.
3. The terms of each series.
4. Prices.

**Audience.** Judges (investors and founders: a16z, Dragonfly, Electric, Synthetix/Infinex, Helius, NEAR; plus Claude Code and Codex) and DeFi traders. They're experts and comfortable with density. The judges give it about four minutes.

**Positioning.** Premium, cinematic, interactive, exact. A Web3/DeFi product in the register of Morpho, Uniswap or a watchmaker's product page: light, not dark-by-default (the user's direction, 2026-10-21).

**Register: loud.** One enormous decision lands in three seconds: the thesis at display size above a polished time-lock dial holding the live locked total, read from chain, with every live lock on its ring. Everything around it is disciplined.

## Material: the vault's time lock, in studio light

Derived from the thesis, not picked. A bank vault's **time lock** is a clockwork that holds the bolt until a set time: not even the owner can open it early. That is Warrant's contract exactly ("not even the writer can take it back early"), and "no oracle" is the same idea: only the clock, here the chain's, opens the lock.

**What the material hands us:**
- **Geometry:** a dial with a printed scale, an index where locks open, a bezel, bolts across lever slots.
- **Colour:** blued steel (heat-blued hands and screws are a horology classic) for collateral locked; the rest is printed ink on white lacquer.
- **Texture:** polished steel (a conic sweep of highlights), a sunburst dial finish, a sapphire crystal's glare, film grain over the frame.
- **Type:** dial printing: expanded small caps; a precise grotesque; a legible mono for figures.
- **Motion:** the dial setting itself; a seconds hand; the lock's bolt stopping a lever; light turning on polished metal.
- **Vocabulary:** locked · opens · bolted · free · released.

**The signal-box world (D-015 to D-023)** was retired after the user's verdict that it didn't feel premium. Its mechanics survive: the levers, the Route and the refusals are still the product's proof; they are now made of the new material.

## Signatures

1. **The Interlock.**
   - Every series renders its state machine for *this viewer* as seven levers: Write · List · Buy · Exercise · Close · Proceeds · Reclaim.
   - Each lever is **free** (a white ceramic key with a lit green lamp) or **bolted** (a blued-steel bolt across its slot, the lamp a red ring: the chain would refuse it). The lamps are signal lamps that carry state, not function, so blue keeps meaning locked (D-032, after D-029). A bolted lever names its lock in contract terms: "until 18:00 UTC", "writer only", "hold ≥ 1 long". Hover or focus gives what it does and the exact `ERR_*` the chain returns.
   - Levers are physical: drag one down and a free lever throws and opens its sheet; a bolted one stops dead at its bolt and springs back. Click and keyboard do the same.
   - The authored moment: **"Test the lock"** sends the refused transaction for real; the lever kicks back and the chain's own `ERR_*` and refund are shown.
   - The trade card leads with the viewer's **likely move** as one primary key (claims for the writer, Exercise for a holder, the best offer for anyone else), carrying its lever's number and lamp. The Interlock stays the full set, in the series bench below the board on wide screens. On a phone the key docks at the bottom of the series sheet (D-027, D-028).
   - Commits say the verb and what moves ("Exercise 1 · pay 4.80 tUSDC", "Lock 1.00 wNEAR until 28 Oct 18:07 UTC"); "Pull" belongs to the levers and to Test the lock.
2. **The Route.**
   - Writer → **NEAR Intents** (the one dark object, the vault) → Holders, per series, with lit tracks for what actually happened on chain (collateral locked in blue, strike paid, delivered, proceeds held).
   - It recurs at system scale around the hero dial and at account scale (wallet ⇄ your Intents balance ⇄ Warrant).
   - Every scale is built from the same HTML parts (`System.tsx`: terminals, paired tracks, the station), so its figures are real text at 11px or more. Inside a series' control well the terminals are printed (a hairline, no shadow) and the Intents block stays the one dark object.
3. **The Lock Dial.**
   - The hero's centrepiece and the system route's station. A polished bezel, a white lacquer face, a printed **log-time scale** (1H · 6H · 1D · 3D · 1W · 1M · 3M · 1Y, tenors as traders write them, ticked like a slide rule) and an index at 12 o'clock where locks open.
   - **A heat-blued centre** (D-033): blued steel with a sunburst that catches the turning light, the total in white and "Next opens in" in gold. Blue means locked, so in the scroll story the blue clears to lacquer when the lock opens. On small dials the readout drops the series line (dials under 420px) and the word "NEAR" from its kicker (under 350px) so nothing leaves the blue.
   - Every live series is a blued-steel marker placed by its time to release; markers that open together step inward so none hides another. A blued arc runs from the index to the next lock to open. Markers are buttons (44px to hit): each opens its series on the board.
   - Markers carry no labels on the ring. The centre is the readout: the next lock to open, or the one you point at or focus ("#2 · 16.80 tUSDC · 23 Oct 16:55" under its clock), so nothing covers the printed scale or the total (D-028).
   - The centre holds the collateral the locks hold (rolling figures) and the clock to the next release. A seconds hand sweeps the ring.
   - It tilts toward the pointer and the bezel's highlight follows it round; it sets itself on load (see Motion).
   - It recurs in **"How the lock holds"**, where scroll runs one lock's clock from written to open, beside the contract's own lines (see Motion), and in the **Write sheet**, where a small dial shows where the new lock lands among the live ones as you pick its expiry.

## Tokens: from the mechanic

State tokens come first:

| Token | Meaning | Value (OKLCH) |
|---|---|---|
| `--lock` | Collateral locked; an action bolted for safety. Blued steel. | `oklch(0.50 0.20 264)` |
| `--live` | A right exercised; backing confirmed | `oklch(0.60 0.15 158)` |
| `--refuse` | Refused by the chain | `oklch(0.57 0.21 27)` |
| `--release` | Collateral released after expiry, reclaimable | `oklch(0.80 0.15 80)` (ink on it) |
| `--deliver` | Strike payments, proceeds | `oklch(0.68 0.12 58)` |
| `--gain` / `--loss` | A payoff's sign (Payoff.tsx): the live green and the refuse red, never as text, always with position (above or below zero) and a label | `oklch(0.60 0.15 158)` / `oklch(0.57 0.21 27)` |

Surfaces and ink:

| Token | Role | Value |
|---|---|---|
| `--board` | Page: studio white | `oklch(0.985 0.002 255)` |
| `--bed` | Wells, hover fills, the lever frame | `oklch(0.958 0.004 255)` |
| `--card` | Raised surfaces: the series list, the trade card, sheets, keys | `oklch(1 0 0)` |
| `--iron` | Ink; the primary action fill (a black pill) | `oklch(0.20 0.013 262)` |
| `--iron-2` | Secondary ink (6.5:1 on board) | `oklch(0.47 0.013 262)` |
| `--iron-3` | Tertiary ink: a story step you haven't reached (4.8:1 on board) | `oklch(0.54 0.012 262)` |
| `--rule` | Hairlines | `oklch(0.905 0.006 255)` |
| `--ink-hover` | Hover on the black pill | `oklch(0.33 0.014 262)` |

Instrument roles (`--panel`, `--panel-raised`, `--panel-line`, `--panel-ink` / `-2` / `-3`, and the `*-lit` state colours) are light by default: the hero stage and a series' control well. **`.night`** re-lights the same roles dark (`--panel` `oklch(0.165 0.012 262)`, inks 0.965 / 0.77 / 0.66, lit states brighter) for the one dark band, the refusals, and the footer. Components never pick light or dark; they use roles, and the scope decides.

No colour without one of these meanings, and each meaning is worn generously (D-032):
- **An action wears the enamel of what it does:** lock for Write (blue), live for Exercise (green), release for Close and Reclaim (amber), deliver for claims (brass), iron for trades and transfers (black), refuse for Test the lock (red). This covers the sheet's commit, the card's primary key and the header's Write.
- **Figures take their state's ink:** locked amounts in blued steel, released in amber, what a holder pays in green, what they receive in brass.
- **The stage is lit by two gels** (blued steel on the writers' side, brass on the holders'), its terminals are lettered in their side's colour, and each sheet's header is washed in its action's enamel.

Blue still means locked: writing locks. Text-safe inks (`--color-*-ink`, 6:1 or more on white) and a deep green (`--color-live-deep`, 5.45:1 under white) keep every label legible. Tints mix in OKLab (see docs/CONTEXT.md).

## Typography

| Role | Face | Use |
|---|---|---|
| Display | **Mona Sans Variable**, expanded (`wdth` 112, `wght` 640, −0.035em, line-height 1) | Headlines, the wordmark (`wdth` 125, +0.16em caps), the dial's figure (`wdth` 108, tabular) |
| Labels | Mona Sans, `wdth` 106 / `wght` 620, uppercase, +0.085em | Dial printing, plate names (narrow `wdth` 75–90 where seven share a row), chips, buttons |
| Body / UI | Mona Sans, normal width | Running text and controls |
| Figures | **Atkinson Hyperlegible Mono Variable** | Every amount, time, ID and address; `tabular-nums`; 0/O and 1/l/I can't be confused |

Roles, as Tailwind tokens in rem on a 93.75% root (15px at the default setting; they scale with the reader's own font-size preference):

| Role | Size at default | Use |
|---|---|---|
| hero display | clamp(2.4rem, 4.9vw, 4.6rem) | The thesis (two lines at 1440) |
| `display-1` | clamp(2.5rem, 5.4vw, 5.4rem) | An account name, an error |
| `display-2` | clamp(2.2rem, 4.4vw, 4.2rem) | The refusals headline |
| `display-3` | clamp(1.9rem, 3.4vw, 3rem) | A section heading |
| `claim` | clamp(1.2rem, 1.8vw, 1.6rem) | The thesis' second clause |
| `h2` / `h3` | 1.5–1.9rem / 22px | Subsections / sheet and card titles |
| `lead` · `body` | 19 · 16px | Prose |
| `ui` · `meta` | 14 · 12.5px | Tables and controls · secondary text |
| `label` · `micro` | 11.5 · 11px | Labels · chips and captions (11px is the floor for functional text) |

- Headings balance, paragraphs avoid orphans. No eyebrow labels, no section numbers; lever numbers stay because their order is the action sequence.
- Monospace is for data only; words stay in Mona Sans, even inside data rows. Token symbols keep their case inside uppercase labels.
- Delivery: the two Latin files are preloaded by the build; the fallbacks are metric-matched (Mona Sans ↔ Arial/Helvetica at 104.44%, Atkinson Mono ↔ Courier New/Menlo at 105.31%, with ascent/descent overrides), so the swap moves nothing.
- Station figures fit their container (`fitFigure`: Mona Sans figures run about 0.6em per character).

## Space, surface, depth

- **Spacing:** 4px base: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 72.
- **Surfaces.**
  - *The stage:* each view opens on a photographic sweep, a soft key light above centre falling off to the edges and the floor, under film grain.
  - *Cards:* white, a hairline and a long soft fall-off (`--shadow-card`). The series list is one card with rows inside it (not a card per row); on wide screens the series detail is a floating trade card; sheets float higher (`--shadow-float`).
  - *Wells:* a series' control panel (Route and Interlock) is a light well inside its card; the levers sit straight in it, never in a second well.
  - *Night:* the refusals band and the footer, dark navy with a key light from above.
  - *Glass:* only where something floats over moving content: the sticky header on wide screens and the dialog backdrop (blur). Nothing else is translucent.
- **Radius:** pills for buttons, segmented controls and chips; 11px inputs and wells; 18–22px cards and sheets; 10px keys; round lamps and markers.
- **Depth:** the dial is the one object with real 3D (perspective tilt, contact shadow on the floor); keys carry a key shadow; everything else is a card or flat.
- **Selection** is a blued-steel ring with a faint blue tint, never a coloured side bar. Each board row carries a phase lamp (blue locked, amber released, hollow reclaimed).

## Layout and responsive

- **1440:**
  - Sticky glass header (wordmark, views, network pill, act-as field, a black "Write a series" pill).
  - The stage: the thesis centred in two lines, the claim on one; below it the system route with the dial as its station: Writers → collateral in / proceeds held → **the dial** → delivered / strike paid → Holders. Backing chips under the dial, the next release and the devnet note beneath. The whole dial is above the fold at 1440×900.
  - "How the lock holds": three steps (Written, Holding, At expiry) scroll on the left, each with the exact line of the contract that enforces it; the dial is pinned on the right with two levers (Exercise, Reclaim) and runs one lock's clock as you read.
  - The board: "Every series, read from chain", filters, the series list (7/12) with each row's "Your move" in words, and the pinned trade card (5/12): terms, the likely move, offers, position. Below both, full width, the series bench: the control well (Route, Interlock) beside the payoff chart.
  - The night band (refusals), then the night footer.
  - Account: the account name as display type, its own route with a white station card, then the ledger.
- **1024:** the stage keeps the full route around a 450px dial; the board runs full width (with a best-offer column) and the card and bench follow beneath it.
- **≤ 768:** the header is two compact rows and scrolls away; the route runs vertically through a full-width dial; the lock story pins a compact strip (dial and its two levers side by side, a quarter of the screen) above its steps, and when the phone is narrow in ems (a large reader font, a 320px screen) the strip wraps and stops pinning; series rows collapse to two lines; the detail opens as a bottom sheet.

## States (all designed; none faked)

- **Empty:** no series yet: how writing works, and Write as the one free lever.
- **Loading:** silhouettes on the stage.
- **RPC error:** the message, the RPC URL and a retry.
- **Missing token metadata:** the raw token ID.
- **Long numbers:** grouped digits, truncated at 6 fractional digits with the full value on hover/focus. Dial and station figures shrink to fit; so do the trade card's terms, which share one size so the row reads as one (12.345678 tUSDC beside 2.50 wNEAR), and its countdown fits even at 366 days.
- **Expired:** released or reclaimed lamps and chips; the dial shows live locks only.
- **Wallet:** disconnected, connecting, wrong network; a NEAR wallet or an EVM wallet (no NEAR account: an "EVM" label, ERC-191 messages, money in and out through 1Click); no EVM wallet in the browser.
- **Transactions:** pending, success with explorer link, refused with the chain's `ERR_*` and refund status.

## Motion

- **Ambient:** state changes ≤ 160ms; rows enter staggered; sheets rise into place (a bottom sheet on phones) over a dimming, blurring backdrop; tooltips scale in; balances roll to new values when a transaction moves them (NumberFlow); countdowns tick digit by digit.
- **The dial sets itself** on first paint: the bezel focuses in, the scale prints tick by tick, the blued arc runs to the next lock, the markers settle onto the ring, a glint crosses the crystal, the figure rolls up, the route's rails draw in their direction of travel, then the seconds hand starts. Pointer movement tilts the dial and turns the light on the bezel.
- **The lock story** (Motion `useScroll`): scrolling the steps runs the clock. The lock drops onto the ring a week out and its blued arc draws in; while it holds it travels to the last hour and a pull on Reclaim is refused (`ERR_NOT_EXPIRED`); at the index it turns amber, the bolt slides out of Reclaim and into Exercise, and the centre reads "Open". The text and the clock read the scroll separately so expiry always plays out while the dial is pinned. With reduced motion the lock moves by step and nothing transitions.
- **Physical levers** (Motion springs): arming as a frame appears, hover lift, drag to throw, the bolt stopping a locked lever with a rubber-band give, the kick back on a refusal.
- **Authored (one):** the refused pull, with the chain's error arriving on the red plate.
- Everything honours `prefers-reduced-motion`: no intro, no tilt, no sweep, no drag, no roll (figures show their value at once), sheets fade instead of travelling.

## Elevation pass (2026-10-20)

Additions that survived the redesign, each with a job:
- **"Three moves the contract refuses":** three large levers kick back against their bolts when scrolled into view and can be pulled by hand; each shows the chain's exact `ERR_*` and its proof (E-005). "Pull again" replays them. Now the night band.
- **Arming:** a lever frame settles into position when it first comes into view.
- **Directional flow:** lit route tracks carry dashes in the direction money moved.
- **Series switch:** a scoped View Transition on the detail panel where supported.
- **Narrow Route:** below 30rem of container width the Route renders vertically.

## Full product pass (2026-10-20)

- **Account: the custody route as columns.** The ledger's columns are the route's stations: your wallet → NEAR Intents (yours, the dark block) → Warrant (committed), with the track arrows as column heads. Each action sits in the station it moves value out of.
- **Claims are lever keys.** A writer's Proceeds and Reclaim render as Interlock keys; a bolted key opens "Test the lock".
- **Money in and out:** wallet routes and 1Click cross-chain routes in both directions, with a step timeline.
- **Positions as Intents assets:** longs move into Intents and back, and between accounts inside it.
- **Payoff at expiry** (dataviz method): one 2px blued line, hairline axes, a 10% wash where the holder profits, direct labels, a snapping crosshair with keyboard control, landmark chips and a table twin.
- **Filters and deep links:** Kind, State and Mine with live counts; `?series=<id>` selects a series (and opens its sheet on phones).
- **Link preview:** `public/og.png` (1200×630) shows the verbatim thesis beside the real dial face (`DialFace`, no chain figures). Source: `web/scripts/og.html`.

## References (2026-10-21)

Studied for patterns, not looks. Captures live in `internal/research/ui-refs/` (third-party images, not committed).

| Product | What it solves well | What Warrant takes | What it leaves |
|---|---|---|---|
| **Robinhood** P/L chart ([help article](https://robinhood.com/us/en/support/articles/profit-loss-chart)) | The readout *leads* (a large profit figure above the plot, the price riding the crosshair), and three landmark chips snap the crosshair to the points that matter. | A fixed readout above the payoff chart; a plain sentence when idle ("Profits if 1 wNEAR is worth more than 5.22 tUSDC at expiry"); landmark chips; break-even on the Buy sheet. | Green/orange profit colouring: `refuse` means a chain refusal, not a loss. |
| **Wise** transfer tracker ([help](https://wise.com/help/articles/2977947/how-do-i-track-my-transfer), [API statuses](https://docs.wise.com/guides/product/send-money/tracking/transfer-statuses)) | A step-by-step tracker with plain step names, an arrival estimate, and a stated path when something pauses. | A vertical timeline for 1Click transfers with first-seen times, "send before" and "usually ~N s" estimates, and refund/failure steps that say where the money went. | Email notifications and brand illustration. |
| **Safe{Wallet}** review ([help](https://help.safe.global/en/articles/276343-how-to-perform-basic-transactions-checks-on-safe-wallet)) | Signing what you can read: a review step, the receiving contract named, decoded fields with a raw toggle, "compare with your wallet". | "What you'll sign" in every sheet: receivers with roles, methods with deposits and decoded args (Warrant's `msg` as the action it encodes), Decoded/JSON, and for cross-chain withdrawals the NEP-413 message itself. | The irreversible-action checkbox. |
| **Deribit** options chain ([public page](https://www.deribit.com/options/BTC)) | Density: expiry tabs, calls and puts around a strike ladder. | Later: a chain view once mainnet holds many strikes per expiry. | The dark terminal look. |
| **Morpho, Uniswap, a watchmaker's product page** | Premium DeFi in daylight: white, one strong accent, soft depth, a hero object. | The register: light studio surfaces, black pills, a single blue, the dial as the product shot. | Their brand colours and illustrations. |
| **Mercury, Apple Card** (inspiration pass 2026-10-21) | A pinned full-screen stage whose sequence is scrubbed by scroll: Mercury's camera pushes into its product; Apple lights its headline. | The pinned scroll scene, as "How the lock holds": scroll runs the lock's clock. | Scrubbed video and photography: our stage is the dial, drawn live. |
| **Increase** | Each mechanism shown running inside product fragments (an API call typing itself, a live event stream, checks ticking through); a two-tone headline. | Showing the mechanism in motion; the contract's own lines beside each step. | Logo walls and bento feature grids. |
| **Morpho** | Its real contract source in a tabbed viewer under "every line is auditable"; a concept diagram as the hero; mono labels on live figures. | Code as proof: each story step quotes the exact line that enforces it, with its file and line. | The light blue page and the blueprint grid. |
| **Aave** | Real product UI as the hero; sections as large inset rounded panels, alternating light and dark. | Confirms the single dark band as contrast. | The stats row (the hero-metric template) and the newsletter block. |

The pass sampled the finance, Web3 and crypto picks on Recent (Godly's successor) and Awwwards' "web3" results, which were mostly agency portfolios and not relevant to a dApp; Refero's results need an account, so it was skipped. Captures are in `internal/research/ui-refs/insp-*.png`.

## Critique pass (2026-10-21)

A dual-agent critique scored the app 27/40 (audit 15/20). The fixes, with the user's choices (D-027):
- **No refusal anyone didn't ask for.** Sheets bound counts by holdings, the offer and the Intents balance (shown, with Max), tie each error to its field, and send your own offers to Cancel. Write bounds expiry to the contract's window. "Test the lock" stays the only deliberate refusal.
- **The refusal room is the band's second half (D-037).** What's refused fills the left, and what's allowed (the honest calls and the way out, D-038) stays in view on the right, stacking below on smaller screens. Attempts are grouped by what they try, a lamp per row: a ring until the chain has answered, then red with the contract's own `ERR_*`, or green for an honest call that had to go through. A row that ends any other way says so in amber. The two counters count only what was read back from chain, so they start at zero every time.
- **The refusals band is proof, not theatre.** Each card is a real refused transaction, read back from chain by hash: the contract's error from its receipt, Intents' refund from its log, the sender and the time. "Send one yourself" pulls a bolted lever for real; "Replay" is only the kick.
- **Way-finding.** Board goes to the board; a shared series link scrolls to it (and lazy sections keep a link's target in view as they load); "Every series ↓" sits under the hero.
- **Labels say what's true:** "closed at expiry", "claimable", a dismiss icon that can't be read as the Close lever, "Options to exercise", plurals, and backing chips that add up to the dial ("= 6,261.00 locked + 2.00 released").
- **Colour:** the payoff's sign (see Tokens); dark ink on green plates; the story's stage names sit beside the contract lines they enforce, dark text with a coloured dot, never as eyebrows.
- **Board at 1280–1440:** the best offer folds into "Locked · open"; six columns from 1440, full width below 1280.

## Critique pass 2 (2026-10-21)

The re-run scored 29/40. Its fixes (D-028):
- **The card fits; the machinery gets a bench.** The pinned card is only what you act on. The route, the Interlock and the payoff sit full width below, where they read at real size.
- **Commits say what moves.** The review decodes `msg` into labelled rows, with the expiry in UTC and from now.
- **Rows say your move in words.** The seven-lamp code lives only in the Interlock, which explains it.
- **The dial reads out at its centre**, not in labels on the ring.
- **Edges:**
  - a sheet with no one to send it offers who can act;
  - long IDs are shortened;
  - a skip link, spoken countdowns, 11px chart text, and 44px account actions.

## Critique pass 3 (2026-10-21)

The third run scored 28/40 (trend 27 → 29 → 28). Its fixes (D-029):
- **Exercise says whether it pays.** On mainnet it shows 1Click's reference price (indicative, never used for settlement) and the net per option, and a losing exercise is demoted to List. The devnet says it has no price.
- **A short balance is a gap with a way through:** "Deposit <shortfall>", then back to the same action with what you typed.
- **Lamps show state, not function.**
- **The board tells the truth after expiry:**
  - no offers;
  - "released" and "returned";
  - "lapsed" longs;
  - one verb, "Claim".
- **Phone.**
  - The hero folds the route into one line and the backing into one "Backed 1:1" verdict.
  - The story is shorter.
  - The sheet shows your options before the machinery.

## Colour pass (2026-10-26, D-032)

The user's verdict: colour wasn't used well, and the interface wasn't decorative enough. The palette stays the mechanic's (no new hues); what changed is how much of it is worn:
- the enamel keys (commit, primary move, Write);
- signal lamps (green free, red bolted);
- state inks on figures, and "Your move" as a chip in its lever's enamel;
- two studio gels on the stage, and terminals lettered by side;
- sheet headers washed in their action;
- a red warning light over the refusals band, and a brass hairline over the footer.

Measured: every recoloured label is 6:1 or more on its ground; axe reports 0 violations; the detector finds 0 anti-patterns.

Then the Lock Dial got its heat-blued centre and the iron move chips became outlined (D-033).

## Wallets from other chains (2026-10-26, D-030, D-031)

- **Connect** is a small card under the button: the NEAR wallet, then each EIP-6963 wallet with its own icon, or "No EVM wallet in this browser". One sentence gives the model: the wallet signs a message, and the relayer sends it and pays the gas. The menu measures its room: it hangs from the button's right edge, or its left edge where a phone's header wraps, and always keeps the 16px gutter. A sheet with no one to send it offers the same options as keys in its well.
- **An EVM account** is an address like any other (`0x17c5…d025`, shortened like NEAR implicit accounts), with an "EVM" text label in the header. No new colour.
- **"What you'll sign"** becomes "a message (ERC-191), not a transaction": signer, Intents, each intent with its amounts read in their token and then exactly as signed, Warrant's `msg` decoded, and the deadline and nonce rules. JSON shows the exact envelope.
- **The account route** names its first station "EVM wallet · on its own chain", and deposits and withdrawals go through 1Click.

## Data truth

Every value comes from chain views (SPEC.md "Views", Intents `mt_balance_of`, token `ft_metadata`, `ft_balance_of`, `view_account`) or, for cross-chain routes, from 1Click's live API. The link preview carries no figures because a static image can't stay true to a live board.
- **Development:** runs against a local sandbox seeded by real transactions (byte-identical mainnet Intents).
- **Production:** reads mainnet.
- **Writes:** on mainnet, a NEAR wallet signs (near-connect), or an EVM wallet signs ERC-191 intents that Warrant's relayer sends (D-030, D-031). On the devnet, the sandbox's public genesis key signs real devnet transactions for the account chosen under "Act as" (D-017), and a dev-only EIP-1193 test wallet signs for the funded 0x account. Cross-chain tabs exist only on mainnet; on the devnet they say why instead of simulating a route.
