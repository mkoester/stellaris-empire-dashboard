# No cheats in multiplayer or Ironman

How multiplayer and Ironman are detected and what was seen in which save. Read before touching `display()`, `campaignMultiplayer()`, `campaignIronman()` or `playerCount()`. _Moved verbatim from `AGENTS.md` on 2026-11-14._

- **No cheats in multiplayer or Ironman** (the user's intent, 2026-11-01; built 2026-11-03,
  Ironman and the `intel` spoilers 2026-11-06). Nothing in the game can tell a player runs the
  dashboard, so it could spoil a multiplayer game; Ironman is the game played as it comes (the
  user's call: same treatment). Once any reading of a campaign says multiplayer
  (`Snapshot.multiplayer`, READER 44; `campaignMultiplayer()`, which stays true — a multiplayer
  save loaded in single player, a month without the mod, does not undo it) or Ironman
  (`campaignIronman()`), `display()` forces every `cheat`-kind switch off **and every spoiler
  marked `intel`** — those revealing other empires or unexplored space: `wholeGalaxy`,
  `surveyAll`, `wormholePairs`, `lgates`, `contactStations`, `pactIntel`, `contractSpoilers`,
  `highwayFriends`
  (`effectiveDisplay(d, noCheats)`, `barred()`) — and ⚙ lists none of them, saying why
  (`viewedNoCheats()`: `ironman` before `multiplayer`). Other spoilers stay: they are the game's
  own content (anomalies, projects, timers, what-ifs), not another player's secrets. **A new
  spoiler that reveals another empire or unexplored space gets `intel: true`.**
  - **Ironman: the save alone** — `galaxy.ironman=yes` (jomini reads it as `true`; every other
    save `no`), already in `Snapshot.galaxySetup` (READER 42). The companion mod cannot help: any
    script mod changes the checksum and switches Ironman off. Seen 2026-11-06 in UNE 2's
    `ironman.sav` (4.5.3, public; a new single-player game, started after a game restart without
    mods; `meta` too holds `ironman=yes`, other saves' `meta` no key), whose `player` block names
    the account alone (`MirkoMachine`) — **a single-player Ironman save names the account**, so
    in Ironman only two players mean multiplayer (READER 48; since READER 56 everywhere, below).

  Multiplayer has two signals:
  - **The save** (`playerCount()`, `Snapshot.players`, READER 56), which serves a player without
    the mod — a cheater would just not run it: the top-level `player = { { name country } … }`
    **lists two or more players**. One named account is no signal (it was until 2026-11-12): **the
    native Linux build names the Steam account in single player** — every save since the switch
    from Proton, e.g. UNE 3 and Yorphian Extractorate under Proton `unknown`, their native games
    `MirkoMachine`; UNE 6 (single player, native) read as multiplayer and lost its cheats. A
    multiplayer game hosted alone (one account) is the mod's to catch. **Old readings**: a stored
    reading without `players` (before READER 56) no longer counts, and a re-read drops its flag;
    one with `multiplayer` but fewer than 2 players owes it to the mod and stays (`fromMod()` in
    `db.ts`, the query in `campaignMultiplayer()`). History as first written: under Proton every
    single-player save on the Linux machine (106, 4.5.x) had one `name="unknown"`;
    Oracularity of Noerm 2200.01.01 (a new multiplayer game, hosted alone, 4.5.3) `MirkoMachine`
    only; UNE 2 `unknown` alone at 19:01, `unknown` + `MirkoMachine` (both country 0) from 19:41
    on, after the Noerm session — whether it was loaded through the lobby nobody remembers
    (`docs/open-checks.md` 27). Nothing else differs: `meta` and `galaxy` (`ironman=no`) are
    alike, and no gamestate key exists only in multiplayer. `cheated_on_save=yes` means the console
    was used, in single player too.
  - **The companion mod** (0.11.0): each month, if the trigger `is_multiplayer` (scope all; vanilla
    uses it in `01_start_of_game_effects.txt`) holds, `SDASH|2|<date>|event|multiplayer` before
    the month's lines → `Month.multiplayer`, kept through the merge with the save
    (`withLogFields`). Monthly, not at load: `on_single_player_save_game_load` is all the game
    offers, and the mod's `load` line hangs on it.
    This is a guard against using the dashboard by accident, not against a determined cheater: a
    fresh dashboard DB, an edited save or an edited build (AGPL) gets past it.
