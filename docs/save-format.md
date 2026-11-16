# Save format

Where each value sits in a save and how the game computes it. Read before reading a new field from a save or fitting a formula. _Moved verbatim from `AGENTS.md` on 2026-11-14._

## Save format facts (4.5.2, read from a real save)

**Contracts** (Planetforgers 2214.02.01, Proton): top-level `missions = { <id> = { mission="<key>" issuer operator location={ type=4 id=<system> } … } }` holds contracts and situation-log missions alike (star journals: `issuer=4294967295`), gaps as `<id>=none`; `contracts = { available = { ids } in_progress = { ids } }` says which are contracts. An offer has `days_left` and `operator=4294967295`, an accepted one `accepted_date` and `status=active`; an internal one (Eternal Chorus, Forever Cruise's) has operator = issuer while still offered. 18 contracts there, from 9 issuers.

**Planet flags** (`planet.flags = { <flag>=<date> … }`, 2210.10.20): every flag the planet carries,
`set_carrier_flag` ones assumed among them (seen: `colony_event`, `mechanical_species0`; a
`perfect_organization` never seen). A timed flag's value is a block with `flag_days`
(`timedFlags()`). Read whole as `Colony.flags` since READER 59, for `has_carrier_flag` /
`has_planet_flag` in planet decisions.

**For a shape not yet seen in our saves** (wars, trade deals, galactic market): the other parser,
eliasdoehne/stellaris-dashboard (`stellarisdashboard/parsing/timeline.py`), reads many; a 4.0.1
save at 2312 lives in chennin/stellaris-dashboard-test-saves (galactic market and GalCom, but
still no trade deal). **What the engine does with a field** (not in any game file): MattMills/
stellarstellaris-win, a reverse engineering of the GOG 4.5.2 build, unofficial — `docs/pops.md`
(growth rounded at random each month, no remainder kept), `docs/ethics.md` (`pop_groups.<id>.fractions`
= the faction-change remainder, `-1` no faction); it agreed with the saves on both (2026-11-02).
Download into `$TMPDIR`, never into the repo. **To find where a save keeps
something**, grepping the raw `gamestate` is not enough: the names are not what you expect (a
branch office is `externally_owned_buildings`, not `branch_office*`). Parse it with jomini
(`parseText(…, q => q.json())` in a throwaway `.mjs` in the repo, so `jomini` resolves; deleted
after) and walk the JSON for keys or values — that found it in minutes where a hand-written
parser of the text did not.

A `.sav` is a zip of `meta` and `gamestate`, both plaintext Clausewitz (~20 MB `gamestate` at 2200).

- Player: top-level `player = { { name country=<id> } }`.
- Stockpile: `country.<id>.modules.standard_economy_module.resources`.
- Monthly flows: `country.<id>.budget.current_month|last_month.income|expenses.<source>.<resource>`.
  **The market's standing orders are booked apart** in `trade_income|trade_expenses|trade_balance`
  (`monthly_trades.<resource>`); the game's top bar includes them (2200.04: energy 118 − 80 = +38).
  The orders themselves: top-level `market.monthly_trades = { { trade_data = { trade_type=
market_buy|market_sell resource country } amount } }`.
- **Slave Market** (4.5.3, Fangnaur 2200.02–08, the first filled one we saw): top-level
  `slave_market_manager = { slaves_on_market = { { key=<pop group> value=<pops offered> } } }`,
  empty `{}` until someone sells. Nothing else per offer — no seller, price or date: the seller is
  whoever controls the colony in the pop group's `planet` (a **colony** id, `country.
controlled_colonies`). The offered pops stay in their group (71: still 802 while 100 were on
  sale) and on a sale move into **new** groups of the buyer (two new ids on its capital), so a save
  cannot tell the buyer — the mod's `slave-sold` line can. Only the UI ("Sell Slaves") and the AI
  (20 % a month, `AI_SLAVE_MARKET_SELL_INTERACTION_CHANCE`) put pops on it; it needs Galactic
  Market access (in a throwaway game: `galcom.16`, `action.96`, nominate, `action.98`; another
  empire as `play <id>` then `effect set_country_flag = has_market_access` and `effect
enable_galactic_market = yes`). GalCom bans: global flags `organic_slave_trade_banned_flag`,
  `sentient_slave_trade_banned_flag` (`Snapshot.slaveTradeBans`).
- Market prices: `market.internal_market_fluctuations = { country=<id> resources={ energy=-15.9 … }
… }` (jomini: `country` and `resources` become parallel arrays), percent off the base price,
  only resources that moved. Base price per unit = `market_price` (100 for all) / `market_amount`
  (`common/strategic_resources`). **The fee is not stored**: `marketFee()` sums it — 30 %
  (`MARKET_TRADE_FEE_BASE`) plus each `country_trade_fee` source the save shows (traditions,
  `country.timed_modifier.items[].modifier`, colony and station buildings), at least 5 %; the list
  is every `country_trade_fee` in 4.5.2's `common/`, re-grep on game updates. Checked at
  2207.03.10 against the budget's `trade_income|trade_expenses.monthly_trades`: buying 107 booked
  vs. 107.3 computed, selling 85 vs. 83.7. Exact alternative, via the mod:
  `check_modifier_value` on `country_trade_fee`. Internal vs. galactic (defines): the internal market's fluctuation per trade is ×2
  (`INTERNAL_MARKET_FLUCTUATION_MULT`) and its recovery ×3 slower
  (`INTERNAL_MARKET_DAYS_TO_BASE_PRICE`). Galactic access = country flag `has_market_access`,
  set with `enable_galactic_market` for Galactic Community members once the market is founded
  (`resolution_galactic_market_form` → `action.99/101/104/115`), removed on leaving it unless the
  country holds the market planet (`galcom.61`). The monthly limit (`monthlyLimit`) is shown on
  the internal market only.
- Colonies: since 4.x a top-level `colony=` section, referenced from `planets.planet.<id>.colony`.
  Holds pops, housing, amenities, stability, `final_designation`, districts, buildings.
  `employable_pops` counts all pops able to work, _not_ the employed: employed is
  `employable_pops - civilian` (Earth 2200.04: 5207 − 1905 = 3302; its `pop_jobs` sum to 3300).
  Jobs: `colony.pop_jobs` lists ids into top-level `pop_jobs.<id> = { type workforce max_workforce
pop_groups = { { pop_group amount } } }`; open positions = `max_workforce − workforce`
  (`-1` = unlimited, civilian). Every colony also carries empty placeholder jobs (servant, purge, …).
- Districts (4.x): `colony.districts` → `districts.<id> = { type level zones }` — **`level` is the
  number built**; `zones.<id> = { type buildings }` (4294967295 = no zone); `buildings.<id> =
{ type position }`. **District caps are computed** (`#lib/districtCaps.ts`, not in the save): per type
  Σ `district_<type>_max_add` (× 1 + `_mult`) over deposits, planet modifiers and buildings; the
  limit is size + Σ `planet_max_districts_add` (blockers −1 or −2). **A blocker's hidden feature
  counts** (`deposit.<id>.swap_type`): Earth's deposits give farming 5 / generator 6 / mining 7,
  plus Pacific Algae Tracts +3 and Delhi Sprawl +2 behind its two blockers = the game's 8 / 8 / 7;
  limit 18 − 2 = 16, all built (2207.03.10). Empire-wide and triggered modifiers are not counted;
  habitats' limit (capital tier, system bodies) is not computed. **Free building slots are not in
  the save** — zone slots from `max_buildings`, `districts_per_building` and planet-wide
  `zone_building_slots_add`.
- Clearing blockers (`#lib/blockers.ts`, "Blockers to clear" panel and per colony): the gain is
  the district limit the blocker takes (1 or 2; its hidden feature is already in the caps); some
  need a tech (`deposit.prerequisites` in the data DB, 12 in 4.5.2), natural ones
  (`deposit_cat_blockers_natural`) cannot be cleared while the planet has a Ranger Lodge; one in
  the build queue (`clear_deposit_blocker`) shows as being cleared.
- **Disabled buildings** (2026-10-30, the nomad game's arkship, 2201.05.01): `buildings.<id> =
{ type disabled=yes position }` — the building keeps its slot and does nothing: its Entertainer
  jobs went and amenities fell 12,188 → 8,493. Read per zone as `disabled` (types, only when any;
  READER 27); `#lib/buildings.ts` `activeBuildings()` for what reads effects (district caps,
  ethic attraction sources, the market fee), the full list for what asks whether one exists
  (built before, Ranger Lodge, milestones, popups). The districts panel strikes them through.
  Jobs, budget, amenities and stability come from the save and already follow.
- Planet modifiers: `planets.planet.<id>.timed_modifier`, as the country's; features like
  `tidal_locked` and `mineral_poor` are permanent ones (`days=-1`).
- Ethics (2026-10-28): `country.<id>.ethics_distribution` (pops per ethic, summing to
  `pops_with_ethic`), `pops_ethics_attraction`, `pops_ethics_change`, `ethics_attraction` — lists of
  17, one slot per ethic in the files' order (the fanatic slots stay 0) — and
  `pops_ethics_on_colonies = { { colony num_pops = {…} change = {…} } }`; a pop group's own split is
  `ethos = { ethics = { "ethic_x" … } pops = { n … } }`, by name. Faction membership:
  `pop_groups.<id>.factions` and `factions_attraction`; the country's
  `standard_pop_factions_module.potential_count` (42 slots, order unknown) not read.
- Pop groups: `colony.pop_groups` → top-level `pop_groups.<id> = { key = { species category } size
happiness }`. **`happiness` is left out at 100 %**: every group of ours at 2201.01.01, where the
  game showed Earth at 100 % happiness and 100 % approval (the user, 2026-10-25); the AIs' stored
  values (base 0.5) never reach 1. Read as 1 since READER 20 — before, as unknown, which left the
  colony's happiness chart empty.
- Automation: `colony.automation = { enabled settings = { "planet_automation_…" } }` lists the
  settings **on** (Earth 2200.05: crime + four the panel hides for this empire);
  `country.default_planet_automation_settings` for new colonies; top-level
  `automation_resources.<country> = { "energy" … }` read as the **disallowed** resources (empty at
  2200.04, all listed after the player unticked all).
- Leaders: **`country.owned_leaders`**, not `leaders.*.country` — that also matches the recruitment
  pool (19 vs. 7). The pool itself is **`country.modules.standard_leader_module.leaders`**, each
  leader's `date_added` the day it joined (`recruitment_date` "0.01.01" until hired); the game
  replaces it all `LEADER_POOL_REFRESH_TIME` (1800 days) after it was filled — 2200.01.01 →
  "Refreshes 2205.01.01" (4.5.3, 2204.10). Whether an event's early `refresh_leader_pool` restarts
  that count is assumed, not seen. Leader capacity is **per class**, base `@base_leader_cap = 3`
  (`common/leader_classes`), raised by `country_<class>_cap_add`; the result is not in the save. Ships: `country.fleets_manager.owned_fleets` → `fleet.<id>.{ship_class, ships}`
  → `ships.<id>.ship_design_implementation.design` → `ship_design.<id>.growth_stages[0].ship_size`.
- A leader's assignment: `leaders.<id>.location = { type id }` — `ship` (that ship's fleet: a
  commander's fleet or the science ship a scientist leads), `army`; a councilor's is a `planet`
  (the capital, no assignment), its seat `council_location`. A leader still in the pool has
  `age=0`: its age counts from `date` (2171.01.01 → 33 on 2204.10, as the game shows).
- Leader experience: `leaders.<id>.experience` counts towards the next level and starts again from
  the overflow (Planetforgers 2213.10: level 3 at 2043 → level 4 at 21). From level n it takes
  `LEADER_EXPERIENCE_REQUIREMENT_BASE_VALUE` + `_SCALE_VALUE` × n(3n + 4) / 6 = 450, 1100, 2050 —
  measured (the game's "Experience for next skill level: 1100" at level 2; every level-up in five
  campaigns fits); the defines' comment (200 475 825 1250) is stale. Class limits are not in the
  save: base 3 + `country_<class>_cap_add` / `country_leader_cap_add` of what is held
  (#lib/leaders.ts leaderLimits; docs/open-checks.md 20).
- Leader upkeep: unity 2 × level (`paragon/leader_base_upkeep`) × the class's factor, which the
  budget gives exactly (`leader_<class>s` unity: commanders 3.3 for levels 2 + 1 → 0.55, each 2.2 /
  1.1 as the game shows), plus a leader's own traits. Recruitment: `leader_cost` = 100 + 50 (L − 1)² +
  25 (L − 1) × (1 + `leaders_cost_mult` …): 75 with The Empire Needs You, as the game shows.
- A leader's home: `background_planet = { type=planet|ship reference }` (4.5.3; the same form as a
  colony's `carrier`), so "governs its home" is the colony's carrier equal to it. An immortal
  leader is read as `immortal=yes` — **spelling assumed**, none seen in a 4.5.3 save.
- Tech costs: × (1 + `TECH_COST_DIFFICULTY_SCALE_MULT` × step × difficulty rank × tier) —
  `galaxy.difficulty`, `galaxy.technology_difficulty_scale`; Normal = 2, cadet 1, admiral 5
  measured (#lib/events.ts techCostFactor), the other steps assumed (docs/open-checks.md 19).
- Wanderlust (nomads' perk, `#lib/wanderlust.ts`): progress in `country.variables`
  (`<category>_system_seen` / `_count`, the counts 80 % of the flagged systems: 21 galactic
  landmarks → 17, all eight checked 2204.10.01), done `country.flags.<category>_completed`; a
  system's categories are star flags (`galactic_object.<id>.flags`: `galactic_landmark_system`, …
  and plain `enclave`) on every system from galaxy generation; a counted system
  `visited_by_nomad@<country>` (spelling assumed, docs/open-checks.md 18). Flag values are game
  hours (2200.01.01 = 62808000).
- Overview: `country.victory_rank|victory_score|economy_power|tech_power|military_power` (the score
  breakdown is not stored); fleets `fleet.<id>.military_power`, names `%SEQ%` + `fmt`/`num` → "1st
  Fleet"; active edicts `country.edicts = { { edict … } }` — the **edict fund (10 / 15) is not
  stored** (base 10 + councilors, multipliers); species `species_db.<id> = { name class traits }`,
  pops via `pop_groups.key.species`; trait budget from `species_archetype` (base only); sectors
  `country.sectors.owned` → `sectors.<id> = { name systems type }`.
- Starbases: `starbase_mgr.starbases.<id> = { level modules buildings build_queue
shipyard_build_queue station }` — **no owner field**; the country's are those whose own `build_queue` it owns — the queue's
  `location.id` is the station ship, not the starbase (both 0 for Sol, which hid an outpost bug). System via `galactic_object.<id>.starbases`;
  an arkship's starbase is in no system's list — it travels. It is where its `station` ship is:
  `ships.<id>.coordinate.origin`, else the ship's fleet's `movement_manager.coordinate.origin`. An
  arkship is a fleet of its own (`ships = { <the arkship> }`, `ship_class=shipclass_starbase`,
  `properties = { station=yes mobile=yes … }`), not an escort's — both agreed for all four arkships
  of Roaming Korinth 2206.10.08 (ours at system 80). Its `shipyard_build_queue=4294967295` is none
  (it builds through its colony's `combined` queue): no shipyard then, READER 39. Ship queue items name only a design
  (`ship_design.<id>.{name, growth_stages[0].ship_size}`). Capital ships (titan, colossus,
  juggernaut) need a citadel with `capital_yards`, an arkship's `arkship_capital_shipyard`, or a
  finished Mega Shipyard, plus the tech (`*_possible_construction` in
  `scripted_triggers/07_scripted_triggers_ships.txt`). **Waystations** (`roamingcybergang`
  2213.08, the AI nomads' 33): starbases `level="starbase_level_waystation_<n>"
type="swaystation_<kind>"`, `modules` only, `variables.waystation_collection_fill` (0…1, set
  monthly by `nomads.9035`: the station's stockpile use, or its wayline's with a Logistics Hub) and
  `flags.stockpile_being_collected_locally_by_logistic_ship` while a logistic ship collects it; the
  stockpile is the station ship's `ships.<station>.resources`. A system with a waystation lists
  `4294967295` (no primary starbase) or its owner's starbase first, then the waystation — it is
  not the system's owner (READER 60). Waylines: top-level `waystation_networks.<i>.waystations = {
<starbase ids> }` and per country `waystation_networks_manager = { waystation_networks = { <i> }
connected_countries = { … } }`; every network was waystations one hyperlane apart. Mega Shipyards: `megastructures.<id> =
{ type owner }` — not yet seen in a save, so how its ship queue is located is a guess.
- **Ship designs** (UNE 6 2208.01.01, 4.5.3; READER 53): the top-level `ship_design` is global
  (2389 entries, **no owner**); the player's saved designs are
  `country.ship_design_collection.ship_design = { 8 9 10 2451 … }`. A ship names its design in
  `ship_design_implementation = { design upgrade growth_stage }`; a design no longer saved stays in
  `ship_design` while ships use it — the fleets tab's **unofficial** design (design 35, an
  auto-generated "Cheetah" gunship on three corvettes, `upgrade=2451` the saved Cheetah screen;
  `4294967295` = none). Starbases' and stations' designs (`starbase_outpost`, `starbase_starport`)
  are outside the collection: their fleets (`ship_class` starbase/station) are left out. A
  design's parts: `growth_stages[0] = { ship_size section = { template slot component = { slot
template } … } … required_component … }`, `role` (screen, gunship; absent on civilian ships),
  `auto_gen_design=yes`. Station designs are named `SUFFIX_NAME_FORMAT` with an empty `NAME` and
  a roman `SUFFIX` ("III"): the tab shows them after their size ("Mining Station III").
  **Not yet checked in game**: that deleting a saved design leaves it as here, and that
  `upgrade` names the design the ships upgrade to (`docs/open-checks.md` 34).
- Map positions: `galactic_object.<id>.coordinate = { x y }` — the game draws **x growing to the
  left** and y growing down (2207.03: Alpha Centauri x 11 west of Sol x −6, Sirius x −30 east);
  `#lib/mapView.ts` flips x.
- Expansion: `country.surveyed_deposit_holders = { { type=0 id=<planet> } }`; systems
  `galactic_object.<id> = { name planet hyperlane = { to length } colonies }`. The game's list
  differs from the class rule (`pc_barren` is `colonizable = no`, yet Mars is offered — terraforming).
  An uncolonised planet in an owned system has no `owner` but `controller=<country>` (Mars:
  `controller=0`); own systems are those whose planets (stars included) the country controls
  (2207.03.10: the four of sector Earth), planets another empire controls are dropped.
  **Distances** (`jumps` from the capital, `beyond` from the nearest own system — the panel's
  "beyond my borders" range, in the profile) come from a multi-source breadth-first search over
  hyperlanes and usable bypasses (`#lib/galaxyGraph.ts`; every jump or bypass traversal is one).
  Bypasses: top-level `bypasses.<id> = { type active connections active_connections linked_to
owner = { type id } }` — owner type 6 = `megastructures.<id>` (gateways, `lgate_base`), 7 =
  `natural_wormholes.<id>`, both with `coordinate.origin`. Which types count, their techs, the
  explore rule and the L-Gate script (star flags `lgate` → `lcluster1`, global flag
  `lgates_activated_globally`) are `BYPASS_RULES`, from 4.5.2's `common/bypass/00_bypasses.txt` —
  re-check on game updates. "Explored" is approximated as a ship having visited either end
  (`visited_objects`); the save has no per-wormhole knowledge (`seen_bypass_types` lists types).
  2207.03.10: 12 wormholes, 5 gateways (inactive), 2 L-Gates, none usable yet.
- Idle leaders: no `location` and no `council_location` — except the ruler (`country.ruler`) and
  envoys. Civilian fleets: `current_order = { <kind>_order = { progress order_id planet |
deposit_holder | orbitable } }`, queue in `order`, **no arrival date**: `movement_manager.path.date` is not
  one (a fleet in flight had 2200.09.16 in 2202.05); routes are counted in jumps instead. Progress totals, checked against five game years of completed orders:
  surveys count to 30 (`BASE_SURVEY_TIME`), station builds of every size to 100, anomalies to
  the `SCIENCE_SHIP_ANOMALY_RESEARCH_DAYS` entry for scientist level vs. anomaly level
  (`planets.<id>.anomaly` → `anomaly_category.level`; level 2 on 3 → 180). The ship sizes'
  `base_buildtime` (outpost 360) is **not** a constructor's build time. Names are templates: `PREFIX_NAME_FORMAT`
  (the `PREFIX` "UNS" is localisation only), `HUMAN1_CHR_<first>` / `HUMAN1_SHIP_<name>`.
- Fleet stance `fleet.fleet_stance` (absent = the default). **Automation is an order**:
  `current_order = { automate_fleet_order = { sub_order = { <task>_order = {…} } settings_survey
construct_mining_stations … = yes/no } }` — the task is the sub-order. `auto_movement` is
  something else (a move order's "go to planet" target).
- New colonies: listed in `controlled_colonies` from landing on; `colonizing_species` while being
  settled; done at `COLONY_POPS_REQUIRED` = 100 pops, growing `COLONY_MONTHLY_GROWTH` = 3/month
  before modifiers. Name `NEW_COLONY_NAME_<n>` = "$NAME$ Prime" … "Decimus".
- Pop growth and migration: `colony.last_month_growth_data = { growth_and_size = { growth }
current_month_growth_details = { key = { GROWTH_CAT_… } value = { … } } species = { … categories
} }`. Details are amounts; **emigration counts against the colony** (Earth 2204.07: growth 3,
  emigration 18 → −15), immigration for it; a single entry is a scalar, not a list.
  **No source→destination pairs**: `/migration` shows exact flows only with one sender or one
  receiver, else a proportional split marked as estimated (`#lib/migration.ts`).
- Explored systems: `country.visited_objects` (system ids). Traditions: `country.traditions`
  (adopt and finish entries included), `tradition_categories`, `last_picked_tradition`; perks
  `country.ascension_perks` (both seen filled 2026-10-19).
  **Every entry counts as a tradition for the cost**, adopt included, and the cost is rounded up:
  3 entries → 300 + (8·3)^1.8 = 605.06, the game's tooltip 300 + 306 (2026-10-19).
- Trade deals (4.5.2, first seen 2026-10-19 in a throwaway game): `trade_deal.<id> = { first = {
country recipient monthly_resources = { food=1 … } sensor_link=yes } second = { … } length=10
date="2200.03.08" }` — each side lists what it **gives**; `length` is years (2200.03.08 → the
  diplomacy screen's 2210). `tradeDeals()` reads it; `recipient` is the other side's id.
- Wars (4.5.2, first seen 2026-10-19): `war.<id> = { name start_date attackers = { { call_type
country caller } } defenders battles = { { attackers = { <ids> } defenders attacker_victory
attacker_losses defender_losses system date type } } attacker_war_goal = { type actor target }
defender_war_goal attacker_war_exhaustion defender_war_exhaustion }` (exhaustion 0–1). **A
  battle's `attackers`/`defenders` lists name each other**: we attacked their civilian ships and
  won every fight, yet the save had `defenders = { us } attacker_victory=yes defender_losses=4`
  (their 4); losses and victory follow the roles. An ended war leaves `<id>=none`;
  `truce` and `dead_war` stayed empty after a won subjugation war. Names: `war_vs_adjectives` =
  "$1$ - $2$ $3$". Shown on the contacts tab (`wars()` in save.ts).
- Branch offices and holdings (4.5.x, first seen 2026-11-01): `colony.<id>.externally_owned_buildings
= { { building_owner=<country> owner_type=corporate|subject_holding buildings = { <ids> } } }`,
  the ids into top-level `buildings`, and `externally_owned_build_queues = { { key=<country>
value=<queue> } }`. No planet or colony field says "branch office" by name (a jomini dump of
  the Planetforgers' save had none); the office's owner keeps `flags.first_branch_office` and
  `variables.branch_offices_established`, its budget `planet_branch_offices` (the trade) and
  `planet_branch_office_buildings`.
- Subjects: top-level `agreements.agreements.<id> = { owner target active_status date_added
term_data = { agreement_preset discrete_terms = { { key value } } resource_terms
can_subject_* … } subject_specialization = { level experience } }`, owner = the overlord; the
  subject's country block holds `loyalty` (−45, the game's agreements screen), `overlord` and
  `subject_date`, and our relation to it `subject=yes`. The monthly loyalty change (+0.9) is not
  stored. Shown on the contacts tab (`subjects()` in save.ts), the terms in the game's words
  from the data DB (`diploNames`: `agreement_term*`, `agreement_preset`; hidden terms have no
  name there and are left out — 7 shown, as the game's agreements screen).
- **Intel** (2214.01.01): our country's `intel_manager = { intel = { { <country> { intel=40.6
stale_intel = { } } } } }` — one entry per contact, pre-FTL and fauna included (20 there);
  `stale_intel` was empty everywhere, so staleness is ours (`diplomacyView()`). The floors from
  pacts are defines (`INTEL_FROM_*`), already in the value. **`country.capital` is a colony id**
  (ours `capital=0` = colony 0 on planet 3), as a construction item's planet — its place is the
  colony's `carrier` (`capitalSystem()`; a nomad's: the arkship, READER 41).
- Galactic Community (2026-10-19): `galactic_community = { members = { <ids> } proposed = {
<resolution ids> } voting = <id> emissaries days election community_formed focus … }`,
  `resolution.<id> = { type country supporters = { <ids> } opponents }` (the voted one also
  `voting = { <country>=<date> }`). Our country holds no GalCom field, and **no country stores
  its diplomatic weight** (`diplomacy_weight` in the save is per fleet: its military power).
  **GalCom tab** (`/galcom`, split off the contacts tab 2026-10-23; its flat-list switch is still
  `contactView.galcomFlat`), two panels: **in force** by category (data DB `resolution.category_key`, or a
  flat list: `contactView.galcomFlat`), each with its effects and all of them summed
  (`totalEffects`), grouped by what they act on (`#lib/modifierGroups.ts`: diplomacy, fleet and
  starbases, armies, war, research, production, pops, upkeep, planets, empire — key patterns from
  4.5.2's resolution modifiers, first match wins); **proposed** (and the one on the floor) as a table with the empires and the
  summed diplomatic weight for and against, each row expandable to who votes how. Weights
  (`GalacticCommunity.weights`, by name, READER 15; the scaled estimate READER 16): exact from companion mod 0.4.0's country
  variable `sdash_dw`, else **estimated** (`estimatedWeight()`: the defines' naval × 0.025 +
  economy × 0.15 + technology × 0.1, × `WEIGHT_SCALE` 2.6), marked ≈. **Checked 2214.01.01**
  (screenshots `2026_10_23_1`–`4`): the game's "Diplomatic Support" of a proposal is the summed
  weight of the empires **for** it, no council factor (all four shown matched to ±1 — the screen
  rounds each weight), and **the proposal queue is ranked by it**; confirmed 2214.02.01 with
  the mod's exact weights (screenshots `2026_10_23_5`–`8`: all 12 sums and the order), the game
  **rounding down** sums and the per-empire tooltip lines (4306.72 → 4306; the member icons round
  normally, 521.8 → 522) (the "#" column; ties in save
  order; all 12 in the game's order); the save's supporter lists matched every icon row. Solving
  the sums gave all 13 members' weights (138–643): game ÷ defines' terms 1.0–3.3, median 2.6, and a
  linear fit with pops was off by up to 227 — modifiers dominate, the estimate stays rough. The
  queue's ↑/↓ arrows are not pass/fail (one with more weight against showed ↑); not in the save.
  **A resolution stores no proposal date** (`resolution.<id> = { type country supporters
opponents }`; only the one voted on has `voting = { <country>=<date> }`, the votes cast):
  `proposalDates()` dates it between the last save without it and the first with it — shown as
  the month when those are the 1st of consecutive months (`proposedLabel()`: "2208.10") — or "by" the
  first save of the history (2214.01.01: five to the month, seven by 2205.03.01, the campaign's
  first save read). **Our diplomatic weight** (`#lib/diploWeight.ts`, right of In force), as the
  game's tooltip (screenshot `2026_10_23_9`, 2214.02.01: Fleet Power 22 = 18 from fleets + The
  Readied Shield 20 %, Pops 136, Economy 163 = 136 + Regulatory Facilitation 20 %, Technology 74 =
  395): naval power × 0.025, **pops × 0.01 × (1 + 2 × their happiness)** (the defines' "BASE +
  HAPPINESS × happiness" per pop — 5875 pops at 65.7 % → 135.95), economy power × 0.15,
  technology × 0.1, each × (1 + its `diplo_weight_<part>_mult`), the whole × (1 +
  `diplo_weight_mult`); the modifiers from every source we hold (resolutions in force, traditions,
  perks, civics, ethics, authority, origin, policies, edicts, timed modifiers — their
  explanations). Computed 395.36 against the mod's 395.06; a gap of 1 or more is shown as not
  explained. Council, envoy (delegate), rival and per-vote modifiers are listed, not summed. The
  other members' remainders did not fit the same formula (2214.02.01 — nomads' pops live off
  colonies, modifiers dominate): only ours is broken down. Categories take their group's banner
  colour (`galcomGroupColor()`, 4.5.2 `resolution_groups` `color_index`). **Proposable**
  (`#lib/proposable.ts`, below the proposals; a line between categories while in the given order): every resolution a
  category lists whose `potential` holds for us (data DB `resolution.potential_json`,
  `allow_json`, `valid_target_json`, `repeal`), each as proposable, in force, already proposed
  ("has already been proposed by …"), locked (`allow` false — a chain's tier needs the one below
  in force, `is_active_resolution`; the game's tutorial: "You may only propose the first un-enacted
  Resolution in a chain"), on the category's cooldown (`CATEGORY_VOTE_COOLDOWN` 2520 days after
  `galactic_community.category_timers`, READER 17 — 2214.02.01: Industry until 2220.12.30), needs
  a target / no target (a targeted one's `valid_target` reduced to the galaxy-wide leaves: no
  council → no custodian or emperor to name), or unknown. The trigger evaluator gained
  `is_active_resolution`, `has_global_flag` (`GalacticCommunity.globalFlags`) and the council
  leaves — custodian, emperor and council seats false before `galactic_council_formed`, unknown
  after (their save fields not seen yet). Costs × our `resolutions_cost_mult` (Gravitas −25 %,
  Pioneer Politics). **Years since formation** count as a cooldown too:
  `is_years_since_community_formation >= 10` (Form Galactic Council's `allow` — every game's first
  ten years) is answered from `community_formed` (the evaluator's first numeric comparison,
  `compare()`), and failing only on it reads "on cooldown until" formation + 10 years. Filters
  (per viewer): in force, proposed, proposable now (on), on cooldown, lower tier, needs target
  (or none possible), other (not allowed otherwise, unknown, not a member) — 2214.02.01: 2, 12, 7,
  4, 55, 5, 7. **Success** of what we can
  propose now (`#lib/votes.ts`): each AI member's weight = the resolution's `ai_weight` (data DB
  `ai_weight_json`: base × the factors whose conditions hold for that AI — its identity from the
  save, the rest unknown, marked ?) × its opinion of us (0.5 at −750, 1.0 neutral, 1.3 at 750,
  linear between — assumed from the defines' comments); for at 7.0, against under 5.5, abstain
  between; success = the decided weight's share for it, as we vote for it, abstain or vote against
  it (`ifFor`, `ifAbstain`, `ifAgainst`). In the queue, the cell of our vote now is ringed (not cast yet = abstain).
  For a resolution already in the queue the same two columns come from the votes cast
  (`actualOutlook()`: undecided members on neither side, our own vote set aside — 2214.02.01:
  Security Contractors 49 % if we abstain, 54 % if we vote for it). Checked 2214.02.01: Buzzword Standardization's predicted supporters are exactly the game's
  "Empires likely to support this Resolution" (screenshot `2026_10_23_11`). The game's own labels
  ("Intermediate Support", "Weak Support") are not reproduced — their thresholds are not in the
  files. Not modelled: TYPE_VOTE_COOLDOWN (5040 days, "a referendum of a given type" —
  not seen in a save), emergency measures, favours. **History** (milestone kind `galcom`, also listed on the galcom tab):
  proposed, put to the vote, passed, failed, withdrawn (`Milestone.galcom` keeps the parts, so the
  list names resolutions with popups and proposers in colour) — a proposal that leaves the queue neither
  voted on nor passed; the save keeps no record of who withdrew it. A vote counts as failed only
  if no save along the branch lists it as passed (snapshots before READER 13 have no passed list:
  2208.01.01 had shown The Readied Shield "failed"). Names and effects from the data DB (`resolution`, its
  effects = the static modifier of the same key, `resolution:<key>` popups).
- Claims (2026-10-19): on the system, `galactic_object.<id>.claims = { { owner date claims } }`
  — `owner` is the claimant, `claims` the strength. The game's claims view lists only ours (with
  the next claim's influence cost, not stored); others' claims on our systems reach us as
  notifications. Contacts tab: ours and those on our systems (`claims()` in world.ts), holder by
  the system's station. By console: `effect random_system = { limit = { exists = owner owner =
{ is_country_type = default NOT = { is_same_value = root } } } add_claims = { who = root
num_of_claims = 1 } }`, and against us `effect random_country = { limit = { … } root = {
capital_scope = { solar_system = { add_claims = { who = prevprevprev num_of_claims = 1 } } } } }`.
- Rivals (2026-10-19): declaring one adds `is_rival=yes` and `rival_date` (declaration + 10
  years: 2205.05 → "2215.05.17") to our relation, `rivals = { country }` and `has_declared_rival`
  to our country; their opinion of us (Themlar Principality) fell to −460. Contacts: "our rival", "rivals us".
- **Another empire's view of us** (`Snapshot.aiIntel`, READER 9–10; `intelOf()`): its
  `personality` (top level of its country block), `ai.attitude = { { country attitude weight
priority date } }` — the entry for our country is its attitude towards us ("loyal" for our
  subject) —, its relation **to us** (`relation_current` 293 vs. our 292 to them; `modifier = {
modifier value }`, one or a list: `opinion_fellow_galcom_member` 50, a gift's
  `opinion_trade_gift`), its stockpile and its budget's balance like ours (2212.03.05), and its
  gross income (`budget.current_month.income`, READER 12: the cap on what it pays a month). Its
  `ai.ai_resource_target_records` (energy 10, minerals 25, … — percentages?) is not read.
- Pacts are **flags on the relation**: `country.relations_manager.relation = { country embassy
research_agreement commercial_pact defensive_pact non_aggression_pledge guarantee closed_borders
migration_access waystation_pact … }` (`=yes`; the last two are the migration treaty and the
  wayline pact), read as `Relation.agreements` (contacts tab, Agreements column). `trust` caps near
  50 (`add_trust = 100` gave 49.5–50.85); `relation_current` is the contacts screen's opinion
  (+210, +142 … matched, screenshot 2026_10_19_1).
- Manual saves: a save with the same date as the head but another state continues the head (a
  manual save after the autosave); only an earlier date counts as a reload.
- **The budget holds monthly flows only.** The game pays it on the 1st; a save on the 1st (or
  later that month) holds that payout as `current_month`, `last_month` the one before (2207.04.01:
  `last_month` = 2207.03.10's `current_month`). Stockpile change between two monthly autosaves =
  the later one's balance, to the cent, unless something was paid outside it.
- **One-off spending is booked nowhere**: construction, station builds, event rewards, one-off
  market trades, edicts, … show only as a stockpile change. `unbooked()` = change since the last
  snapshot before the latest's month start − that month's payout, per day with the mod's ticks;
  `namedSpending()` (`#lib/spending.ts`) names what it can, the rest is "unexplained":
  - **save diffs** between consecutive snapshots: new construction items we pay for
    (`Snapshot.construction`, `paying_country`, cost exact — paid when queued), edicts newly active
    (data DB `edict.cost_json` `cost`, before multipliers: the campaigns' 15 energy matched),
    constructor build orders that **became current** (data DB `ship_size_resource`: stations 100
    minerals, outposts 100 alloys) — a station is paid when its order starts, not when queued
    (2207.04.02: three queued at Barnard's Star, 100 gone), leaders hired (cost unknown);
  - **the mod's spending events** (0.3.0): `on_district_queued|unqueued`,
    `on_building_queued|unqueued` (scope: the colony, not the item), `on_edict_activated` (the
    edict not in scope), `on_decision_enacted`, `on_leader_hired`, `on_colonization_started`,
    `on_megastructure_build_start` (4.5.2 `common/on_actions/00_on_actions.txt`). An event dates
    the save-diff item of the same kind and place shown by the next save; the others stand alone
    as "maybe" causes. No hook for ship or starbase orders, one-off market trades or event
    rewards.
    2207.03.10 → 04.02: energy −30 = Education + Recycling Campaign, minerals −600 = City District
    on Earth 500 + research station at Barnard's Star II 100; unexplained 0 for every resource.
- **A construction item's `buildable_*.planet` is a colony id** (2207.04.02: `planet=0` is
  Earth's colony 0, Earth being planet 3 — planet 0 is Sol's star); `orbitable` names planets and
  starbases.
- Budget sources: `planet_<job>` (job output and inputs), `pop_category_<stratum>` (pop upkeep and
  trade), `planet_pops_traits` (food), `planet_buildings`, `planet_districts_*`.
- Autosaves: `autosave=4` in `settings.txt` gave one per month (2200.02/03/04.01, observed).
- Build queues: `construction.queue_mgr.queues.<id> = { owner location type items={…} }` (`planet`,
  `army`, `starbase`, `ships`, `combined`); a planet's own queue is `planets.planet.<id>.build_queue`,
  and `items` lists its entries in order; `simultaneous` is how many it builds at once (1 for a
  normal planet, 2 for the AI arkship seen; wilderness empires and mods raise it). Entries are `construction.item_mgr.items.<id> = { queue
progress progress_needed resources buildable_<kind>={…} }`; seen kinds (2200.04, AI queues):
  `district`, `army`, `ship`, `starbase_building`, `clear_deposit_blocker` (→ `deposit.<id>.type`).
  `building` not yet seen — `save.ts` names it by the block's first string field.
- Game length: top-level `galaxy = { mid_game_start=100 end_game_start=200 victory_year=300 }`,
  years after the 2200.01.01 start (small/default galaxy). Stored as `Snapshot.endGameYear`.
- Top bar: `country.<id>.empire_size` — **already raised to `EMPIRE_SIZE_FLOOR` (50)**: Yorphia
  read 50 in every save to 2203.10.01. While it sits at the floor the empire chart adds the
  unfloored size, estimated (`#lib/empireSize.ts`): the defines' `EMPIRE_SIZE_FROM_*` weights
  (colonies 20, systems 1, districts 0.5, pops 0.005; branch offices not counted) × the
  `empire_size_*_mult` modifiers of civics, ethics, authority, origin, traditions, perks, techs,
  timed modifiers and species traits, `nomadic_empire` for a nomad; then **per colony** its ascension
  tier (`colony.ascension_tier`: −5 % a tier, `PLANET_ASCENSION_SPRAWL_MODIFIER`, × (1 +
  `planetary_ascension_effect_mult`)) on all its parts and its governor (`species_empire_size_mult
= @planet_empire_size`, −2 % per skill = `level` + `bonus_skill_level`) on its colony and pops, not
  its districts (READER 29). **Checked against the game's tooltip** (Roaming Korinth 2203.02.01,
  screenshot `~/Pictures/Screenshots/screenshot_2026-10-30_22-11-54.png`): districts 8 × 0.5 × 2 ×
  0.9375 = 7.5, colony 20 × 2 × 0.9375 × 0.96 = 36.0, pops 5514 × 0.005 × 0.9375 × 0.96 = 24.8;
  the sum 68.31 shows as 69 (rounded up). A species' pops are not split by colony: they shrink by the
  colonies' pop-weighted factor. Also `starbase_capacity_used` / `starbase_capacity`,
  `used_naval_capacity`; research per field is `physics|society|engineering_research` in the
  budget income. Envoys are `leaders.<id>` with `class="envoy"` and `country=<id>`; one is in use
  while it has `location = { assignment=… }` (seen: `first_contact`). **Not stored: the naval
  capacity maximum** — companion mod 0.6.0 exports the `max_naval_capacity` trigger into our
  country variable `sdash_nc` (`Snapshot.navalMax`, READER 20), shown as used / max; not yet
  checked in game.
- **Which techs can be researched** (`techTiers()`, `inReach()` in `#lib/techTiers.ts`): every
  prerequisite researched (data DB `technology_requirement.prerequisites_json`) **and** its tier
  open — a tier opens once 6 techs of the tier below are researched **in the same research area**
  (physics, society, engineering), `previously_unlocked` in 4.5.2
  `common/technology/tier/00_tier.txt` (0 for tier 1, 6 for tiers 2–5; the file does not say per
  area — the user confirmed it, 2026-10-22) — and `potential` not false for the empire. The cards
  on offer (`tech_status.alternatives`) are a weighted random draw from those: never plan with them.
- **Switching research mid-way keeps the progress, not the card** (the user's question 2026-11-06:
  does starting a card and switching away keep it available for good, as event tech progress
  seems to? — **no**). Throwaway `unitednationsofearth4_-337465913`, 4.5.3, screenshots
  `<user dir>/screenshots/2026_11_06_1…6.png`: Administrative AI researched to 13.3 / 1100, then
  "Change Research" (2200.01.20) — its points move to
  `tech_status.stored_techpoints_for_tech = { tech_administrative_ai=13.33826 … }` (one entry per
  tech switched away from, all fields in one block) and its card shows "13/1100"; **switching
  redraws nothing** (the panel: "Whenever we finish researching a Technology, up to 3 new options
  will be generated"). At the next draw (`research_technology tech_shields_2` from the console,
  2200.02.03 — the save's `alternatives` change at once, while the panel keeps showing the finished
  tech until the next tick) it **was not among the new cards**, and no `always_available_tech`
  entry appeared; its 13.3 points stayed stored. So events that grant progress _and_ keep a tech
  on offer do two things: of 493 `add_tech_progress` in `events/` and `common/`, 280 pair it with
  an `add_research_option` of the same tech. Read as `Snapshot.techKept` (READER 49, `techKept()` in `server/save.ts`), shown on the tech tab; checked 2026-11-06 on a copy of the `throwaway` DB re-read from the UNE 4 saves: Administrative AI 13 (not on offer), Zero-G Refineries 13 and Planetary Unification 16 (on offer, ↺). The game's own panel shows that draw without it too (2200.03.02, `2026_11_06_7.png`: Fusion Power, Blue Lasers, Zero-G Laboratories — the same draw, no second one yet). Whether stored points
  raise a tech's draw weight is not known (`TECH_WEIGHT_PREVIOUS_OPTION = 0.5` lowers a previous
  card's).
- Progress: `country.tech_status.<area>_queue = { { progress technology date } }` (research points,
  not percent; every queued tech keeps its own, `date` = started — `Snapshot.techQueued`, READER 6;
  a tech switched away from keeps its points in `stored_techpoints_for_tech`, above); permanent research options (focus rewards'
  `add_research_option`) are repeated `tech_status.always_available_tech="…"` keys
  (`Snapshot.techPermanent`; 2212.03.05: Volcanic Forge, Doctrine: Fleet Support, Exotic Materials
  Labs, each also among the cards); `stored_techpoints = { 1310.7 0 0 }` is **stored research** per
  field (`Snapshot.techStored`, READER 7; see "Stored research" in `docs/open-points.md`); `country.government.council_agenda` + `council_agenda_progress`;
  `country.next_election`. **Agenda progress moves on the 1st only** (2207.02.01 → 03.01: +44,
  03.01 → 03.10: 0), research once a month too, after the 1st's autosave (2200.02.01 autosave: no new progress; 02.02: a full month, +13.47, even on a tech picked on the 1st — the tech selected at the tick gets the whole month; 2026-11-06) — so the agenda's rate is measured across month starts, or a
  mid-month manual save hides it. Galaxy cost sliders `galaxy.technology`, `galaxy.traditions`. Tech costs
  in game were ×1.05 of the extracted base (source unconfirmed, `TECH_COST_OBSERVED_FACTOR`).
- Milestone sources (2207.03.10): `country.government.council_agenda_cooldowns = { council_agenda
start_date }` (passed agendas), `country.ruler`, `country.active_policies = { { policy selected
} }`, `country.government.civics|authority`, `country.ethos.ethics`, `country.last_date_war_lost`
  ("0.01.01" = never). Removed leaders leave `leaders.<id> = none`. Prescripted names (the ruler)
  come out as their key ("ruler name humans1"). Only undismissed notifications survive in
  `message`, so it is no event source.
- Empire-wide modifiers (events, agendas, relics, …): `country.timed_modifier = { items = { {
modifier="celebrate_diversity" days=3535 } … } }` — `days` left, −1 = permanent; stored as an
  end date (`addGameDays`: 30-day months). Named and explained from the data DB's
  `static_modifier` tables (`modifier:<key>` popups, Empire modifiers panel). Some keys are no
  static modifier (`uncivic_parliamentary_system_isolationist`, 4.0.1) and show as the key.
- Identity of a game state (`Snapshot.fingerprint`): `tick` + `random_count`, both top-level.
- Planets: `moon_of` marks moons, `surveyed_by` the countries that surveyed them (one id or a
  list), `controller` the owner of the system it lies in.
- Galaxy and the others (`server/world.ts`, 2207.03.10): `galactic_object.<id> = { coordinate
star_class planet=… hyperlane starbases inner_radius outer_radius }` (radii 390/490 are no
  in-system size); planets' `coordinate` is in-system (Earth 90 from the star). **A hyperlane can be
  listed twice** (2207.03.10: Iblyria → 236): `galaxy()` de-duplicates, or a keyed `{#each}` throws
  in the browser only — the page shows, then a 500 the server log never sees. **Fleets have no
  owner**: a country lists its own in `fleets_manager.owned_fleets = { { fleet=<id> } }`, so a
  station's owner is starbase → `station` ship → `fleet` → that list (`stationOwner`; Chors
  Compass: the Caravaneers). Reading every `country` costs ~250 ms per save (51 countries).
  First contacts: top-level `first_contacts.contacts.<id> = { owner country name location leader
date days_left difficulty clues stage status }` (`leader=4294967295`: none; `status`
  in_progress / finished / aborted; stages have no localisation). Relations
  `country.relations_manager.relation = { country contact communications hostile
relation_current trust threat border_range pre_communications_name }` (`border_range`
  2147483647: not bordering; pacts as flags, see "Pacts are flags" above). Situations `situations.situations.<id> = { country
type progress last_month_progress approach stage }`. Anomalies: `country.events.anomalies =
{ <planet ids> }`, category in `planets.planet.<id>.anomaly`. Special projects
  `country.events.special_project = { id special_project carrier = { type=planet reference } }`,
  no progress. Dig sites `archaeological_sites.sites.<id> = { location = { type=2 id=<planet> }
type index clues difficulty days_left excavator_fleet }`; `index` is the chapter under way,
  0-based (**assumed**: every site in Roaming Korinth 2210.10.20 reads 0, and `site_star_petal`'s
  difficulty 2 is its first stage's — no site seen past a chapter yet). Megastructures `megastructures.<id> =
{ type coordinate.origin owner }` (2207.03.10: ruined gateways, a ruined quantum catapult, two
  ruined ring world sections).
- Empire focus: `country.focus = { active = { <card ids> } priority = { current } reward = {
rewards = { { category current="development_rewards_2" progress } } } }`; cards are top-level
  `focus_cards.<id> = { type status }`, **`status=1` = done**: the game's panel at 2207.03.10 lists
  exactly the five `status=0` cards (screenshot 2026_10_18_4; one taken just before showed a card
  that had just been completed and replaced). Offered techs `country.tech_status.alternatives = { physics =
{ "tech_…" } … }`. Leaders: `leaders.<id> = { name class level age species traits job }`.
- Prescripted names: a save names a prescripted empire's ruler, species and empire by loc key
  (`PRESCRIPTED_ruler_name_humans1` → "Dolores Muwanga"); `displayName()` resolves them from the
  data DB's `prescripted_name`, set at start (`setPrescriptedNames`). Snapshots stored earlier
  keep the raw text ("ruler name humans1") until their save is read again.
- Launched agendas: `country.government.council_agenda_cooldowns = { council_agenda start_date }`
  — **`start_date` is when it can be picked again**, not the launch (2207.03.10, other empires:
  Infinite Opportunities until 2231/2232, 30 years after their first agenda). Launch = that minus
  the agenda's cooldown (`agenda_cooldown`, else `COUNCIL_AGENDA_COOLDOWN` 10,800 days; data DB
  `council_agenda.cooldown_days`), after-launch effect until launch + `finish_days` (3,600). The
  agendas table shows these dates, the upcoming list "can be picked again". **Checked on our own
  first launch** (throwaway game): Expand the Council launched 2212.03.05 (a manual save that day),
  the save's `start_date` 2242.03.05 = + its 10,800-day cooldown — the derived launch is exact.
- Council: `country.government.council_positions = { <ids> }` → top-level
  `council_positions.council_positions.<id> = { country type leader }` (2207.03.10: defense,
  research, state; the ruler is `country.ruler`, apart). Policy flags `country.policy_flags =
{ "unrestricted_wars" … }` (strings). Edicts `{ edict date start_date perpetual=yes }` — a
  perpetual one's `date` is junk (`-5070.07.21`), else the end date.
- Government: `country.government = { type="gov_representative_democracy" authority civics={…}
origin="origin_default" … }` (2207.03.10); ethics in `country.ethos.ethics`. `type` is named
  from the data DB's `government_type`.
- A colony's sector: its planet's system (`coordinate.origin`) in an owned sector's `systems`
  (`sectorBySystem()`; 2207.03.10: only the core sector, `type="core_sector"`, named after the
  capital). Habitability: `pop_groups.<id>.habitability` (0–1, seen 1 and 0.9), pops-weighted.
