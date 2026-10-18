# stellaris-empire-dashboard

Second-screen dashboard for a running Stellaris game: graphs over time (pops, stockpiles, monthly
income), colony state, later rule-based hints. Reads what the game writes — autosaves and, via the
companion mod in `mod/`, `game.log` — and keeps a **save graph**, so loading an older save starts
a branch instead of overwriting history.

SvelteKit 3 / Svelte 5 / Tailwind v4 / TypeScript 6 / pnpm, on Node 24 LTS (`.node-version`).
Storage is `node:sqlite` (built into Node, no native build). Saves are parsed with `jomini`.

- **SvelteKit 3 layout:** no `svelte.config.js` — config goes to `sveltekit({...})` in
  `vite.config.ts`; `tsconfig.json` extends `$app/tsconfig`; `$lib` is gone, import
  `#lib/<path>.ts` (`imports` in `package.json`). Hook types (`Handle`, `ServerInit`) come from
  `@sveltejs/kit/hooks`. The typed `resolve()` wants the query written out —
  ``node ? resolve(`/map?node=${node}`) : resolve('/map')``, not ``resolve(`/map${q}`)`` with `q`
  maybe empty.
- **TypeScript stays on 6** until `svelte-check` (peer `^5 || ^6`), `typescript-eslint`
  (`<6.1.0`) and Kit (`^6`) accept 7 — checked 2026-10-14.

Cross-project conventions come from the OKF vault; workspace rules from `../CLAUDE.md`.

## Goals (from the start, mkMac2017)

- A second screen next to the running game: the state of the empire at a glance, and its history.
- **Going back in time must not break it.** Loading an older save starts a new timeline (a branch
  of the save graph) instead of overwriting history, and one can **switch between timelines**
  (`/timeline`, `?node=`; planet pages follow the empire page).
- Today a reload's branch point is a _guess_ when time goes backwards (marked, correctable on
  `/timeline`). To make it exact, the companion mod could write a timeline identifier to the log —
  see "Open".

## Running it

Runs on the machine the game runs on (Linux/Proton) and binds to `127.0.0.1`. Paths are required
settings with no defaults — a default pointing at a real location fails quietly against the wrong
tree.

```sh
DASHBOARD_DB=<dir>/dashboard.sqlite \
STELLARIS_SAVE_DIR="<Stellaris user dir>/save games" \
STELLARIS_GAME_LOG="<Stellaris user dir>/logs/game.log" \
STELLARIS_DATA_DB=<workspace>/stellaris-data-extraction/sqlite/stellaris.sqlite \
pnpm dev --host 127.0.0.1
```

`STELLARIS_DATA_DB` is the extraction's SQLite, read once at start for tech/agenda names and base
costs and the cost defines — regenerate it after a game update (`../stellaris-data-extraction/AGENTS.md`).
`STELLARIS_GAME_LOG` is opt-in: set it when the companion mod is enabled.

**One watcher per process.** `app.ts` keeps its state on `globalThis`: Vite re-imports server
modules on edits, and a second watcher once re-read the saves, moved the head back and filed the
next autosave as a branch (2201.06 under 2201.04).

**The DB is history, not a cache.** The game keeps only its last 5 autosaves (`autosave_*` rotate),
so snapshots of deleted saves exist nowhere else — never delete the DB or drop its tables.

- **A new snapshot field needs a default in `upgrade()` (`src/lib/upgrade.ts`)**, which brings
  stored snapshots to the current shape on read. Saves still on disk refresh their snapshot on
  every start (a re-read save replaces its stored reading).
- `SCHEMA` in `db.ts` versions the _tables_ only; bumping it drops all history. Change the tables
  with a migration instead.

`STELLARIS_TEST_SAVE=<.sav>` enables the real-save test in `save.test.ts`; vitest swallows its
`console.log` dump unless run with `--silent=false`. Its assertions fit our 4.5.2 campaign (a
4.0.1 save fails one); for an ad-hoc look at any save, a throwaway `src/lib/server/*.test.ts`
calling `readSave`/`toSnapshot` (and `loadGameData` for the data DB) works — delete it after.

