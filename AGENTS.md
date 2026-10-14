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
pnpm dev --host 127.0.0.1
```

The DB is a cache of the saves: delete it to rebuild from scratch (the save graph is re-guessed
from mtime order, manual parent corrections are lost). `STELLARIS_TEST_SAVE=<.sav>` enables the
real-save test in `save.test.ts`.

**How it works:** `watch.ts` polls the save folder (first backfill in mtime order, then every 2 s;
a file is read once its size and mtime hold still for one interval) → `save.ts` reads the zip with
`zip.ts` and queries the gamestate with jomini → `db.ts` places the snapshot in the save graph via
`timeline.ts` and records it → `/api/events` tells open pages to reload.

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
- Build queues: `construction.queue_mgr.queues.<id> = { owner location type }` (`planet`, `army`,
  `starbase`, `combined`); items live in `construction.item_mgr.items` — **shape not yet seen**
  (empty in a 2200.01.01 save).
- Identity of a game state (`Snapshot.fingerprint`): `tick` + `random_count`, both top-level.

## Open (needs a running game on Linux)

- **Build queue items**: `construction.item_mgr.items` was empty in the only save available; the
  colony table has no queue column until a mid-game save shows the shape.
- **`continue_game.json` on load**: if the game rewrites it when a save is *loaded*, it names the
  branch point exactly — `place()` already takes that as `loadedFrom`, nothing feeds it yet.
- **Autosave interval**: `settings.txt` has `autosave=4`; which interval that means is unverified.
- **Companion mod** (`mod/`, monthly `log` lines into `game.log`) and **hint rules**: not started.
- Cross-check the parsed numbers against the in-game UI.
