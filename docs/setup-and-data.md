# Setup, discovery and game data

Configuration, folder discovery for `/setup`, the extraction at start and mods in the game data. Read before changing `server/config.ts`, `locate.ts`, `extract.ts` or `dataStore.ts`. _Moved verbatim from `AGENTS.md` on 2026-11-14._

**Configuration** (`server/config.ts`): environment variables win, then `config.json` in the app
data folder (`%APPDATA%\stellaris-empire-dashboard`, `$XDG_DATA_HOME/stellaris-empire-dashboard`),
which `/setup` writes: `{ gameDir, userDir, gameLog? }` (`gameLog` defaults to `<userDir>/logs/game.log`). The save folder is `<userDir>/save games`,
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
game's files (`isGameDir`, `isUserDir`); user folders rank by newest save. One entry per folder
(`folderKey`): symlinks resolved, and on Windows and macOS case and separators folded — Steam keeps
its registry `SteamPath` lowercase (`c:/program files (x86)/steam`), so Windows' first `/setup`
(2026-10-25) listed Steam's folder twice; Windows shows the on-disk spelling (`realpathSync.native`). **Not yet confirmed on a
real machine:** the Microsoft Store layout, GOG's registry key, Heroic/Lutris — players type the
path when they are wrong. A machine moved from Proton to the native build keeps both user folders
(`scripts/stellaris-native.sh`); ranking by newest save picks the one in play.

