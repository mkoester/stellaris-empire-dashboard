# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- An **ethics** tab: per ethic how many of our pops hold it, how strongly the empire draws pops to
  it (attraction) and last month's change, both over time as charts, and where each ethic's pops
  live. It marks the governing ethic that embracing a faction of a new ethic would remove.
- Our factions moved there from the government tab, with charts of their support and approval
  over time, whether they are promoted or suppressed, and what embracing each still needs
  (support over 20 %, 5000 unity, the 10-year cooldown).
- One time window for every history chart: a bar under the tabs picks 5, 10, 20 or 50 years or
  everything, a stretch of years, or half a window back and on; in a chart, drag to zoom to a
  stretch, Ctrl+wheel zooms, Shift+wheel moves, a double-click goes back to the last 20 years.
  Every chart follows, on every page. Not stored: a reload starts at the last 20 years.
- Nomads: energy and minerals show as the one pool the game has, the Operational Reserves — stock,
  capacity and level (Critical, Low, Medium, High) in the top bar, a chart, the resources tab
  with both budgets, and in Upcoming when the reserves reach their next level.
- A nomad's arkship colony is named after its ship ("Peshnab the Faithful", not "colony 0"), with
  its class and size; ship names from the game's name lists read as the game writes them.
- The situations tab names each situation's stage.
- The reserves' level is coloured as in the game (Critical red, Low orange, High green), with the
  share of the capacity and how far the next level is at this month's net, up or down.
- The ethics tab ends with what draws pops to each ethic, to the governing ethics and how fast
  they shift: the ethic's own rules (they explain the empire-wide factor) and every modifier in
  the game files — which apply to us, and how each can be changed (now, slowly, not).

### Changed

- Saves are read again (READER 25) for the ethics and situation stages; the ethics history starts with the saves still
  on disk. The bundled extractor needs `ethic.sort_order`.

## [0.1.3] - 2026-10-27

### Added

- The diplomacy tab shows what our intel knows of each empire's ethics as coloured chips (each
  explained on hover), how many steps apart they are from ours, and every change of ethics our
  intel saw, dated between two saves. The circle marks each empire's ethics beside its name.
- Every empire's name on the diplomacy tab shows what our intel knows of it on hover — government,
  ethics, civics, origin (from intel 40), capital, federation, opinions — and from which intel the
  rest would show. The graph names each empire's government and civics (a switch).
- A legend for the relations graph: hovering a relation kind, an ethic (regular and fanatic as
  one), an authority, a civic or origin our intel has shown of an empire on the graph, or "unverified" lights it up in the
  graph, a click keeps it lit.
- Two more ways to group the circle: by **ethics** (empires at most N steps apart on average) and
  by **federation fit** (≈ what their ethics would cost a federation's cohesion, by the game's
  defines).

## [0.1.2] - 2026-10-26

### Added

- The species tab explains every right on hover: the game's tooltip and what it does to the
  species' pops.
- Companion mod 0.6.0 stores the naval capacity, so the dashboard shows it as used / maximum.
- Upcoming lists everything that runs out: when a decision, artifact action, astral action or
  enclave deal is available again (the game does not announce it), timed empire and colony
  modifiers, edicts and trade deals ending, the Galactic Community's recess, a focus change and a
  government reform. Event timers no action names are a spoiler switch in ⚙.
- A cooldown that has run out stays on Upcoming until it is used again or dismissed (✕), per
  colony where it is a colony's; relics, diplomatic actions (Satisfying Insults) and federation
  laws count too.
- Upcoming shows when an envoy's and an excavation's next roll is, and every ship on its last
  task — military fleets included — with an estimate (≈) where the save gives no date.
- Upcoming also shows when the capital can move again, each changed species right, and each
  empire you insulted; Satisfying Insults reads as the bonus coming back with the next insult.
- Loading a save in game (companion mod) asks whether to show it now; otherwise the dashboard
  switches to it with the next save or month, as before.

### Changed

- Closing the dashboard's window or pressing Ctrl+C stops it cleanly: the save being read is
  stored first and the history file is closed (no `-wal`/`-shm` files left beside it). A second
  Ctrl+C stops at once.
- The save graph shows the campaign being looked at only, named in its title.
- Companion mod 0.7.0 (log format 3): every month, day and load line carries a run id drawn at
  each load. The game drops a log line it has already written, so after going back in time most
  of a replayed month went missing, and loading the same save twice was not noticed.

