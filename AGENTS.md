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
dev server ingests saves and moves the head). On the Linux game machine it lives in
`~/.local/share/stellaris-empire-dashboard/`. Copy `dashboard.sqlite*` (WAL files included) to a
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
`map` (`/map`, the discovered galaxy, see below), `migration`, `expansion`
(`/expansion`: the Expansion panel full-size, see below), `trade deals`
(`/deals`: running and ended deals, their monthly resources, `#lib/deals.ts`), `market`
(`/market`: prices over time and the standing orders, `#lib/market.ts`) and `events`
(`/events`: the milestone log, searchable, filtered in the page), `government`, `situations`, `focus`,
`traditions`, `tech`, `leaders`, `species`, `contacts`, `megastructures` (all below), `mods` and
`dlc` (last; see
"DLCs and mods" below); tabs keep `?node=`. Tables on the newer tabs sort through
`SortTable.svelte` (columns as `Column<T>` from `#lib/sort.ts`), maps through `GalaxyMap.svelte`
(pan, zoom, resize, lanes, systems with an optional `fill`; the page draws its `layer`;
`MigrationMap` is one such layer). **Maps show only what is discovered**: visited or own systems
(the save's `terra_incognita.systems` is the same list; its 256×256 `data` grid is run-length
encoded, row-major, but its scale is not pinned down) plus first contact sites, lanes only among
them (`discovered()`, `mapView()`, `server/mapSystems.ts`). As the game, a map also draws every
lane of a system whose lanes the empire knows — `country.hyperlane_systems` (`GalaxySystem.lanesKnown`):
visited plus hyperlane detection range, which sensors and the Map the Stars edict raise
(2207.03.10: 60 = 41 visited + 10 one jump out + 9 further; matches the game's map around Craxima
and Rimmock) — the systems at their far ends faint, "Unknown". Explored wormholes are dashed arcs, behind the profile's `wormholeLinks` switch (on). Explored =
**both ends visited**: the save marks no wormhole as explored (bypasses carry no such field, the
country only `seen_bypass_types`), and exploring one is a fleet's jump through it (4.5.2
`common/bypass/00_bypasses.txt`, `on_pre_explore`), which visits the far end; one end visited is
not enough (2207.03.10: Phiroza visited, Eye of Bal not — no link). `wormholePairs` (spoiler) shows
every pair (`wormholeLinks()` stores them all), both ends. Fit
buttons: capital, my empire, explored, the page's own, everything; a per-viewer `sectors` checkbox
splits our territory by sector (`GalaxySystem.sector`, the colonies tab's `sectorColors`). Profile switches: `unknownStars`
adds every other star, faint, named "Unknown" and without lanes, but not the special systems off
the main hyperlane network (`mainNetwork()`; 2207.03.10: Kleeia `distar_sealed_1_2` and Ultima
Vigilis `surveillance_supercomputer_system`, no lane at all — the game reveals such systems by a
trigger) (the game shows all stars from the start, only the
connections are hidden); `wholeGalaxy` shows every system and lane. With `unknownStars` the
star-only megastructure rules (catapult, stellar cannon, matter decompressor's star) count those
systems too. Megastructure candidates, the catapult's farthest system and the jumps beyond the border
count discovered systems only. Table rows tied to a system (`SortTable` `link`) and the map share a
bindable `hovered` system: the row is highlighted, the system ringed; binding `selected` too
makes a click (row or system, not a drag) pick a system, ringed in sky blue, its row scrolled into
view. **Borders** (`territories` on `GalaxyMap`; `#lib/borders.ts`, `#lib/territories.ts`,
`territoriesOf()` in `server/mapSystems.ts`): a smooth field, as the game blends territory — each
owned system radiates exp(−3·(d/R)²), R = `REACH` (0.8) × the median nearest-neighbour distance
(`claimRadius`), and each lane between two systems of one owner the same over its distance from
the lane scaled by `CORRIDOR` (0.5); an owner holds where its summed field passes a lone system's
value at R and beats every other owner's, traced by marching squares (R/5 grid) into rings drawn
even-odd. **Only owned systems count** — an unowned one is covered, not cut out. Iterations that
looked wrong against the game's map (2205.07, Cydran Concern): Voronoi cells clipped to circles
left far systems as islands; every system as a site cut a territory where an unowned system sat
beside a lane; cells plus corridors left seams and dents; the field at REACH 1.25 covered 57 of
362 unowned systems (40 owned: "looks like they own more"), at 0.8 12. ~180 ms for 14 owners on a 400-system
galaxy, once per owner change. Colours are the game's: a country's first `flag.colors` swatch, its
`map` rgb from `flags/colors.txt` (data DB `flag_color`). Shown: ours, empires we have
communications with, every visited station's owner with `contactStations`; stations we saw but
cannot name are **guessed** (one shipset within `GUESS_JUMPS` = 3 jumps = one empire), dashed, in
a colour of ours; other visited stations grey, "unknown owner". **Map tab** (`/map`,
`#lib/mapLayers.ts`): borders and the markers of what was discovered — open first contacts,
stations seen, anomalies, dig sites, special projects, wormholes, gateways and L-gates
(`GalaxySystem.bypasses`), megastructures and their ruins (`*_ruined`) — each layer hidden by the
profile's `mapFilter`, plus a table with what is worked on and how far (an envoy on a contact,
an excavation running; stage, clues, days — anomalies and special projects carry no progress in
the save) and a system search (known names completed; picks and centres, `GalaxyMap.show()`). Say
**colony** wherever a colony is meant; planet only for the planet itself (`planetId`, Expansion,
`PlanetInfo`).
The `all` tab and custom tabs (`/tab/[id]`; the header is a switch, not a panel) render the same
panels by id (`EmpirePanel.svelte`);
`LAYOUT` in `#lib/settings.ts` lists them, in `all`'s order and grouping — **a new empire panel
goes there and into `EmpirePanel`**. Settings are stored server-side in the `setting` table
(`PUT /api/settings`), which a `SCHEMA` bump does not drop. The theme (`system`/`light`/`dark`)
is global; everything else (custom tabs, chart events, the colonies and expansion views, display options) lives
in a **profile** (`#lib/profiles.ts`, `server/settings.ts`): rows `profiles`, `profile:<id>`,
`activeProfile`, `campaignProfiles`. The profile in use is the **viewed** campaign's — the
`?node=` one, else the head's (`viewedCampaign()`, via `getRequestEvent()`; API calls carry the
page's `?node=`, `api()` in `#lib/settings.ts`) — else the last picked; picking one makes it the
viewed campaign's. **Campaigns** (one per save folder) switch in the header's `game` dropdown,
shown from two on: each is its tip node (`campaignTips()` in `#lib/timeline.ts`: the head for the
one being played, else its last observed node), named after its latest save's empire
(`campaignName()`); the tab stays, a colony or custom tab goes to `all`. The **config
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
for every candidate), then among the terraforming candidates; below it the **habitat sites**
(`habitatSites()` in save.ts, `#lib/habitats.ts`), shown once the empire can build habitats
(`tech_habitat_1`, the Diadochi / Great Khan's Legacy civics, `democratic_khanate_flag`) or always
with the config tab's `habitatsAlways`: one habitat per system, inside the borders to build; its
district limit after `max_habitat_districts_value` (6 + ¼ per star and planet, again with Habitats
II and III, + ¼ per moon and asteroid for Void Dwellers), its mining, energy and science caps from
the surveyed orbital deposits' `habitat_modifier` (data DB `deposit_habitat_modifier`); filtered by
the same range and a minimum size (default 10, the game's "poor" threshold); district numbers are what the planet allows once its blockers are
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

**Council** (government tab): the ruler's seat (`councilor_ruler_<authority>`; not in the save's
seat list, `possible = { always = no }`) and the seats held, each with what it gives **at the
leader's level** — 4.5.2 `common/governments/councilors/000_councilor_documentation.txt`: a seat's
`modifier` "is multiplied by assigned Leader's level" (`atLevel`; `seat:<key>` popups hold the
per-level values), shown per level and, in brackets, at the **councilor level** = leader level +
its `bonus_skill_level` + the empire's `councilor_skill_add` the save shows active (traditions,
edicts, policy options, civics, timed modifiers; `councilorBonus()`, data DB `councilorSkill`).
Each seat's leader classes are chips in the game's colours; the leader's traits add their
`councilor_modifier` ("applied to country if leader is on the Council", flat — 4.5.2
`common/traits/000_documentation_leader_traits.txt`; `ltraitcouncil:<key>`). Possible seats are our
civics' seats and the base and enclave seats known to be open (`possible` true): the enclaves' seats need a
leader with the enclave's trait, hired at that enclave (4.5.2 `events/overlord_enclaves_events.txt`,
e.g. `enclave.7100`: 50 influence and energy by empire size), so the extraction rewrites
`any_owned_leader = { has_trait = X }` as `has_owned_leader_trait` leaves, checked against our
leaders; the Thought Warden (`has_leader_flag = mindwarden_commander`, the Mindwardens origin)
stays unknown, hidden. Agendas show "while preparing" (`modifier`, active while being enacted —
`99_README_AGENDAS.txt`) and "once launched" (launch effect text, `finish_modifier` for its
duration); edicts their effects, in the table. Factions: none has formed in a save yet, so the
panel lists faction types only with the profile's `factionTypes` (our ethics) or
`allFactionTypes` switch — both marked cheating. `unlocked_civic_council_slots` is the number of
seats (3 at 2207.03.10, all held). The agenda being prepared shows progress / cost (at empire size),
percentage and months; every other open one "~N months if picked next" — the measured rate and
size factor of the current agenda, started from 0. Same-status agendas sort alphabetically.

