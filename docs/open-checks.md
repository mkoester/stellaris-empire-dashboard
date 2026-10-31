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

### 4b. Cooldowns, rolls and travel in Upcoming (2026-10-25) — throwaway game

Per item: a manual save before and after (diff in `$TMPDIR`), a screenshot of the greyed-out
tooltip ("available in …"), the dashboard's row for comparison. **Done 2026-10-25** (throwaway
`unitednationsofearth_-15512622`, results in `AGENTS.md` → "Cooldowns and expiries" and "Run-out
cooldowns stay"): minor artifact actions, the relic triumph, Satisfying Insults, colony decisions
on two colonies, species rights, moving the capital, the reform date, insults per empire, and a
run-out cooldown dismissed on a reloaded branch. Still open:

1. **Astral actions**: `resource astral_threads 5000`, use one — which field records the use and
   its engine `cooldown` (data DB `astral_action_cooldown`); `usages` in the country block.
2. **Dimensional Lock** on a wormhole: the lock's save fields while built (180 days) and while it
   holds (3600), and their end against the game's tooltip.
3. **Shroud / psionic**: a delve (`last_delve_date`, `shroud_cooldown*`), a Shroud power or covenant
   used, a calling refreshed (`CALLINGS_REFRESH_COOLDOWN_DAYS` 360).
4. **Engine cooldowns left**: a federation law change (its timers sit on the federation, not read
   yet), the jump drive (`jump_drive_cooldown`).
5. **Rolls**: an envoy on a first contact and a science ship on a dig site — the next roll's date
   against `days_left`, and the cycle after a roll (`last_roll`).
6. **Days per jump**: a military fleet and a science ship over a known number of jumps, with a
   manual save each few days — calibrates `DEFAULT_DAYS_PER_JUMP` (10, a placeholder).

### 5. Trader enclave deal — trade tab

The trade tab prices XuraCorp's exotic gases (and the Riggans' motes, Muutagan's crystals) from
the 4.5.2 event script: 500·N energy at once, +N a month and −10·N energy a month for 10 years,
N = 1…5 — 14.2 energy a unit whatever N. Not yet seen in game; a deal's modifier in the save
(`enclave_trade_N_xur`) is what the tab reads as "our deal".

- **Do:** open XuraCorp (in contact in the campaign) → strategic resource; hover the options.
- **Send:** a screenshot of the options and their tooltips. If you take a deal, the date — the
  next autosave should show it on the trade tab.

### 11. Predicted votes — galcom tab, Proposable (from 2026-10-23)

Each AI's vote is predicted from the resolution's `ai_weight` × its opinion of us (0.5 at −750,
1.3 at 750, **linear between — assumed**). Checked only on Buzzword Standardization (base 7: the
three members with negative opinion missing from the game's list, exactly). The other proposable
ones carry `?` (conditions the save cannot answer for other empires).

- **Do:** on the Resolutions screen, hover "… Support" of each resolution the tab lists as
  proposable now (Charter of Worker's Rights, Equal Standing Act, Exploitation Act, the two Storm
  ones, Form Galactic Council).
- **Send:** each "Empires likely to support this Resolution" tooltip — compared with the tab's
  "for" list, it tests the opinion curve away from neutral and the unknown conditions.

### 12. Diplomatic weight with envoys or a council seat — galcom tab

Our weight's breakdown matched the game's tooltip at 2214.02.01 (no envoy in the Community, no
council). Envoys (`diplo_weight_delegate_mult`, +10 % each, Gravitas +2.5 %) and a council seat
(`diplo_weight_council_mult` +20 %, and × 1.5 when voting — `COUNCIL_DIPLOMACY_WEIGHT_MODIFIER`)
are listed, not summed.

- **Do:** once an envoy is assigned to the Galactic Community (or the council forms with us on
  it), hover our weight next to "Proposal Queue".
- **Send:** the tooltip; then the tab's "not explained" line shows how far off it is.

### 13. What intel shows of others — diplomacy tab

The tab follows the game's intel levels from the files (pacts and opinions from intel 50) and
treats subjects and wars between others as public — an assumption.

- **Do:** open the diplomacy view of one empire we have intel < 50 on and one ≥ 50.
- **Send:** both screenshots — which pacts, rivals, subjects and wars the game shows of them.

### 15. Naval capacity, and the `all` tab's error page (from 2026-10-25)

Companion mod 0.6.0 exports the naval capacity (`sdash_nc`); never run in game. Separately, the
Mac run of 0.1.1 showed a 500 on the `all` tab after a month, gone on reload — not reproduced
(every replayed state renders server-side), so a browser-side error; charts now rebuild when their
lines change, the suspected cause.

- **Do:** with mod 0.6.0, let an autosave pass with the `all` tab open; keep the browser's
  developer console open (it names a browser-side error).
- **Send:** a screenshot of the fleet manager's naval capacity and the date; any console error
  and the start window's output if the 500 shows again.

### 16. Ethics attraction — the factors the save cannot tell (from 2026-10-30)

Settled 2026-10-30 (throwaway nomad game, 2200.05.01, screenshots
`~/Pictures/Screenshots/screenshot_2026-10-30_20-09-12` … `20-09-53`; `AGENTS.md` → Ethics tab).
**Settled 2026-10-31 on the 4.5.3 open beta** (Roaming Korinth 2204.08.01, save; dashboard's
ethics tab): the rules now add onto 1, and what the save cannot tell is the council —
`value:count_councilors_with_ethic` = 0.1 (`@council_ethic_attraction`) per ruler or councilor with
the ethic. Egalitarian ×2.45 = 2.25 known + 0.2 (two councilors), xenophile ×2.1 = 2 + 0.1 (one),
spiritualist ×2.1 = 2 + 0.1 (the ruler): every remainder exact, so "From Relations" was 0. The
4.5.2 numbers (×3 = ×2.5 × 1.2, ×2.2 = ×2 × 1.1) fit the same count as a factor. The game's
tooltip (`screenshot_2026-10-31_01-49-58` … `01-50-08`) shows pop attraction, not these factors.
Done 2026-10-31: the dashboard counts the council rule from the save's leaders (extractor
`ethic_attraction.per_json`); the three ethics read ×2.45 / ×2.1 / ×2.1, known in full.