**Checking a change end to end: run against a copy of the DB**, never the real one (history — a
dev server ingests saves and moves the head). Copy `dashboard.sqlite*` (WAL files included) to a
temp dir, start `pnpm dev` with `DASHBOARD_DB` pointing there and the real save dir, then request
pages and `/__data.json` with curl and stop the server — all in one command where the sandbox gives
each command its own network namespace.

**How it works:** `watch.ts` polls the save folder (first backfill in mtime order, then every 2 s;
a file is read once its size and mtime hold still for one interval) → `save.ts` reads the zip with
`zip.ts` and queries the gamestate with jomini → `db.ts` places the snapshot in the save graph via
`timeline.ts` and records it → `/api/events` tells open pages to reload. In parallel, `feed.ts`
follows `game.log` from its current end and turns the mod's monthly lines into partial snapshots
(stockpile and net income) of the campaign being played.

**Upcoming events** (`events.ts`, pure): research per field, next tradition, council agenda, build
queue items and the next election, sorted by due date. Rates are _measured_ — progress between the
branch's two latest saves, so every speed bonus counts — and costs are base costs from the data DB
scaled by empire size and the galaxy sliders. Checked against the game at 2200.04.01: research
53/71/108 months, tradition 2200.09.01 exact; the agenda is 164 vs. the game's 163 (rounding).

**Popups** (`InfoPopup.svelte`, `server/explain.ts`): traits, edicts, council agendas, techs,
jobs and the empire's identity (`civic:`, `origin:`, `authority:`, `ethic:`, `gov:`) explained from
the extraction DB — descriptions, modifiers (edict/agenda ones live in `tradition_modifier`, techs
in `technology_modifier`), a few facts. Civics and origins follow the planner's pages: the effects
tooltip as text, job swaps, unlocked buildings, granted traits, the council seat (its modifiers
per leader level as `after`); ethics their implications (`ethic_tag_label`) and forbidden
policies. The **Government panel** (`panels/Government.svelte`, `identity()` in `server/empire.ts`)
sorts the save's flat `government` list by the kind the data DB knows each key as, and sums the
choices' flat modifiers in `#lib/effects.ts` — **adapted from the planner's `collectEffects`**. The modifier formatting in
`modifiers.ts` is **copied from the planner's `src/lib/civics.ts`** — keep the two in step. The
popup itself is plain CSS: the planner's needs Skeleton UI.

**Tabs and settings:** the layout's tab bar shows the custom tabs, then `all` (`/`), `colonies`
(`/colonies`: all colonies in one table, see below), `colony` (`/colony` → first colony,
`/colony/[id]` with a dropdown; old `/planet/[id]` links redirect),
`map` (`/map`, reuses `MigrationMap` — fork it when the two diverge), `migration`, `expansion`
(`/expansion`: the Expansion panel full-size, see below), `trade deals`
(`/deals`: running and ended deals, their monthly resources, `#lib/deals.ts`), `market`
(`/market`: prices over time and the standing orders, `#lib/market.ts`) and `events`
(`/events`: the milestone log, searchable, filtered in the page); tabs keep `?node=`. Say
**colony** wherever a colony is meant; planet only for the planet itself (`planetId`, Expansion,
`PlanetInfo`).
The `all` tab and custom tabs (`/tab/[id]`; the header is a switch, not a panel) render the same
panels by id (`EmpirePanel.svelte`);
`LAYOUT` in `#lib/settings.ts` lists them, in `all`'s order and grouping — **a new empire panel
goes there and into `EmpirePanel`**. Settings are stored server-side in the `setting` table
(`PUT /api/settings`), which a `SCHEMA` bump does not drop. The theme (`system`/`light`/`dark`)
is global; everything else (custom tabs, chart events, the colonies and expansion views, display options) lives
in a **profile** (`#lib/profiles.ts`, `server/settings.ts`): rows `profiles`, `profile:<id>`,
`activeProfile`, `campaignProfiles`. The profile in use is the current campaign's (the head's),
else the last picked — picking one while a campaign runs makes it that campaign's. The **config
tab** (`⚙`, `/settings`) manages them (`/api/profiles`: create, rename, delete, select, import;
`GET /api/profiles/<id>` exports `{ format: 'stellaris-dashboard-profile', version: 1, name,
settings }`). The first read made profile `default` from the rows stored before profiles; those
stay, unread. The theme is a class on `<html>`, put there by `hooks.server.ts` (no flash); `layout.css`
defines the `dark:` variant on it. Canvases (uPlot) pick axis colours per draw and redraw on
`onThemeChange` (`#lib/theme.ts`).

