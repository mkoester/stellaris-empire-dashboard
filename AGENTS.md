# stellaris-empire-dashboard

Second-screen dashboard for a running Stellaris game: graphs over time (pops, stockpiles, monthly
income), colony state, later rule-based hints. Reads what the game writes — autosaves and, via the
companion mod in `mod/`, `game.log` — and keeps a **save graph**, so loading an older save starts
a branch instead of overwriting history.

SvelteKit 3 / Svelte 5 / Tailwind v4 / TypeScript 6 / pnpm, on Node 26 LTS (`.node-version`; always the current LTS, workspace `AGENTS.md`).
Storage is `node:sqlite` (built into Node, no native build). Saves are parsed with `jomini`.

- **SvelteKit 3 layout:** no `svelte.config.js` — config goes to `sveltekit({...})` in
  `vite.config.ts`; `tsconfig.json` extends `$app/tsconfig`; `$lib` is gone, import
  `#lib/<path>.ts` (`imports` in `package.json`). Hook types (`Handle`, `ServerInit`) come from
  `@sveltejs/kit/hooks`. The typed `resolve()` wants the query written out —
  ``node ? resolve(`/map?node=${node}`) : resolve('/map')``, not ``resolve(`/map${q}`)`` with `q`
  maybe empty.
- **Every `goto()` takes a `resolve()`** — the lint's `svelte/no-navigation-without-resolve`
  refuses a plain string; for "this page with another query" pass `resolve(...args)` with the
  route id plus query and `page.params` (`here()` in `+layout.svelte`). It flags an external link
  with a dynamic `href={url}` too, but not one that starts with a literal scheme: store the address
  without it and write `href="https://{host}"` (the about tab).
- **Svelte 5 trims whitespace at the start and end of an element**, so a Prettier-wrapped
  `<span …>⏎ by {x}</span>` renders "by" glued to what precedes it (the about tab's credits,
  2026-11-01). The lint refuses `{' '}` (`svelte/no-useless-mustaches`): put the space in an
  expression, ``<span>{` by ${x}`}</span>``. A template literal without an expression
  (``{` – nothing`}``) is refused too: with nothing to interpolate, use a margin (`ml-1`) instead
  of the space (`Outcome.svelte`, 2026-11-15).
- **A `{#snippet}` written directly inside a component's children becomes that component's prop**
  (svelte-check: "'x' does not exist in type '$$ComponentProps'"). A snippet rendered in two places,
  or handed to another component, goes at the template's top level.
- **TypeScript stays on 6** until `svelte-check` (peer `^5 || ^6`), `typescript-eslint`
  (`<6.1.0`) and Kit (`^6`) accept 7 — checked 2026-10-14 and 2026-11-06.

Cross-project conventions come from the OKF vault; workspace rules from `../AGENTS.md`.

## Goals (from the start)

- A second screen next to the running game: the state of the empire at a glance, and its history.
- **Going back in time must not break it.** Loading an older save starts a new timeline (a branch
  of the save graph) instead of overwriting history, and one can **switch between timelines**
  (`/timeline`, `?node=`; planet pages follow the empire page).
- Without the companion mod a reload's branch point is a _guess_ when time goes backwards (marked,
  correctable on `/timeline`). With it (0.2.0+) the mod's `load` line names the loaded save exactly
  — see "Companion mod".
- No cheats in multiplayer or Ironman: once any reading of a campaign says multiplayer or Ironman,
  `display()` forces every `cheat`-kind switch and every spoiler marked `intel` off. A new spoiler
  that reveals another empire or unexplored space gets `intel: true`. How both are detected, and
  the saves it was seen in: `docs/no-cheats.md`.

## Running it

Runs on the machine the game runs on and binds to `127.0.0.1`. **Players** get a zip per OS
(`docs/packaging.md`) and pick two folders on `/setup`; **development** passes every path explicitly, so a dev
server never picks a real folder by itself:

```sh
DASHBOARD_DB=<dir>/dashboard.sqlite \
STELLARIS_SAVE_DIR="<Stellaris user dir>/save games" \
STELLARIS_GAME_LOG="<Stellaris user dir>/logs/game.log" \
STELLARIS_DATA_DB=<workspace>/stellaris-data-extraction/sqlite/stellaris.sqlite \
pnpm dev --host 127.0.0.1
```

