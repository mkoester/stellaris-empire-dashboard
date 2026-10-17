# stellaris-empire-dashboard

Second-screen dashboard for a running Stellaris game: graphs over time (pops, stockpiles, monthly
income), colony state, later rule-based hints. Reads what the game writes — autosaves and, via the
companion mod in `mod/`, `game.log` — and keeps a **save graph**, so loading an older save starts
a branch instead of overwriting history.

SvelteKit 3 / Svelte 5 / Tailwind v4 / TypeScript 6 / pnpm, on Node 24 LTS (`.node-version`).
Storage is `node:sqlite` (built into Node, no native build). Saves are parsed with `jomini`.

- **SvelteKit 3 layout:** no `svelte.config.js` — config goes to `sveltekit({...})` in
  `vite.config.ts`; `tsconfig.json` extends `$app/tsconfig`; `$lib` is gone, import
  `#lib/<path>.ts` (`imports` in `package.json`).
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

`STELLARIS_TEST_SAVE=<.sav>` enables the real-save test in `save.test.ts`.

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

**Popups** (`InfoPopup.svelte`, `server/explain.ts`): traits, edicts, council agendas, techs and
jobs explained from the extraction DB — descriptions, modifiers (edict/agenda ones live in
`tradition_modifier`, techs in `technology_modifier`), a few facts. The modifier formatting in
`modifiers.ts` is **copied from the planner's `src/lib/civics.ts`** — keep the two in step. The
popup itself is plain CSS: the planner's needs Skeleton UI.

**Colours** (`colors.ts`) follow the game: resources and research fields after their icons, other
events after the game's text colours. Charts and the upcoming list both use them.

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

- **`pnpm install` / `pnpm add` must run outside the sandbox** (`! pnpm install`): pnpm 12 fails to
  take its store lock (`pnpm-store-operation-locks: Operation not permitted`) even with the store in
  `$TMPDIR`. Tests, check, build and dev don't touch the store and work sandboxed.
- **Node 24 is not first on PATH** (MacPorts' `node` is 22, pulled in by the `pnpm` port). Prefix
  commands with `fnm exec --using=24 --`.
- Starting the dev server needs `sandbox.network.allowLocalBinding` (set in the workspace
  `.claude/settings.json`); start it and make the requests in one Bash command.

## Save format facts (4.5.2, read from a real save)

A `.sav` is a zip of `meta` and `gamestate`, both plaintext Clausewitz (~20 MB `gamestate` at 2200).

- Player: top-level `player = { { name country=<id> } }`.
- Stockpile: `country.<id>.modules.standard_economy_module.resources`.
- Monthly flows: `country.<id>.budget.current_month|last_month.income|expenses.<source>.<resource>`.
  **The market's standing orders are booked apart** in `trade_income|trade_expenses|trade_balance`
  (`monthly_trades.<resource>`); the game's top bar includes them (2200.04: energy 118 − 80 = +38).
  The orders themselves: top-level `market.monthly_trades = { { trade_data = { trade_type=
market_buy|market_sell resource country } amount } }`.
- Colonies: since 4.x a top-level `colony=` section, referenced from `planets.planet.<id>.colony`.
  Holds pops, housing, amenities, stability, `final_designation`, districts, buildings.
  `employable_pops` counts all pops able to work, _not_ the employed: employed is
  `employable_pops - civilian` (Earth 2200.04: 5207 − 1905 = 3302; its `pop_jobs` sum to 3300).
  Jobs: `colony.pop_jobs` lists ids into top-level `pop_jobs.<id> = { type workforce max_workforce
pop_groups = { { pop_group amount } } }`; open positions = `max_workforce − workforce`
  (`-1` = unlimited, civilian). Every colony also carries empty placeholder jobs (servant, purge, …).
- Districts (4.x): `colony.districts` → `districts.<id> = { type level zones }` — **`level` is the
  number built**; `zones.<id> = { type buildings }` (4294967295 = no zone); `buildings.<id> =
{ type position }`. **Not in the save: district caps and free building slots** — caps come from
  deposits' `planet_modifier` (`district_*_max_add`; Earth's give farming 5 / generator 6 / mining 7
  vs. the game's 8 / 8 / 7, so more sources apply), game-start scripts and more; zone slots from
  `max_buildings`, `districts_per_building` and planet-wide `zone_building_slots_add`.
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
- Expansion: `country.surveyed_deposit_holders = { { type=0 id=<planet> } }`; systems
  `galactic_object.<id> = { name planet hyperlane = { to length } colonies }`. The game's list
  differs from the class rule (`pc_barren` is `colonizable = no`, yet Mars is offered — terraforming).
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
  `country.next_election`; galaxy cost sliders `galaxy.technology`, `galaxy.traditions`. Tech costs
  in game were ×1.05 of the extracted base (source unconfirmed, `TECH_COST_OBSERVED_FACTOR`).
- Identity of a game state (`Snapshot.fingerprint`): `tick` + `random_count`, both top-level.

## Open (needs a running game on Linux)

- **Migration treaties, never seen in a save** (2207.03: none, not even between AI empires).
  `migrationPartners()` takes any relation mentioning "migration" — check the real shape at the
  first treaty, tighten it, and add the foreign colonies' case to the tests from that save.
- **Exact branch points via the mod**: each month the mod rolls a random id and keeps the previous
  one in a country variable, logging both (`SDASH|…|<date>|timeline|<id>|<previous id>`). After a
  load, the first line's _previous id_ is the id of the loaded save's month — the parent, exactly.
  The variables also land in every save. Needs the mod running (no achievements).
- **District caps and free slots via the mod**: the `free_district_slots` trigger (colony scope)
  can be exported with `export_trigger_value_to_variable`; no trigger for free building slots found.
- **`continue_game.json` on load**: if the game rewrites it when a save is _loaded_, it names the
  branch point exactly — `place()` already takes that as `loadedFrom`, nothing feeds it yet.
- **Companion mod, never loaded in game.** First run decides three guesses, each failing loudly
  rather than silently: `[GetDate]` prints `YYYY.MM.DD` (else `feed.ts` reports "unexpected date
  format"), variables print as plain numbers (else "malformed SDASH line", e.g. for `1.2K`), and
  `export_resource_income_to_variable` is _net_ income (else the merge logs "disagree on net
  income" at the first autosave).
- **Chart zoom and pan**: wanted — the default window (`xRange`: last 20 years, 1 ahead) should
  zoom out/in and shift. Not started.
- **Traditions taken**: read from `country.traditions` (list) — a guess, no save with an adopted
  tradition seen yet. Wrong means the second tradition's cost stays at 300.
- **`/migration` holds four variants to compare** (over time, matrix, monthly flow, map) — the
  user picks which to keep, then drop the rest.
- **Next, the user's plan:** tabs, then a configurable main dashboard.
- **Hint rules**: not started.
- Cross-check the parsed numbers against the in-game UI.
