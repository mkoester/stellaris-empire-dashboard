# Open points

What is open, assumed, or confirmed in game, with dates and screenshots. Read before an in-game check and before calling a number verified; the numbered checks are in `open-checks.md`. _Moved verbatim from `AGENTS.md` on 2026-11-14._

## Open (needs a running game on Linux)

- **Waylines, our own (2026-11-16)**: the roaming tab was checked on the AI nomads' waystations
  only — `roamingcybergang` had none of ours at 2213.08. After building the first: its tier,
  modules, fill and stockpile against the waystation's own window, and a module's monthly
  collection against the tab's number. **Assumed**: the tier factor (×0.75 at Waystation I)
  applies to flat `starbase_collected_system_<r>_add` too (the Hydroponics Bay's food); the
  wayline groups follow neighbouring systems (matched the save's `waystation_networks` for all
  five AI waylines).

- **A dig site's chapter (2026-11-15)**: `DigSite.chapter` = the save's `index` + 1 is
  **assumed** — every site seen so far reads `index=0`. Check after a chapter's event: the
  frontier tab's Chapter column should read 2, and the Outcome's "← next" mark move with it.
- **Outcome trees against the game (2026-11-15)**: the frontier tab's Outcome for an anomaly
  or project should match what its event window offers when it completes (options, rewards). A
  tree is built from the files (`stellaris-data-extraction` `extractor/outcomes.py`), so
  conditions are known only as "depends", never evaluated.
- **Tabs that did nothing when clicked, 0.1.17 on mkTuxedCachy (2026-11-15)**: every tab but
  `mods` and `about` gave no visible effect, then worked again a little later. The user then saw
  it only with two or more dashboard tabs open; closing all but one cured it. Explained: each page
  held three `/api/events` streams (layout `followLoads` + `followTicks`, page `followGame`), and a
  browser gives a host 6 HTTP/1.1 connections — two tabs held all six, so each click's
  `__data.json` waited. `about` has no server load, which fits; `mods` has one, which does not.
  Fixed for 0.1.19: one stream for the whole browser (SharedWorker `#lib/eventsWorker.ts`, hub
  in `#lib/live.ts`). Still to confirm in the browser: 3+ tabs click through, DevTools shows one
  `/api/events`.
- **Map heights, unchecked in a browser (2026-11-17)**: `GalaxyMap.svelte`'s bottom-edge handle
  (pointer capture, `scrollAlong()`): drag a map at the page's end (the frontier tab) down past the
  window's bottom in one go — the page should scroll along and the map follow; the height should
  survive a reload; a click on the handle without a drag stores nothing. Also check that a map last
  on its page (the frontier tab's; every map in "wide + table") is square with nothing stored on a
  tall window, and on a low one ends with its legend in sight once scrolled to.

**The checks still owed from the 2026-10-22 session — what, how, which screenshot — are listed in
`docs/open-checks.md`** (growth capacity, outpost influence, starbase costs, market price, tech
screen, trade calibration, stored research, releases).

- **Ambitions (formerly Crisis), planned 2026-11-03**: data DB `crisis_path`, `crisis_level`,
  `crisis_objective`, `menace_perk` (extraction's design notes). Our own path: a `/ambition` tab
  (currency, level ladder with requirements and perks, objectives with this galaxy's reward,
  months to the next level). **Other empires' ambitions are a spoiler** (the user's decision,
  2026-11-03; switch `ambitionsAll`): on, who, what (path, level) and where (capital and the
  path's sites); off, only what the game tells a player (4.5.3 files). For Nemesis that's the
  personality "Crisis Aspirant" from the perk on, the "Mysterious Supernova"/Star-Eater alerts
  and the "Destroying Star Systems" opinion, and "Galactic Crisis Declared" at level 5. For
  Hyperthermia it's the personality "Thermarchy", plus the opinion "Thermarchy Empire" from
  level 2, which needs government intel 2 (everyone at 5). Behemoth shows warnings at level 5,
  Cosmogenesis nothing that names it, and Defender an opinion modifier. Ascension perks are in
  no intel category. **Unread: the save shape** (no local save has an ambition): in a
  throwaway game, save before and after `activate_ascension_perk ap_become_the_crisis`, then
  `resource menace 1000`. Also check whether the diplomacy screen lists another empire's
  perks.

- **Explored wormholes**: "both ends visited" is a proxy (reaching both ends by hyperlanes would
  show a link never jumped through; since 2026-11-20 only once Wormhole Stabilization is
  researched, which exploring needs — after that the proxy can still be wrong). At the first wormhole explored, diff its `bypasses.<id>`,
  `natural_wormholes.<id>` and the country block against an earlier save for a real marker.

- **Stations seen, exactly**: saves catch only the fleets present at save time. The companion mod
  could log each system entry (an `on_entering_system`-style on_action) with the station's shipset
  for `feed.ts`. Check the borders and the guesses against the game's map at the first sighting.

- **Megastructure scores, not yet checked in game**: the arc furnace's (Sol 20 at 2207.03.10)
  against the game's "best systems" tooltip; whether the catapult's `catapult_range_base` is in
  galaxy-map units (assumed); whether the in-system distance to
  the outermost body is what new ships of a mega shipyard travel (hyperlane arrival points are not
  stored); and whether the catapult's `max_jumps = 25` (another catapult) is a rule or AI weight.
- **Gestalt empires, first checked 2026-10-24** (throwaway Machine Intelligence, 2201.10.01;
  screenshots `~/Pictures/Screenshots/screenshot_2026-10-24_12-54-52` … `12-57-54`): a machine
  world's pops come from assembly (`GROWTH_CAT_ASSEMBLY` +4 = the game's "Monthly Pop Summary"),
  no natural growth — the growth tab shows both; jobs match the game's job screen pop for pop,
  in its strata `complex_drone` / `simple_drone` ("Menial Drones") / `maintenance_drone`; no
  factions (the game's "No Factions"). Jobs' output fixed 2026-10-24 (budget sources, `docs/save-format.md`); the
  species are named "Yorphid" (data DB `prescripted_name`) and "Trans-Yorphid" (the modified
  species' inline template `$affix$$base$`, `displayName()`). Not checked yet: habitability of a machine species on the
  expansion tab, galcom proposals barred to gestalts (`is_gestalt = no`), consumer goods on the
  produce tab.
- **Our factions**: confirmed against the game's factions screen at 2212.03.05 — support,
  approval, pops and their monthly change (`pops_change`, "(+51)") and both names match; the
  game **rounds percentages down** (support 0.05723 → 5 %, approval 0.99999 → 99 %), so the
  government tab does too. They form only after 10 years and the first other species met (4.5.2
  `is_faction_allowed`; 500 potential members). An autosave on the day one forms can lack
  `support_percent` (read as 0).
- **Faction Approval shows `+0.1`, not `+10%`**: `isPercentModifier` (`modifiers.ts`, copied from
  the planner's `civics.ts`) does not know `faction_approval`. Fix both copies together.

- **Stored research — partly understood** (the user's question 2026-10-22: event research "never
  seemed applied", so they skipped such rewards; their hypothesis: it applies when the next tech
  starts). The game's own text (4.5.2 `concepts_l_english.yml` `concept_research_shared`): "Stored
  Research is received from certain events or when no research is selected. Each month, Stored
  Research equal to the Monthly Gain is used, increasing research speed" — the tech view shows
  "Stored: X (+Y/Day)" (`TECH_POINTS_STORED_DESC`). So it is **not lost and not deferred**: it
  trickles in, research at up to double speed until it is gone. Read from the saves on disk
  (`tech_status.stored_techpoints` vs. the queues' progress):
  - United Nations, society 2207.01 → 02: stored 383 → 359, Eco Simulation +49/month vs. ~+24
    before — the doubling.
  - Planetforgers, physics 2206.05 → 2207.10: stored 801 → 0 over ~14 months while researching.
  - It also **fills while a field's queue is empty** (United Nations 2207.03.01: society 766, no
    society tech; Planetforgers 2207.10.02: society 930, none).
  - Planetforgers 2212.03.01: physics stored 0 → 1370 (an event), by 03.05 1310.66 — the drop,
    59.34, is **exactly one month's physics gain** (budget income 59.35), and Exotic Materials Labs
    gained +143 in those 4 days. **Explained 2026-10-22:** research arrives in one monthly chunk
    _after_ the autosave on the 1st (society +34.8, engineering +46.0 in the same 4 days — one
    month each), so that window holds March's chunk: 59.34 drawn from stored. The game's research
    tooltip at 03.05 (screenshot `2026_10_22_5`): "+168.07 progress/month" = base 59.60 × 1.41
    (+84.04) plus "Stored Research: +84.03" — stored adds the _modified_ monthly gain while
    drawing the base from the stock. `researchRate()` (`events.ts`) now measures per chunk; it had
    scaled 4 days to a month (+1072.6/month, "due in 1 month"; the game: 5). Confirmed by the
    next autosave: 03.05 → 04.01 left progress (753.42 / 1315.66 / 774.72) and stored (1310.66)
    unchanged — April's chunk comes after it.
    To check, in a throwaway game: note the monthly physics gain, `resource physics_research 1000`
    (does the console add to stored?), then a manual save every day for ~10 days
    (`fast_forward 1`): stored drop vs. progress per day, the tech view's "+Y/Day", and what a tech
    finishing mid-month does with its overflow. The tech tab shows stored research and "≈ N months
    at double speed" (stored ÷ the field's monthly income) — revise once the rate is confirmed.

- **Embron's 50 % habitability is a ceiling, not its value** (2026-10-22, screenshot
  `2026_10_22_3`): the tooltip sums 110 % (Volcanic Preference, Planet Forgers, Red Giant, …,
  Devouring Giant −50 %) but "Species Habitability Cap: 50 %" — `red_giant_stage_4` (the Red
  Giant Expansion situation around Embrala) carries `habitability_ceil_add −0.5` and
  `pop_environment_tolerance −0.5`; stage 5 has −0.7 (a 30 % cap). The save's per-species value
  already includes the cap, so the dashboard shows it right; a hint before the next stage would
  need the situation's stage thresholds.

- **Pop growth: planet capacity, solved** (2026-10-22, Planetforgers 2212.03.05–06.01, screenshots
  `2026_10_22_4`, `22`–`24`; not in the save). **Capacity = housing + 400 × free district slots**
  on normal planets (volcanic, arid), free = the game's max districts − built − **queued**
  districts — a district queued even far back takes its 400 at once, long before its housing
  arrives (`growthFlags` warns). Six readings matched exactly (Embron 12600 / 12200 queued /
  12600 with one more slot / 13200 once that district was built — its slot already counted, +600
  housing — Caugantu Prime 6100 / 6500). Species habitability (Caugantu 80 → 90 %)
  and housing usage (Adaptability −10 %) do not enter; a queued building does not. The max
  districts come from the game's tooltip: Embron 25 = 20 size + 3 `civic_world_forgers`
  (`pc_volcanic_max_districts_add`) + 1 Expansion finished + 1 Adaptive Ecology — `districtCaps`
  now reads civics, origin, traditions and perks (`empireOwners`, `planets.ts`). Players measured
  other per-slot values in 3.0 (×100 since 4.0): habitats 300, Gaia ~600, tomb worlds ~200, and
  ~400 per cleared blocker (r/Stellaris "Population growth strategies in 3.0", 2021) — not
  checked; habitats get no capacity. The logistic term from the defines fits:
  `LOGISTIC_POP_GROWTH_R` 0.0025 × pops × (1 − pops / capacity), capped at 5 — Caugantu 1.28
  (game 1.39, the rest growth speed). The growth tab shows the capacity (`planetCapacity`).

- **Outpost cost, confirmed** (2026-10-22, Planetforgers 2212.03.05, screenshots
  `2026_10_22_11`–`15`): influence 67, 135, 202, 270, 337 at 1–5 jumps from our nearest system =
  floor(75 × jumps × 0.9) — the step formula holds, × `country_starbase_influence_cost_mult`
  (Reach for the Stars −10 %); alloys 90 = 100 × the Expansionist stance's
  `starbase_outpost_cost_mult` −10 %. `outpostMults()` (`systems.ts`) reads those from the save's
  traditions, perks and policy; civics, origins, councilors and Shroud cycles are not read yet.
  **Starbase upgrades**: outpost → starport cost 225 alloys of 250, starhold 1000 of 1000 — the
  outpost's modifier covers its starport upgrade only (`starbaseGain`). Modules and buildings
  50 alloys as in the files.
- **Market price, confirmed** (2026-10-22, internal market, screenshots `2026_10_22_6`, `7`,
  `16`–`18`): buy = base × (1 + fluctuation %) × (1 + fee), in trade — alloys 5.20, energy 1.24,
  food 1.30 as `price()`; minerals and consumer goods off by 0.01 in the direction of that month's
  automatic trades.
- **Tech cost, confirmed** (2026-10-22, screenshots `2026_10_22_19`–`21`): base × (1 + 0.05 ×
  tier), rounded down — tier 1 1575 / 1312 / 1050, tier 2 2200 / 2750, rare or not
  (`techCostFactor`, `events.ts`).

- **Habitat district limits, not yet checked in game** (no habitat tech at 2207.03): whether
  `count_system_planet` counts the star as a major body (assumed yes: Sol 9 major → 8 districts),
  against the game's habitat placement tooltip.

- **Migration treaties: a foreign colony's case** — the treaty's flag is known (`migration_access`,
  2026-10-19), but the throwaway game's partner had no pops moving yet; check `/migration` once
  they do.
- **Battles: only some are recorded** — the throwaway war had more fights (the station, single
  civilian ships one by one) than its two `battles` entries; the station was killed by console
  `damage`, which may not count. Check at the next war which fights the list keeps.
- **Diplomacy tab: subjects and wars between others are assumed public**, and which pacts the
  game's diplomacy screen shows at which intel is from the files only. Check: a screenshot of an
  empire's diplomacy view at intel < 50 (no pacts expected) and one ≥ 50 against the tab; at the
  first intel drop (lost embassy or pact), whether the tab marks its facts "unverified since".
  Federations (`federation.<id>.name`, `country.federation`) are not yet seen in a save.
- **Diplomacy tab, ethics**: check the chips against the game's contacts screen (ethics column)
  for two or three empires, and `federation fit` against a real federation's cohesion tooltip
  ("Opposing ethics(N)", the defines' lines) — how a fanatic ethic and a gestalt count.
  **The game has its own distance**, engine-computed: the trigger `opposing_ethics_divergence =
{ steps > N who = <country> }` (4.5.2 `common/scripted_effects/first_contact_effects.txt`), and
  `calculate_ethics_divergence` in `script_values/01_script_values_paragon.txt` turns it into a
  value (`complex_trigger_modifier`, `mode = add`). The companion mod could export that per empire
  to check our steps (whether it counts only opposed axes is unknown).
- **Rivals of us, assumed**: `rivalsOfUs` reads another empire's relation to us as ours to them
  (`is_rival=yes`); no AI rivalled us yet (2205.06).
- **Galactic Community: session timing, solved** (2214.01.01): `galactic_community.days` counts
  the days a resolution has been on the floor, up to `RESOLUTION_VOTE_TIMER` (1440) — the game's
  "Senate is in session 899" was 1440 − 541; after the vote `voting` and `days` go and `cooldown`
  counts the recess down from `SENATE_RECESS_TIMER` (720). Resolution 9 (Regulatory
  Facilitation): days 1411 on 2213.12.01, `pass_date` 2213.12.30, cooldown 719 on 2214.01.01;
  `category_timers.<category>` = the pass date. `galacticCommunity()` gives `voteEnds` and
  `nextVote` (READER 13), the galcom tab shows them. Still unknown: `election` (180), and
  **votes are weighed by diplomatic weight**, which no country stores: companion mod 0.4.0
  exports it, else the tab estimates it (see "Galactic Community" in `docs/save-format.md`).
  Passed resolutions: `galactic_community.passed = { <ids> }`; resolution descriptions lose loc
  commands ("members of the should …" — `[global_event_country.GetGalCommunityOrGalImperium]`), an
  extraction loc-cleanup gap.
- **The game's own timeline, unused**: `country.timeline_events = { { date definition data types
} }` (`timeline_first_deficit`, `timeline_galactic_community_resolution`, `timeline_event_year`,
  …) — a ready milestone source beside our diffing.
- **Fleet combats outside wars**: each fleet's `fleet_stats.combat_stats` holds only its last
  combat and is cleared some time after (2205.10.14's: in the 11.01 save, gone by 12.01), so the
  contacts tab's log (`combats()`, `combatLog()`) has what monthly saves caught. The losses are as
  of the save: 2 of the salvagers' 3 at 11.01, the game's report says 3 of 3. The companion mod
  0.2.0 logs every battle we fight (`combat` milestones); not yet seen in game, and the contacts
  tab does not use them yet.
- **The Shroud, open points** (2206.01.01, after the first delve; screenshot 2026_10_19_7): our
  `modules.standard_shroud_module = { attunement = { x y } month_start_attunement
last_month_attunement_offset patron_relations = { <ids> } last_delve_date }`; top-level
  `patron_relations.<id> = { owner patron position = { x y } contact calling = { tier
calling_start_date completed patron_objective } deeds = { { patron_objective } }
unlocked_passive_accords_count pre_communications_name … }` — eight patrons on a circle
  (positions ±1 / ±0.7), contact `none` or `completed` (the Composer of Strands after the delve),
  `is_preferred_patron` on the country. **A patron's standing (the game's
  "65 / 1000") is `month_start_attunement` towards it, × 1000** — confirmed 2026-10-19 over four
  autosaves: the Composer at (0, −1) showed 50 with month-start y −0.05 and 65 with −0.065, while
  `attunement` (y −0.2, then −0.215) runs a month ahead and 0.15 further. Whether it is the dot
  product with the patron's position or the distance along its axis is still open for the
  diagonal patrons (±0.7, ±0.7). The **shroud tab** (`/shroud`, `#lib/shroud.ts` pure,
  `shroud()` in save.ts; data DB `patron`, `calling*`, `deed`): a compass of the contacted
  patrons with our attunement (now and month start), and per contacted patron its standing, the
  calling (tier, reward), its deeds and — negative — the opposite patron's (the save's five
  each), accords and covenant. Uncontacted patrons stay hidden, as in the game. Still to see: a
  completed calling, an accord unlocked, a favor.
- **Companion mod 0.5.0's storage: confirmed** (throwaway game, 2200.05.01, the first autosave
  after loading 0.5.0; screenshots `~/Pictures/Screenshots/screenshot_2026-10-24_11-57-04`, `-22`):
  `sdash_m_<res>` for every resource with storage on us (unity, research and nanites give
  nothing), the tradable ones on all 16 empires we talk to; the resources panel drops its ≈ and
  shows the game's top bar (25K energy, 15K, 50K trade). It confirmed three rows of
  `docs/storage.md` without a tooltip: the base (us and most AIs); fallen empires at base +
  120,000 (`fallen_empire_base` 100,000 + Mega-Engineering 20,000, which both have — the
  campaign's 135,000 minerals); bio ships (two empires with Biogenesis shipsets: food 25,000,
  alloys 12,500). No AI difficulty bonus at this setting.
