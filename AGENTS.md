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
`STELLARIS_GAME_LOG` is opt-in: set it when the companion mod is enabled. The DB is a cache of
what the game wrote: delete it to rebuild from the saves (the save graph is re-guessed from mtime
order; manual parent corrections and past mod months are lost). A schema change bumps `SCHEMA` in
`db.ts`, which rebuilds it automatically. `STELLARIS_TEST_SAVE=<.sav>` enables the real-save test
in `save.test.ts`.

**How it works:** `watch.ts` polls the save folder (first backfill in mtime order, then every 2 s;
a file is read once its size and mtime hold still for one interval) → `save.ts` reads the zip with
`zip.ts` and queries the gamestate with jomini → `db.ts` places the snapshot in the save graph via
`timeline.ts` and records it → `/api/events` tells open pages to reload. In parallel, `feed.ts`
follows `game.log` from its current end and turns the mod's monthly lines into partial snapshots
(stockpile and net income) of the campaign being played.

**Upcoming events** (`events.ts`, pure): research per field, next tradition, council agenda, build
queue items and the next election, sorted by due date. Rates are *measured* — progress between the
branch's two latest saves, so every speed bonus counts — and costs are base costs from the data DB
scaled by empire size and the galaxy sliders. Checked against the game at 2200.04.01: research
53/71/108 months, tradition 2200.09.01 exact; the agenda is 164 vs. the game's 163 (rounding).

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
- Colonies: since 4.x a top-level `colony=` section, referenced from `planets.planet.<id>.colony`.
  Holds pops, housing, amenities, stability, `final_designation`, districts, buildings.
  `employable_pops` counts all pops able to work, _not_ the employed: employed is
  `employable_pops - civilian` (Earth 2200.04: 5207 − 1905 = 3302; its `pop_jobs` sum to 3300).
- Autosaves: `autosave=4` in `settings.txt` gave one per month (2200.02/03/04.01, observed).
- Build queues: `construction.queue_mgr.queues.<id> = { owner location type items={…} }` (`planet`,
  `army`, `starbase`, `ships`, `combined`); a planet's own queue is `planets.planet.<id>.build_queue`,
  and `items` lists its entries in order. Entries are `construction.item_mgr.items.<id> = { queue
progress progress_needed resources buildable_<kind>={…} }`; seen kinds (2200.04, AI queues):
  `district`, `army`, `ship`, `starbase_building`, `clear_deposit_blocker` (→ `deposit.<id>.type`).
  `building` not yet seen — `save.ts` names it by the block's first string field.
- Game length: top-level `galaxy = { mid_game_start=100 end_game_start=200 victory_year=300 }`,
  years after the 2200.01.01 start (small/default galaxy). Stored as `Snapshot.endGameYear` — the
  outer bound for zooming out, once zoom exists.
- Top bar: `country.<id>.empire_size` (50 at start), `starbase_capacity_used` / `starbase_capacity`,
  `used_naval_capacity`; research per field is `physics|society|engineering_research` in the
  budget income. Not stored: naval capacity cap, envoy slots (envoys are `leaders.<id>` with
  `class="envoy"`; an idle one has `job="bureaucrat"` — assigned shape not yet seen).
- Progress: `country.tech_status.<area>_queue = { { progress technology date } }` (research points,
  not percent); `country.government.council_agenda` + `council_agenda_progress`;
  `country.next_election`; galaxy cost sliders `galaxy.technology`, `galaxy.traditions`. Tech costs
  in game were ×1.05 of the extracted base (source unconfirmed, `TECH_COST_OBSERVED_FACTOR`).
- Identity of a game state (`Snapshot.fingerprint`): `tick` + `random_count`, both top-level.

## Open (needs a running game on Linux)

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
- **Hint rules**: not started.
- Cross-check the parsed numbers against the in-game UI.
