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

Cross-project conventions come from the OKF vault; workspace rules from `../AGENTS.md`.

## Goals (from the start)

- A second screen next to the running game: the state of the empire at a glance, and its history.
- **Going back in time must not break it.** Loading an older save starts a new timeline (a branch
  of the save graph) instead of overwriting history, and one can **switch between timelines**
  (`/timeline`, `?node=`; planet pages follow the empire page).
- Without the companion mod a reload's branch point is a _guess_ when time goes backwards (marked,
  correctable on `/timeline`). With it (0.2.0+) the mod's `load` line names the loaded save exactly
  — see "Companion mod".

## Running it

Runs on the machine the game runs on and binds to `127.0.0.1`. **Players** get a zip per OS
(below) and pick two folders on `/setup`; **development** passes every path explicitly, so a dev
server never picks a real folder by itself:

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

**Configuration** (`server/config.ts`): environment variables win, then `config.json` in the app
data folder (`%APPDATA%\stellaris-empire-dashboard`, `$XDG_DATA_HOME/stellaris-empire-dashboard`),
which `/setup` writes: `{ gameDir, userDir, gameLog? }`. The save folder is `<userDir>/save games`,
the dashboard DB `dashboard.sqlite` there unless `DASHBOARD_DB`. While a folder is missing,
`run()` leaves the app in `setup` and `hooks.server.ts` sends every page to `/setup`; a failed
start (no Python, a broken install) lands there too, with the reason — never a crashed server. The
root layout's load returns empty data then (`setup: true`), the layout no tab bar.

**Discovery** (`server/locate.ts`, for `/setup`): Steam libraries from every Steam root's
`libraryfolders.vdf` (Windows: `SteamPath` from the registry; Linux: native, `~/.steam/steam`,
Flatpak, Snap), GOG (registry `GOG.com\Games\*\path`, `C:\GOG Games`, `~/GOG Games`, Heroic),
Microsoft Store (`<drive>:\XboxGames\Stellaris\Content`); user folders from the real Documents
folder (registry `User Shell Folders\Personal`, so OneDrive redirection counts), Linux native,
Proton's `compatdata/281990` in every library, Wine prefixes. A folder counts only when it holds the
game's files (`isGameDir`, `isUserDir`); user folders rank by newest save. **Not yet confirmed on a
real machine:** the Microsoft Store layout, GOG's registry key, Heroic/Lutris — players type the
path when they are wrong. This machine has a native and a Proton user folder side by side (the
Proton one holds the saves).

**Game data** (`server/extract.ts`): without `STELLARIS_DATA_DB` the extractor runs at start
against `gameDir` — `data/stellaris-<rawVersion>-<hash of the DLC folders and the extractor's
`**version**`>.sqlite`, so a game update, a new DLC or a dashboard with a newer extractor (new
tables) extracts again (~5 s), older files stay. The packaged launcher names the extractor and
its Python (`STELLARIS_EXTRACTOR`, `STELLARIS_PYTHON`).

## Packaging and releases

`node scripts/package.mjs [--os windows|linux|macos]` →
`dist/stellaris-empire-dashboard-<version>-<os>-<arch>.zip` (`windows-x64`, `linux-x64`,
`macos-arm64`, `macos-x64`): the build plus `jomini` (the only external import left in the build),
Node 24 (pinned, SHA-256 from nodejs.org; it needs macOS 13.5+), the extractor from
`../stellaris-data-extraction` by `git archive HEAD` (a release build refuses one that is not on
the tag `package.json` pins as `extractorVersion`), Python where the system has none recent
enough, and `release/`: `launcher.mjs`, `start.bat` / `start.command` / `start.sh` (checks
`python3 ≥ 3.10`), `README.txt` for players — **its "Where things are" is the list of every
folder for players**; a new discovery path in `locate.ts` goes there too.

- **Windows**: Python's embeddable package (pinned, SHA-256 from python.org's release API; its
  `._pth` gets `..\extractor`).
- **macOS**: python-build-standalone's `install_only_stripped` CPython (pinned release and
  SHA-256 from its GitHub release assets), the same version as Windows'. Apple ships only 3.9
  with the Command Line Tools. The interpreter is static, so `libpython`, Tcl/Tk, pip, headers
  and `lib-dynload` (only `_tkinter`, `_dbm`) are pruned (69 → 53 MB zip). Checked 2026-10-22
  with the same prune of the release's _Linux_ build here: a full extraction, 281 civics and 77
  origins. Zips store symlinks as symlinks (`zip -y`: `python3 → python3.14`). `start.command`
  clears the quarantine mark on its own folder (`xattr -dr com.apple.quarantine .`) once the
  player has allowed it in Privacy & Security; the bundled Python is not notarized, Node is.
  **The Mac zips have not run on a Mac yet** — first run per `RELEASE.md`.
  Downloads are cached in `.cache/`. **In the Claude Code sandbox** Node's `fetch` needs
  `NODE_USE_ENV_PROXY=1` to reach nodejs.org (it ignores the proxy otherwise: `EAI_AGAIN`).

**`launcher.mjs` serves the app through its own HTTP server**, not adapter-node's `index.js`:
without `ORIGIN` adapter-node 6 takes every request for `https`, and SvelteKit rejects the forms
(`/setup`, `/timeline`) as `Cross-site POST form submissions are forbidden` — only on the built
app, `pnpm dev` never shows it. It marks each request `http` in a header named by `PROTOCOL_HEADER`,
so 127.0.0.1, localhost and a LAN address (`--lan`) all work, and a foreign origin is still refused.