- **Companion mod 0.4.0's diplomatic weight: confirmed** (2214.02.01, the first autosave with
  it): `variables.sdash_dw` on all 13 members, equal to the game's screen (642.41 → 642, …) and to
  the weights solved from the 2214.01.01 tallies. Open: the council's × 1.5 (no council yet).
- **Companion mod 0.3.0's spending events, not yet run in game** (written 2026-10-22): whether
  `carrier_event` is the right type for the "This = Colony" hooks (vanilla uses it for
  `on_building_complete`), whether `[This.GetName]` there gives the planet's name as the save's
  construction items name it, and whether a colonization's planet already has an `owner`. An older
  dashboard skips the new kinds (`parseLine` returns null for an unknown kind).
- **Companion mod 0.2.0, not yet run in game** (written 2026-10-20 from 4.5.2's script docs):
  the daily tick (one set of `tick` lines per date, also after save/load — never two), the `load`
  line's id against the loaded save's `sdash_tl`, each event line's names (do `[From.GetName]` in
  `on_war_beginning` and `[FromFromFrom.GetName]` in `on_space_battle_won` resolve, or print
  blank?), and whether event labels match the diffed ones (no duplicates on `/events`).
- **District caps via the mod, to check the computed ones**: the `free_district_slots` trigger
  (colony scope) can be exported with `export_trigger_value_to_variable`; no trigger for free
  building slots found. Matched by hand for Earth only.