On Linux, `../scripts/dashboard.sh` (`--beta`, `--feature <f>`, `--help`) sets all of it for the
develop, open-beta or a feature checkout, with `STELLARIS_EXTRACTOR` instead of `STELLARIS_DATA_DB`,
and links the companion mod from that checkout.

`STELLARIS_DATA_DB` is the extraction's SQLite, read once at start for tech/agenda names and base
costs and the cost defines — regenerate it after a game update (`../stellaris-data-extraction/AGENTS.md`).
`STELLARIS_GAME_LOG` is opt-in for a dev run: set it when the companion mod is enabled. A player's
dashboard reads `<userDir>/logs/game.log` by itself (the user folder from `/setup`; without the mod
it holds no `SDASH` line, so nothing happens) — never when `STELLARIS_SAVE_DIR` is set.

Configuration (`config.json`, `/setup`), folder discovery, the extraction at start and mods in the
game data, per campaign: `docs/setup-and-data.md`. Read it before changing `server/config.ts`,
`locate.ts`, `extract.ts` or `dataStore.ts`. Which mods need more than the data: `docs/mod-support.md`.

## Packaging and releases

What a zip holds per OS, the launcher, stopping and the version: `docs/packaging.md`. Read it
before changing `scripts/package.mjs` or `release/`. Releasing: `RELEASE.md`.

## The dashboard DB

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
  new field stays at its `upgrade()` default until the save changes. **Two branches bump it
  independently**: on a merge (`develop` into `open-beta` or back) renumber above both and fix the
  "since READER n" notes, or one side's field is never re-read. 2026-10-31: both had 38 (the
  shipset on `develop`, ships' sizes and systems on `open-beta`), merged as 40. **Open,
  2026-11-21: `develop` has 74 and `feature/highway` 57** (develop: FirstContact labels, prescripted names, dig-site
  chapters, planet flags, waystations, the home system surveyed, name templates, every contact's tech
  gap, the Edict Fund, contracts completed, contract passengers aboard arkships, dig sites excavated by our fleets only, transport contracts' pickup and drop-off, cosmic storms and prescripted name templates, event chains, precursor intel, Grand Archive specimens, fallen-hive fragment names; the highway: the Ancient Highway mod) — that merge takes 75,
  and conflicts in `save.ts`'s import block (the highway's `readHighway`/`unclaimable` import) and
  in `world.ts`'s `galaxy()` (develop's `waystation`, the highway's fields).