**Colonies tab** (`/colonies`; rows from `server/colonies.ts`, logic in `#lib/colonyTable.ts` and
`#lib/colonyProfile.ts`, both pure; `ColonyTable.svelte`): one table or one per sector (with the
sector's summed net output, as the game's sector row), sortable, filtered, columns picked; in
one-table mode each row carries its sector's colour (`CATEGORICAL`). Under each colony its **pros
and cons**: district caps per type, every non-cap effect of its features and planet modifiers
(good or bad by `positiveIsGood`), blockers, habitability < 100 %, free district room. Temporary planet modifiers (with an end date) count
too, marked ⏳ and counted apart: `6 (5+1)` is 5 lasting and 1 temporary (`countLabel()`). **Suits**
ranks resources by that evidence (a cap counts its size, a tagged pro +2, a con −2;
`resourceOf()` reads the resource from the key); a designation whose resources score under half
the best gets a ⚠ (capitals and cities aim at nothing). **Needs attention** (`problems()`):
stability < 50, housing or amenities short, habitability < 70 %, over a quarter of the pops
without a job (civilians are normal in 4.x). Orbital deposits are left out — the station mines
them, not the colony. Mode, sort, filters and columns are the `colonyView` setting, replaced
whole on PUT. The `all` tab's Colonies panel is still its own compact table. Pros and cons are
`TraitChip.svelte`; both tables sort through `#lib/sort.ts`.

**Habitability per species** (`#lib/habitability.ts`; the colonies and expansion tabs' "habitability
for" picker, main species = most pops): where the species lives, the save's value (pop groups,
`Colony.speciesHabitability`); elsewhere an estimate from the data DB — its traits'
`pc_<class>_habitability`, 100 % on `ideal` classes, plus `pop_environment_tolerance` (traits,
planet modifiers and features) only where the class gives it any, at least
`habitability_floor_add`. Empire-wide bonuses are not counted. Matched the game's Expansion
Planner at 2207.03.10 (Mars 0 %, Arid and Savanna 30 %, Tundra with Atmospheric Aphrodisiac 35 %).
The Hab. column takes the game's colours: yellow below `HABITABILITY_WRONG_PLANET`, red below
`HABITABILITY_OPPOSITE_PLANET` (0.7 / 0.4, data DB defines). Class names take their climate's
colour (`#lib/climate.ts`, `climate-*` in `colors.ts`), sampled from the climate-preference trait
icons: dry, wet, cold, volcanic, gold for the other colonizable classes; toxic worlds (no icon) an
olive of our own. Volcanic worlds are an ordinary colonizable class in 4.5.2 (climate dry,
`initial = yes`), good only for volcanic-preference species.

**Expansion** (`panels/Expansion.svelte`, the `all` tab compact — modifiers by name, effects on
hover — and the expansion tab with each effect shown): sortable, including per district type;
jumps from the capital, the nearest own shipyard and the border; filters by range (+0…+10, any),
class and district types (all of those picked); toxic worlds behind their own toggle until the
empire can detox them (`Snapshot.canDetox`: the `ap_detox` perk or the `knights_detox` country
flag — 4.5.2 `common/terraform/02_special_terraform_links.txt`; Climate Restoration is needed as
for every candidate), then among the terraforming candidates; district numbers are what the planet allows once its blockers are
cleared, now in brackets (`DistrictCap.blocked`, `PlanetCaps.limitCleared`: the blockers' hidden
features and their district loss). Matched the game at 2207.03.10 (Alpha Centauri IV farming 11
(8), generator 7 (5), mining 3 (2)) once the extraction resolved
`@DISTRICTS_FROM_SR_DEPOSITS` (swamps and bogs: +3 farming). Its view (range, toggles, filters,
sort, species) and both tables' row lines belong to the profile.

