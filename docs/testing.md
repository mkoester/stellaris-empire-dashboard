# Testing: DB copies, replays and throwaway games

How to check a change end to end on a DB copy, replay a live month, read a save ad hoc, and the throwaway games with their console commands. Read before any end-to-end or in-game check. _Moved verbatim from `AGENTS.md` on 2026-11-14._

`STELLARIS_TEST_SAVE=<.sav>` enables the real-save test in `save.test.ts`; vitest swallows its
`console.log` dump unless run with `--silent=false`. Its assertions fit our 4.5.2 campaign (a
4.0.1 save fails one); for an ad-hoc look at any save, a throwaway `src/lib/server/*.test.ts`
calling `readSave`/`toSnapshot` (and `loadGameData` for the data DB) works — delete it after.

**A change to the save reader that must not change its output is checked on real saves, old tree
against new** (2026-11-15, the split of `save.ts`): `git archive develop src package.json | tar -x`
into `$TMPDIR` with `node_modules` linked, then one Node script per tree that imports
`src/lib/server/save.ts` and `gamedata.ts` (Node runs the `.ts` files as they are), reads the same
saves with `loadGameData(<data DB>)` and writes each snapshot's JSON; `diff` them. Read each save
alone _and_ after another: that comparison is what showed the old reader's names following the
save read before, which no unit test could see (each sets its own state).

**Tests of a server module that reads the process-wide state** (`getDb()`, `getGameData()`) set
`globalThis.__stellarisDashboard` before a dynamic `import()` of the module — `planner.test.ts` is
the pattern, with an in-memory DB and only the game data fields its goals read. This is also why
vitest keeps one worker per file (`isolate`, its default): with shared workers that state would
leak between test files.