**A game the release was not built for** (`#lib/gameNote.ts`, 2026-11-28, after a player on 4.5.4
reported 0.2.1's Windows crash): the target is `__GAME_TARGET__`, the companion mod's
`supported_version` read by `vite.config.ts` — no second number to bump. `/setup` warns for the
picked install, a release build above every page and in the log: a game before `OLDEST` (4.5) will
most likely not work, an older one from 4.5 on is pointed to the earlier releases on GitHub
(`RELEASES_PAGE`, `GameNoteLine.svelte`), a newer one may miss things, and the target's version on a Steam
beta branch (`steamBranch()`: `appmanifest_281990.acf`'s `MountedConfig.BetaKey`) is an open beta.
One note, the version's first: Steam's Betas list also rolls the game back, as a branch.

**Game data** (`server/extract.ts`): without `STELLARIS_DATA_DB` the extractor runs at start
against `gameDir` — `data/stellaris-<rawVersion>_<build>-<hash of the DLC folders and the extractor's
`**version**`>.sqlite` (`v4.5.3_7793-…`; the build from `launcher-settings.json`'s `version`, as an
open beta shares its `rawVersion` with the release), so a game update, a beta build, a new DLC or a
dashboard with a newer extractor (new tables) extracts again (~5 s), older files stay. The footer
shows the data DB's own `meta.game_version`. The packaged launcher names the extractor and
its Python (`STELLARIS_EXTRACTOR`, `STELLARIS_PYTHON`). **The key holds the extractor's
`__version__` and a hash of its code** (`extractorVersion()`: the script and `extractor/*.py`) —
during development the version stays the same across changes, and a dashboard kept serving data
from older extractor code, silently (2026-10-31: Mega-Engineering's prerequisites, fixed in the
extractor, never reached a dashboard with `STELLARIS_EXTRACTOR`); now any code change extracts
once more (~5 s), a release's players only when its code changes.

**Mods in the game data** (2026-11-08; the user's ask: mods adding districts, slots, designations,
trees, perks, civics, traits; **per campaign since 2026-11-09**, the user's ask: "only the current
playset — can a changed playset be picked up by the running dashboard?"): **each campaign's data
is extracted with its latest save's mods** (`campaignModSet()` in `#lib/addons.ts`, `campaignMods()`
in `db.ts`), `--mod` each in load order, so their designations, districts, zones, tradition trees,
traits, archetypes, starbase levels and defines are in the data DB, and the `Better …` rebalances'
values replace vanilla's (the extractor's merged view: `../stellaris-data-extraction/extractor/mods.py`).
**The save names mods but not their order** (`meta.mods`, alphabetical), so the order comes from the
launcher: the order seen while the campaign was played (`rememberOrder()`: at each save the running
game writes, `dlc_load.json` if it holds exactly the save's mods, kept as setting `loadOrder:<campaign>`
— **the launcher rewrites `dlc_load.json` on every playset edit, not only at a game start**: on
2026-11-09 at 21:28, after the game had closed at 21:24, with no game start between; the user had
edited the playset), else `dlc_load.json` (the active playset) when it holds exactly these mods, else
the playset
closest to them (`launcherPlaysets()`: `launcher-v2.sqlite`, most of the mods, fewest others, the
active one first; the mods it lacks appended alphabetically), else alphabetical ("guessed"). Measured
2026-11-09 on this machine: no playset held any older campaign's 17 mods exactly — "4.5 tests
dashboard" had gained Dev Tools since —, so the closest playset is the common case. A campaign
without a save yet takes `dlc_load.json`. Relative descriptor paths resolve against the user dir. An older mod registered by `archive=` (a
zip, 2017's Research options+) has that as its `path` and is unpacked by the extractor (v0.1.15).
**The data DBs** (`server/dataStore.ts`, `dataOf()` in `app.ts`): named by game, DLCs, extractor and
mods in load order (`dataDbFor()`; folder and update time per mod — none leaves the key as before
mods, so an unmodded player never re-extracts), kept on disk; one on disk loads at first use, the
three most recently used stay in memory, one extraction runs at a time. Pages read the viewed
campaign's (`getGameData()`, `getExplanations()`, `dataMods()`, `dataVersion()` resolve it once per
request through `viewedCampaign()`); a campaign whose data is not extracted yet gets the most
recently used one while it extracts in the background — the layout's banner says so — then pages
reload. Start-up extracts the head campaign's before the first page. **Saves are read with their
campaign's data** (prescripted names and entry events are baked into snapshots): the watcher's
`prepare` sets them per campaign (extracting first if needed) and `reader` holds the campaign's data
DB stamp (`readerOf()`: `READER:mtime:size` of its file, the format of before, so an unchanged data
DB re-reads nothing), so a campaign whose data changes is read again (`Watcher.reread()`).
**Changes are followed while running**: a new save naming other mods, or the launcher's files
(`dlc_load.json`, `launcher-v2.sqlite` and its WAL, polled every 5 s, `watchLauncher()`) — a
playset edited, a game started — resolve each campaign's mods again, re-read descriptors (mod
updates), and extract and re-read where they changed. **Extraction goes through the extractor's
parse cache** (`--cache <app dir>/data/parse-cache`, `parseCacheDir()`, extractor v0.1.14), which
parses only files it has not seen: 45 mods 10 s, the game alone 6 s (2026-11-09). A failed modded
run (a broken mod file, a player's extractor from before `--mod`) falls back to the game's own data,
logged — and is tried again at the next start (its data DB never exists). `/mods` shows which mods
the campaign's data includes (`meta.mods`, `loadDataMods()`; null for an older extractor), where
their order comes from, mods without a folder, and the save's mods the data lacks
(`dataModMismatch()`: while extracting, or after a failure). `STELLARIS_DATA_DB` dev runs use that
one data DB for every campaign, unmodded. Checked 2026-11-09 on a DB copy (eight campaigns, a fresh
app folder): three extractions (two 17-mod sets, Ancient Highway's two), the banner while one ran,
each campaign's `/mods` naming its own; after changing the order rule, one extraction and 21
re-reads; a third start with nothing changed: none of either. **The dashboard caps none of the counts
these mods raise** (tradition trees, perks, civic points; checked 2026-11-08) — the save holds what
was taken. Which mods need more than the data: `docs/mod-support.md`.
