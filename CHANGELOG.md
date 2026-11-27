# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [0.2.1] - 2026-11-26

### Added

- Ethics tab: a map of every empire's governing ethics, as far as your intel shows them (the game
  has no such map mode), with filters per ethic plus "ours" and "opposites", stripes for several
  ethics, and a table by empire (with badges: authority, enclave, fallen empire, pre-FTL, trader,
  marauders, roaming) or by ethic. Countries without ethics (fauna, leviathans) are left out, as
  are contacts you have no communications with unless the Diplomacy spoiler is on. Our pops'
  ethics can be grouped by axis, from one pole to the other.
- Ideologies tab (Willpower): our ideology's strength, level, momentum and tenets with what each
  gives at its slot, the tenets on offer, and the foreign ideologies we know. A cheat in ⚙ shows
  every ideology with its adopters. Dimmed until we adopt or know one.
- Ambitions tab: our ambition's level, currency, each level's requirements and perks, and its
  objectives; before we take one, the ambitions this empire could take. A spoiler shows the
  ambitions the game gave away through an empire's personality ("Crisis Aspirant"); a cheat shows
  every empire's, with its level. Dimmed until we take one.
- Mods' names: whatever an enabled mod adds — systems, megastructures, techs, special projects,
  contracts — is named from the mod's own English texts instead of its raw keys, and a mod's
  techs get their area, tier and cost.
- Support for the Ancient Highway mod: a Highway tab in campaigns that run it —
  your portal and its gate (broken, studied, repaired, sealed) with the next step, both gate techs
  with the grants so far, open studies, the express links, a map of the ring and the mod's terms.
  Two switches in ⚙: a spoiler (what your friends know of the ring) and a cheat (what every
  other empire knows). The mod's centres show as special stars with its gentler effects, jumps
  and distances count the gates and express links you can use, and the ring's systems and portals
  are never offered for outposts, colonies or megastructures. A repair under way shows
  its days left, a gate the Galactic Community forced open the date it may be sealed again; the
  highway's resolutions in the Community, the story fragments found, and in the terms the gates'
  60-day wind-up and who may pass. A nomad is told it gets no portal.
- A section bar: on a long page, a one-line bar under the tabs lists its headings, marks the one
  you are reading and jumps to any of them.

### Changed

- Frontier tab, outcomes: each branch and option names its condition and what each part of it
  says today (yours, the planet's or the ship's), and two opposite branches read as one if/else.
  Resources and tech areas in their colours, popups for the summary, trait badges and specimens,
  modifiers labelled. A contract's project shows its reward, steps, work left and deadline.

### Fixed

