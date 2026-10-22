# Open checks (from the 2026-10-22 session)

What the systems, produce, jobs, growth, tech and trade tabs still need from the game. Each item:
what is open, how to check it, and what to send. Screenshots go to the game's own folder
(`<Stellaris user dir>/screenshots/`, F12 in game); name the colony or system in the message.
Background for each is in `AGENTS.md` (sections named below).

## A. Screenshots from the real campaign (no cheats needed)

Session 2026-10-22 (Planetforgers, 2212.03.05, screenshots `2026_10_22_1`–`15`) settled the
outpost cost and the tech tab's rates; results in `AGENTS.md` → Open. What is left:

### 1. Pop growth: planet capacity — blocks the growth model

`AGENTS.md` → Open → "Pop growth: planet capacity". **Embron's capacity is 12600** (the planet
size tooltip, "Colony Capacity"; housing 9800, 3 free districts, 50 % habitability), and the game
confirms its 50 % habitability. The growth tooltip shows no breakdown (last month +5, "Estimated
Growth Next Month" 5.26). Still needed for the fit:

- **Do:** hover **Caugantu Prime's planet size** (planet view, the size number) — "Colony
  Capacity"; later, the same for a third colony of another size or habitability.
- **Send:** the tooltip and the save's date.

### 3. Starbase costs — systems tab

Seen: modules and buildings 50 alloys as in the files (Crew Quarters upkeep 0.74 = 1 × (1 − 20 %
Galactic Ambition − 6 % Minister of Defense)); outpost → starport **225 alloys, files 250** — a
−10 % whose source is not found (the Expansionist stance's `starbase_outpost_cost_mult` covers
outposts only by its name; no leader trait of ours matches).

- **Do:** on Embrala (starport), hover the **upgrade to starhold** (files: 1000 alloys).
- **Send:** the tooltip — 900 means a flat −10 % on upgrades, 1000 means it was the outpost's own.

### 4. Market buy price — produce tab

Internal market, fee 30 %: alloys buy 5.20 / sell 2.80 trade — the produce tab's 5.20 matches.
Minerals: game 1.32, ours 1.31 (fluctuation +0.765 % → 1.3 × 1.00765 = 1.3099); 1.3 × (1 + 2 ×
0.765 %) would give 1.32 — the fluctuation counted twice?

- **Do:** select **energy** (fluctuation −4.36 %: ours 1.24, "twice" would be 1.19) and consumer
  goods (−1.72 %: ours 2.56) in the market.
- **Send:** the screenshot of each buy price.

### 5. Tech screen — tech tab

Seen: the progress numbers match (753/1575, 1315/2750, 774/3300); rates fixed (see `AGENTS.md`).
Left: **rare tier-2 techs cost ×1.10, not ×1.05** (Volcanic Forge 2750, Arc Furnace 3300; tier 1:
1575) — rare or tier?

- **Do:** in the research screen, open a field's choices and note a **non-rare tier-2** tech's
  cost (e.g. Gravitic Sensors, base 2000: 2100 or 2200?). And a ★ permanent option when one is
  on offer.
- **Send:** the screenshot.

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
- 3 → apply the upgrade cost modifier in `#lib/systems.ts` (`starbaseGain`).
- 4 → `price()` in `#lib/market.ts`.
- 5 → `TECH_COST_OBSERVED_FACTOR` in `#lib/events.ts`.
- 6 → fit `TradeModel` (`#lib/aiTrade.ts`), add the session's numbers as its test, set
  `calibrated`; then gift → opinion, monthly deals by length, and the produce tab's trade-deal
  option.
- 7 → the tech tab's "≈ N months at double speed" (stored ÷ base gain) stands if the draw is the base gain.