**Checking a change end to end: run against a copy of the DB**, never the real one (history — a
dev server ingests saves and moves the head). On the Linux game machine the one in use is
`~/.local/share/stellaris-empire-dashboard-test/` (every campaign, the nomad Roaming Korinth
included, 2026-10-31) — on mkTuxedCachy there is no `-test` folder, and the released zip's own
`~/.local/share/stellaris-empire-dashboard/` is the one in use (2026-11-15); on the game machine
it is stale since 2026-10-18
(UNE 3 alone: an exploration that read it reported the nomad campaign missing); on a Mac in `~/Library/Application Support/stellaris-empire-dashboard/`. **Take the copy with
`sqlite3 <db> ".backup '<copy>'"`** (consistent while the dashboard writes); **once the dashboard
is closed, open the source as `file:<db>?immutable=1`**: with no `-shm` left, SQLite must create
one beside the DB, which the sandbox cannot, and every open fails "unable to open database file"
(2026-11-16). Or copy `dashboard.sqlite*` (WAL files included) to a
temp dir, start `pnpm dev` with `DASHBOARD_DB` pointing there and the real save dir (or a copy of
one campaign's folder, so a READER bump re-reads only that campaign — it then logs "cannot read
the launcher's playsets" on every read: no launcher DB beside the copy, harmless, 2026-11-18), then request
pages and `/__data.json` with curl (to only read what the copy holds, point `STELLARIS_SAVE_DIR` at an
empty folder: nothing is ingested, the head stays) and stop the server — all in one command where the sandbox gives
each command its own network namespace. `__data.json` is devalue-encoded: decode the last node's
`data` with `unflatten` from `node_modules/.pnpm/devalue@*/node_modules/devalue/index.js` (a
`node --experimental-strip-types` script can import the pure `src/lib/*.ts` to recompute from it).
A profile switch is flipped on the copy with `PUT /api/settings` (`{"display":{…}}` — **it replaces
the whole `display`**, `parseDisplay()` defaulting what is left out, so send every switch the check
needs in one PUT, the gates `showSpoilers` / `showCheats` included (2026-11-07: a second PUT for the
cheat silently switched the spoiler off), with the
page's `?node=`). **A `?node=` the copy lacks serves another node silently** (the dev server reads new saves into its copy, so ids found in an earlier copy may not exist in a fresh one — 2026-11-12): check the decoded `tip` before trusting a page. A save-wide question (every colony across the history) is quickest as a
throwaway `src/lib/server/*.test.ts` over the copy: set `globalThis.__stellarisDashboard = {
updates, status, explanations: {}, gameData: loadGameData(<data DB>) }` before importing
server modules that call `getGameData()`/`getExplanations()` — delete it after. **To find where
a page hangs**, call its server function from such a test under `timeout 150` and log each step's
time with `appendFileSync` to a file: vitest holds a test's console output, and `timeout` killing
it loses all of it (2026-11-06, Roaming Korinth's planner: `plannerPage` → `suggestions()` →
`display()` per body).

**Replaying a live month** (what a player sees as the mod's line and then the autosave arrive):
on the copy delete the nodes after the one to start from (`snapshot`, `node`, the later saves'
`save_file` rows; `state.head`), give `STELLARIS_SAVE_DIR` a folder holding only the saves up to
it and `STELLARIS_GAME_LOG` an empty file; once the server is up, append the month's `SDASH|2|…`
lines (the real log's, or written from a snapshot's stockpile and balance — `parseLine()` needs
only the `SDASH|` part), fetch `__data.json`, then copy the next autosave in and fetch again. The
save merges into the log month's node (same id, same tip). 2026-10-25: every state rendered 200
server-side; a browser-side error needs a browser, which the sandbox cannot start.

## Measuring a page

How 0.1.18's speed-up was found (2026-11-15): reading the code suggested a warm-up, the profile
showed two queries. Measure the packaged path, not `vite dev`:

1. `node_modules/.bin/vite build`; a folder holding a copy of `release/launcher.mjs` and a symlink
   `app` → `build/` runs it as a zip would.
2. A consistent DB copy, WAL included: `VACUUM INTO '<copy>'` from a read-only `node:sqlite`
   connection. A copy of an older schema also runs the new migration, with its backup beside it.
   **In the sandbox that open fails** ("unable to open database file", 2026-11-15) where the DB's
   folder is not writable — the released zip's `~/.local/share/stellaris-empire-dashboard/` on
   mkTuxedCachy; a WAL database needs its `-shm` beside it even to read. With the dashboard
   stopped (no `-wal` file left) a plain `cp` of `dashboard.sqlite` is consistent; otherwise copy
   all three files to `$TMPDIR` and `VACUUM INTO` from that copy.
3. One command: start the launcher with `DASHBOARD_DB`, `STELLARIS_SAVE_DIR`,
   `STELLARIS_DATA_DB` (one of `data/*.sqlite`), `XDG_DATA_HOME=$TMPDIR/…` and a `PORT`; wait for
   `every campaign is up to date` in its log (**a catch-up re-reading saves makes requests ~1.5 s
   and drowns every other effect**), time each route twice with `curl -w '%{time_total}'`, then
   `kill -INT` the launcher.
4. To see where the time goes, start it with `node --cpu-prof --cpu-prof-dir=<dir>`, request one
   page ~15 times, stop it, and sum the profile's `samples`/`timeDeltas` per function (self and
   total time). A cost every route shares sits in `+layout.server.ts`.
5. A suspect query: `EXPLAIN QUERY PLAN` and a timed `prepare().all()` on the copy, before and
   after a candidate `CREATE INDEX`. SQLite takes an expression index only when the query cannot
   use another one first (`+n.campaign`, `campaignIronman`).

## Testing in a throwaway game

**Reading a save ad hoc** (a number the tabs do not show yet): a throwaway script in
`src/lib/server/` (so `#lib` imports resolve) that runs `readSave` + `toSnapshot`, started with
`node` and deleted after — call `setPrescriptedNames` first, or prescripted names read as their keys
("planet name zrobots" for Yorphia). Never regex a fixed window of the raw `gamestate` from a
country's start: it runs into the next country's block and reads their values (2026-10-24: a
"lost" silo that was there all along) — bound the block by its braces, or use the snapshot.

**The current throwaway game** (2026-10-24): `yorphianextractorate_888024433` (Machine
Intelligence, Shroud-Forged; companion mod 0.5.0). Holds: console stockpiles, a planet and a
starbase Resource Silo, Construction Templates, Mega-Engineering, the galactic market founded from
the console (we host; with no Galactic Community we alone have access), two 1000-energy gifts to Lahtrepian (9), the first accepted 2201.06.01 (+41; 39 from
2202.06.01; the second gift: 78; 76 from 2203.06.01 — the first gift's date holds). Since 2026-10-24
it runs on the native build: its saves are in the native user dir (workspace `AGENTS.md`).

**The second throwaway game** (2026-11-05): `federatedtheianpreservers_-1907099999` (Lithoid,
oligarchic, fanatic materialist, pacifist → xenophile by console 2214; Ensign — not Cadet, whose
+50 % to every job blurs output checks), dashboard DB `sdash --db-dir throwaway`. Holds: research
agreements with two empires on one tech (2200.06–2201), migration treaties since 2200.10, a second
colony Curiel (arid, by console), Mineral and Energy Shortages from 2219. Lessons: **pick a tech in
every area before measuring research speed** — an empty queue stores the points, and stored points
spoil the measurement for months; **`fast_forward` writes no autosaves** — only the companion
mod's months arrive, which carry no colonies or species: make a manual save at the end. Console
recipes: `stellaris-modding-insights/docs/07-debugging-and-console.md`.

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
food, consumer goods and alloys 15,000, trade 50,000), `instant_build` (**while on, every
country's storage of every resource is 1,000,000** — influence and research included — and
stockpiles grow past the real limit; turn it off before a month whose storage you measure;
2026-10-24, gone again the month after), `survey`, `fast_forward <days>`,
`factions.spawnall`, `federation_add_experience`/`_cohesion`, `event <id>` (`action.96` opens the Galactic Market
nomination, an event chain, not a situation — skipping the resolution, so none of its modifiers;
`action.98` ends it, at once if fired: it founds the market only with a nominated planet (the
planet decision "Market Nomination", 1000 energy, 150 influence), else it fails — so
`action.96`, nominate, `action.98` founds it at once with us as host (2026-10-24, worked);
`galcom.16` founds
the Galactic Community, `distar.11000` opens the L-Gates, `crisis.199|1000|2000|8005`,
`fallen_empires_awakening.1` after `play`-ing a fallen empire), `effect <script>`. Situations:
`effect add_situation_progress = 500` moved our Psionic Ascension to its next stage (2026-10-19;
an `every_situation = { limit = … }` form did not).