- Event chains are read again (they sit in the country's events in 4.5.4 and 4.6): the frontier
  showed no precursor, no L-Cluster chain and no contract progress. Saves still on disk are read
  again.
- The data comes from extractor 0.1.27 (4.6.0): ideologies and tenets, species names in empire
  names ("Authority of Ba Grax"), and the conditions the frontier shows.

## [0.2.0] - 2026-11-23

Built for Stellaris 4.6.0 "Corona Borealis" and Willpower; bundles stellaris-data-extraction
0.1.25 (the 4.6 game data).

### Fixed

- Stellaris 4.6.0: ethics steps apart, opposite poles and the ethic chips read each ethic's tier
  and pole, not `category_value`, whose scale 4.6 widened. A 4.6 data DB had put regular
  Authoritarian at neutral and Egalitarian at fanatic.
- Absolute ethics (4.6, Fallen Empires and Willpower) count as their ethic: a xenophobe's first
  contact +2, `is_fanatic_<ethic>`, the ethics tab and the faction list.
- Governor effects per skill level under their 4.6 names (`skill_<class>_colony_governor`).

### Added

- The Cultural Envoy among the civilian ships.
- Companion mod 0.16.1: asks for Willpower's four new techs, supports 4.6, and no longer writes an
  `error.log` line for each new colony's first month.

## [0.1.31] - 2026-11-23

### Added

- Contacts: first contact difficulty as the game sums it — stage, protocol and a xenophobe's +2,
  each part in the tooltip — and how it changed since the last save. Exact with companion mod
  0.16.0; without it, the cautious protocol's +2 is an estimate (≈).
- Migration: resettlement apart from migration, with the exact pairs of planets from companion mod
  0.16.0; the slider marks the months pops moved, and the arrows step between them.
- Maps: switches for your colonies, fleets and civilian ships on every map, replacing the ship
  picker on the map and systems tabs; a special stars checkbox per map, with a default in settings.
- Contracts: an offer the game does not show you yet sits behind the spoiler switch, with the tech
  it needs (as in the game, a nomad sees it only with that tech researched); offers name what
  accepting needs — techs, and the arkship for Deep Scan and Stellar Ignition.
- Contracts: Where names the place of the work and the ships that do it (Raid Planet shows the
  system owner's colonies, a transport not taken yet where it goes).

### Changed

- Contracts: the nearest science ship, construction ship, fleet or arkship — whichever the work
  needs — instead of the nearest arkship; the Beyond column is gone, and the table fits beside the
  map.
- Bundles Node 26.13.1 (security release) and Python 3.14.10.

### Fixed

- Contacts: first contact stages counted one low ("Stage 2" where the game says "Stage 3").
- Diplomacy: a rivalry edge reads "rivalry", not "our rival" — the arrow in the tooltip gives the
  direction.
- Open tabs reconnecting while the dashboard restarted could make it throw an error.

## [0.1.30] - 2026-11-21

### Added

- Archive: a new tab for the Grand Archive — its three exhibitions (Aesthetic Wonders, Galactic
  History, Xeno Geology) with their 9 exhibits, which are active, the storage, and what the active
  specimens give, per exhibition and summed. Bonuses for only some empires (lithoid, gestalt, …)
  apply to yours or are marked when the save cannot tell. A cheat switch shows another empire's
  archive; empires you have not met stay unnamed. The tab stays greyed until you research
  Galactic Archivism.
- Archive: every specimen lists what it gives — modifiers and monthly resources — even when not
  active (in grey); its name is tinted by its rarity.
- Archive and trade: a bonus filter — one chip per kind of bonus (each resource, amenities,
  stability, leaders, research, pops, military, space fauna), always all of them, those no
  specimen here gives disabled.
- Trade: a spoiler switch lists, per exhibition side by side, the specimens each empire you can
  trade with would trade you, ≈ what one would cost in trade and whether they would at all, and
  which of yours each would pay most for, with what each specimen gives you. A cheat switch adds
  those no deal can get now, with the reason.
- Fallen hive fragments: the War, Growth and Control Splinter is shown beside each fragment's name
  on every tab that names empires and in the history, whatever the fragment is called.
- Companion mod 0.15.0 stores the Specimens Output bonuses, so the exhibitions' output is exact;
  without it, they count none (≈).

### Changed

- Bonuses on the archive and trade tabs: a bonus to a resource is labelled in that resource's
  colour; amenities, stability and leader bonuses have colours of their own.
- Trade: empires the game will not trade with (Fanatic Purifiers, Devouring Swarms, Determined
  Exterminators, scorched-earth Infernals) are left out, and fallen empires from the specimen
  lists — their trade screens have no specimens.

### Fixed

- Empire names: the three fragments of a shattered fallen hive all read "Indomitable" or
  "Forgotten" instead of "Indomitable Myrran Aggression" and so on; names made from a species
  take the game's ending ("Misharan Pact", not "Mishar Pact"); a separatist empire reads
  "Fellnoll Commune", not "Commune".
- Specimen trade, checked in the trade screen: an empire's opinion of you does not stop a
  specimen deal (it read "refuses" under 750); an attitude that trades nothing still takes a
  specimen as a gift ("gift only"); and an empty exhibition makes a specimen worth no more to an
  empire without a Grand Archive — prices were 1.5× too high there.

## [0.1.29] - 2026-11-21

### Added

- Contracts: which arkship carries the passengers of Diplomatic Support, Prisoner Disposal and the
  Sightseeing Tour — the game picks one at random when several are there and never shows which.
- Contracts: remote ones (research projects, no system, Join Wars) apart from those at a place;
  transports show their pickup and drop-off, and hovering one draws its route on the map.
- Map: a storms mode, after the game's Weather Forecast — every cosmic storm where it is, and with
  Cosmic Weather Models the systems ahead on its path with when it gets there.
- Frontier: L-Gate and Precursors panels from the situation log — L-Gate insights of 7, the
  L-Gates you know and what can still give insights; each precursor found with its artifacts and
  home system. An L-Gate badge marks the anomalies, projects and dig sites that lead there.
- Frontier: a Precursor badge on what leads to a precursor, which one on hover (a spoiler switch),
  and a cheat switch showing everything the save holds on precursors: which this galaxy has, their
  systems on the map (undiscovered ones too) and every empire collecting them.
- Frontier, situations: a Next column (when the next stage comes, up or down), each stage's
  threshold (Operational Reserves: Critical 0 · Low 1300 · Medium 6500 · High 19500), and the
  situations that never end (Operational Reserves, Passenger Satisfaction) pinned on top.
- Frontier, Still to gain: a "Leads to" filter (L-Gate, Precursor); resources in the header's
  order.
- Frontier: stations seen grouped by their likely empire, in shipset colours; anomalies, dig sites
  and projects fold, and a source's chip unfolds its panel before scrolling to it.

### Changed

- Frontier: situations' progress and monthly change to two decimals; a monthly change the save
  gives as 0 is measured between saves (≈). Stations seen hide an empire you talk to by the
  system's owner now.
- Maps: a natural wormhole counts as explored only with Wormhole Stabilization researched.
- A nomad's window title says Roaming, as its tab does.

### Fixed

- Dig sites: an excavated site showed "chapter 5 / 4" with a time estimate; other empires'
  excavations counted as ours.
- Contracts: an issuer named by a template showed "$1$ of $2$" (with the extractor's 0.1.22 data);
  prescripted species names read "Human $1$ Commonwealth".
- A situation a mod names by script (the Alarm Clock mod's reminders) showed no name.
- Explanation cards inside a paragraph rendered invalid HTML.

## [0.1.28] - 2026-11-19

### Added

- Upcoming: when a market price is back to normal after trading more than a month recovers (≈,
  fitted on real saves); the monthly swing of orders within the limit gives no row, orders beyond
  it a "keeps rising" one.
- Checks GitHub for a newer release at start and every 3 hours (⚙ Updates: the interval, 0 never
  checks); a newer one shows as a link next to the version in the tab bar. Release builds only.
- Frontier: tech rewards and research options say whether the tech is researched, already a
  permanent research option, or in your plan (also as a prerequisite of a planned tech). Outcomes
  get badges for the kinds of reward they hold: physics, society and engineering research,
  research options, resources, a fleet, a leader offered or granted, leader experience, traits
  and more. Still to gain lists research options on their own rows.

### Changed

- Trade: prices and gifts are coloured against the market — plain at the market price, orange to
  green the better (the best in bold), grey the worse. Gifts are coloured per empire, so each row
  shows which resource buys that empire the most, and count per 1,000 trade of each resource by
  default.
- Trade: a nomad's energy and minerals fade in the offer and gift tables (a nomad keeps them).
- Trade: the rates, prices and gifts are a spoiler switch now; other empires' stockpiles moved to
  a cheat switch of their own, switched on for profiles that had the old one.

## [0.1.27] - 2026-11-18

### Added

- Pacts to offer: every empire you talk to without a research agreement or commercial pact,
  ranked by what the pact brings a month in trade, greyed with the reason where the game would not
  allow it or the AI would refuse. The upkeep is the one your budget shows; acceptance is an upper
  bound until calibrated. Behind a spoiler switch.
- Edicts: what-ifs pay unity upkeep only beyond the Edict Fund — exact with companion mod 0.14.0,
  else a lower-bound estimate (≈).
- A back-to-top button on every tab.
- Contracts: per contract what to do (its projects, their days and what they need), the reward
  in resources and in trade, scaled by the contracts you completed, the opinion lost on failure,
  and how many jumps each of your arkships is from it. A Reward, Work and Nearest arkship column.
  Needs a data DB from this release.

### Fixed

- Nomads: traditions and perks show the nomad variant in popups, effects and their sums; no
  Mastery of Nature decision on an arkship.
- Contracts: page data no longer carries every contract in the galaxy, whose issuers you may not
  have met.
- Contracts: the tab is no longer greyed for a nomad that has only offers from empires it talks
  to — it counted only contracts you issued or took.

## [0.1.26] - 2026-11-17

### Added

- Planner: when each goal can be started and when it is built — the cost still to pay, at this
  month's net income (highlighted) and at the mean of the last months (a setting, default 6;
  one-time spending left out). The tooltip lists each resource needed with its stock and when it
  is there. A display switch times goals in plan order, paying the goals above first.
  Megastructure costs need a data DB from this release.
- Wanderlust: the map and the planner show each category's counted / needed targets, the ones
  found in visited systems and whether they would finish it; the map's right-click offers an
  arkship visit as a want, not only an avoid.
- Outcomes: months of income show what they come to now ("≈ +N now"); tech progress shows its
  research points and how long your own research would take.
- Frontier: a checkbox per panel hides what is gone from the save, newest first; a Status column
  marks a source ≈ finished where the save has a flag, modifier or deposit only it gives.
- Maps: square where the window has room, else as high as it allows. Drag the bottom edge past
  the window edge to grow a map at the end of a page in one drag.
- Settings: a default map fit (explored) and width; what the browser keeps for itself (width,
  dragged heights) is listed, each with a reset.

### Changed

- History shows only the empires you have met, as far as your intel goes (systems and colonies
  from intel 30, wars from 20), named as you know them. A spoiler switch shows everything about
  met empires; everything about all empires is a cheat now.
- Subject numbers are an intel spoiler. What each commercial pact brings is always shown; the
  pact switches only cover research partners' techs.

### Fixed

- First contacts were spoiled: stage names gave away the contact's kind (now its stage number),
  and pages and the contacts tab carried names, types and galaxy history before you talk.
- Empire names: name templates are filled in ("Pact of Fellnoll"), an empire never shows as an
  id ("unknown empire" instead), and a war keeps its save name only where every side is known.
  Names events give (e.g. "False Asteroid") are read with a data DB from this release.
- FirstContact-MeaningfulLabels contacts read "Voidworms (Space Fauna)", not "fc label fauna
  Voidworms".
- Planner: Arc Furnace, Stellar Cannon and Sentry Array goals never read as built.

## [0.1.25] - 2026-11-17

### Added

- Frontier: every level of an outcome folds on its own, with a short summary of what is inside.
  What your empire can never get (an option for another origin or civic, a branch your ethics rule
  out) is greyed, with the reason on hover, and left out of the markers and the summary; a dig
  site's done chapters are greyed. Needs a data DB from this release.
- Frontier: "Still to gain" — what the open anomalies, special projects and dig sites can still
  bring this empire, summed: for sure and expected, the resources' worth in trade. Each reward
  names its sources (coloured by kind, with how long each takes) and how certain it is (sure,
  likely, possible); techs, modifiers and traits open their popup. Tech progress shows the tech's
  tier, area, cost to you and what the progress is worth in research. Filters for sure / possible
  and for each kind of source (the sums follow them); hovering a source highlights everything it
  gives and its row further down, clicking it jumps there.
- Frontier: how long each open anomaly, special project and dig site takes — an anomaly by your
  best scientist's level, a ship's project its days, a research project ≈ its cost at your
  research in that field, a dig site ≈ the expected rolls of its remaining chapters.
- Frontier: stations of empires you have communications with are hidden from "Stations seen"
  (their territory is on the map); a switch shows them again.
- The window title names the tab: "Colonies - Empire Dashboard (Stellaris)".

### Changed

- The History and Diplomacy switches "beyond what you know" are spoilers now, not cheats: the
  game reveals both through intel and exploring. Still off in multiplayer and Ironman. Where
  spoilers are hidden and cheats shown, they now read as off until spoilers are shown.

## [0.1.24] - 2026-11-16

### Added

- Plan waystations on the roaming tab: a planned one moves from the sites into the waystations
  table (in italics, with its planned modules and what it would collect), shows ⚑ and light blue on
  the map, and its wayline dashed. Every "✓ planned" button has a ✕ beside it to take the plan out
  again, on every tab.
- The companion mod (0.13.0) also reads the research options the day after a tech is researched,
  when its field draws new cards — not only on the 2nd of the month.

### Fixed

- The roaming tab's "+ goal" and "+ wayline" buttons did not show.
- The home system counts as surveyed: its deposits show on the waylines tab (a nomad's starting
  system was missing there), on maps and in the planner's popups.

## [0.1.23] - 2026-11-16

### Added

- Nomads: the expansion tab is now **roaming** — where a waystation pays off (map and table:
  what its best modules would collect, for the 2 slots of a new waystation), which waylines it
  would extend or link, and whose space it is: another empire's without a Wayline Pact costs
  opinion and gives them a war goal. Plan a waystation, a module, or a whole wayline from ours in
  one click. Below: your waylines with each waystation's stockpile and what each wayline still
  lacks, and the Settle down panel as before. Each site's value in trade a month shows under its
  star; rate the sites for Waystation I, II or III (2, 4 or 6 slots) to find the best spots for
  later. A pre-FTL civilisation counts too: a Research Observatory there collects society
  research by your interference policy.
- The tech tab has a **tech tree** per field: each tech by where it stands (researched, being
  researched, on offer, within reach) and whether it is planned. Hover a tech for + want / − want;
  click it to see what it needs and leads to, or fade everything but the techs within reach, the
  wanted ones, or the clicked tech's path. Techs this empire can never get are left out.
- **− want** plans a tech for later: still wanted, not yet. While a tech planned for later — or
  one to avoid — is on offer, Upcoming says to pick another card.
- With the companion mod 0.13.0, the cards on offer are read on the 2nd of each month, so
  Upcoming and the tech tab show this month's cards without waiting for the next autosave.
- The planner has shortcuts for nomads: logistic ships, waystations, arkships (only nomads see
  them).
- The influence tab lists everywhere influence can go, at base cost: what this playthrough can
  never use is hidden (nomad or settled, origin, civics, authority), what is not available yet is
  greyed with the reason.
- The frontier tab keeps finished anomalies, dig sites, special projects and situations below each
  list, greyed, with the date last seen and their outcomes.

### Fixed

- A system with only a nomad's waystation no longer shows that nomad as its owner on maps and
  borders: waystations claim no space.
- Influence hints name the real conditions for a rival (a harm-relations envoy counts at once, an
  insult does not), and with influence storage full a nomad is pointed to waystations and arkship
  upgrades instead of claims and outposts.

## [0.1.22] - 2026-11-15

### Changed

- The situations tab is now **frontier**: situations and events are the game's terms for one of
  its panels each. Old links to `/situations` still work.
- Its tables use the width: first contacts, stations seen and situations on the left; anomalies,
  dig sites and special projects on the right; the first-contact map below them.
- A map that ends its page is as high as it is wide, or reaches the window's bottom where that is
  more: the frontier tab's, and every map in "wide + table". Heights dragged before are not
  taken over.
- The Resources strip shows strategic resources in the game's order — Volatile Motes, Exotic
  Gases, Rare Crystals — here and on the resources charts, and splits into two rows: basic and
  advanced resources, then strategic and rare resources, unity and influence.
- Colony what-ifs: the current designation shows what leaving it loses, one-time costs read
  "costs … once", and policy changes warn of their 10-year lock.

### Added

- What anomalies, special projects and dig sites actually give, behind the spoiler switches: the
  frontier tab's Outcome column shows markers (known, random, choice, depends, project, later,
  risk), the first rewards, and the whole chain on opening. The same text is the tooltip on the
  map tab, on the planner's anomaly and dig-site suggestions and on Upcoming's excavation rolls.
  Needs a data DB from stellaris-data-extraction with the `outcome` table; older ones show the
  event titles as before.
- A spoiler switch for dig sites' chapters; dig sites show their next chapter.
- Colony what-ifs for the crime decisions: the Anti-Crime Campaign frees the enforcers beyond
  those holding crime at 25 for open jobs (recommended where crime is 10 or more and jobs are
  open), Crime Lords costs the workforce of 3 criminal jobs per crime point. Whether a colony can
  take them (crime 10 or more, Introduce Chaos's flag) is read from the save.

### Fixed

- Designation what-ifs count pop-wide and stratum workforce bonuses (the nomad capital's +10 %,
  worker and simple drone bonuses): switching away no longer looks like a pure gain.
- Dig sites by their name ("Gas Giant Structure", not "star petal") on the frontier tab, the
  map, the planner and Upcoming.

## [0.1.21] - 2026-11-15

### Added

- Planner suggestions mark ascension perks and tradition trees, include Wanderlust, collapse
  duplicate ascension trees, and dim trees unavailable to the current empire. Planning a linked
  ascension perk also plans its tree.

## [0.1.20] - 2026-11-15

### Added

- All tab Recommendations panel (next to Upcoming, a What-ifs spoiler): worthwhile edict, policy,
  designation and planet decision changes, with their estimates. “Show all options, ranked” lists
  every estimate together for comparison.
- What-ifs (⚙, a spoiler) now count upkeep: Recycling Campaign shows the consumer goods it saves,
  not "1 effect not counted". Upkeep modifiers on pops, jobs, buildings, districts, ships,
  starbases, leaders, armies and edicts are read from what the budget books.
- Each what-if sets what you gain against what it costs: an edict's own upkeep and one-off cost,
  scaled by what the budget books for your active edicts, and the net in trade a month at the
  produce tab's values. The edicts table sorts by it.
- What-ifs on more tabs: switching a species' Living Standards (species tab), the traditions not
  yet picked, adopting another tree and the ascension perks open to you (traditions tab), and the
  tech cards on offer (tech tab).

## [0.1.19] - 2026-11-15

### Added

- The megastructures tab is dimmed until a megastructure is found or the tech for one is
  researched.
- The council marks which class holds a seat that takes several, such as the ruler's.

### Changed

- In "wide + table", a map reaches the window's bottom, like the table beside it. Each map
  remembers its height for that mode and for the others separately.

### Fixed

- With two or more dashboard tabs open, clicking a tab did nothing until one was closed.
- A map's chosen height is kept: leaving the full window or switching modes no longer overwrites it.
- Council agendas list modifiers that read alike once (Arkship Development showed each line three
  times).

## [0.1.18] - 2026-11-15

### Added

- The start window names the dashboard's version and the game version beside the address.

### Changed

- Pages load several times faster (about 0.05 s instead of 0.45 s on a history of 330 saves),
  the first one after the start too: the dashboard's database gets two indexes, and the start
  loads the first page once before the browser opens it.

### Security

- The dashboard answers only under a local name (`localhost`, an IP address, a `.local` or
  dot-less name): a website that points its own domain at your computer can no longer pass as the
  dashboard and read or change it.
- With `--lan`, other devices on your network can still look and change the view, but the game
  folders and deleting a game's history can only be changed on the computer the dashboard runs on.

### Fixed

- A save or month that could not be stored completely is no longer stored in part: merging a save
  into its month, and reading a save again, now happen in one step.
- A prescripted empire (United Nations of Earth, Commonwealth of Man, …) could show under its
  internal name ("EMPIRE DESIGN humans1") in contacts, diplomacy and the maps for the first save
  read after a start, and other empires' names could come from another game's mods. Saves still on
  disk are read again.
- An error while reading a game's saves again in the background can no longer stop the dashboard.
- Correcting a save's parent on the timeline refuses a save of another game.

## [0.1.17] - 2026-11-15

### Added

- A **bonuses** tab: what one more bonus is really worth at this point in the game. Bonuses of a
  kind add up, so +10 % on top of +50 % is only +6.7 %, and −10 % upkeep on top of −20 % saves
  12.5 %. For each kind it lists the bonuses that hold now; pick a typical value from the game
  data, or enter your own, to see the change in resources a month, pops or days. Covered: research
  speed and cost; job output per resource and job efficiency (its own pile, measured per job from
  the save, with the upkeep it adds); the output of stations, starbases and strata; upkeep and
  construction costs by category; empire size, with what it does to tech, tradition and agenda
  cost; tradition cost and naval capacity; pop growth and assembly; stability, happiness and
  amenities; and every build speed, council agendas included.

## [0.1.16] - 2026-11-14

### Fixed

- The header and every tab no longer blank out between the companion mod's monthly line and the
  next autosave: until that save arrives, the page shows the last save's empire (name, score,
  empire size, colonies …) with the new date and stockpile. Seen on a fast machine, where months
  pass between autosaves.
- Colonies named from a name list show their name ("San Lucas", "St. Pomeroy") instead of their
  key ("HUMAN1 PLANET SanLucas") in Upcoming, the colony pages and everywhere else (the bundled
  extractor 0.1.17 brings the names; saves still on disk are read again).
- Setup: the user folder's caption ("the one holding `save games`") no longer breaks over three
  lines.

## [0.1.15] - 2026-11-12

### Added

- District automation what-ifs (⚙ What-ifs, a spoiler): on the colony page, what the next
  Automation or Optimization Building for farmers, miners or technicians would do there — how much
  of the jobs' workforce it takes over (freeing pops for other jobs) or fills, the output that
  adds, and what it costs. Its monthly cost grows with the districts it automates: besides the
  building's upkeep, every automated job costs energy. The colonies tab ranks where one pays most.
  Needs the game data of extractor 0.1.16 for the automated jobs' cost.
  An automation building stands in a zone of its district: where that district has none yet, the
  line says to build the zone first (checked in game: 300 of 1200 farmer positions automated,
  open positions first, 12 + 8 energy a month).
  Each line shows what the automated workforce makes and what the pops it frees made in that job:
  automation gets every output multiplier but not job efficiency, so it makes a little less.
- The header shows the empire's total pops.
- Subjects tab: per subject its loyalty over time and where it is heading, when the deal can be
  renegotiated and what a proposal costs, the specialisation's progress with its perks, our holdings
  against the deal's limit, and what the subject does — its opinion of us, trust, wars and
  policies (fleet doctrine and the rest). A cheat adds its power, fleet, size and pops as numbers.
  Needs the game data of extractor 0.1.16 for the specialisations.

### Changed

- A single-player game no longer counts as multiplayer because its save names the Steam
  account: the native Linux build always writes it. Only a save with two or more players, or the
  companion mod's monthly line, means multiplayer now; readings stored before do not count, and
  campaigns that lost their cheats get them back once their saves are read again.
- Galaxy tab: settings that differ from the default for the galaxy's size are highlighted (the
  default in the hover), and the difficulty is coloured by its place, green for Civilian to red for
  Grand Admiral, with what it does in a popup; a folded table lists every difficulty's effects on
  us, the AI's empires and non-playable countries, and on tech costs per tier.
- Planet decision what-ifs read "lasts: …, costs: …", and "+N effects not counted" names what the
  estimate leaves out (in its hover).

### Fixed

- The Museum Exhibits, Organic Sanctuaries and Performance Competition decisions last 10 years, not
  "for good" (extractor 0.1.16).
- Long rows of resource amounts wrap instead of running out of their panel (the what-ifs).

## [0.1.14] - 2026-11-09

### Added

- Mods in the game data: each game's data is extracted with the mods of its latest save, in your
  launcher's load order, so designations, districts, tradition trees, traits and starbase slots
  that mods add are named and counted, and rebalance mods' values are used. Switching between
  games played with different playsets just works, and a playset edited or a game started with
  other mods is picked up while the dashboard runs — no restart; a banner shows while the data is
  being extracted. The mods tab shows which mods the data includes and where their order comes
  from.
- Starbase slots follow mods that enlarge starbases (such as Slightly Larger Starbases): the
  starbases tab counts each level's slots as the game does, from its ship size.
- The load order a game was played with is remembered while it runs, so editing the playset
  afterwards does not change that game's data.
- Older mods that come as a zip (such as Research options+) are part of the game data too.
- A new playset or a mod update extracts the game data about three times faster (45 mods: 34 s →
  10 s): the extractor keeps each file it has read, in `data/parse-cache`.

- A Contracts tab for Nomads contracts. A nomad sees the contracts it took and the offers of
  empires it talks to; a settled empire the contracts it issued. Each comes with its kind, issuer,
  who took it, system and days left to accept, and a map. Two new switches in ⚙: a spoiler
  (offers of empires you do not talk to as a nomad; other empires' contracts up to a picked range
  beyond your border as a settled empire) and a cheat (every contract in the galaxy). The map
  tab has a contracts layer, and the systems, situations, diplomacy and megastructures maps mark
  contracts too. Names and kinds need a data DB with the `contract` table (extractor 2026-11-07).

- The colony page shows its districts as cards in two rows: the city district with its government
  zone and, beside it, its further zones; below, the special districts (usually generator, mining
  and agriculture, those with none built yet too) — each with its icon, colour and count of its
  cap, its zones and their buildings as tiles (disabled ones struck through). The icons are
  our own, not the game's. A switch keeps the table view.

- A Starbases tab: every starbase with its level, modules, buildings, free slots, build queue
  and shipyard queue, filtered to all, shipyards or those without, outposts on request, plus the
  starbase capacity and the shipyards panel. Its starbase planner ranks, per module and building,
  the systems (yours, and unclaimed ones up to a picked range beyond your border) where it does
  most: station output bonuses by the system's orbital deposits, the Transit Hub's resettlement
  bonus by how many pops the system's colonies can push out, stability and governing ethics by
  the colonies there — and what has to happen first (an outpost, an upgrade, a free slot). It
  needs game data with starbase modifiers (extractor 2026-11-09).

- A Fleets tab: your military fleets with the designs their ships are built to, and every ship
  warship and bio-ship design — saved, saved but unused, or **unofficial** (ships still built to a design you no
  longer have saved). A design shows its sections and components, the fleets using it, the design
  its ships upgrade to, and base stats (hull, armor, shields, evasion, speed, power, cost, upkeep,
  weapons) before empire modifiers. The stats need game data with ship parts (extractor
  2026-11-09).

## [0.1.13] - 2026-11-07

### Added

- Every map marks the stars that change a fight in their system: pulsars (shields disabled),
  neutron stars (sublight speed −50 %), black holes (harder to disengage and to jump away), the
  X-ray binaries with one of them and the Viridescent Lightbringer (armor disabled). Each has its
  own icon, its effects on hover, and the legend under the map explains them.
- The Traditions tab shows each tree in its colour from the game: a stripe beside each adopted
  tree, a dot before each of the others. The planner tab's tradition goals carry it too, as a
  stripe on their adopt / pick / finisher badge.
- A Slave Market tab: what is for sale now (species, pops, seller) and what was offered before,
  with the date it was gone. With the companion mod 0.12.0 it also lists every sale — species,
  pops, buyer and seller — and names the buyer of each ended offer; in multiplayer and Ironman only
  the sales we take part in. An empire that allows slavery always sees the tab; for one that does
  not, ⚙ → Display decides: only while a species we give full citizenship is for sale (default),
  always, or never.
- Each colony page lists its pops by species, with their citizenship (and slavery type for slaves)
  and habitability; its Pops (jobs) chart gains an "enslaved" line where there are slaves — they
  work ordinary jobs, so "employed" includes them.

### Changed

- A chart's right-hand axis is named beside it (open jobs, pops per month, …).

### Fixed

- Species rights of every species but the founder were not read (the government, ethics and
  leaders tabs saw none for them).

## [0.1.12] - 2026-11-06

### Fixed

- Popups are no longer cut off at the edge of a scrolling panel (Upcoming, wide tables): they open
  above the page, below the name or above it where there is more room.

### Added

- Upcoming tells you when a tech you planned (or one it needs) is among the research cards on
  offer — the game does not. The row stays until you pick it or dismiss it.
- A tech's popup shows what the game's research card does: tier, cost, what it needs and leads
  to, its effects and what it unlocks (buildings, districts, components, ship types, features) —
  the same card as in the empire planner — everywhere a tech is named: the planner tab and its
  history, events, ethics sources, blocker hints, edicts, research agreements, shipyards.
- The tech tab shows the progress a tech keeps when you switch research away from it: on its card
  (↺) and in a list of every tech holding some. The game keeps the points, but not the card — the
  next draw may not offer it again.
- A release's title names the game version it was built for: "Stellaris Empire Dashboard 0.1.12
  (v4.5.3)".

## [0.1.11] - 2026-11-06

### Added

- The planner offers tech shortcuts: bundles of techs worth having in nearly every game (the
  resource districts' zone slots, the research buildings, habitats, the largest hull of your
  shipset, Mega-Engineering, …), each added with one click, its prerequisites following by itself.
- Ironman games are recognised (from the save's galaxy settings) and get the same treatment as
  multiplayer: the cheats are off for good once any save of the game is Ironman.
- In multiplayer and Ironman games the spoilers that reveal other empires or space you have not
  explored are off too: the whole galaxy, every system surveyed, every wormhole pair, every L-Gate,
  station owners before communications, and pact intel. Spoilers about the game's own content
  (anomalies, special projects, event timers, what-ifs) stay available.
- An influence tab: this month's influence by source, the sources over time, what was spent
  outside the budget (claims, outposts, decisions) and what goes uncollected — power projection
  below its maximum (with the naval capacity still to fill: full coverage needs used naval
  capacity × 2 ≥ empire size), empty rival slots, and income lost at the storage cap.
- A pacts tab: each pact type with its partners and upkeep. Migration treaties: our main species
  in each partner's empire and theirs in ours, over time. Commercial pacts: what they bring in
  trade (10 % of each partner's trade production). Research agreements: the +25 % research speed
  on a tech the partner has, added to the speed you already research at (measured from your saves
  and shown), so it is worth less the more bonuses you have — this month's extra research, and with
  ⚙'s pacts intel spoiler each partner's techs per area against ours. The pacts cheat adds which techs each partner has, what
  each commercial pact brings, and which tech to pick to gain most.
- The tech tab shows your research bonuses and how they stack, per area: speed, output and cost,
  each with its sources (traditions, ethics, techs, policies, the council and its councilors'
  traits, situation stages, …). Bonuses of one kind add up, so each one more is worth less — the
  tab says what one more +10 % is really worth, and what a research agreement adds. Your actual
  speed is measured from your saves and checked against the sum of the sources.
- The pacts tab lists our species living in other empires — also after a migration treaty has
  ended — with the change since they first showed up there.
- The jobs tab shows, per colony and resource, the job output bonuses and how they stack: the
  workforce's base output, the bonuses counted from the game files (empire, colony, governor,
  species, difficulty), the rest the colony got on top (stability, happiness), and what one more
  +10 % is really worth there.

### Changed

- The zips bring Node 26 (the current LTS) instead of 24. Same requirements: Windows 10, macOS
  13.5 or newer.

### Fixed

- The planner loads again for a campaign with a large galaxy that is neither Ironman nor
  multiplayer: a nomad empire's planner never finished loading, and the map and every other tab
  got faster too.
- The colonies tab, the colony tab and the empire panel show your colonies again while months
  pass without autosaves (`fast_forward`, or autosaves off with the companion mod on); they read
  "No colony matches" before.
- Councilors in an oligarchic empire act two levels higher (the authority's +2), as in game; the
  council's effects were shown two levels too low.

## [0.1.10] - 2026-11-04

### Added

- A Discord icon in the header, before the version: bugs and feedback go to the dashboard's
  forum on the Mirko's paradox Discord.

## [0.1.9] - 2026-11-04

### Added

- Multiplayer games switch every cheat off: ⚙ says so and lists none. The dashboard recognises one
  by its saves; companion mod 0.11.0 also reports it each month.
- Pops charts show last month's change on a second axis: growth, assembly, migration (refugees
  arrive as immigration) and other causes. On the all tab migration between your own colonies
  cancels out, which leaves what came from or went to other empires. Each is drawn as the mean of
  the months around it, with the month itself (whole pops, as the game books them) faint behind
  it: the game turns a fractional rate into a chance of one more pop, so a single month jumps by
  up to one. ⚙ → Pops charts sets the months: 3 before and 2 after by default, up to 6 each way.
  The game's first day counts as no month booked yet, no longer as a drop to zero.
- What colony deficits cost: a colony that uses more of a resource than it makes is supplied by
  the rest of the empire, and the game charges trade for it (energy, minerals and food 0.125 a
  unit, consumer goods 0.25, alloys 0.5; the capital's shortfall less the empire's base income).
  The colonies tab has a "Deficit" column and the empire's total against what the budget booked;
  each colony page a "Supplied from elsewhere" panel that weighs the fee against making it there
  instead — building, upkeep and what the workers make now, less what it would make.
- What-ifs (⚙ → What-ifs, a spoiler, off by default): what an edict would do if enacted now (or
  an active one if cancelled), what switching a policy would do, and on each colony page what
  another designation or a planet decision would do — output a month and stability, with what the
  estimate does not count named. Distribute Luxury Goods' estimate is now behind the same switch.
- Growth tab: the Pops chart below the projection.
- Colony tab: a Pops chart for the colony, with its monthly change, after Stability; the chart of
  employed pops, civilians and open jobs is now "Pops (jobs)".
- Map tab: map modes, after the game's own. They colour the borders by union, by our diplomatic
  relation in the game's order, by their opinion of us, intel or AI attitude, and by trust, threat
  and how fresh our intel is. A claims mode fills the systems we claim and our systems others
  claim. A mode shows only what our intel shows, as the diplomacy tab does. Empires we have no
  communications with stay grey, and a reading our intel no longer confirms is dashed.
- Every map: "full window" lays the map over the whole browser window, with its toolbar, the map
  tab's modes and layers, and the table beside it if you pick "wide + table". Esc goes back.

### Changed

- Bundles the extractor v0.1.11, which reads Stellaris 4.5.3: ambitions, planet decisions and
  the deficit fee per resource, for the deficit and what-if features above.

### Fixed

- Megastructure sites rule out every multiple star system, as the game does: 4.5.3's new
  quaternary stars and the crisis binary/trinary variants were offered for a Dyson Sphere, Ring
  World and the like.

## [0.1.8] - 2026-11-01

### Changed

- Bundles the extractor v0.1.10: branch offices and holdings (what they need, what they give), and
  28 names and descriptions that were empty before, among them the Shroud's Psi Corps tradition,
  the arkship techs and nine starbase modules.

### Added

- Maps: rings around the galactic core — just inside the innermost system, just outside the
  outermost, and evenly spaced ones between (by galaxy size, or how many you pick) — and a cross
  dividing the galaxy into 4, 8 or 16 sectors named by compass direction (NE, SE, SW, NW, or turned
  by half a sector: N, E, S, W), reaching a little past the galaxy and fading out. On by default
  (a large galaxy: 2 rings between; 8 sectors, N, NE, E …); ⚙ → "Map rings and quadrants". Inspired by the mod Quadrant
  Fixed.
- Galaxy tab: the settings the galaxy was created with, grouped as on the game's setup screen.
  Inspired by the mod In-Game Settings View. Saves still on disk are read again once.
- A tab with nothing to show yet has its name dimmed, and its tooltip says why (migration, trade
  deals, galcom, shroud, diplomacy, situations). It stays a link.
- History tab: the galaxy's known history since 2200 — a map of who held which system at the
  month picked, and the events up to it (colonies, systems claimed or taken, communications,
  guardians slain, wars), the events beside the map with "wide + table". You know your own history, all of an empire's once you talk to it — back
  to the start —, whoever held a system you have been to, and guardians' falls. A cheat in ⚙ shows
  everything. Saves still on disk are read again once.
- Subjects tab: your subject agreements, the branch offices and holdings you own or that sit on
  your colonies, and for a MegaCorp a branch office planner — every colony ranked by the trade an
  office would bring per influence it costs (≈). Inspired by the mod Branch Office Expansion
  Planner.
- ⚙ is organised like a browser's settings: groups, a section list and a search. Spoiler and cheat
  settings are listed only once shown, and hidden ones are off — each comes back as it was.
- About tab: thanks to the mods, projects and libraries this dashboard learned from or builds on.
- Wide maps: every galaxy map has a `width` switch — `wide` uses the browser window's full
  width, `wide + table` puts the map's table beside it (map tab: Found; systems; megastructures;
  first contacts). One choice for all maps, remembered in this browser.
- Upcoming: what sits idle stays listed until it is busy again or dismissed (✕) — a research
  field without a tech, no council agenda in preparation, a colony or shipyard with nothing in its
  queue, a leader without a post, an empty council seat, free leader slots, idle civilian ships.
  Dismissing hides that idle spell only; idling again later shows it again.
- Map and systems tabs: our ships on the map (all, fleets or civilian; stored in the profile), a
  fit "my stations and ships", and for nomads "my waystations" in place of "my empire".
- Colony page: what "Distribute Luxury Goods" would bring if enacted now — its Consumer Goods,
  then amenities → happiness → stability → job output, a month and over its 10 years (≈); job
  upkeep stays the same. While it runs, until when.
- Mods tab: the launcher's load order (`#`, the default sort), as of the last game start, and each
  mod's age since its last workshop update.
- Nomads: your arkships on the map, systems and migration maps (the capital ringed), with a fit
  "my arkships".
- Migration: a circle view — your arkships clockwise, oldest first, by size or by name — and your
  arkships' own migration. A nomad without migration partners now gets a map too.
- Expansion tab for nomads: **Settle down** — what settling still needs (Adaptability or
  Versatility finished, origin quests), where an arkship could settle (habitability now and with
  Arkship Remains, jumps from your arkships) and what each of the game's outcomes would do with
  your numbers. For a nomad the tab is called "settle", dimmed until settling is possible. A
  settled empire gets an **Embark** checklist instead.

### Fixed

- The maps' "capital" button went to a nomad's old home star instead of the capital arkship, and
  was greyed out on the systems tab; distances from the capital (expansion) were off for nomads
  the same way. Saves still on disk are read again once.
- The all tab's Leaders panel shows each class's limit with what raises it (techs such as
  Colonial Centralization, traditions, civics, …), not always 3.
- Ships are named as in game: a nomad's "Logistic Ship" no longer shows as a constructor, the
  construction ship as "Construction Ship". Saves still on disk are read again once.
- A nomad's arkship is no longer listed as an idle shipyard of its own beside its colony: it
  builds ships through the colony's shared build queue, so the colony's entry covers both. It is
  also placed on the map where it is.
- Mods tab: a mod installed twice — a local copy and its Workshop subscription — is active only
  where the launcher loaded it, not both.
- Companion mod 0.10.1: a colony's daily jobs and pops lines are no longer empty (0.9.0–0.10.0
  read `num_sapient_pops`, which is no trigger; now `pop_amount`).
