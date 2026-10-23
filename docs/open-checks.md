# Open checks (from the 2026-10-22 session)

What the systems, produce, jobs, growth, tech and trade tabs still need from the game. Each item:
what is open, how to check it, and what to send. Screenshots go to the game's own folder
(`<Stellaris user dir>/screenshots/`, F12 in game); name the colony or system in the message.
Background for each is in `AGENTS.md` (sections named below).

## A. Screenshots from the real campaign (no cheats needed)

Session 2026-10-22 (Planetforgers, 2212.03.05, screenshots `2026_10_22_1`–`21`) settled outpost
and starbase costs, the market price formula, tech costs and research rates; results in
`AGENTS.md` → Open. What is left:

### 4. Market buy price — produce tab (small remainder)

The formula is confirmed (base × (1 + fluctuation) × (1 + fee)): alloys 5.20, energy 1.24, food
1.30 match. Minerals (game 1.32, ours 1.31) and consumer goods (2.55, ours 2.56) lean the way the
monthly automatic trades push them (buy 42 minerals, sell 10 consumer goods) — the save's
fluctuation may lag the screen.

- **Do:** at the next autosave on the 1st, open the market with minerals and consumer goods.
- **Send:** the screenshot and the date.

### 5. Trader enclave deal — trade tab

The trade tab prices XuraCorp's exotic gases (and the Riggans' motes, Muutagan's crystals) from
the 4.5.2 event script: 500·N energy at once, +N a month and −10·N energy a month for 10 years,
N = 1…5 — 14.2 energy a unit whatever N. Not yet seen in game; a deal's modifier in the save
(`enclave_trade_N_xur`) is what the tab reads as "our deal".

- **Do:** open XuraCorp (in contact in the campaign) → strategic resource; hover the options.
- **Send:** a screenshot of the options and their tooltips. If you take a deal, the date — the
  next autosave should show it on the trade tab.

## B. Throwaway-game sessions (console cheats; separate `DASHBOARD_DB`)

Setup as in `AGENTS.md` → "Testing in a throwaway game".

### 6. Trade calibration — blocks the trade tab's numbers

The whole session is written out in **`docs/trade-calibration.md`** (~1 hour): ~20 offers'
acceptance numbers (not sent) with three empires of different personality, four gifts' "Favorable
Trade Deal" and the opinion, its decay over two months, one non-trading attitude. Rows 21–24
(added with the trade price panel) pin down trade's own worth — the model's `tradeWeight` guess —
and whether a nomadic empire can put energy or minerals into a deal at all.

Partly done in the campaign (2026-10-23, `docs/trade-calibration.md` → Results): the
acceptance's form, energy and minerals, the monthly cap. Open: what food, consumer goods, alloys,
strategic resources and trade are worth (a second empire), a one-off payment against monthly, and
the gifts.

- **Send:** the filled tables (or screenshots of each offer's acceptance and each opinion
  tooltip) and the session's save folder name. Note whether `resource alloys 20000` or
  `resource 20000 alloys` worked in the console.

### 7. Stored research — tech tab

`AGENTS.md` → Open → "Stored research". The 4-day puzzle is solved (a monthly chunk after the
1st's autosave), and the game's tooltip shows stored research adding the modified monthly gain
while drawing the base. Left: confirm the draw per month equals the _base_ gain over a few months,
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

- Growth (capacity done): add "what +1 district / a cleared blocker / a medical building / an
  edict gains" and the colony ranking to the growth tab; check the per-slot value on a habitat or
  Gaia world when there is one.
- 4 → `price()` in `#lib/market.ts`.
- 6 → fit the rest of `TradeModel` (`#lib/aiTrade.ts`), add the numbers to its test, set
  `calibrated`; then gift → opinion, monthly deals by length, and the produce tab's trade-deal
  option.
- 7 → the tech tab's "≈ N months at double speed" (stored ÷ base gain) stands if the draw is the base gain.