- **The tables change only by a migration**: append a step to `MIGRATIONS` in `db.ts` (append
  only — a released step has run on players' DBs). The version is SQLite's `user_version` (0.1.0's
  `state.schema = '15'` is taken over as 15); a new DB is the 0.1.0 tables plus every step, so each
  step runs in every test. Before migrating, `openDb` leaves a copy beside the DB
  (`dashboard.v<old>.sqlite`); a DB of a newer dashboard is refused (the reason shows on `/setup`),
  never dropped — a player who starts an older zip by mistake keeps their history.
- **A query a page runs is checked with `EXPLAIN QUERY PLAN` on a DB copy.** `USE TEMP B-TREE`
  beside a `json_extract` column means every snapshot is parsed before `LIMIT 1` keeps one (two
  layout queries took ~400 ms of every page until migration 18). Time a page by profiling it:
  "Measuring a page" in `docs/testing.md`.
- The background start, cleaning up campaigns and the migrations so far: `docs/database.md`. Read
  it before changing `watch.ts` or `campaigns.ts`, or adding a migration.

## Checking a change

Check a change end to end against a copy of the dashboard DB, never the real one: a dev server
ingests saves and moves the head. Where the DB in use lives differs per machine (`docs/testing.md`):
on mkTuxedCachy the released zip's own, `~/.local/share/stellaris-empire-dashboard/`. New save shapes come from throwaway games with
console cheats, never the real campaign, against a separate `DASHBOARD_DB`.

Checks: `node_modules/.bin/svelte-kit sync && node_modules/.bin/svelte-check --tsconfig ./tsconfig.json`,
`node_modules/.bin/vitest run`, `node_modules/.bin/prettier --check . && node_modules/.bin/eslint .`
(why not `pnpm <script>`: "Sandbox notes"). ESLint reads the types for `src/**/*.ts` (floating
promises, `switch` exhaustiveness) and takes about 35 s. **A promise started and left alone needs a
`.catch`** — a rejection nobody handles ends the Node process — and a `switch` over a union names
every member.

**A change to a page or a component checks every page's server render**: `node
scripts/check-pages.mjs --db <dashboard.sqlite> --data <stellaris.sqlite>` (`pnpm check:pages` with
the same arguments). It copies the DB, renders each campaign's newest node on every route, with the
switches as stored and all on, and fails on a non-200 or on anything the server warns while
rendering — Svelte's dev-only `node_invalid_placement_ssr` (a `<ul>` from a component inside a
`<p>`) is only logged, so svelte-check and vitest never see it. Its `<p>` location can name the
wrong file (`Panel.svelte:576`, an 18-line file, for a `<p>` on `/expansion`, 2026-11-19): find the
page by the check, not by the message. About 2 min for five campaigns (450 pages);
narrow with `--campaign <part>` / `--route /path`. Hydration warnings need a browser: not covered.
Open: a test DB and running it before releases (`docs/testing.md`, "The page check").

- The procedure on a DB copy, replaying a live month, the real-save test, reading a save ad hoc,
  the throwaway games and their console commands ("Testing in a throwaway game"): `docs/testing.md`.
  Read it before any end-to-end or in-game check.
- What is open, assumed or confirmed in game ("Open (needs a running game on Linux)"):
  `docs/open-points.md`; the numbered checks still owed: `docs/open-checks.md`. Read them before an
  in-game check and before calling a number verified.
- Where each value sits in a save and how the game computes it ("Save format facts"):
  `docs/save-format.md`. Read it before reading a new field from a save.

## Architecture

**How it works:** `watch.ts` polls the save folder (first what changed since the last run, in mtime order — the head campaign's at once, the others' in the background — then every 2 s;
a file is read once its size and mtime hold still for one interval) → `save.ts` reads the zip with
`zip.ts` and queries the gamestate with jomini (the readings by domain are in `server/save/`,
re-exported by `save.ts`; `toSnapshot()` is handed the campaign's game data, never a global) → `db.ts` places the snapshot in the save graph via
`timeline.ts` and records it → `/api/events` tells open pages to reload. **That stream is opened
once per browser** (a SharedWorker, `#lib/eventsWorker.ts`): subscribe through `#lib/live.ts`,
never `new EventSource` in a page — three per tab once held all 6 connections a browser gives a
host with two tabs open, and every tab click hung (`docs/open-points.md`). In parallel, `feed.ts`
follows `game.log` from its current end and turns the mod's monthly lines into partial snapshots
(stockpile and net income) of the campaign being played.

**Two sources, one moment:** an autosave and the mod's line for the same date are merged into one
node (`place()` → `merge`), otherwise the second would look like a reload. The merge compares the
mod's income with the save's balance and logs `mod and save disagree on net income` on a mismatch.
The save's reading wins, but what only the log knows — `logEvents`, `ticks`, and the timeline id if
the save lacks it — is kept (`withLogFields()`), also when a save is read again.
**A month from the feed alone carries only its date, stockpile, net income and events**
(`toLogSnapshot`: everything else null, `''` or `[]`). While no save follows — the next autosave,
or `fast_forward`, which writes none — `branch()`'s `latest` takes **every field the month lacks**
from the branch's last save (`latestOf()`, `#lib/latest.ts`), its own `logEvents` and `ticks` kept
even when empty; `kind` stays `log`. Before, colonies alone (the colonies tab read "No colony
matches", throwaway Theian Preservers 2207.05–10, 2026-11-05), and the header lost name, score,
empire size, starbases, envoys, naval capacity and pops after each month (0.1.15 on a fast
machine, the user 2026-11-14).

## Tabs

The tabs show what the game's own panels show. Everything beyond that is a profile switch in ⚙
(`Display`), off by default and labelled as a spoiler or as cheating (the list and the story:
`docs/tabs-shell.md`).

**A tab is dimmed by the rule its page shows rows by** (`#lib/tabData.ts` calls the page's own
predicate, e.g. `whyOf()`): a separate "has data" test drifted — the contracts tab was greyed for
a nomad while listing two offers (the user's report 2026-11-18).

**Lists of options follow the playthrough** (the user's rule, 2026-11-16, the influence tab's
sinks): hide what this empire will never use — a nomad never settles, a settled empire never
embarks, an origin, civic or authority it lacks —, grey what is not available _yet_ with the
reason on hover, and grey a group's header when nothing in it is available. A table column out of
reach for this empire fades (`Column.faded` in `SortTable`, with the reason as its `title`) and
drops out of the row's colour scale — a nomad's energy and minerals in the trade tab's offer and
gift tables (2026-11-18).

**A tradition or perk is the empire's variant** (data DB `tradition_swap`, `#lib/swaps.ts`; the
user's report 2026-11-18: a nomad's Mastery of Nature unlocks no decision): show it through
`swapExplanations()`, and sum a held tradition's or perk's modifiers under `empireSwaps(s,
data).source(key)` — the owner's key reads the settled empire's effects.

**Page data is visible to the viewer, not only what a page renders** (the user's ask 2026-11-17,
"don't spoil any first contact"): another empire's real name, type, ethics or civics before
communications stays on the server. `branch()`'s `latest` goes to every page as
`pageLatest()` (`#lib/contacts.ts`: only ourselves and those we talk to, no galaxy-wide
`history`, `diplomacy`, `allWars` or `contracts` — a new galaxy-wide field that names other
empires is dropped there too: `contracts` reached every page with its issuers' names until
2026-11-18); `empireColors()` and contact rows hold real names only once we talk. Check a change
by grepping every tab's HTML and `__data.json` on a DB copy for an open contact's real name.
Never show an empire by its id: one without a known name is "unknown empire", and a save-made
name built from other empires' names (a war's) only where every one of them is known.

**Every value or worth is in trade** (the user's rule, 2026-11-16): `valueOf()` with
`valuesOf(snaps)` (`#lib/value.ts`, `server/unitCosts.ts`) — the market's base price, else what a
unit costs us. No energy-based or self-made weights; label it "trade", two decimals.

**A page with plan buttons returns `tip`** (spread `branch()`'s fields, or `tip: b.tip`):
`AddGoal`, `WantButtons` and the roaming tab's "+ wayline" render nothing without
`page.data.tip`, silently — the roaming tab shipped that way in 0.1.23. A check of such a page
counts the buttons in its HTML, not only its `__data.json`.

Each tab's notes are in one of these; read the one for the tab before working on it:

- `docs/tabs-shell.md`: upcoming events, cooldowns and expiries, popups, tabs and settings, the
  `all` and custom tabs, the time window, colours.
- `docs/tabs-planner.md`: planner, trade-offs.
- `docs/tabs-empire.md`: colonies, habitability, expansion, roaming (a nomad's waylines), settle down / embark, milestones,
  council, government, nomads, frontier (formerly situations), focus, traditions, tech, leaders, species, contacts.
- `docs/tabs-economy.md`: trade, growth, pops charts, growth projection, job output bonuses, bonuses, jobs,
  produce, influence, contracts.
- `docs/tabs-ethics.md`: ethics.
- `docs/tabs-galaxy.md`: galaxy, subjects, history, map rings, fleets, starbases, systems, system
  entry events, megastructures, pacts, diplomacy, DLCs and mods.
- Calibration of the trade tab: `docs/trade-calibration.md`. Storage sources: `docs/storage.md`.

## Companion mod (`mod/dashboard_feed`)

**Everything the mod adds must also work without it** (the user's rule, 2026-10-24): the mod is
optional, so each feature falls back to an estimate from the saves and says so. Mark every value
that rests on an estimate with **≈** (the dashboard's mark, as on the galcom tab), say in its
tooltip what is estimated and which mod version stores the game's value, and drop the ≈ once the
value is exact. A new mod feature without its fallback is not done.

**The dashboard must work without the mod, and no mod version may break it** (the user's rule,
2026-10-26). Players update the two separately — a Workshop subscription updates itself, a zip
does not. So `feed.ts` reads the formats in `FEED_FORMATS` and **skips any other** (an outdated
mod's, or one newer than the build) instead of failing; the layout then names the format and which
side to update (`unsupportedFeed()`, until a month is read). Released 0.1.1 still threw per line
on format 3: **upload a mod with a new format only after the dashboard reading it is released.**
**New mod data goes in an `event|<kind>|…` line** (0.9.0's `colony-jobs`, 0.10.0's
`system-entered`): `parseLine` returns null for an unknown event kind, so older dashboards skip it
without a format bump — a new head of its own (`tick-colony|…`) falls through to the resource
parse and throws per line there. Values the save can carry go into variables instead (`sdash_nc`,
`sdash_stab_*`), with no line at all.
Drop an old format by raising `FEED_FORMATS.min`, never by erroring.

The line formats, the table of lines, what each mod version exports, the daily tick and exact
branch points: `docs/companion-mod.md`. Read it before changing the mod or `feed.ts`.

- **A save field's name is not a trigger**: every trigger the mod exports must appear in
  `triggers.log` or in vanilla script (`trigger:<name>`). 0.9.0 exported `num_sapient_pops` (a
  save field); the game only says so in `error.log` (`cannot find: num_sapient_pops`), and the
  log line prints the variable empty. Grep `error.log` for `sdash_` after each mod change.
- **An event's type must match its on_action's scope** (the comment above each on_action in
  vanilla `common/on_actions/00_on_actions.txt`): `on_colonized` is `Scope = Carrier` (since 4.4),
  so `sdash.10` is a `carrier_event` — as a `planet_event` it failed on every arkship colony from
  0.2.0 to 0.10.0 (`error.log`: "attempted to execute an event on an unsupported scope", no
  `sdash_` in the line — grep `Event: sdash` too).

**`events/sdash_tech_options.txt` is generated** from the data DB
(`scripts/gen-tech-options.mjs`, mod 0.13.0): re-run it after a game update, with the mod's other
re-diffs. It changes the checksum: no achievements while enabled. **Publishing** (Steam Workshop and Paradox
Mods, through the launcher): `mod/PUBLISHING.md` — store copy, thumbnail source, published IDs.
Register it on Linux with
`scripts/link-mod.sh stellaris-empire-dashboard/mod/dashboard_feed` (from the workspace
root, launcher closed). The link points at one checkout: the game runs that checkout's mod, so a
worktree's mod change reaches the game only once relinked — `../scripts/dashboard.sh` relinks to
the checkout it runs at every start.

### Sandbox notes (Claude Code on the Mac)

On Linux (2026-10-17) Node 24 is first on PATH — no `fnm` prefix — and check, test, lint and a
dev server on a DB copy all ran sandboxed. Kill that server by `$!`, not `pkill -f <pattern>`,
which also matches the Bash command's own shell and ends it (exit 143). **Start
`node_modules/.bin/vite dev --strictPort`, not `pnpm dev`**: `$!` of `pnpm dev` is pnpm, and
killing it leaves Vite holding the port — the next start in the same command failed "Port 5199
is already in use" and a check of it read nothing (2026-10-31). For checks that extract, set
`XDG_DATA_HOME=$TMPDIR/xdg` with `STELLARIS_GAME_DIR` + `STELLARIS_EXTRACTOR`, so the real data
folder stays untouched; count `extracting game data` lines in the log per start.

- **`pnpm install` / `pnpm add` must run outside the sandbox** (`! pnpm install`): pnpm 12 fails to
  take its store lock (`pnpm-store-operation-locks: Operation not permitted`) even with the store in
  `$TMPDIR`. Tests, check, build and dev don't touch the store and work sandboxed. On Linux
  (2026-10-31) `pnpm update` was denied by permission: hand it over the same way. **But on Linux
  the same day a `pnpm check` ran pnpm's own install first (pnpm 12.3.4, 29 packages missing from
  `node_modules`) and it succeeded sandboxed**, the lockfile unchanged — **but it built that store
  inside the workspace** (`.pnpm-store/`, the vault's `claude-sandbox` skill): `node_modules` then
  hung on it, and the user's next `pnpm update` failed `ERR_PNPM_UNEXPECTED_STORE` (2026-11-06; a
  plain `pnpm install` relinked it to `~/.local/share/pnpm/store`). So never install sandboxed, and
  run checks as `node_modules/.bin/<tool>`, not `pnpm <script>`: pnpm installs first when it finds
  `node_modules` out of step with the lockfile.
- **After `pnpm update`/`install`, run `node_modules/.bin/prettier --write pnpm-lock.yaml`**: the
  lockfile is kept in Prettier's format (`pnpm lint` checks it), pnpm writes its own, and the diff
  balloons (2026-10-31: 2028 lines → 552 after the reformat).
- Slow checks while the game runs, the Mac's Node and local binding: `docs/sandbox.md`.