- **`continue_game.json` on load**: if the game rewrites it when a save is _loaded_, it names the
  branch point exactly — `place()` already takes that as `loadedFrom`, nothing feeds it yet.
- **Companion mod, first loaded 2026-10-19** (throwaway game): it fires monthly and `[GetDate]`
  prints `2200.02.01` (zero-padded, as `feed.ts` expects). The first build's lines were garbled — a
  `$RES$` parameter inside the quoted log string lands one character off — so each line is now
  spelled out in the event. **All three first-run guesses hold** (2205.09.01, after a restart):
  variables print as plain decimals (`2460.95365`, unity `99861092.57269`), and
  `export_resource_income_to_variable` is net income — energy −19.36242 and minerals 36.04496,
  exactly the save's balance that day.
- **Galactic market prices**: `market()` reads `market.fluctuations` /
  `galactic_market_resources` as lists by resource index — confirmed on a 4.0.1 save at 2312
  (chennin/stellaris-dashboard-test-saves; 24 slots there vs. 26 resources in 4.5.2, so the order
  follows the game version's `strategic_resources`), and in our own game (Yorphia, founded from
  the console 2201.05.01): 26 slots, open for the basic five and the rare ones, every fluctuation 0
  through 2203.10.01 — we alone had access and never traded on it; the market tab says so. The
  game's market screen at base prices is still to be screenshotted. Prices exist
  only for saves read since 2026-10-17; older ones' saves are gone.