The version in the header and the zip names is `scripts/version.mjs` (decorated with git state;
a commit tagged `v<version>` counts as a release, since CI builds from the detached tag).
Releasing: `RELEASE.md` — pushing a `vX.Y.Z` tag on `main` runs `.github/workflows/release.yml`,
which checks out the extractor at `extractorVersion` next to the dashboard, tests, packages and
creates the GitHub release with both zips and the `CHANGELOG.md` section as notes. The Windows zip has not run on Windows yet — Wine cannot start in the
sandbox (`wineserver` needs a writable `/tmp`).

**One watcher per process.** `app.ts` keeps its state on `globalThis`: Vite re-imports server
modules on edits, and a second watcher once re-read the saves, moved the head back and filed the
next autosave as a branch (2201.06 under 2201.04).

**The DB is history, not a cache.** The game keeps only its last 5 autosaves (`autosave_*` rotate),
so snapshots of deleted saves exist nowhere else — never delete the DB or drop its tables.

- **A new snapshot field needs a default in `upgrade()` (`src/lib/upgrade.ts`)**, which brings
  stored snapshots to the current shape on read, **and a `READER` bump (`server/save.ts`)**. A
  start reads only saves that are new or changed (`save_file`: path, `mtime:size`, reader). Saves
  still on disk that an older reader (or an older data DB) read are read again. A re-read replaces
  the stored reading and leaves the head alone (`refresh()` in `db.ts`). Forget the bump and the
  new field stays at its `upgrade()` default until the save changes.
- **A start reads one campaign, the rest follows in the background** (`watch.ts`): before the
  dashboard is up, only the head campaign's saves to read (new, changed, or of an older reader) —
  with an empty DB the campaign of the newest save. The other campaigns wait in a backlog that
  `catchUp` works off 3 s after `running` (`CATCH_UP_DELAY_MS` in `app.ts`), the most recently
  played first, one save per turn of the watcher's lock, so live autosaves and pages get through.
  A backlog read places a save after the campaign's node read last (`record(…, at)`) and **never
  moves the head** — game.log months go to the head's campaign. A campaign viewed meanwhile
  (`refreshCampaign`) or played meanwhile (a new autosave in it) has its backlog read at once,
  first. Pages reload on the `refreshed` event. Checked 2026-10-22 on a copy of this machine's DB:
  the head campaign's 10 saves before the first page, the other campaign's 27 within 34 s.
- **Cleaning up** (`campaigns.ts`, `POST /api/campaigns`): the config tab lists every campaign in
  the history with a delete; a campaign with no saves left on disk (`Watcher.onDisk`, from the last
  scan) gets a banner once — "keep it" goes to the `keptCampaigns` setting, never asked again.
  `deleteCampaign` drops its nodes, snapshots and galaxy but keeps its `save_file` rows, so saves
  still on disk are not read back in (`refresh` leaves a save not in the graph out); a new save of
  that campaign starts it afresh.
