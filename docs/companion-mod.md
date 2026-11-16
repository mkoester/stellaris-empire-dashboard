# Companion mod: log lines and features

The `SDASH` line formats, what each mod version exports, the daily tick, exact branch points. Read before changing `mod/dashboard_feed` or `feed.ts`. _Moved verbatim from `AGENTS.md` on 2026-11-14._

Hidden events write `game.log` lines for human players, `SDASH|2|<date>|…` (format 2 since mod
0.2.0; `feed.ts` still reads format 1's monthly lines). **Format 3 (mod 0.7.0)** puts a run id after
the date of every month, tick and load line (`SDASH|3|<date>|<run>|end`), drawn at each load
(`sdash_roll_run`): the game drops a line it has already written this session (checked 2026-10-25:
a branch replaying July logged 4 of 26 resources a day, no `tick-end` and no month `end`; a second
load of one save no `load` line), and its random draws differ after a load (one save loaded twice:
the next month's timeline ids 492755 and 934959, all else identical). Checked with 0.7.0 the same
day: 07.01 loaded twice logged both loads (runs 524422, 777538), the replayed 08.01 month came
complete and became node 286 under 281, beside the left 08.01 (282). Event lines stay format 2.
The format is shared with `feed.ts` — change both together and bump the number. The table below
shows format 2.

| Line                                                                      | When                                                          | From                                                                                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `timeline\|<id>\|<previous id>`                                           | monthly, first                                                | `on_monthly_pulse_country`                                                                                                        |
| `<resource>\|<stockpile>\|<monthly income>` × 26, then `end`              | monthly                                                       | same                                                                                                                              |
| `tick\|<resource>\|<stockpile>` × 26, then `tick-end`                     | daily                                                         | a self-rescheduling event                                                                                                         |
| `load\|<id>`                                                              | a save was loaded                                             | `on_single_player_save_game_load`                                                                                                 |
| `event\|colony\|<planet>`                                                 | colony established                                            | `on_colonized`                                                                                                                    |
| `event\|war-started\|<war>` / `event\|war-ended\|<loser>\|<winner>`       | at once                                                       | `on_war_beginning` / `on_war_ended`                                                                                               |
| `event\|leader-died\|<leader>`, `event\|ruler\|<name>`                    | at once                                                       | `on_leader_death`, `on_ruler_set`                                                                                                 |
| `event\|combat\|<winner>\|<fleet>\|<loser>\|<fleet>\|<system>`            | each battle we fight                                          | `on_space_battle_won`                                                                                                             |
| `event\|<spending kind>\|<colony, leader, planet or system>` (0.3.0)      | at once                                                       | queued/cancelled, edict, decision, … (`#lib/spending.ts`)                                                                         |
| `event\|multiplayer` (0.11.0)                                             | monthly                                                       | `is_multiplayer` holds (see `docs/no-cheats.md`)                                                                                  |
| `event\|slave-sold\|<species>\|<pops>\|<buyer>\|<seller>` (0.12.0)        | each sale, galaxy-wide                                        | `on_slave_sold_on_market` (This = pop group, From = buyer, FromFrom = seller)                                                     |
| `event\|tech-option\|<tech>` × n, then `event\|tech-options-end` (0.13.0) | the 2nd of each month, and the day after a tech is researched | `sdash.6`, scheduled a day ahead by `sdash.1` and `sdash.7` (`on_tech_increased`), once a day at most (format 3: with the run id) |

- **Diplomatic weight** (0.4.0): no log line — each month the player's event exports every
  Galactic Community member's `diplomacy_weight` trigger into its country variable `sdash_dw`, so
  every save carries it (`galacticCommunity()` reads it).
- **Storage** (0.5.0): no log line — each month `sdash_export_resource` also exports our maximum of
  every resource (`export_resource_maximum_to_variable`, 4.5.2 effects.log) into `sdash_m_<res>`,
  and `sdash_export_tradable_maximums` the tradable ones of every empire we have communications
  with. Read as `Snapshot.storageMax` and `AiIntel.max` (`storageMax()`); the resources panel's storage line
  and the trade tab's "They take" use them, else ≈ the base (`docs/storage.md` lists every
  source). Confirmed in game 2026-10-24 (`docs/open-points.md`).
- **Colony stability** (0.8.0): no log line — each month `every_controlled_colony` (arkships
  included) exports `planet_stability_add` and `planet_stability_mult`
  (`export_modifier_to_variable`, colony scope per 4.5.3 effects.log) into the colony's
  `sdash_stab_add` / `sdash_stab_mult`. They land on the colony's **carrier** — the arkship's
  `ships.<id>.variables` (2205.10.01), a planet colony's planet assumed, not seen yet — and are
  read as `Colony.stabilityAdd|Mult` (READER 36). **Checked 2205.10.01** (screenshots
  `screenshot_2026-10-31_09-25-00`, `-09`): `sdash_stab_add=33.35` = the tooltip's lines but
  approval (10 + 5.6 + 17.7); the page's 110.9 = the tooltip's sum with approval unrounded (95.8 %
  → +27.5, shown "+27").
- **Research options** (0.13.0, the user's ask 2026-11-16: "check on every 2nd of a month which
  tech options are available"): the monthly `sdash.1` schedules `sdash.6` a day ahead, and so does
  `sdash.7` on `on_tech_increased` — a field draws its new cards when one of its techs is researched
  (4.5.4 `SELECT_TECHNOLOGY_DESC`: "Whenever we finish researching a Technology, up to N new
  options will be generated"; picking or changing research draws none), on any day, so the 2nd
  alone left a mid-month draw unseen until the next month. `sdash_queue_tech_options` schedules it
  once a day at most (a one-day country flag). `sdash.6` logs
  one line per tech on offer and an end line (an empty list is a list). Script cannot list the
  options, only ask `has_tech_option = <key>` (4.5.4 triggers.log), so `sdash.6` asks it for every
  tech of the data DB with a cost: `events/sdash_tech_options.txt` is **generated** by
  `node scripts/gen-tech-options.mjs --db <data DB> --out mod/dashboard_feed/events/sdash_tech_options.txt`
  — re-run after a game update; techs of other mods are not asked. Format 3, like the month lines,
  so a replayed 2nd after a load is not dropped as a repeat; event lines, so an older dashboard
  skips them. `feed.ts` hands the list over at the end line (`onTechOptions`); `app.ts` keeps the
  last one per campaign **in memory** (`liveTechOptions()`; a load drops it) and reloads open pages.
  At the head, `withLiveOptions()` (`#lib/techOffers.ts`) adds it as a reading after the last save
  for Upcoming's planned techs on offer and the tech tab's cards (dated in the panel title) — the
  cards only: the reading repeats the last save, which rates would read as no progress. Without
  the mod, or after a restart, the saves' cards serve as before. In game: `docs/open-checks.md` 39.
- **First entry into a system** (0.10.0): `on_entering_system_first_time` (scope: ship, From =
  the system) logs `event|system-entered|<system>` for a human owner's ship; the line only dates a
  system entry event (see "System entry events", `docs/tabs-galaxy.md`), never stands alone.
- **Colony jobs and pops, by day** (0.9.0): inside the daily tick, before `tick-end`, every
  colony's `free_jobs`, `num_unemployed` and `num_sapient_pops` (triggers, colony scope) go to
  `sdash_fj|un|pp`, and only when one differs from the last logged (`sdash_*_log`) a line
  `SDASH|2|<date>|event|colony-jobs|<colony>|<open jobs>|<unemployed>|<pops>` — an event line, so
  a dashboard without the kind skips it. `feed.ts` files it with its day (`Tick.colonies`, by
  colony name), so it reaches the page live (the colony page's Pops (jobs) chart title: "Pops (jobs) —
  <date>: … employed, … civilians, … open jobs") and is stored with the month; the Pops chart
  draws those days between the saves (`colonyDaySeries()`). **Broken in game (2026-10-31):**
  `num_sapient_pops` is no trigger, and the lines come out empty (`docs/open-checks.md` 23). Mod
  0.8.0–0.10.1 ran only on 4.5.3 (the Linux machine has the beta), never on 4.5.2. **A colony's
  variables live on its carrier**, and loc in colony scope cannot read them: log them from inside
  `carrier = { }` (0.10.1; `docs/open-checks.md` 23). The `system-entered` line was first seen
  2026-11-01 (Baxom, Tozied, Ecio, 2206.12–2207.01). **Assumed until checked**
  (`docs/open-checks.md` 23): unemployed = the civilians, employed = pops − unemployed, and
  `free_jobs` the same count as the save's open jobs. Checked 2026-10-31 on a DB copy with a
  replayed line: the `tick` server event carries it.
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
  Until then the layout offers it (`loaded`, from `pendingLoad()`; the `loaded` server event makes
  open pages ask): "show it now" opens the loaded node on the same tab — the user's ask
  2026-10-25, a refresh alone kept showing the abandoned future.
  **The game drops a log line identical to the one before it** (checked 2026-10-25: loading the
  same save twice without unpausing logged one `load` line; another save in between, both): a
  repeated load of one save is invisible to the dashboard, and a dashboard restart forgets a
  pending load.
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