- Companion mod 0.10.1: a new colony is logged for a nomad arkship too (since 0.2.0 the event
  failed on every colony whose carrier is a ship).

## [0.1.7] - 2026-10-31

### Added

- Planner tab, right after `all`: goals for your playthrough — systems to survey, outposts,
  colonies (planets, habitats, ring segments), starbase upgrades, modules and buildings, districts
  and buildings per colony, megastructures, techs, traditions, ascension perks, focus cards,
  anomalies, dig sites, situations, first contacts, Wanderlust categories (and systems your
  arkship should stay out of), civics, ethics and government types, plus free-text goals. Add,
  remove, reorder (drag or ▲▼), park, note; every change is kept in a history. Each goal is
  checked against your latest save: done goals tick themselves off with their date, one that is
  no longer possible is flagged (and counted on the tab), and a goal you want to avoid turns red
  once it happens. The plan follows your save graph: loading an older save starts a branch with
  its own plan, and goals from other branches can be copied over.
- "+ goal" buttons on the tech, traditions, colony, expansion, megastructures and situations tabs;
  a right-click on a system on the map lists the goals that fit it, and the map's new "planned
  goals" layer shows where your goals are.
- The planner picks up what you already did: every tradition of an adopted tree (taken ones as
  done, with their date; the rest as the tree's remaining picks) and every ascension perk taken.
- Nomads: no outposts; waystations and arkships (civilian, science, military) to plan instead.
- Popups in the planner: what a tech, a tradition, a Wanderlust category's reward or a focus card
  gives, and for an outpost or waystation what the system holds — station deposits (per
  waystation module), a pre-FTL civilisation to observe, colonizable planets. Potential goals
  start folded.
- Planning a tech plans what it needs: every prerequisite not researched yet, down the whole chain
  (of "either … or" prerequisites the one your empire can get), and the tier gates ("6
  Engineering techs of tier 4"). Remove the tech and they go with it.
- Traditions are named with their tree, perks are marked; a perk you plan or took suggests the
  tradition tree it opens (The Flesh is Weak → Cybernetics).
- Nomads: no settling either — colony goals are left out like outposts. The suggestions' buttons
  sit at the left of each row.

- Planner order follows the game: traditions as you picked them, a pick after the ones it needs,
  a tree's finisher last; techs after what they need and tier gates in order. Your own order
  still decides wherever the rules leave a choice.
- Planning a tradition tree's adoption plans the whole tree; planning one pick plans the adoption
  and the picks it needs.

- Planner badges: a tech's tier and research area (in the game's colours, with a filter per area),
  a tradition's place in its tree (adopt, pick, finisher), perks — in the plan, the suggestions and
  the history, which hides reorderings unless you ask for them.
- Research goals go as early as they can: tier by tier, a tech before the tier gate it counts
  towards.
- Removing a goal asks whether the requirements it brought, and nothing else needs, go too — or
  stay as goals of their own.
- A perk whose conditions do not hold yet can still be planned, with a warning (The Flesh is
  Weak: two perks taken first).

- Focus in the planner: tasks show the area they give points to and how many; the rewards are
  goals of their own, one per Empire Progression tier ("Conquest tier 4: Improved Weaver
  Development"), with the points still needed and each area's next tiers suggested.

- Focus tab: each category unfolds to every tier of its Empire Progression — unlocked, current,
  or how many points are still to go — with a button to plan any of them.

### Fixed

- A bio-ship empire (Biogenesis shipsets) was planned the classic hulls — Corvettes up to
  Battleships — for techs that take either; it now gets Harbingers and Stingers. Tech within
  reach, focus rewards and the other tabs that check a tech's conditions know the ship kind too.
- Fast clicks on ▲▼ in the planner could scramble a group's order; one change now runs at a time,
  and ▲▼ step past the next goal shown.
- The game data is extracted again whenever the bundled extractor's code changes, not only its
  version number.
- Techs whose prerequisites include "one of" choices (Mega-Engineering and 16 others) were listed
  as within reach too early: their prerequisites were missing from the game data.

## [0.1.6] - 2026-10-31

### Changed

- Bundles the extractor v0.1.6: it records which Steam branch the game it reads is on (`public`
  or a beta), and its own release data is checked to be the public game's. What the dashboard
  extracts from your game is unchanged.
- The release notes name the game version a build was made for.
- Dependencies updated (SvelteKit 3.1, Vite 8.3.5, Svelte 5.57.3, …).

## [0.1.5] - 2026-10-31

### Added

- Map tab: the table shows each find's difficulty (first contacts, dig sites, anomalies by their
  level), when it was first seen and how many months ago — first contacts by their own date,
  anomalies and dig sites by the first save listing them, wormholes, gateways, L-Gates and
  megastructures by the first visit of their system.
- System entry events: the popups entering a system shows — guardians (Bir's "Crystalline
  Asteroids"), ruined megastructures, abandoned gateways, Helito's "Missing Orbitals", … — on the
  map (layer "system entry events") and the events tab ("Bir: Crystalline Asteroids"), matched by
  the system's star flags; a popup that shows once per empire (the first abandoned gateway) only
  where it did. With **companion mod 0.10.0** dated to the day of entry. Saves still on disk are
  read again once.
- Companion mod 0.10.0: each first entry of our ships into a system (a log line older dashboards
  skip).
- Colony page, while a colony sits at the stability cap of 100: a panel beside "Amenities,
  happiness and stability" with how far above the cap the game's sum is, how much approval and
  how many amenities could go before stability drops below 100, and what holds each up on the
  colony and empire-wide — how to change it and what else giving it up costs. The Stability chart
  draws "over 100" on its right axis. How far above the cap needs **companion mod 0.8.0** (the
  game saves stability capped); without it the panel gives the rates.
- Colony page: with **companion mod 0.9.0** the Pops chart shows employed, civilians and open
  jobs on each day they changed, not only at the monthly save — a building finished mid-month and
  its jobs filling up — and its title the latest day while the game runs.
- Companion mod 0.9.0: a colony's open jobs, unemployed pops and pops, logged on the day one
  changes (an event line older dashboards skip).
- Companion mod 0.8.0: each colony's flat stability and stability multiplier, stored in the save
  every month (no new log line). Saves still on disk are read again once.
- Stellaris open betas: the game data is extracted per game **build**, not per version — an open
  beta (4.5.3, build 7793) and the release after it share their version, and the release would
  have kept the beta's data. Every player's dashboard extracts once more after this update (~5 s).
- The footer names the game version and build the game data was read from (`game 4.5.3 (7793)`).
- At the right end of the tab bar: the game's **last save** and **last data** — a save, the companion
  mod's month or its daily tick, whichever came last — so it shows whether the dashboard keeps up.
- The recruitable leaders: Upcoming shows when the game replaces them (5 years after the pool
  was filled; estimated, as an event may do it early), and the history marks each refresh on the
  day it happened (event kind "recruitable leaders refreshed"). Saves still on disk are read
  again for it once.
- Leaders tab: what each leader holds — the rule, a council seat, a colony, a fleet or the science
  ship it leads, several at once — with the level it acts at there (a councilor with the
  country's councilor bonus), and what each role gives now (a seat's modifiers at that level, the
  traits' in that role, and what they do to the leader itself) — and, dimmed, every other role its
  class can hold and what it would do there (scientists: council, science ship; commanders:
  council, fleet, army; officials: council, governor, Galactic Community and federation
  delegate); the ruler first, then by level (ties: officials, scientists, commanders); per class
  how many are hired of its (soft) limit, and a filter to show only some classes; and the
  recruitable leaders in a table of their own, with their age and how many of each class.
- Leaders tab: a badge for each role (ruler, council, governor, science ship, fleet, army,
  delegates, home colony, itself) beside every role, and beside each trait for every role it
  acts in; each leader's unity upkeep (read back from the budget, so every modifier counts), and
  the recruitable leaders' recruitment cost and upkeep.
- Traits that depend on a synthetic empire or on food (`is_individual_machine`,
  `country_uses_food`) are decided from the founder species and the food expenses, no longer
  "may apply" (Fertility Preacher).
- Leaders tab: the traits' conditional effects (Righteous's −25 crime as governor, the
  Expertise traits' research with Technocracy …), each where its condition holds — by the leader
  (ruler, class) and the empire (gestalt, nomadic, civics); one the save cannot answer is shown
  as "may apply". What a trait does on the leader's home colony, whatever its role. A governor's
  home-planet bonus applies only on its home: elsewhere it is marked wasted. Seats' and classes'
  effects name the level they are at, "(Ruler × 3)"; officials' delegate effects per level.
- Leaders tab: what each class gives per skill level in each role (the game's "Per Level"
  tooltip: as governor of a planet, a sector, its home planet; commanding a fleet or an army; on
  a science ship), in a table and in each leader's roles at its level — commanders and scientists
  can govern too; each bonus names its source in brackets.
- Upcoming: when each leader reaches its next level, at the experience it gained since an earlier
  save.
- The game's difficulty in the tab bar, before the dates: "Admiral (6/7)".
- Wanderlust (the nomads' perk): the events tab and the charts mark each system an arkship
  counts, a category done and all of them; the map gets a Wanderlust layer — the target systems
  you have visited, with whether the arkship has counted them yet, and above the map each
  category's progress (seen / needed). A new spoiler setting marks every target, visited or not.
- Ethics tab: "From Council" counts the ruler and councilors with the ethic from the save
  (+0.1 each), so the empire-wide factor is known in full where it was "+0.2 from 4 rules the
  save cannot tell".

### Fixed

- "Show it now" (a save loaded in game) stays on the page you are on — a colony, a custom tab,
  settings, the timeline — with its other query parameters; it took some pages back to `all`.
  Going back to following the game keeps them too.
- Fleets named from the game's name lists show their name ("Maelstrom Fleet"), not their key
  ("NECROID1 FLEET MaelstromFleet"); armies too. Needs extractor 0.1.5.
- Research due dates (Upcoming, tech tab) ignored the difficulty: the galaxy setting
  "Difficulty Adjusted Technology Costs" raises tech costs by the difficulty and the tier — 1875
  for a 1500 tier-1 tech on Admiral, where the dashboard said 1575 and so months too early.
- Ethics tab, an ethic's own rules: 4.5.3 adds most of them onto a base of 1 instead of
  multiplying (`+1` for the ethic itself, `−0.25` for a democracy); they show as such, and the
  known part of the empire-wide factor adds them in the game's order. Needs extractor 0.1.5.
- A nomad's Operational Reserves in the Stockpile charts dropped to 0 on each day of the
  companion mod's tick (it logs energy and minerals, not the reserves); those days are a gap the
  line bridges now — as is any resource a tick does not log.

## [0.1.4] - 2026-10-31

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
- The ethics table shows the game's Average Ethic Attraction beside its share, cut as the game
  does; the reasons the game lists (council, governor, living standards, jobs) are now told from
  the save, matching the game's tooltips.
- Every attraction source says how to get it — the traditions, perks, techs, civic or policy it
  needs, which leaders have a trait — with popups; what this empire can never have is hidden, so
  the nomads' variants no longer show twice. An agenda shows as one row, while preparing and after
  launch.
- The timeline numbers each game's saves on its own (#1, #2, …) instead of counting across all
  games. Existing histories are renumbered once at the first start (a copy of the database is
  left beside it); links keep working.
- Each colony page explains its amenities, happiness and stability: what they do now, how many
  amenities are missing, how many more would still help and how many are wasted beyond twice the
  need (the scaling between the game's ends assumed, marked ≈).
- Civics that unlock a source show the authority they need (the three Memorialist civics), the ones
  this empire cannot take greyed.
- Disabled buildings count for nothing where the dashboard works out effects (district limits,
  ethic attraction, the market fee) and are struck through in a colony's districts.
- The server log names saves by their number in their game ("#17 of …").
- Buildings explain themselves on hover everywhere: cost, upkeep, output, jobs, modifiers and the
  civics that unlock them.

### Changed

- Saves are read again (READER 25) for the ethics and situation stages; the ethics history starts with the saves still
  on disk. The bundled extractor needs `ethic.sort_order`.

### Fixed

- A nomad's arkship shows as a colony everywhere: the colonies tab, its colony page (the colony
  tab opens on it), the events filter, growth, trade-offs, job efficiency and the `all` tab's
  link. Its districts count towards empire size.
- The estimated empire size under 50 counts what the game does per colony — its ascension tier
  and its governor's skill — and a nomad's +100 % from colonies and districts; it matches the
  game's own breakdown.

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
