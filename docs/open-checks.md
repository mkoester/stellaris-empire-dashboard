# Open checks (from the 2026-10-22 session)

What the systems, produce, jobs, growth, tech and trade tabs still need from the game. Each item:
what is open, how to check it, and what to send. Screenshots go to the game's own folder
(`<Stellaris user dir>/screenshots/`, F12 in game); name the colony or system in the message.
Background for each is in `AGENTS.md` (sections named below).

## A. Screenshots from the real campaign (no cheats needed)

Session 2026-10-22 (Planetforgers, 2212.03.05, screenshots `2026_10_22_1`–`21`) settled outpost
and starbase costs, the market price formula, tech costs and research rates; results in
`AGENTS.md` → Open. What is left:

### 1. Pop growth: planet capacity — blocks the growth model

`AGENTS.md` → Open → "Pop growth: planet capacity": the logistic formula holds with the game's
capacity, but two colonies do not separate what capacity is built from (Embron 12600: housing
9800, 3 undeveloped districts at 50 %; Caugantu Prime 6100: housing 2900, 7 at 80 %).

- **Do:** hover a colony's **planet size** ("Colony Capacity") **before and after a district
  finishes** there (normal play, no cheats) — the difference is one district's share at that
  habitability; and the same for a third colony when there is one.
- **Send:** the tooltips, the colony and the dates.

### 4. Market buy price — produce tab (small remainder)

The formula is confirmed (base × (1 + fluctuation) × (1 + fee)): alloys 5.20, energy 1.24, food
1.30 match. Minerals (game 1.32, ours 1.31) and consumer goods (2.55, ours 2.56) lean the way the
monthly automatic trades push them (buy 42 minerals, sell 10 consumer goods) — the save's
fluctuation may lag the screen.

- **Do:** at the next autosave on the 1st, open the market with minerals and consumer goods.
- **Send:** the screenshot and the date.

## B. Throwaway-game sessions (console cheats; separate `DASHBOARD_DB`)

Setup as in `AGENTS.md` → "Testing in a throwaway game".

### 6. Trade calibration — blocks the trade tab's numbers

The whole session is written out in **`docs/trade-calibration.md`** (~1 hour): ~20 offers'
acceptance numbers (not sent) with three empires of different personality, four gifts' "Favorable
Trade Deal" and the opinion, its decay over two months, one non-trading attitude.

- **Send:** the filled tables (or screenshots of each offer's acceptance and each opinion
  tooltip) and the session's save folder name. Note whether `resource alloys 20000` or
  `resource 20000 alloys` worked in the console.

### 7. Stored research — tech tab

`AGENTS.md` → Open → "Stored research". The 4-day puzzle is solved (a monthly chunk after the
1st's autosave), and the game's tooltip shows stored research adding the modified monthly gain
while drawing the base. Left: confirm the draw per month equals the *base* gain over a few months,
and what a tech finishing mid-month does with its overflow — plain monthly autosaves of the
campaign suffice, no cheats.

- **Send:** nothing; read from the next autosaves (`tech_status.stored_techpoints` vs. progress).

## C. Not in the game

### 8. Releases

The extraction gained tables (starbase parts and levels, market lots, AI data, defines) that the
systems, produce, jobs and trade tabs need. Player zips bundle the extractor from the tag pinned
as `extractorVersion` (`v0.1.0`): release the extraction first (its `RELEASE.md`), bump
`extractorVersion`, then the dashboard (workspace `AGENTS.md`: release order).

### 9. After the answers come in

- 1 → fit capacity (`#lib/growth.ts`), then add "what +1 district / a cleared blocker / a medical
  building / an edict gains" and the colony ranking to the growth tab.
- 4 → `price()` in `#lib/market.ts`.
- 6 → fit `TradeModel` (`#lib/aiTrade.ts`), add the session's numbers as its test, set
  `calibrated`; then gift → opinion, monthly deals by length, and the produce tab's trade-deal
  option.
- 7 → the tech tab's "≈ N months at double speed" (stored ÷ base gain) stands if the draw is the base gain.