### Fixed

- A companion mod newer (or older) than the dashboard no longer causes errors: its lines are
  skipped, the dashboard works from the saves as without the mod, and a banner says which of the
  two to update.
- A page showing the save being played by its link (`?node=`, e.g. after switching games) went on
  following the game only until the next save; it now keeps following.
- Going back in time to the month before the newest one put the new branch's first month on the
  old branch (both carried the same date).
- A chart whose lines change while the page stays on the same save (an autosave arriving after
  the companion mod's month) is drawn anew instead of updated in place — suspected behind an
  error page on the `all` tab that went away on reload.
- Civilians' unity under Social Welfare, and the trade every stratum makes, show in the Jobs panel
  and the jobs tab.
- The colony happiness chart had no values for our own pops: the save leaves 100 % out.
- Slavery and purge types are listed only for species that are enslaved or purged.
- Setup on Windows listed Steam's folder twice, once in lowercase (Steam's registry entry); folders
  now count as one whatever their case. The Windows zip is confirmed on a real Windows machine.

## [0.1.1] - 2026-10-24

### Added

- The growth tab and each colony page project pops 10 to 200 years ahead, per colony and for the
  whole empire:
  natural growth at each colony's measured speed (slowing as the planet fills) and assembly
  apart, both stopping once the colony is overcrowded — with when each colony stops growing.
- The empire-size chart also shows the real size while it is under 50 (the game, and the save,
  never count it lower), estimated from colonies, systems, districts and pops.
- Designations explain themselves on hover — what the colony specialises in and the bonus it
  grants — wherever they are shown, by their name in game.
- Summed effects (government, traditions, Galactic Community) and empire modifiers carry badges
  for where each part comes from: origin, civic, ethic, gestalt, authority, tradition, perk,
  GalCom, event, situation, …
- Gestalt empires: the growth tab shows assembled pops (Replicators, robot assembly) beside
  natural growth, so a machine world no longer looks stagnant; the colony page lists complex,
  menial and maintenance drones in the game's order; the government tab says a gestalt has no
  factions instead of "none formed yet".
- The resources panel shows, under each resource, its storage and the months until it is full
  (or empty, when shrinking) — grey when far off, turning amber and then red the nearer it gets.
  Companion mod 0.5.0 stores the game's storage — ours and every empire we talk to, so the trade
  tab knows how much more each one takes in; without it the base storage is shown, marked ≈.
- The diplomacy tab's circle is the default graph and groups empires by blocs (federations,
  overlords and subjects), mutual opinion (you pick how high) or cooperation (pacts); relations
  switch all on or off at once; names no longer run off the edge.
- The contacts tab splits the Galactic Community: resolutions in force by category (or one list)
  with all their effects summed, and proposals with the diplomatic weight for and against — click
  one to see who votes how. Companion mod 0.4.0 stores each member's weight; without it the weight
  is an estimate, marked ≈. Proposals are listed in the game's queue order, by the weight for them, with when they were proposed (to the month, from the saves — the game keeps no date). The Galactic Community's history — proposals, votes, passed, failed and withdrawn resolutions — is on the events tab and under the proposals. The Galactic Community has a tab of its own: galcom. It breaks down our own diplomatic weight as the game's tooltip does — fleet, pops, economy, technology, each with its modifiers — and lists what we could propose — and why not: the tier below not in force yet, the category's cooldown, already proposed, a target needed, and for each one we could propose now how likely it is to pass — whether we vote for it, abstain or vote against it, from how each AI weighs it — and for those already proposed, from the votes cast so far. Filters split what is held back: on cooldown (also the Galactic Council's first ten years), the tier below missing, a target needed, other. Proposal dates read as the month where the saves allow (2208.10); the effects in force are grouped by what they act on.
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

### Fixed

- The companion mod's `game.log` is read without any setup: the dashboard follows the game
  folder's `logs/game.log` (before, only a hand-edited `config.json` turned it on).
- Gestalt empires: drone jobs show what they make and use (the jobs panel and tab were empty but
  for Maintenance Drones), and drone upkeep counts in what a unit costs.
- Modified species are named as in game ("Trans-Yorphid", not "$affix$$base$ Yorphid Trans-"),
  and prescripted species by their name ("Yorphid", not "Zrobots").
- The species tab no longer runs trait effects into the next column.
- Charts redraw when their data changes in place (picking another projection horizon redrew
  nothing).

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