- **The tables change only by a migration**: append a step to `MIGRATIONS` in `db.ts` (append
  only — a released step has run on players' DBs). The version is SQLite's `user_version` (0.1.0's
  `state.schema = '15'` is taken over as 15); a new DB is the 0.1.0 tables plus every step, so each
  step runs in every test. Before migrating, `openDb` leaves a copy beside the DB
  (`dashboard.v<old>.sqlite`); a DB of a newer dashboard is refused (the reason shows on `/setup`),
  never dropped — a player who starts an older zip by mistake keeps their history.

`STELLARIS_TEST_SAVE=<.sav>` enables the real-save test in `save.test.ts`; vitest swallows its
`console.log` dump unless run with `--silent=false`. Its assertions fit our 4.5.2 campaign (a
4.0.1 save fails one); for an ad-hoc look at any save, a throwaway `src/lib/server/*.test.ts`
calling `readSave`/`toSnapshot` (and `loadGameData` for the data DB) works — delete it after.

**Checking a change end to end: run against a copy of the DB**, never the real one (history — a
dev server ingests saves and moves the head). On the Linux game machine it lives in
`~/.local/share/stellaris-empire-dashboard/`. Copy `dashboard.sqlite*` (WAL files included) to a
temp dir, start `pnpm dev` with `DASHBOARD_DB` pointing there and the real save dir, then request
pages and `/__data.json` with curl and stop the server — all in one command where the sandbox gives
each command its own network namespace. `__data.json` is devalue-encoded: decode the last node's
`data` with `unflatten` from `node_modules/.pnpm/devalue@*/node_modules/devalue/index.js` (a
`node --experimental-strip-types` script can import the pure `src/lib/*.ts` to recompute from it).
A profile switch is flipped on the copy with `PUT /api/settings` (`{"display":{…}}`, with the
page's `?node=`). A save-wide question (every colony across the history) is quickest as a
throwaway `src/lib/server/*.test.ts` over the copy: set `globalThis.__stellarisDashboard = {
updates, status, explanations: {}, gameData: loadGameData(<data DB>) }` before importing
server modules that call `getGameData()`/`getExplanations()` — delete it after.

**How it works:** `watch.ts` polls the save folder (first what changed since the last run, in mtime order — the head campaign's at once, the others' in the background — then every 2 s;
a file is read once its size and mtime hold still for one interval) → `save.ts` reads the zip with
`zip.ts` and queries the gamestate with jomini → `db.ts` places the snapshot in the save graph via
`timeline.ts` and records it → `/api/events` tells open pages to reload. In parallel, `feed.ts`
follows `game.log` from its current end and turns the mod's monthly lines into partial snapshots
(stockpile and net income) of the campaign being played.

**Upcoming events** (`events.ts`, pure): research per field, next tradition, council agenda, build
queue items, the next election and **deficits** (`deficits()`: when a stockpile runs empty at its
monthly balance, or "in deficit" once empty — the game applies `<resource>_deficit` then, 4.5.2
`09_static_modifiers_deficit.txt`, without warning ahead; the row's popup shows its effects),
sorted by due date. Checked 2026-10-19: at 2210.01.01 (24.65 energy, −30.56/month) it gave
2210.02.01, the date of the save's `timeline_first_deficit`. In the save an empty resource is
**missing from the stockpile**, and no `*_deficit` modifier is stored. 4.5.2's `energy_deficit`
has every effect commented out — an energy shortage costs nothing directly. Rates are _measured_ — progress between the
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
(`/expansion`: the Expansion panel full-size, see below), `growth` (`/growth`, see below), `jobs` (`/jobs`, see below), `trade` (`/trade`, see below), `produce` (`/produce`, see below), `systems` (`/systems`, see below), `trade deals`
(`/deals`: running and ended deals, their monthly resources, `#lib/deals.ts`), `market`
(`/market`: prices over time and the standing orders, `#lib/market.ts`), `resources`
(`/resources`: per resource, in the Resources strip's order (`stripOrder()`), a chart — stockpile
left, net per month right (`resourcePanelSeries()`) — and the latest save's month by budget source
(`Snapshot.budget`, every source, the market's as `market:<source>`; `resourceBudget()` in
`#lib/flows.ts`; its total is the save's balance: 2207.04.02 energy +3.455 both), and below it
what the budget does not explain (`unbooked()` in `#lib/series.ts`, see "One-off spending")),
`trade-offs` (only with its switch, below) and `events`
(`/events`: the milestone log, searchable, filtered in the page), `government`, `situations`, `shroud` (patrons and attunement), `focus`,
`traditions`, `tech`, `leaders`, `species`, `contacts`, `galcom`, `diplomacy`, `megastructures` (all below), `mods` and
`dlc` (last; see
"DLCs and mods" below); tabs keep `?node=`. **Every list is a `SortTable.svelte`** (the user's ask
2026-10-23: "make all tables sortable"; columns as `Column<T>` from `#lib/sort.ts`; `sort={{
column: '', desc: false }}` keeps the given order — the game's, a queue's — until a header is
clicked; `rowClass`/`rowStyle` set a row apart, `below` adds a details line under each row). Left
plain: key/value layouts (council seats, policies, species rights, tech queues and cards by
field, the Government panel), the matrices (migration heatmap, research tiers, the diplomacy
matrix), the build queue (its order is the queue) and the forms on ⚙. **Empire names are
`EmpireName.svelte`**: its colour is the page's `empireColors` (name → map colour, from
`branch()`, so every page has it) unless passed. Maps through `GalaxyMap.svelte`
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
362 unowned systems (40 owned: "looks like they own more"), at 0.8 12 — and those are cut out,
a hole of `HOLE` (¼ R) around each unowned system inside a territory (the user's call). ~180 ms for 14 owners on a 400-system
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
(`PUT /api/settings`), which no migration touches. The theme (`system`/`light`/`dark`)
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

**Trade-offs tab** (`/tradeoffs`, behind the profile's `tradeoffs` switch in ⚙ — exploratory, the
user's ask 2026-10-22: "when to spend scarce resources on what"; `#lib/tradeoffs.ts` pure,
inputs from `server/tradeoffs.ts`): what can be built now — stations at surveyed deposits in our
systems without one (`Body.station`, the planet's `shipclass_orbital_station`), districts where a
colony has room (the colonies tab's caps; jobs from data DB `district_job`), buildings of a type
we have built before (so unlocked; not `government` ones) on the colony with most idle pops — with
base costs (data DB, scaled by what our queued items of that kind cost), upkeep, build days
(`build_time`; stations have none, ≈ 100 as their orders count) and outputs **measured**: a job's
output per working pop from the budget (`jobFlows` ÷ filled), a station's as its deposit's base ×
our stations' budget income ÷ their deposits' base. Ranked by payback (cost ÷ net value per
month, values in energy at market base prices — editable weights); simulated month by month per
strategy (best payback, each kind first, waiting for a cost cut, nothing), saving up for the next
option, which needs the colony's idle pops. **Changes** ("from month M, output of station
gatherers +10 %") come from presets — the research queue at its due dates, every tech **within
reach** (`inReach()` in `#lib/techTiers.ts`: prerequisites researched — data DB
`technology_requirement` —, its tier open **per field** (physics, society, engineering; the
user's word), `potential` not false) dated as if researched next in its field, the traditions open
in adopted trees at the next tradition — or the viewer's own. Not the cards on offer: those are
chance (the user's call). Changes scale measured values, an approximation (the game adds
multipliers). Not modelled: pop growth, housing, free building slots (not in the save), storage
caps, one build at a time per queue. 2207.04.02: Civilian Industries on Earth 10 months, rural
districts 11–20, stations 20–50; over 60 months every strategy ends within 1 % of the others
(everything affordable gets built within ~2 years), 11 % above building nothing.

**Systems tab** (`/systems`, `#lib/systems.ts` pure; the user's ask 2026-10-22): our systems — and
the discovered ones up to +0…+10 jumps beyond the border, or all (`systemView.range`, facts only) —
with what the galaxy knows (star, bodies, deposits' base yield, anomalies, megastructures,
bypasses), what each **cost** and **earned**, cumulative per save, in trade (the shared values,
see the jobs tab — without them a system making only research could never break even), a
projection (12–120 months) and the break-even month. `+0` beyond the border is `mine` (the user's
call), so the ranges start at +1.
Monthly: the starbase's level, modules and buildings and the stations (`Snapshot.orbitalStations`,
since READER 5) have base upkeep and output in the data DB (`costs.ship`, `costs.module`,
`costs.starbaseBuilding`, deposits); the budget books them per kind empire-wide (`starbases`,
`starbase_modules`, `starbase_buildings`, `station_gatherers|researchers`,
`orbital_mining|research_deposits` — read from the 2212.03.05 save), and `allocate()` splits each
booked total over the systems by base share, so modifiers count. One-off: the outpost when a
system turns ours in `knownSystems` (100 alloys + influence **estimated** as
`EXPANSION_COST_BASE + EXPANSION_COST_DISTANCE × (jumps − 1)` from our nearest system, capped —
the engine's distance basis is not in the files); construction items in the system
(`Construction.systemId`, since READER 5; exact) when both saves list construction, else what the
starbase gained, at data DB prices; new stations at their size's cost. What the first save already
shows counts as "before history" (approximate), except the capital's starbase. The colonies
toggle (`systemView.colonies`) adds each colony's `produces`/`upkeep` and the construction on it
(colony → system from the latest galaxy's bodies). Not counted: ships built at a system's shipyard,
refunds of cancelled items, the influence of claims.

**Trade tab** (`/trade`, `#lib/aiTrade.ts` pure; the user's biggest pain point, 2026-10-22: "who
trades what, both directions, for how much, normalised by trade"): the empires we have
communications with — regular and fallen ones only (`TRADING_TYPES` in save.ts; pre-FTL
civilisations, monsters, enclaves and the game's event countries also have communications) —
with what the diplomacy screen shows: personality and its `trade_willingness`, attitude towards
us (one that does not trade refuses everything: data DB `attitude.trade`), their opinion of us
with its modifiers, trust, our deals, a gift's "Favorable Trade Deal" and the months until it has
faded (data DB `opinion_modifier`: +1 a point, max 100, decay 2). With the **`tradeIntel`**
spoiler (cheating — their stockpiles and income; the route strips them otherwise): the deal
finder (we give X, for Y: per empire the most Y it would give per X, against selling X and buying
Y on the market with the fee) and per empire and resource whether it is short (under a third of
its storage) or flush (over three quarters). **Estimated**: the AI's valuation is engine code;
measured 2026-10-23 on three empires (one fallen) and gifts to 13 more
(`docs/trade-calibration.md` → What we know; every tooltip line is a case in `aiTrade.test.ts`): the
acceptance is our side's worth × the AI's willingness minus its side's, linear in the amount
however large; a unit a month is worth 0.5 × the months of one at once, 10 years or 30; a unit is worth p ×
base/(base + its **gross** income of it), both per resource and fitted (`WORTH`; not `ai_weight`,
not the defines' income base of 50), every tooltip line within 3 % at its date; minerals and food drift
upward over time (at the same income: minerals 0.048 → 0.056, food 0.067 → 0.082 a unit from
2212.08 to 2213.08), energy rose 10 % then held, the rest held — the defines' "need"
(`TRADE_VALUE_RESOURCE`) is engine state; the curves hold the latest level (2213.08) and the test
checks older lines at their date's level (`LEVEL`); a gift buys that worth at the AI's willingness in opinion (`giftOpinion()`, whatever
its attitude — rivals and unfriendly ones took gifts; the "What a gift buys" table; "Favorable
Trade Deal", max 100 — it did not fade in four months, whatever the files say; worth nothing into
full storage); a resource not measured gets no estimate. It takes in at worth only up to 0.8 of its storage
(`room()`, `worthOf()`; the deal finder's "They take" column — the base max, storage modifiers
are not in the save). It gives at once its
stockpile above max(`ai_wants`, 500) (`spare()`, `TRADE_MIN_RESOURCE_STOCKPILE`) and a month at
most 0.3 of its **gross** income (`TRADE_MAX_RESOURCE_PERCENT`, `monthlyCap()`; `AiIntel.income`,
READER 12). Open: motes, gases, crystals and the other strategic resources (the nomad test game).
**Trade is a resource** there (default trade → energy) though it has no `ai_weight`: measured like
the rest. **Nomadic empires** (`AiIntel.nomadic`, READER 11) are those running
`situation_nomad_economy` — the origin misses most (2212.06.01: six such empires, one nomad
origin); they never give energy or minerals (`NOMAD_RESERVE`; the game's
`concept_operational_reserves_desc` says so for the market, for deals it is our assumption —
calibration rows 23–24), nor do we when nomadic. **Trader enclaves** (`Snapshot.traderEnclaves`,
flag `trader_enclave_country_1|2|3` = XuraCorp exotic gases, Riggans volatile motes, Muutagan rare
crystals) sell for energy only, 500·N at once plus 10·N a month for +N a month over 3600 days
(4.5.2 `leviathans.130–132`, `enclave_trade_N_*`) — 14.2 energy a unit whatever N
(`ENCLAVE_DEAL`); shown without the spoiler, our running deal from `countryModifiers`. **Pay once, receive monthly** (the deal finder's second mode, `lumpForMonthly()`): our lump's
worth buys a unit a month at 0.5 × the months of one at once (`TRADE_VALUE_RESOURCE_MONTHLY_MULT`),
so over the deal the AI pays twice a swap's units, the same total for any length — held to its
monthly cap; a deal breaks when the payer "can't afford the monthly rate" (seen in game), so the
mode shows its net income after paying and how long its stockpile lasts. **What a
resource costs in trade**: per empire the trade paid per unit (`wantPrice`) and received
(`offerPrice`), against the market's buy and sell price. Tables are `SortTable`s (a cell snippet
gets the column id, for matrices); willing, opinion and trust are tinted by `scaleColor()`. Not
yet: the produce tab's trade-deal option.

**Growth tab** (`/growth`, `#lib/growth.ts` pure; the user's ask 2026-10-22, built before the
capacity model — see "Pop growth: planet capacity" under Open): per colony, natural growth
(`GROWTH_CAT_GROWTH`) as the mean of its last six saves (fractions are a chance: Embron 5, 6, 5 …
→ 5.33, so the cap of 5 rounds up too), months per 100 pops, housing used of the total
(`Colony.housing`, `housingUsed` — `total_housing`, `housing_usage`, READER 8), free districts
under the limit and more behind blockers (`colonyDetails().caps`), habitability, and notes: at the
cap, overcrowded (growth stops at 1.15 × housing, `OVERCROWDING_NO_GROWTH_THRESHOLD`), low
habitability, not growing. Still to come once capacity is fitted: what +1 district, a cleared
blocker, a medical building or an edict would gain, and the colonies ranked by it.

**Jobs tab and the shared values** (`/jobs`, `#lib/unitCosts.ts` pure, `server/unitCosts.ts`; the
user's asks 2026-10-22: "normalised costs for everything we produce" and "how well does each job
perform on each colony, which colonies should be specialised"):

- **What a unit costs us**, per source from the latest budget: a job's inputs plus its workers'
  upkeep — the stratum's `pop_category_<stratum>s` expenses per pop **and** what every pop eats,
  `planet_pops_traits` (food; alloys for the Planetforgers' species) per pop; without the latter
  worker jobs came out near free (technicians 0.02 trade per energy) —, stations' and starbase
  modules' upkeep. Several outputs split the cost by value. Not counted: what building it cost,
  building and district upkeep.
- **Values** (`unitValues()`, `valuesOf(snaps)`): the market's base price where it sells (trade
  = 1), else the output-weighted mean of its sources' cost per unit, iterated to a fixed point.
  The systems, produce and trade-offs tabs value resources at these (the produce tab's own
  overrides on top, "ours" resets one). 2212.03.05: physics 0.74, society 1.53, engineering 1.49,
  unity 0.95.
- **Colonies × resources**: a colony's output (`Colony.produces`) against its filled jobs at the
  empire's mean per pop (budget `planet_<job>` income ÷ filled) — 100 % average; shown only where
  its jobs make at least 1 a month (flat building output read Caugantu's alloys as 604 %). The
  best colony per resource is bold; the per-job output per colony is not in the save, so this is
  per resource.

**Trade-offs presets** have a popup each (`Preset.ref`: `tech:`, `tradition:`, `perk:`; the
explanations of the tech tab), grouped and folded by source; untaken ascension perks are presets
too, dated at the next tradition (when a slot opens is not in the save; their modifiers are in
the data DB's `tradition_modifier`). Weights are in trade.

**Produce tab** (`/produce`, `#lib/produce.ts` pure, inputs from `server/produce.ts`; the user's
ask 2026-10-22: "the best way to generate resource X, real and normalised costs"): pick a
resource, every option that adds it ranked by **trade per unit** over a horizon (1, 5, 10 years):
(one-off cost + months × what it uses per month) ÷ (months × units), other resources at market
base prices — the market's buy price (`price × (1 + marketFee)`, the save's fluctuation) is the
same unit, shown above the table, and "beats buying after" is the payback against it. What else an
option yields is shown, **not netted**: netted, a mining district's minerals made it the cheapest
alloys source (Planetforgers' miners yield a little alloys) at a negative price. Options: the
trade-offs tab's stations, districts and buildings (`tradeoffData()`; `jobMeasure()` and
`paidFactor()` shared from `server/tradeoffs.ts`), starbase modules and buildings of types we have
built where a starbase has a free slot (data DB `starbase_level` slots; output and upkeep scaled
by what the budget books for the built ones), a blocker cleared plus a district in the room it
makes (cost both, days both), and edicts we could enact (`edictRows`: possible, unlocked, not
active) — their output modifiers (`edictModifiers`, data DB `tradition_modifier`) as a share of
what the group yields today (`groupFlows()`: per job, stratum and station kind; `changeGain()`),
marked `estimated`, an upper bound since the game adds multipliers. Values of what the market
does not sell (influence, unity, research) are the viewer's, in `produceView.weights`. Not
offered: buildings never built (no unlock data per building), designations, job swaps, new
colonies, trade deals (step 4).

**Revealing what the game hides is the user's choice, off by default** (their rule, 2026-10-18):
the tabs show what the game's own panels show — agendas, edicts, policies, council seats as the
game lists them, maps only discovered space, factions only once formed. Everything beyond is a
profile switch in ⚙ (`Display`), labelled as spoilers or cheating where it is: `showLocked`,
`factionTypes` / `allFactionTypes`, `anomalySpoilers`, `projectSpoilers`, `contactStations`,
`unknownStars`, `wholeGalaxy`, `wormholePairs`, `lgates`, `surveyAll`, `tradeIntel`, `diplomacyAll`. A new view of hidden information follows the same pattern. **The
check is the user's in-game screenshot** of the matching panel (workspace `AGENTS.md`): it caught
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
built into the game; read as running `situation_nomad_economy` (the origin misses most nomads,
see the trade tab).

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
- **tech**: the three queues with due dates (`events.ts`), the cards on offer **now**
  (`tech_status.alternatives`; the game redraws a field's cards once its tech is done) with ▶ the
  one being researched, ★ the permanent options and the progress of queued ones, "offered over
  time" (`#lib/techOffers.ts`: a run of saves with the same cards is one offer, the pick = the
  field's tech researched meanwhile), research tiers, everything researched.
- **leaders**: `Snapshot.leaderList`, traits explained by `ltrait:<key>` (data DB `leader_trait`,
  each modifier labelled with its scope); class colours (`class-*` in `colors.ts`, envoys ours);
  envoys behind a switch, off by default.
- **species**: traits with their effects in a grid (the climate preference, one line per planet
  class, a row of its own; more picks wrap into more rows), trait budget, rights. System names
  from random-name lists that are localisation keys (`VOIDWORM_SYSTEM_12` = Papqaqtet) resolve
  through the data DB's `prescripted_name`.
- **contacts** (`#lib/contacts.ts`): the relations table ("Relations"), its filters and columns
  being the profile's `contactView` (stored at once, `PUT /api/settings`). Filters by **kind**
  (`kindOf()`, `KIND_TYPES` from 4.5.2 `common/country_types/*` — re-check on game updates):
  other empires (`default`, the only one on by default), fallen, enclaves, traders (the
  Caravaneers), pre-FTL civilisations (`primitive`), space fauna (leviathans and guardians
  included), marauders, other (factions, the Shroud, event countries). Names are `EmpireName`
  (map-colour swatch) with `EmpireBadges` (fallen, enclave, nomadic, … — shared with the trade tab).

**Diplomacy tab** (`/diplomacy`, `#lib/diplomacy.ts` pure, `diplomacy()` and `ourIntel()` in
`server/world.ts`; the user's ask 2026-10-23: "all the player knows(!) about all other empires"):
every country but `other`, the relations between them (pacts and rivalries are flags on each
country's `relations_manager.relation`; subjects `country.overlord`; wars every `war`), as a table,
a matrix (row's opinion of the column, pact abbreviations) and a graph — on the galaxy map at the
capitals (`GalaxyMap` `selected` bound to the empire whose capital is clicked; capitals not yet
discovered are added faint, the intel names them) or on a circle (`DiplomacyCircle.svelte`, the
default), its empires grouped by `clusters()`: **blocs** (federations, overlords with their
subjects), **mutual opinion** (average-linkage merging while the known opinions between two groups
average at least `diplomacyView.threshold`, 100; unknown pairs do not count) or **cooperation**
(`PACT_SCORE`: defensive pact 3 … rivalry −3, war −5 — our weights, not the game's; a group needs
on average one point per pair) — each group an arc, listed under the circle. Edge kinds toggle
(`diplomacyView.hiddenEdges`, all/none buttons, embassies and closed borders off by default); a click
focuses one empire and fades the rest (per viewer, Esc clears). **What we know is the game's intel
model**: our `intel_manager` value per country (0–100) → a level per category (4.5.2
`common/intel_levels/00_intel_levels.txt`), and what a level reveals
(`common/intel_categories/*`): government 1 (intel 10) ethics, civics, capital; diplomacy 1 (20)
rivalries, federation; diplomacy 2 (50) pacts and opinions. A pact shows through either side,
their opinion of us always; subjects and wars are **assumed public** (Open). `diplomacyView()`
walks the branch's saves: a fact keeps its reading from the last save whose intel showed it — gone
if that save showed it gone, else **"unverified since"** that date when the intel no longer shows
it. Snapshots keep relations only among the diplomatic kinds (empires, fallen, enclaves, traders,
marauders) and with communications (`Snapshot.diplomacy`, `intel`, `allWars`, READER 14). The
`diplomacyAll` cheat (⚙) is the latest save's truth; the route strips nothing else, since the
model never passes hidden facts. 2214.01.01: 47 countries, 113 relations shown of 141, 115
opinions of 228.

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
The save's reading wins, but what only the log knows — `logEvents`, `ticks`, and the timeline id if
the save lacks it — is kept (`withLogFields()`), also when a save is read again.

## Companion mod (`mod/dashboard_feed`)

**Everything the mod adds must also work without it** (the user's rule, 2026-10-24): the mod is
optional, so each feature falls back to an estimate from the saves and says so. Mark every value
that rests on an estimate with **≈** (the dashboard's mark, as on the galcom tab), say in its
tooltip what is estimated and which mod version stores the game's value, and drop the ≈ once the
value is exact. A new mod feature without its fallback is not done.

Hidden events write `game.log` lines for human players, all `SDASH|2|<date>|…` (format 2 since mod
0.2.0; `feed.ts` still reads format 1's monthly lines). The format is shared with `feed.ts` —
change both together and bump the number.

| Line                                                                 | When                 | From                                                      |
| -------------------------------------------------------------------- | -------------------- | --------------------------------------------------------- |
| `timeline\|<id>\|<previous id>`                                      | monthly, first       | `on_monthly_pulse_country`                                |
| `<resource>\|<stockpile>\|<monthly income>` × 26, then `end`         | monthly              | same                                                      |
| `tick\|<resource>\|<stockpile>` × 26, then `tick-end`                | daily                | a self-rescheduling event                                 |
| `load\|<id>`                                                         | a save was loaded    | `on_single_player_save_game_load`                         |
| `event\|colony\|<planet>`                                            | colony established   | `on_colonized`                                            |
| `event\|war-started\|<war>` / `event\|war-ended\|<loser>\|<winner>`  | at once              | `on_war_beginning` / `on_war_ended`                       |
| `event\|leader-died\|<leader>`, `event\|ruler\|<name>`               | at once              | `on_leader_death`, `on_ruler_set`                         |
| `event\|combat\|<winner>\|<fleet>\|<loser>\|<fleet>\|<system>`       | each battle we fight | `on_space_battle_won`                                     |
| `event\|<spending kind>\|<colony, leader, planet or system>` (0.3.0) | at once              | queued/cancelled, edict, decision, … (`#lib/spending.ts`) |

- **Diplomatic weight** (0.4.0): no log line — each month the player's event exports every
  Galactic Community member's `diplomacy_weight` trigger into its country variable `sdash_dw`, so
  every save carries it (`galacticCommunity()` reads it).
- **Storage** (0.5.0): no log line — each month `sdash_export_resource` also exports our maximum of
  every resource (`export_resource_maximum_to_variable`, 4.5.2 effects.log) into `sdash_m_<res>`,
  and `sdash_export_tradable_maximums` the tradable ones of every empire we have communications
  with. Read as `Snapshot.storageMax` and `AiIntel.max` (`storageMax()`); the resources panel's storage line
  and the trade tab's "They take" use them, else ≈ the base (`docs/storage.md` lists every
  source). Not yet run in game.
- **The daily tick**: 4.5.2 has no sub-monthly on_action, so `sdash.2` re-fires itself with
  `days = 1`. The stockpile moves within a month (spending, the market, rewards, deals); income
  does not, so the tick logs stockpiles only. Pending events are saved with the game, so the chain
  survives a load; `sdash.3` seeds it (game start, load, every month as a safety net) only without
  the timed flag `sdash_tick_alive` each tick renews — else a load would run two chains.
  `feed.ts` reports each day at once (`onTick` → the `tick` server event → the Resources panel's
  "as of <date>" while the page shows the head) and keeps them with the next month
  (`Snapshot.ticks`, drawn between months in the Stockpile chart, `stockpileSeries()`).
- **Exact branch points**: each month a random six-digit id goes into the country variable
  `sdash_tl` (old one: `sdash_tl_prev`; one `random_list` per digit — 4.5.2 has no random-value
  effect), so every save carries it too (`country.variables`, read as `Snapshot.timelineId`). On
  load the mod logs the loaded save's id; `loadedNode()` finds the latest node of that id not after
  the load's date, and the next observation (log month or save) becomes its child, unflagged
  (`takeLoaded()` in `app.ts`). A load also drops the events and days buffered since the last month.
- **Events re-date milestones**: a month's events travel with its snapshot (`logEvents`, so they
  follow the save graph). `milestones()` gives each to the earliest diffed milestone of the same
  kind whose label contains its name, within 45 days after it (`fromLog()`), else shows it alone;
  battles are a kind of their own (`combat`). **Not logged, because no loc command names them**
  (4.5.2 `localizations.log`): the tech of `on_tech_increased` (`last_increased_tech` is a trigger
  only), the tradition, perk, policy and government change — those stay dated by save diffs.
- Built from 4.5.2's own docs (`logs/script_documentation/`, which the game rewrites on every
  launch — empty while it loads; the `script_documentation` console command is gone):
  `export_resource_stockpile_to_variable`, `export_resource_income_to_variable`, `[Scope.var]` and
  `[GetDate]` in loc, `[From.GetName]`/`[FromFrom.GetName]` (both used in vanilla loc). Loc commands
  inside a scripted effect are written `\\[...]` (vanilla `99_advanced_documentation.txt`). The
  resource list equals `common/strategic_resources/00_strategic_resources.txt` (26 keys) — re-diff
  on game updates.

It changes the checksum: no achievements while enabled. Register it on Linux with
`scripts/link-mod-proton.sh stellaris-empire-dashboard/mod/dashboard_feed` (from the workspace
root, launcher closed).

### Sandbox notes (Claude Code on the Mac)

**While the game runs, an end-to-end check is slow**: a dev server on a DB copy backfills every
save new since the copy first (minutes with a few dozen; every save on disk after a `READER` bump
in the played campaign), and tests take 2–3× as long — run it in the background and
wait for its output; pick nodes by date from the copy's `node` table.

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
`unity`/`influence`/`cash` (= `energy`)/`minerals`/`food`/`consumer_goods`/`alloys <n>` (no
prefix), every other resource `resource <res> <n>` — `trade` too, and the rare ones by their save
key: `sr_living_metal`, `sr_zro`, `sr_dark_matter` (2026-10-23; `volatile_motes`, `exotic_gases`,
`rare_crystals`, `nanites` as named). Amounts stop at our storage (2200: energy 25,000, minerals,
food, consumer goods and alloys 15,000, trade 50,000), `instant_build`, `survey`, `fast_forward <days>`,
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
- **Intel** (2214.01.01): our country's `intel_manager = { intel = { { <country> { intel=40.6
stale_intel = { } } } } }` — one entry per contact, pre-FTL and fauna included (20 there);
  `stale_intel` was empty everywhere, so staleness is ours (`diplomacyView()`). The floors from
  pacts are defines (`INTEL_FROM_*`), already in the value. **`country.capital` is a colony id**
  (ours `capital=0` = colony 0 on planet 3), as a construction item's planet.
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
  years after the 2200.01.01 start (small/default galaxy). Stored as `Snapshot.endGameYear` — the
  outer bound for zooming out, once zoom exists.
- Top bar: `country.<id>.empire_size` (50 at start), `starbase_capacity_used` / `starbase_capacity`,
  `used_naval_capacity`; research per field is `physics|society|engineering_research` in the
  budget income. Envoys are `leaders.<id>` with `class="envoy"` and `country=<id>`; one is in use
  while it has `location = { assignment=… }` (seen: `first_contact`). **Not stored: the naval
  capacity maximum** — only script can read it (`max_naval_capacity` trigger, exportable with
  `export_trigger_value_to_variable`), i.e. the companion mod.
- **Which techs can be researched** (`techTiers()`, `inReach()` in `#lib/techTiers.ts`): every
  prerequisite researched (data DB `technology_requirement.prerequisites_json`) **and** its tier
  open — a tier opens once 6 techs of the tier below are researched **in the same research area**
  (physics, society, engineering), `previously_unlocked` in 4.5.2
  `common/technology/tier/00_tier.txt` (0 for tier 1, 6 for tiers 2–5; the file does not say per
  area — the user confirmed it, 2026-10-22) — and `potential` not false for the empire. The cards
  on offer (`tech_status.alternatives`) are a weighted random draw from those: never plan with them.
- Progress: `country.tech_status.<area>_queue = { { progress technology date } }` (research points,
  not percent; every queued tech keeps its own, `date` = started — `Snapshot.techQueued`, READER 6;
  a tech not in a queue has no progress in the save); permanent research options (focus rewards'
  `add_research_option`) are repeated `tech_status.always_available_tech="…"` keys
  (`Snapshot.techPermanent`; 2212.03.05: Volcanic Forge, Doctrine: Fleet Support, Exotic Materials
  Labs, each also among the cards); `stored_techpoints = { 1310.7 0 0 }` is **stored research** per
  field (`Snapshot.techStored`, READER 7; see "Stored research" under Open); `country.government.council_agenda` + `council_agenda_progress`;
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

## Open (needs a running game on Linux)

**The checks still owed from the 2026-10-22 session — what, how, which screenshot — are listed in
`docs/open-checks.md`** (growth capacity, outpost influence, starbase costs, market price, tech
screen, trade calibration, stored research, releases).

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
  exports it, else the tab estimates it (see "Galactic Community" above).
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
- **Companion mod 0.5.0's storage, not yet run in game** (written 2026-10-24): whether
  `export_resource_maximum_to_variable` fills `sdash_m_<res>` in the next monthly autosave — ours
  for every resource (what it gives for one without storage, e.g. unity: ignored if ≤ 0), and the
  tradable ones of every empire we talk to. Check: the resources panel's storage loses its ≈ and matches
  the game's top-bar tooltip; a fallen empire's shows how far its storage really goes (135,000+).
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
  follows the game version's `strategic_resources`). Not yet seen in our own game. Prices exist
  only for saves read since 2026-10-17; older ones' saves are gone.
- **Chart zoom and pan**: wanted — the default window (`xRange`: last 20 years, 1 ahead) should
  zoom out/in and shift. Not started.
- **`/migration` holds four variants to compare** (over time, matrix, monthly flow, map) — the
  user picks which to keep, then drop the rest.
- **Next, the user's plan:** a configurable main dashboard (custom tabs pick empire panels now;
  the migration and planet panels are not pickable yet).
- **The daily tick on the 1st, before or after the payout?** `unbooked()` takes the payout off
  the step that crosses a month start. Saves on the 1st are after it (checked); if the mod's tick
  or monthly line on the 1st runs before it, a month shows +payout on the 1st and −payout on the
  2nd. Check on the first campaign played with mod 0.2.0.
- **Hint rules**: not started.
- Cross-check the parsed numbers against the in-game UI.