- **`/migration` holds four variants to compare** (over time, matrix, monthly flow, map) — the
  user picks which to keep, then drop the rest.
  The map has a **circle** mode (the user's ask 2026-11-01; the profile's `migrationView`: layout
  and order, `MigrationCircle.svelte`, geometry shared with the diplomacy circle in `#lib/circle.ts`):
  our arkships clockwise from 12 o'clock — oldest first (`arkshipFirstSeen()`: the first save
  listing the ship, then ship id; the save's `construction_date` reads 2200.01.01 for every
  arkship, later ones too), by size (tier, then planet size) or by name (`arkshipOrder()`) —, every
  other migrating colony in a group after a gap. **Our arkship colonies migrate too** (`migration()`
  rows since READER 41, placed where the ship is): before, the rows came from planets only, and a
  nomad without a treaty partner got "No colonies." and no map. Other empires' arkship colonies
  stay out — a colony names no owner.
- **Next, the user's plan:** a configurable main dashboard (custom tabs pick empire panels now;
  the migration and planet panels are not pickable yet).
- **The daily tick on the 1st, before or after the payout?** `unbooked()` takes the payout off
  the step that crosses a month start. Saves on the 1st are after it (checked); if the mod's tick
  or monthly line on the 1st runs before it, a month shows +payout on the 1st and −payout on the
  2nd. Check on the first campaign played with mod 0.2.0.
- **Hint rules**: not started.
- Cross-check the parsed numbers against the in-game UI.
