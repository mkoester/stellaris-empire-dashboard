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

### 6. Trade calibration — the rest

The trade model is fitted to tooltips at 16 empires, gifts and deals (2026-10-23; summary in
`docs/trade-calibration.md` → What we know). Done in the campaign without cheats — tooltips set
up, not sent — not in a throwaway game. Open:

- the gift's decay: none in four months (the files say −2 a month) — does it start later, or only
  below some value? Watch the autosaves;
- when a monthly deal breaks: in game it ended with "the other empire can't afford the monthly
  rate of resource X" — at a zero stockpile, or a negative net income? The deal finder's monthly
  mode assumes the stockpile runs out (net income after paying, months it lasts);
- the drift of basic resources (minerals and food up 6–9 % every half year, energy 10 % then
  flat, the rest steady; ruled out so far: `docs/trade-calibration.md`): its shape — KhellZen's
  seven-resource tooltip (nothing sent) at every monthly autosave for a few months. Smooth points
  to time, steps to a state change on their side (then compare that month's save). 2213.08 → 09 →
  10: no change;
- once the **galactic market** is founded (`Snapshot.market.galactic`): the same tooltips again —
  1000 energy, minerals, food, trade, consumer goods and alloys at KhellZen and Lolehndra (set
  up, not sent), plus a manual save. Does the market move what a resource is worth to an AI, or
  the drift?;
- volatile motes, exotic gases, rare crystals and the other strategic resources: monthly deals
  with tooltips, in the nomad test game (nomads have them from the start);
- one deal (not a gift) offered to an empire whose attitude does not trade: the −1000 the defines
  give (`OFFER_TRADE_ACCEPTANCE_ATTITUDE`) is not seen yet.

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

### 10. Which empire would accept an embassy, a pact, subjugation — trade tab (idea, 2026-10-23)

Open question: can the trade tab show, per empire, whether it would accept an embassy, each pact
(non-aggression, commercial, research, migration, defensive) and vassalization — and why not? What
the files give (4.5.2 `common/defines/00_defines.txt`, `*_ACCEPTANCE_*`): per action a sum of
opinion × a factor (embassy 0.5, commercial 0.4, research 0.4, NAP 0.2, defensive 0.2, migration
0.5), the AI's attitude (alliance / coexist / other), existing pacts of that kind (−30 or −50 each),
border distance, shared rivals, allies and threat, relative strength; commercial pacts add the
trade value collected (`COMMERCIAL_PACT_ACCEPTANCE_GIVEN/TAKEN_VALUE`), research agreements the
techs one has and the other not; vassalization power difference, pops, loyalty and threat; plus
each action's `AI_acceptance_base_value` in `common/diplomatic_actions/00_actions.txt` (commercial
pact −50). Most inputs are in the save (opinion, attitude, pacts, rivals, relations; distance and
strength need work); the engine may add terms the files do not show, as the trade valuation did.
**Calibrate like trade:** the diplomacy screen's acceptance tooltip per action at a few empires,
against the formula — the files are a starting point, not the answer.

### 9. After the answers come in

- Growth (capacity done): add "what +1 district / a cleared blocker / a medical building / an
  edict gains" and the colony ranking to the growth tab; check the per-slot value on a habitat or
  Gaia world when there is one.
- 4 → `price()` in `#lib/market.ts`.
- 6 → add P for each newly measured resource to `WORTH` (`#lib/aiTrade.ts`) and its tooltips to
  the test; then gift → opinion, monthly deals by length, and the produce tab's trade-deal
  option.
- 7 → the tech tab's "≈ N months at double speed" (stored ÷ base gain) stands if the draw is the base gain.
