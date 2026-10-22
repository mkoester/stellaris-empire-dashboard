# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Companion mod 0.2.0 (log format 2): the stockpile every day, shown live in the resources panel
  and between months in the stockpile chart; the exact save you loaded, so a reload's branch is no
  longer a guess; colonies, wars, leader deaths, new rulers and space battles at the day they
  happen, on the events page and in the charts. The dashboard still reads the 0.1.0 mod's lines.
- Cleaning up: the config tab lists the games in the history, each can be deleted; a game whose
  saves are all gone from disk is offered for deletion once.

- A resources tab: per resource a chart of its stockpile and its net per month, and a table of
  what earns and spends it each month, source by source (ships, jobs, buildings, the market, …),
  and what changed the stockpile outside that budget (construction, events, …), by day with the
  companion mod.
- The resources tab names that spending: what was queued for construction, edicts and campaigns,
  stations, leaders hired — from the saves, and to the day with companion mod 0.3.0, which also
  logs districts and buildings queued or cancelled, decisions, colonizations and megastructures.

- A trade-offs tab (switched on in ⚙, exploratory): what pays back fastest right now — stations,
  districts or buildings — measured from your own budget, and a month-by-month comparison of
  strategies, with knobs for techs within reach and the next tradition.

- The tech tab: the cards on offer mark the one being researched, the permanent options and the
  progress of queued techs; stored research per field (from events — used up at up to double
  research speed); a new list of what was offered when, and what you picked.
- A jobs tab: what each unit of a resource costs you, source by source (jobs with their workers'
  upkeep, stations, starbase modules), and how well each colony works its jobs for each resource
  against your empire's average — the colonies to specialise. Research, unity and the other
  resources the market does not sell are now valued at what they cost you, on every tab.
- The trade-offs tab: each tech, tradition and ascension perk shows all it does on hover; values
  are in trade.
- A produce tab: pick a resource and see every way to get more of it — stations, districts,
  buildings, starbase modules, clearing a blocker, edicts — each with its cost, upkeep and what
  else it yields, ranked by what it costs per unit in trade against buying it on the market.
- A systems tab: every system of ours — and, if you like, those up to ten jumps beyond the border
  — with what we know of it, what it cost (outpost, upgrades, modules, buildings, stations, their
  upkeep; colonies optionally) and what it earned, over time and in total, valued in trade, with a
  projection and the month it breaks even.

- A download for macOS (13.5 or newer), for Apple silicon and Intel Macs, with its own Python.
- Every folder the dashboard looks in, per system and store, listed in the zip's `README.txt`.

### Changed

- Game data is extracted again when a new dashboard brings a newer extractor, not only after a
  game update or a new DLC.

- A start reads only the game played last (the first start: the one with the newest save); the
  other games catch up in the background a few seconds later, the most recently played first.
- The history is upgraded in place when a new version changes its tables, after a copy beside it
  (`dashboard.v15.sqlite`). An older version started by mistake refuses a newer history instead
  of discarding it.

## [0.1.0] - 2026-10-20

First public release.

### Added

- Reads the game's autosaves as they are written and keeps their history in a save graph: loading
  an older save starts a new branch instead of overwriting history.
- Tabs for the empire overview with history graphs, colonies (pros and cons, problems), a single
  colony, the discovered galaxy map, migration, expansion and habitat sites, trade deals, the
  market, events, government (council, agendas, policies, edicts, factions), situations, the
  Shroud, empire focus, traditions, tech, leaders, species, contacts, megastructures, mods and DLC.
- Profiles with custom tabs; light and dark theme.
- Downloads for Windows and Linux that bring their own runtime: start, pick the game folders
  (found automatically for Steam, GOG, Microsoft Store, Linux native and Proton), play.
- Game data read from your own installation once per game version and DLC set.
