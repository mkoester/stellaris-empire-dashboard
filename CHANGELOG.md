# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The diplomacy tab's circle is the default graph and groups empires by blocs (federations,
  overlords and subjects), mutual opinion (you pick how high) or cooperation (pacts); relations
  switch all on or off at once; names no longer run off the edge.
- The contacts tab splits the Galactic Community: resolutions in force by category (or one list)
  with all their effects summed, and proposals with the diplomatic weight for and against — click
  one to see who votes how. Companion mod 0.4.0 stores each member's weight; without it the weight
  is an estimate, marked ≈. Proposals are listed in the game's queue order, by the weight for them, with when they were proposed (to the month, from the saves — the game keeps no date). The Galactic Community's history — proposals, votes, passed, failed and withdrawn resolutions — is on the events tab and under the proposals. The Galactic Community has a tab of its own: galcom. Proposal dates read as the month where the saves allow (2208.10); the effects in force are grouped by what they act on.
- Empire names carry their map colour everywhere, and every list can be sorted by any column.

- A diplomacy tab: every empire you know and the relations between them — pacts, rivalries,
  subjects, wars, opinions — as a table, a matrix and a graph (on the galaxy map at their capitals,
  or on a circle), in each empire's own colour. It shows what your intel on each empire reveals, as
  the game does; what it showed once but no longer does stays, marked "unverified since" that date.
  Click an empire to see it and its relations alone. A cheat in ⚙ shows everything.
- The contacts tab's relations table is titled and filters by kind — other empires, fallen
  empires, enclaves, traders, pre-FTL civilisations, space fauna, marauders — and names carry
  their colour and the fallen, nomadic, enclave, … badges of the trade tab.

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

- A trade tab: the empires you talk to with their personality (how good a deal must be), attitude,
  opinion of you and what makes it up, and how long a gift's goodwill lasts; with a switch in ⚙
  (cheating), what each would give for what — estimated until calibrated against the game
  (`docs/trade-calibration.md`) — and what they are short of or flush with.
- A growth tab: natural pop growth per colony as measured, months per 100 pops, housing used,
  free districts (more behind blockers), habitability, and what holds a colony back.
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
- The trade tab's tables sort by any column; nomadic and fallen empires are marked; willingness,
  opinion and trust run from red to green. Trade is a resource in the deal finder (default: trade
  for energy), nomads never give their energy or minerals, and trader enclaves show what their
  strategic resource costs. A new panel prices every resource in trade per empire: what you would
  pay for it, what you would get for it, or both.

- The trade tab's estimates are fitted to the game's own trade screen at three empires, one of them
  fallen: what a unit
  of energy, minerals, food, consumer goods, alloys, living metal and trade is worth to them, how
  much they hand over at once (all but 500 of a resource) and a month (30 % of their income of it),
  and how their personality's willingness discounts what you offer. Other strategic resources show
  no estimate until measured. A new table shows the opinion a gift of 1000 of each resource buys at
  every empire — rivals and empires that refuse trades take gifts too.

- The trade tab's deal finder has a second mode: pay once, receive monthly. An empire values a
  monthly payment at half a one-off, so over the deal it pays you twice what it would at once; the
  table shows what each pays a month, the total, against the market, and whether it can afford the
  payment — a deal it cannot afford breaks.

- The trade tab knows an empire takes in at worth only what fits under 80 % of its storage: the
  deal finder shows how much of what you give it takes, and gifts and pay-once deals count no more.
- The contacts tab's Galactic Community shows when the current vote is decided, or when the next
  one starts.

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