### 17. Amenities, happiness and stability — colony page (from 2026-10-30)

Settled 2026-10-30 (Roaming Korinth 2203.02.01, screenshots
`~/Pictures/Screenshots/screenshot_2026-10-30_22-12-11` … `22-13-38`): approval → stability and
stability → job output are linear (+28.5 at 97.5 %, +28.88 % at 98.143); the amenities' +20 % cap.
**Settled 2026-10-31 (4.5.3 open beta, 2204.08.20, `screenshot_2026-10-31_01-49-08`):** amenities
between the ends are linear too — 9659 provided for 6020 needed (1.604×) gives "Citizen Pop
Happiness +12.0 %"; linear predicts +12.09 % (a curve would be far off: squared, +7.3 %). The
save (2204.08.01) holds 9655.6 / 6020 / 3635.6 free against the tooltip's 9659 / 6020 / 3639 nineteen
days later.

## B. Throwaway-game sessions (console cheats; separate `DASHBOARD_DB`)

Setup as in `AGENTS.md` → "Testing in a throwaway game".

### 6. Trade calibration — the rest (paused 2026-10-23)

The trade model is fitted to tooltips at 16 empires, gifts and deals (2026-10-23; summary in
`docs/trade-calibration.md` → What we know, how to resume → Paused). Done in the campaign without
cheats — tooltips set up, not sent — not in a throwaway game. Open:

- the gift's decay: solved (2026-10-24) — the whole stack loses 2 a year, on the first gift's
  anniversary; a further gift does not reset it (`docs/trade-calibration.md` → Gifts);
- when a monthly deal breaks: in game it ended with "the other empire can't afford the monthly
  rate of resource X" — at a zero stockpile, or a negative net income? The deal finder's monthly
  mode assumes the stockpile runs out (net income after paying, months it lasts);
- the drift of basic resources (minerals and food up 6–9 % every half year, energy 10 % then
  flat, the rest steady; ruled out so far: `docs/trade-calibration.md`): its shape — KhellZen's
  seven-resource tooltip (nothing sent) at every monthly autosave for a few months. Smooth points
  to time, steps to a state change on their side (then compare that month's save). 2213.08 → 2214.01:
  no step, ~1 % down at 10,000's resolution. Mind an AI's room (0.8 of storage): offer 10,000
  only where it fits;
- the galactic market: **still open** — the 2026-10-24 throwaway test (`docs/trade-calibration.md`)
  founded it with us as its only member (no Galactic Community, so no AI had access); it showed our
  access changes nothing an AI values, not what an AI on the market does. Redo with the Community
  founded and the AIs in it;
- strategic resources: at once measured (2200.03.01 throwaway game, `docs/trade-calibration.md`);
  left: one monthly deal to confirm the 0.5 × months rule holds for them too (nanites are not
  tradable);
- the basic resources' curves at game start differ from the campaign's (consumer goods, alloys,
  food, trade; same file): when do they change — a step at some event, or gradually?;
- where a fallen empire's room really ends in a deal: its storage is known now (companion mod
  0.5.0: base + 120,000), so offer it alloys up to and past 0.8 of that to see the cut-off.

### 7. Stored research — tech tab

`AGENTS.md` → Open → "Stored research". The 4-day puzzle is solved (a monthly chunk after the
1st's autosave), and the game's tooltip shows stored research adding the modified monthly gain
while drawing the base. Left: confirm the draw per month equals the _base_ gain over a few months,
and what a tech finishing mid-month does with its overflow — plain monthly autosaves of the
campaign suffice, no cheats.

- **Send:** nothing; read from the next autosaves (`tech_status.stored_techpoints` vs. progress).

## C. Not in the game

### 14. Storage, computed — resources panel (open task, 2026-10-24)

Without companion mod 0.5.0 the resources panel's storage is ≈ the base. Compute it instead, with a
breakdown like the game's tooltip, from the sources in `docs/storage.md`; check it against the
mod's exact value. Needs: researched techs in the snapshot (`tech_status.technology`: Construction
Templates, Mega-Engineering), our silos (planet zones' `building_resource_silo`, starbase
`resource_silo` — `Station.buildings`), influence left out (it ignores the general modifier), passed resolutions, relics,
civics, bio ships, Dyson gun stage — and an extraction fix: `building_modifier` sums the Resource
Silo's and Subterranean Cache's two blocks into a flat +10,000, dropping the Construction Templates
condition; starbase buildings', resolutions' and relics' storage modifiers are not extracted.

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