**Revealing what the game hides is the user's choice, off by default** (their rule, 2026-10-18):
the tabs show what the game's own panels show — agendas, edicts, policies, council seats as the
game lists them, maps only discovered space, factions only once formed. Everything beyond is a
profile switch in ⚙ (`Display`), labelled as spoilers or cheating where it is: `showLocked`,
`factionTypes` / `allFactionTypes`, `anomalySpoilers`, `projectSpoilers`, `contactStations`,
`unknownStars`, `wholeGalaxy`, `wormholePairs`, `lgates`, `surveyAll`. A new view of hidden information follows the same pattern. **The
check is the user's in-game screenshot** of the matching panel (workspace `CLAUDE.md`): it caught
the edicts (58 → the game's 5), policies, agendas and focus cards here.

**Government tab** (`/government`, `#lib/government.ts` and `#lib/triggers.ts`, both pure): the
identity panel, ruler and council seats, the agenda with its due date (`events.ts`), the agendas this
empire can have (`potential` not false: current, cooldown, open, open? — `allow` not answerable —,
not allowed now, locked — none of the traditions or perks in its `unlocked_by` taken; 2207.03.10:
7 open, matching ethics such as Open Arms and Give and Take), policies with the options this empire can have, edicts (active with their
start, the others by unlock), and per faction type its demands. The data DB's normalised triggers
(`*_json`) are evaluated **three-valued** against the save (`facts()`: country type, civics,
ethics, authority, origin, DLCs, policy and country flags, traditions, perks, techs, war): what
the save cannot answer (`num_rivals`, scopes like `any_owned_pop_group`) is unknown, shown `?`,
never guessed — except that a leaf naming a parameter-free scripted trigger is evaluated by its
body (data DB `scripted_trigger`; `is_dark_consortium_empire` → its civics). As the game lists
them: policies are the save's `active_policies` (2207.03.10: 27, the game's panel; War
Philosophy under both its categories), edicts those whose potential holds and that are unlocked
(traditions, perks and `prerequisites` techs; 2207.03.10: exactly the game's five). The profile's
`showLocked` switch (⚙) adds the rest: locked agendas and edicts, all policies and options.
**Species rights** (species tab, `#lib/rights.ts`): `country.modules.standard_species_rights_module
.primary = { species_index citizenship living_standard … }` per species, every option of each kind
whose potential is not false (`from` = the country, folded in; `has_trait` = the species'),
2207.03.10: Human as the game's panel, a few options more than the game shows (their conditions
read scopes the save cannot answer). `is_nomadic` is
built into the game and approximated as a Nomads origin.

**Situations tab** (`/situations`, `#lib/situations.ts` pure, readers in `server/world.ts`): first
contacts as a table (age in months, difficulty, clues, stage, days left, envoy, jumps from our
border along hyperlanes, their stations) and a map (open contacts by difficulty and age, ✉ with
an envoy); situations, anomalies, special projects (no progress in the save), dig sites, a link
to events. Spoilers are display switches in the profile (`anomalySpoilers`, `projectSpoilers`:
the outcome events' titles), as is `contactStations`: visited systems coloured by their
station's owner, and every map's borders named — the save names it before communications, a
spoiler. **Stations seen** (`Snapshot.stationsSeen`, `stationsSeen()` in `server/world.ts`): other
empires' stations in the systems our fleets are in when the game saves (`fleet.<id>.movement_manager.coordinate.origin`),
with the owner's shipset (`graphical_culture`) — what the player saw being there. A snapshot field,
so it follows the save graph; `mergeSightings()` keeps first and last date per system. The owner id
stays on the server unless we talk to them. Monthly autosaves catch only the fleets present then
(2207.03.10: none yet — every fleet abroad sat in a station-less system). **The galaxy is not stored per snapshot** (~1.6 MB at 2207.03.10): `Snapshot.galaxy` and
`Snapshot.surveyedAll` (expansion candidates and habitat sites as if every planet were surveyed: 2448
planets vs. 51) go to the `galaxy` table, one row per campaign holding its latest reading
(`galaxyOf()`; rows before 2026-10-18 hold the systems alone); every system's place, star, lanes
and bodies (each `surveyed` or not), owner and megastructures only for visited or own systems.
Pages read it through `campaignGalaxy()` (`server/mapSystems.ts`), which applies `surveyView()`:
bodies of visited or own systems only, anomalies only on surveyed planets — or everything with the
`surveyAll` spoiler, which also swaps the expansion and habitat lists (`expansionOf()`,
`surveyedAll()` in `server/expansion.ts`; the campaign's latest reading, not the branch's).
**L-Gates** (`lgates` spoiler): every L-Gate system (`GalaxySystem.lgate`, an `lgate_base`
megastructure; 2207.03.10: Eye of Bal, Ribellan Vortex), named, with an L-Gate marker. The
L-Cluster (`lcluster`: star flags `lcluster*`) only exists once the gates open — 4.5.2
`events/distant_stars_events_3.txt` `distar.11000` spawns it then, 550–560 from the galactic
core at 44–46°, its other systems relative to that within ranges; then every gate links to its
entrance `lcluster1` (`lgateTo`, a star), drawn like a wormhole in cyan. Before that the spoiler
links every gate to `PREDICTED_LCLUSTER` (`situations.ts`, id −1): 555 from the core at 45° from
−x towards −y — calibrated 2026-10-19 by `event distar.11000` in a throwaway game: `lcluster1`
(Final Egress) at (−395, −396), its eight other systems (`lcluster2`… `lcluster4b`) around it
within ~70; the event did not set `lgates_activated_globally`. Without the spoiler a
gate's link shows once both ends are visited. **First contact** markers take the game's map icon
blue (`#6478c8` on `#284088`, sampled from a screenshot: `firstcontact_map_icon.dds` is a cyan
saucer the map does not show).

**Megastructures tab** (`/megastructures`, `#lib/megastructures.ts`, pure): every system ranked
per structure (arc furnace, dyson swarm, dyson sphere, ring world, matter decompressor, stellar
cannon, quantum catapult, mega shipyard, sentry array), with a map coloured by score and a table,
filtered to my systems, up to +0…+10 jumps beyond the border, or all. Structure, range, the
fitting switch and the picked system are the profile's `megastructureView` (default Arc Furnace). `MEGA_RULES` is taken from 4.5.2
`common/megastructures/*` (file per rule; re-check on game updates): star classes, no
binary/trinary, no colonizable planet (`colonizable_planet`: the data DB's colonizable classes plus
city, relic, nuked, hive, machine, habitat), no non-gate megastructure already there (ruined ones
block too, though they can be restored), The Machine Age (arc furnace and swarm need it, the Dyson
Sphere only exists without it). Scores: the arc furnace's is the game's own `tooltip_system_score`
(bodies neither star nor colonizable without a research deposit; ≤ 10 poor, ≥ 16 good); the only
structure with one. The others are ours: swarm = the star's deposit amounts, sphere = colonizable
planets frozen + deposits, ring world = deposit amounts removed with every non-star body, catapult
= the farthest system on the 2D map (and how many lie within the stages' 300/450/750), mega
shipyard = the outermost body's distance from the star (the way out for new ships), sentry array
= systems not ours within 20 **hyperlane jumps** (stage 1; 40 and 60 shown, the finished array
sees everything — `has_full_sensor_range`). `sensor_range` is jumps: ship sensors are 1–4 and
starbases add 1, which in map units (~20 between systems) would not leave their own system. Jumps
run over discovered lanes, so early on the score saturates (2207.03.10: 37 for every reachable
system). Rules needing bodies are unknown (`?`) in unvisited systems.
2207.03.10: catapult best near the centre (Elthir: farthest 387, centre 83); arc furnace Sol 20.

**Focus, traditions, tech, leaders, species, contacts** (one route each):

- **focus** (`#lib/focus.ts`): the open and done cards (hint, requirement, the progress each
  gives: 10 / 25 / 50 by tier, core cards to all three) and per category the next reward and the
  one after. A reward is `add_research_option` — "permanent until researched" (4.5.2
  `logs/script_documentation/effects.log`): no research, no progress. Several options are an
  if/else on the empire, not a choice; the one ours is evaluated (`is_diplomatic` …) and the
  ⓘ popup says why. Categories in the game's colours (`focus-*` in `colors.ts`).
- **traditions**: the active effects in two tables, traditions and perks (`totalEffects()`,
  `EffectTotals.svelte`, shared with the Government panel; text-only effects listed apart), every
  adopted tree in full with each tradition's effects (not yet active ones grey), the other trees,
  every perk (taken first, conditions not checked).
- **tech**: the three queues with due dates (`events.ts`), the cards on offer
  (`tech_status.alternatives`), research tiers, everything researched.
- **leaders**: `Snapshot.leaderList`, traits explained by `ltrait:<key>` (data DB `leader_trait`,
  each modifier labelled with its scope); class colours (`class-*` in `colors.ts`, envoys ours);
  envoys behind a switch, off by default.
- **species**: traits with their effects in a grid (the climate preference, one line per planet
  class, a row of its own; more picks wrap into more rows), trait budget, rights. System names
  from random-name lists that are localisation keys (`VOIDWORM_SYSTEM_12` = Papqaqtet) resolve
  through the data DB's `prescripted_name`.
- **contacts** (`#lib/contacts.ts`): the relations table, its filters and columns being the
  profile's `contactView` (stored at once, `PUT /api/settings`).

**DLCs and mods** (`/dlc`, `/mods`, `#lib/addons.ts`, pure): what is active comes from each
save's `meta` (`required_dlcs`, `mods`: names; `version`) → `Snapshot.dlcs|mods|gameVersion`;
the changelog is the `dlc` and `mod` milestones, so it follows the save graph and starts with the
first save read since 2026-10-18. The DLC catalogue is the data DB's `dlc` table (all 36 of
`dlc_info.txt`, category from the installed DLCs' descriptors, Steam release dates). Installed
mods are the launcher's descriptors, `<user dir>/mod/*.mod`, the user dir being
`STELLARIS_SAVE_DIR`'s parent (`server/mods.ts`, read at start); `supports()` compares their
`supported_version` (`v4.5.*`) with the save's version. A dev copy registered next to its workshop version (`link-mod-proton.sh`) has the same name and id: rows are keyed by descriptor file, marked "local", and left out of the version notes (`trackedMods()`) — keyed by name and id they once broke the tab (a duplicate key, client-side only). 2207.03.10: 28 DLCs, 17 mods. **Merged
DLCs**: Utopia, Synthetic Dawn and Humanoids are gameplay DLCs no script checks for (data DB
`dlc.host_checks` 0) and saves leave them out of `required_dlcs` though installed — shown as
"base game". **Mod updates**: the launcher's `launcher-v2.sqlite` (`mods.timeUpdated`, seconds;
`version` where the descriptor has none, read-only) completes the descriptors; at each start
`noteModVersions` notes every mod whose version, supported version or update time changed in
the `mod_version` table, with the head's game date — the mods tab's "Updates", since
2026-10-18 (many mods name no version: their update shows as a new update time). The DLC tab
opens per category.

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

## Testing in a throwaway game

New save shapes come from **throwaway games with console cheats, never the real campaign** (its
history lives only in the DB), against a **separate `DASHBOARD_DB`**, the companion mod on (cheats
end achievements anyway). Per topic a manual save before and after, diffed in `$TMPDIR`, plus a
screenshot of the game's panel. Commands, from the wiki's console page (verified for 4.5):
`debugtooltip` (ids), `contact`, `communications`, `debug_yesmen` (AI accepts all), `play <id>`,
`war <attacker> <defender> <wg>` (`wg_subjugation`, `wg_tribute`), `peace_on_player <id>`,
`activate_ascension_perk <ap>`, `activate_tradition <tr>`, `research_technology <tech>`,
`unity`/`influence`/`cash`/`resource <n> <res>`, `instant_build`, `survey`, `fast_forward <days>`,
`factions.spawnall`, `federation_add_experience`/`_cohesion`, `event <id>` (`galcom.16` founds
the Galactic Community, `distar.11000` opens the L-Gates, `crisis.199|1000|2000|8005`,
`fallen_empires_awakening.1` after `play`-ing a fallen empire), `effect <script>`. Situations:
`effect add_situation_progress = 500` moved our Psionic Ascension to its next stage (2026-10-19;
an `every_situation = { limit = … }` form did not).

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
- Subjects: top-level `agreements.agreements.<id> = { owner target active_status date_added
term_data = { agreement_preset discrete_terms = { { key value } } resource_terms
can_subject_* … } subject_specialization = { level experience } }`, owner = the overlord; the
  subject's country block holds `loyalty` (−45, the game's agreements screen), `overlord` and
  `subject_date`, and our relation to it `subject=yes`. The monthly loyalty change (+0.9) is not
  stored. Shown on the contacts tab (`subjects()` in save.ts), the terms in the game's words
  from the data DB (`diploNames`: `agreement_term*`, `agreement_preset`; hidden terms have no
  name there and are left out — 7 shown, as the game's agreements screen).
- Galactic Community (2026-10-19): `galactic_community = { members = { <ids> } proposed = {
<resolution ids> } voting = <id> emissaries days election community_formed focus … }`,
  `resolution.<id> = { type country supporters = { <ids> } opponents }` (the voted one also
  `voting = { <country>=<date> }`). Our country holds no GalCom field (diplomatic weight is not
  stored). Contacts tab: members, the vote, the proposals with our side; names and effects from
  the data DB (`resolution`, its effects = the static modifier of the same key, `resolution:<key>`
  popups).
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
- Pacts are **flags on the relation**: `country.relations_manager.relation = { country embassy
research_agreement commercial_pact defensive_pact non_aggression_pledge guarantee closed_borders
migration_access waystation_pact … }` (`=yes`; the last two are the migration treaty and the
  wayline pact), read as `Relation.agreements` (contacts tab, Agreements column). `trust` caps near
  50 (`add_trust = 100` gave 49.5–50.85); `relation_current` is the contacts screen's opinion
  (+210, +142 … matched, screenshot 2026_10_19_1).
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
type clues difficulty days_left excavator_fleet }`. Megastructures `megastructures.<id> =
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
  agendas table shows these dates, the upcoming list "can be picked again"; our own first launch is
  still to check them against.
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

## Open (needs a running game on Linux)

- **Explored wormholes**: "both ends visited" is a proxy (reaching both ends by hyperlanes would
  show a link never jumped through). At the first wormhole explored, diff its `bypasses.<id>`,
  `natural_wormholes.<id>` and the country block against an earlier save for a real marker.

- **Stations seen, exactly**: saves catch only the fleets present at save time. The companion mod
  could log each system entry (an `on_entering_system`-style on_action) with the station's shipset
  for `feed.ts`. Check the borders and the guesses against the game's map at the first sighting.

- **Megastructure scores, not yet checked in game**: the arc furnace's (Sol 20 at 2207.03.10)
  against the game's "best systems" tooltip; whether the catapult's `catapult_range_base` is in
  galaxy-map units (assumed); whether the in-system distance to
  the outermost body is what new ships of a mega shipyard travel (hyperlane arrival points are not
  stored); and whether the catapult's `max_jumps = 25` (another catapult) is a rule or AI weight.
- **Our own factions, not seen yet**: `factions.spawnall` (2026-10-19) formed four for an AI
  only: `pop_factions.<id> = { country type name support_percent support_power faction_approval
members = { <ids> } last_month_pops pops_change last_month_colony_pops }`. `factions()` reads
  ours from that shape; the government tab shows formed ones with support and approval — check
  against the game's factions screen at our first faction.
- **Faction Approval shows `+0.1`, not `+10%`**: `isPercentModifier` (`modifiers.ts`, copied from
  the planner's `civics.ts`) does not know `faction_approval`. Fix both copies together.

- **Habitat district limits, not yet checked in game** (no habitat tech at 2207.03): whether
  `count_system_planet` counts the star as a major body (assumed yes: Sol 9 major → 8 districts),
  against the game's habitat placement tooltip.

- **Migration treaties: a foreign colony's case** — the treaty's flag is known (`migration_access`,
  2026-10-19), but the throwaway game's partner had no pops moving yet; check `/migration` once
  they do.
- **Battles: only some are recorded** — the throwaway war had more fights (the station, single
  civilian ships one by one) than its two `battles` entries; the station was killed by console
  `damage`, which may not count. Check at the next war which fights the list keeps.
- **Rivals of us, assumed**: `rivalsOfUs` reads another empire's relation to us as ours to them
  (`is_rival=yes`); no AI rivalled us yet (2205.06).
- **Galactic Community, not yet understood**: `galactic_community.days` (541 while voting) and
  `election` (180), and each voted resolution's `voting = { <country>=<date> }`. The game's screen
  at the same date (screenshot 2026_10_19_3) shows "Senate is in session 899" and 255 by the
  proposal queue — neither number is in the save. **Votes are weighed by diplomatic weight**
  (855 for = 469 + 245 + 141), and no country's weight is stored: the tab counts empires. No resolution has passed yet:
  where passed ones are kept is still to see. Resolution descriptions lose loc commands
  ("members of the should …" — `[global_event_country.GetGalCommunityOrGalImperium]`), an
  extraction loc-cleanup gap.
- **Fleet combats outside wars**: each fleet's `fleet_stats.combat_stats` holds only its last
  combat and is cleared some time after (2205.10.14's: in the 11.01 save, gone by 12.01), so the
  contacts tab's log (`combats()`, `combatLog()`) has what monthly saves caught. The losses are as
  of the save: 2 of the salvagers' 3 at 11.01, the game's report says 3 of 3. The companion mod
  could log combats (an on_action) for the complete record.
- **Next topics (the user's, 2026-10-19)**: the Shroud — first data at 2205.12.01 after Psionic
  Ascension: our `standard_shroud_module`, `has_delved_in_shroud`, `last_delve_date`, delve
  counts, and top-level `patron_relations.<id> = { owner patron position contact special_project
leaders unlocked_passive_accords_count … }` (the Covenants); read them with the first delve's
  save and the game's Shroud screen (`can_access_shroud`, `shroud_*` keys), and other
  empires' agreements with each other — their own relations hold them (2205.05: 10 research
  agreements, 12 migration treaties, 4 subjects among the AIs), but showing them needs the game's
  intel rules (`intel_manager`, `intel_level`), or it is a spoiler switch.
- **Exact branch points via the mod**: each month the mod rolls a random id and keeps the previous
  one in a country variable, logging both (`SDASH|…|<date>|timeline|<id>|<previous id>`). After a
  load, the first line's _previous id_ is the id of the loaded save's month — the parent, exactly.
  The variables also land in every save. Needs the mod running (no achievements).
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
  follows the game version's `strategic_resources`). Not yet seen in our own game. Prices exist
  only for saves read since 2026-10-17; older ones' saves are gone.
- **Chart zoom and pan**: wanted — the default window (`xRange`: last 20 years, 1 ahead) should
  zoom out/in and shift. Not started.
- **`/migration` holds four variants to compare** (over time, matrix, monthly flow, map) — the
  user picks which to keep, then drop the rest.
- **Next, the user's plan:** a configurable main dashboard (custom tabs pick empire panels now;
  the migration and planet panels are not pickable yet).
- **Hint rules**: not started.
- Cross-check the parsed numbers against the in-game UI.
