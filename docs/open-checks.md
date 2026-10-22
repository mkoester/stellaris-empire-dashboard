# Open checks (from the 2026-10-22 session)

What the systems, produce, jobs, growth, tech and trade tabs still need from the game. Each item:
what is open, how to check it, and what to send. Screenshots go to the game's own folder
(`<Stellaris user dir>/screenshots/`, F12 in game); name the colony or system in the message.
Background for each is in `AGENTS.md` (sections named below).

## A. Screenshots from the real campaign (no cheats needed)

### 1. Pop growth: planet capacity — blocks the growth model

`AGENTS.md` → Open → "Pop growth: planet capacity". Capacity is housing + room from undeveloped
districts (more with better habitability) + cleared blockers; the formula is engine code.

- **Do:** for **three colonies** — the capital, Caugantu Prime (small, 7 free districts, 80 %
  habitability) and one more of another size or habitability — open the colony and hover the
  **pop growth** number (the growth breakdown).
- **Send:** a screenshot of that tooltip per colony (base growth, any capacity figure, growth
  speed modifiers); if it names capacity anywhere else (the planet size tooltip), that one too;
  plus the save's date. The dashboard's growth tab of the same date shows housing, free
  districts and habitability for the fit.
- **Also check on Embron:** the growth tab shows **50 % habitability** (the save's pop-weighted
  value; it was 100 % at game start). Screenshot the planet's habitability (planet view or the
  species tooltip there) — if the game says 100 %, our reading is wrong.

### 2. Outpost influence cost — systems tab

`AGENTS.md` → Open → "Outpost influence, estimated". We charge 75 + 75 × (jumps − 1) from the
nearest own system.

- **Do:** with a construction ship, hover "build outpost" on systems **1, 2 and 3 jumps** beyond
  the border (before building).
- **Send:** the three cost tooltips (influence and alloys), and the systems' names.

### 3. Starbase costs — systems tab

- **Do:** on a starport, hover the upgrade to starhold, one module (e.g. Trade Hub) and one
  building (e.g. Hydroponics Bay) in the build menu.
- **Send:** the three tooltips (cost, upkeep). Expected from the files: starhold 1000 alloys,
  modules 50 alloys, hydroponics 50 alloys / 1 energy — differences are modifiers we do not
  apply yet.

### 4. Market buy price — produce tab

- **Do:** open the market, select alloys (and one more resource).
- **Send:** the screenshot showing the buy price per unit and the fee. Compare with the produce
  tab's "Market: … trade per Alloys, fee … included".

### 5. Tech screen — tech tab

- **Do:** open the research screen with a permanent option on offer (★ on the tech tab).
- **Send:** a screenshot of the three fields' cards, and the hover over a field's research
  showing **"Stored: X (+Y/Day)"** if it has stored research. Checks: the ★ techs, the progress
  numbers, and the stored amount and its daily rate (see 7).

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

`AGENTS.md` → Open → "Stored research". The game says stored research is used each month up to
the monthly gain; our saves show a drop of exactly one month's gain in 4 days but +143 progress
(~11 expected).

- **Do:** note the monthly physics gain (top bar tooltip); console `resource physics_research 1000`
  (check the order as in 6); then **10 days in a row**: `fast_forward 1` and a manual save. Also
  let one tech finish mid-month and save the day after.
- **Send:** the save folder name, and a screenshot of the research screen's "Stored: X (+Y/Day)"
  on the first day. The rest comes from the saves (stored vs. progress per day).

## C. Not in the game

### 8. Releases

The extraction gained tables (starbase parts and levels, market lots, AI data, defines) that the
systems, produce, jobs and trade tabs need. Player zips bundle the extractor from the tag pinned
as `extractorVersion` (`v0.1.0`): release the extraction first (its `RELEASE.md`), bump
`extractorVersion`, then the dashboard (workspace `AGENTS.md`: release order).

### 9. After the answers come in

- 1 → fit capacity (`#lib/growth.ts`), then add "what +1 district / a cleared blocker / a medical
  building / an edict gains" and the colony ranking to the growth tab.
- 2, 3 → correct `outpostInfluence()` and apply cost modifiers in `#lib/systems.ts` if needed.
- 6 → fit `TradeModel` (`#lib/aiTrade.ts`), add the session's numbers as its test, set
  `calibrated`; then gift → opinion, monthly deals by length, and the produce tab's trade-deal
  option.
- 7 → fix the tech tab's "≈ N months at double speed".