**Milestones** (`#lib/milestones.ts`, pure): the campaign's bigger events — systems, colonies
(colonization started / established / gained / lost), districts built and buildings done per
colony, wars, traditions, perks, research, species,
trade deals, passed agendas, leaders, ruler, civics/ethics/authority (by name, `identityNames`),
government type and origin, policies, edicts, sectors —
**derived on read** by diffing consecutive _saves_ along the branch (`branch()` → `milestones`), so
they follow the save graph and cover all history for fields already stored. A field is compared
only between saves that both have it (null = unknown; an empty colony list too), and an event is
dated to the first save showing it. New kind: `KINDS` + a detector + a colour in `colors.ts`. Each
chart has an "events" picker (`EventPicker.svelte`); choices are stored per `<scope>:<title>`
(`empire:`/`colony:` — stored `planet:` keys are renamed on read; `log` for the Events panel) in the `chartEvents` setting, merged on PUT.

**Colours** (`colors.ts`) follow the game: resources and research fields after their icons, other
events after the game's text colours. Charts and the upcoming list both use them. **Districts**
take theirs from the data DB (`district.color`, the border of the game's grid-box icon), shown as
a swatch and tinted name by `DistrictName.svelte`; pages get them as `colors` next to `names`.

**Two sources, one moment:** an autosave and the mod's line for the same date are merged into one
node (`place()` → `merge`), otherwise the second would look like a reload. The merge compares the
mod's income with the save's balance and logs `mod and save disagree on net income` on a mismatch.

## Companion mod (`mod/dashboard_feed`)

Every month, for human players, one `game.log` line per resource:
`SDASH|1|<date>|<resource>|<stockpile>|<monthly income>`, then `SDASH|1|<date>|end`. The format is
shared with `feed.ts` — change both together and bump the `1`. Built from 4.5.2's own docs
(`logs/script_documentation/effects.log`): `export_resource_stockpile_to_variable`,
`export_resource_income_to_variable`, `[Scope.var]` and `[GetDate]` in loc. Loc commands inside a
scripted effect are written `\\[...]` (vanilla `99_advanced_documentation.txt`). The resource list
equals `common/strategic_resources/00_strategic_resources.txt` (26 keys) — re-diff on game updates.

It changes the checksum: no achievements while enabled. Register it on Linux with
`scripts/link-mod-proton.sh stellaris-empire-dashboard/mod/dashboard_feed` (from the workspace
root, launcher closed).

### Sandbox notes (Claude Code on the Mac)

On Linux (2026-10-17) Node 24 is first on PATH — no `fnm` prefix — and check, test, lint and a
dev server on a DB copy all ran sandboxed. Kill that server by `$!`, not `pkill -f <pattern>`,
which also matches the Bash command's own shell and ends it (exit 143).

- **`pnpm install` / `pnpm add` must run outside the sandbox** (`! pnpm install`): pnpm 12 fails to
  take its store lock (`pnpm-store-operation-locks: Operation not permitted`) even with the store in
  `$TMPDIR`. Tests, check, build and dev don't touch the store and work sandboxed.
- **Node 24 is not first on PATH** (MacPorts' `node` is 22, pulled in by the `pnpm` port). Prefix
  commands with `fnm exec --using=24 --`.
- Starting the dev server needs `sandbox.network.allowLocalBinding` (set in the workspace
  `.claude/settings.json`); start it and make the requests in one Bash command.

## Save format facts (4.5.2, read from a real save)

**For a shape not yet seen in our saves** (wars, trade deals, galactic market): the other parser,
eliasdoehne/stellaris-dashboard (`stellarisdashboard/parsing/timeline.py`), reads many; a 4.0.1
save at 2312 lives in chennin/stellaris-dashboard-test-saves (galactic market and GalCom, but
still no trade deal). Download into `$TMPDIR`, never into the repo.

A `.sav` is a zip of `meta` and `gamestate`, both plaintext Clausewitz (~20 MB `gamestate` at 2200).

- Player: top-level `player = { { name country=<id> } }`.
- Stockpile: `country.<id>.modules.standard_economy_module.resources`.
- Monthly flows: `country.<id>.budget.current_month|last_month.income|expenses.<source>.<resource>`.
  **The market's standing orders are booked apart** in `trade_income|trade_expenses|trade_balance`
  (`monthly_trades.<resource>`); the game's top bar includes them (2200.04: energy 118 − 80 = +38).
  The orders themselves: top-level `market.monthly_trades = { { trade_data = { trade_type=
market_buy|market_sell resource country } amount } }`.
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
- Planet modifiers: `planets.planet.<id>.timed_modifier`, as the country's; features like
  `tidal_locked` and `mineral_poor` are permanent ones (`days=-1`).
- Pop groups: `colony.pop_groups` → top-level `pop_groups.<id> = { key = { species category } size
happiness }`. **`happiness` is omitted for some groups** (rulers, specialists at 2200.05) —
  treated as unknown, not 0.
- Automation: `colony.automation = { enabled settings = { "planet_automation_…" } }` lists the
  settings **on** (Earth 2200.05: crime + four the panel hides for this empire);
  `country.default_planet_automation_settings` for new colonies; top-level
  `automation_resources.<country> = { "energy" … }` read as the **disallowed** resources (empty at
  2200.04, all listed after the player unticked all).
- Leaders: **`country.owned_leaders`**, not `leaders.*.country` — that also matches the recruitment
  pool (19 vs. 7). Leader capacity is **per class**, base `@base_leader_cap = 3`
  (`common/leader_classes`), raised by `country_<class>_cap_add`; the result is not in the save. Ships: `country.fleets_manager.owned_fleets` → `fleet.<id>.{ship_class, ships}`
  → `ships.<id>.ship_design_implementation.design` → `ship_design.<id>.growth_stages[0].ship_size`.
- Overview: `country.victory_rank|victory_score|economy_power|tech_power|military_power` (the score
  breakdown is not stored); fleets `fleet.<id>.military_power`, names `%SEQ%` + `fmt`/`num` → "1st
  Fleet"; active edicts `country.edicts = { { edict … } }` — the **edict fund (10 / 15) is not
  stored** (base 10 + councilors, multipliers); species `species_db.<id> = { name class traits }`,
  pops via `pop_groups.key.species`; trait budget from `species_archetype` (base only); sectors
  `country.sectors.owned` → `sectors.<id> = { name systems type }`.
- Starbases: `starbase_mgr.starbases.<id> = { level modules buildings build_queue
shipyard_build_queue station }` — **no owner field**; the country's are those whose own `build_queue` it owns — the queue's
  `location.id` is the station ship, not the starbase (both 0 for Sol, which hid an outpost bug). System via `galactic_object.<id>.starbases`. Ship queue items name only a design
  (`ship_design.<id>.{name, growth_stages[0].ship_size}`). Capital ships (titan, colossus,
  juggernaut) need a citadel with `capital_yards`, an arkship's `arkship_capital_shipyard`, or a
  finished Mega Shipyard, plus the tech (`*_possible_construction` in
  `scripted_triggers/07_scripted_triggers_ships.txt`). Mega Shipyards: `megastructures.<id> =
{ type owner }` — not yet seen in a save, so how its ship queue is located is a guess.
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
  (adopt and finish entries included), `tradition_categories`; perks `country.ascension_perks`.
- Manual saves: a save with the same date as the head but another state continues the head (a
  manual save after the autosave); only an earlier date counts as a reload.
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
  years after the 2200.01.01 start (small/default galaxy). Stored as `Snapshot.endGameYear` — the
  outer bound for zooming out, once zoom exists.
- Top bar: `country.<id>.empire_size` (50 at start), `starbase_capacity_used` / `starbase_capacity`,
  `used_naval_capacity`; research per field is `physics|society|engineering_research` in the
  budget income. Envoys are `leaders.<id>` with `class="envoy"` and `country=<id>`; one is in use
  while it has `location = { assignment=… }` (seen: `first_contact`). **Not stored: the naval
  capacity maximum** — only script can read it (`max_naval_capacity` trigger, exportable with
  `export_trigger_value_to_variable`), i.e. the companion mod.
- Progress: `country.tech_status.<area>_queue = { { progress technology date } }` (research points,
  not percent); `country.government.council_agenda` + `council_agenda_progress`;
  `country.next_election`. **Agenda progress moves on the 1st only** (2207.02.01 → 03.01: +44,
  03.01 → 03.10: 0), research daily — so the agenda's rate is measured across month starts, or a
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
- Government: `country.government = { type="gov_representative_democracy" authority civics={…}
origin="origin_default" … }` (2207.03.10); ethics in `country.ethos.ethics`. `type` is named
  from the data DB's `government_type`.
- A colony's sector: its planet's system (`coordinate.origin`) in an owned sector's `systems`
  (`sectorBySystem()`; 2207.03.10: only the core sector, `type="core_sector"`, named after the
  capital). Habitability: `pop_groups.<id>.habitability` (0–1, seen 1 and 0.9), pops-weighted.

## Open (needs a running game on Linux)

- **Migration treaties, never seen in a save** (2207.03: none, not even between AI empires).
  `migrationPartners()` takes any relation mentioning "migration" — check the real shape at the
  first treaty, tighten it, and add the foreign colonies' case to the tests from that save.
- **Wars, never seen in a save** (2207.03: `war`, `truce`, `dead_war` empty). `wars()` in
  `save.ts` reads an assumed shape — check the real one at the first war, tighten it, and replace
  the assumed test fixtures.
- **Trade deals, never seen in a save** (ours to 2207.03, and a 4.0.1 save at 2312: `trade_deal`
  empty). Known (stellaris-dashboard's parser): `trade_deal.<id> = { first = { country … } second
= { country sensor_link=yes … } date length }`. Guessed in `tradeDeals()`: each side lists what
  it _gives_, resources under a key containing "month" are monthly. Each deal keeps its raw block
  (`TradeDeal.raw`, shown on `/deals`) and an unreadable one logs `trade deal … not understood` —
  at the first deal, compare `/deals` with the game's diplomacy screen and tighten the parser.
- **Exact branch points via the mod**: each month the mod rolls a random id and keeps the previous
  one in a country variable, logging both (`SDASH|…|<date>|timeline|<id>|<previous id>`). After a
  load, the first line's _previous id_ is the id of the loaded save's month — the parent, exactly.
  The variables also land in every save. Needs the mod running (no achievements).
- **District caps via the mod, to check the computed ones**: the `free_district_slots` trigger
  (colony scope) can be exported with `export_trigger_value_to_variable`; no trigger for free
  building slots found. Matched by hand for Earth only.
- **`continue_game.json` on load**: if the game rewrites it when a save is _loaded_, it names the
  branch point exactly — `place()` already takes that as `loadedFrom`, nothing feeds it yet.
- **Companion mod, never loaded in game.** First run decides three guesses, each failing loudly
  rather than silently: `[GetDate]` prints `YYYY.MM.DD` (else `feed.ts` reports "unexpected date
  format"), variables print as plain numbers (else "malformed SDASH line", e.g. for `1.2K`), and
  `export_resource_income_to_variable` is _net_ income (else the merge logs "disagree on net
  income" at the first autosave).
- **Galactic market prices**: `market()` reads `market.fluctuations` /
  `galactic_market_resources` as lists by resource index — confirmed on a 4.0.1 save at 2312
  (chennin/stellaris-dashboard-test-saves; 24 slots there vs. 26 resources in 4.5.2, so the order
  follows the game version's `strategic_resources`). Not yet seen in our own game. Prices exist
  only for saves read since 2026-10-17; older ones' saves are gone.
- **Chart zoom and pan**: wanted — the default window (`xRange`: last 20 years, 1 ahead) should
  zoom out/in and shift. Not started.
- **Traditions taken**: read from `country.traditions` (list) — a guess, no save with an adopted
  tradition seen yet. Wrong means the second tradition's cost stays at 300.
- **`/migration` holds four variants to compare** (over time, matrix, monthly flow, map) — the
  user picks which to keep, then drop the rest.
- **Next, the user's plan:** a configurable main dashboard (custom tabs pick empire panels now;
  the migration and planet panels are not pickable yet).
- **Hint rules**: not started.
- Cross-check the parsed numbers against the in-game UI.
