# Tabs: galaxy, fleets, systems and diplomacy

Galaxy, subjects, history, map rings and quadrants, fleets, starbases, systems, system entry events, megastructures, pacts, diplomacy, DLCs and mods. Read before working on one of them. _Moved verbatim from `AGENTS.md` on 2026-11-14._

**Galaxy tab** (`/galaxy`, `#lib/galaxySetup.ts` pure; the user's ask 2026-11-01, after the mod
In-Game Settings View): the save's whole `galaxy` block (`Snapshot.galaxySetup`, READER 42; the
cost sliders and difficulty read from it as before), grouped as the setup screen's categories
(4.5.x `common/gamesetup_settings/gamesetup_settings.txt`: Gameplay, Galaxy, Empires, Precursors,
Game Length, DLC), keys we do not know under "Other". The save's keys differ from the setup
screen's tokens (`template` = galaxy_size, `shape`, `habitability` = colonizable_planet_odds,
`primitive` = primitive_odds, `logistic_ceiling_v2`); labels are the localisation's where it has
one (`NUM_HYPERLANES` "Hyperlane Density"), else ours — the dashboard is English only. Disabled
precursors are named from the data DB's `precursor` (empty without the table). Years are after
2200 (`mid_game_start=100` → 2300). Not yet compared with the game's own setup screen. **What
differs from the default is highlighted** (the user's ask 2026-11-12; `defaultOf()`, the default in
the row's hover): per galaxy size from `map/setup_scenarios/<size>.txt` (data DB `setup_scenario`:
empire counts, wormholes, gateways, hyperlanes, planet odds, crisis strength), else the `*_DEFAULT`
define (game length, cost and capacity sliders, growth, logistics, storms — their caps per size —,
voidworms, cutholoids, fallen empires), else the engine's (`ENGINE_DEFAULT`: difficulty Ensign,
crisis "any", AI aggressiveness normal, … — **assumed**, said in the hover); `resource_abundance`
gets none (its define is a slider step: 2 of 0–5, the save holds 1). Checked on UNE 6 (medium):
only the 3 nomad empires (default 2) stand out. **Difficulty** (the same ask): the row coloured by
its place — Civilian green, Cadet plain, Ensign yellow on to Grand Admiral red (the user's
colours) — with a popup of what it does, and a folded table of all seven: the static modifiers
`difficulty_<d>_player` (ours, Civilian and Cadet), `difficulty_<d>` (the AI's regular empires,
Captain up; not players' subjects) and `difficulty_<d>_npc` (non-playable countries, from Ensign),
and a tech's extra cost a tier at this game's scaling (`techCostFactor()`; traditions have no
tiers — how the setting scales them is not known).

**Subjects tab** (`/subjects`; the user's ask 2026-11-01: "subjects and branch offices: an
overview"): the subject agreement cards (`SubjectCards.svelte`, shared with the contacts tab), and
per subject (`SubjectDetails.svelte`, `#lib/subjects.ts` pure; the user's ask 2026-11-12, with
`stellaris-mod-VassalOrders` in mind): loyalty over time with its trend and the share from opinion
(× 0.01, `SUBJECT_MONTHLY_LOYALTY_OPINION_MULTIPLIER`), when the deal can be renegotiated
(`date_changed` + `AGREEMENT_CHANGE_COOLDOWN_MONTHS` 60; a deal never changed is open at once
without `has_cooldown_on_first_renegotiation` — **assumed**, not seen in game) and what a proposal
costs, the specialisation's level, XP and months to the next (XP = loyalty × 0.1 a month) with its
perks as popups (data DB `specialist_*`, extractor 0.1.16), our holdings against the
`subject_holdings_limit_N` term, and what the subject does — opinion of us, trust, wars, breach of
a resolution, every policy (fleet doctrine …) from its own country block (`Subject.stance`, READER
55). Its numbers (`Subject.power`: military, economy, tech power, fleet, naval use, size, pops,
colonies, rank) only with the `subjectNumbers` spoiler (a cheat until 2026-11-17; `intel`) — the game shows Inferior / Equivalent /
Superior. Checked 2026-11-12 on a DB copy (UNE 6, Silicron 2208.02.01: loyalty 92.8, +3.9 a month,
+3.7 from opinion 366, renegotiation open since 2205.11.01, holdings 0 / 1, 26 policies named); UNE 6
counts as multiplayer, so the cheat stays off there (the guard). The
branch offices and holdings we own and those on our colonies (`Snapshot.external`, READER 43:
`colony.<id>.externally_owned_buildings`, see `docs/save-format.md`), and for a MegaCorp the
**branch office planner** (`#lib/branchOffices.ts` pure; after the mod Branch Office Expansion
Planner): every regular empire's colony with trade (`Snapshot.branchSites`, jumps from our
capital), ranked by trade a month per 100 influence — an office's income 0.5 × the colony's trade
(`BRANCH_OFFICE_INCOME_SCALE`), its cost 75 influence + 5 a jump, at most 1000
(`BRANCH_OFFICE_INFLUENCE_COST_*`), +5 empire size each (4.5.2 defines). **Estimated (≈)**: the
jumps' origin is a guess (our capital), value modifiers and the office's buildings are left out;
the one office in our saves (an AI's on a nomad's arkship, Planetforgers 2214.02.01) booked 59.48
trade on a colony making 112.24 — 6 % above 0.5 ×. By default only colonies an office can open on
now: a commercial pact with the owner (`Relation.agreements`), no office there. **No save of ours
has a MegaCorp player**: the planner and our own offices are checked by unit tests only.

**History tab** (`/history`, `#lib/history.ts` pure; the user's ask 2026-11-01: "the known history
of the galaxy since 2200", the migration tab's slider — now `FrameSlider.svelte`, both tabs): a
map coloured by system owner at the month picked and the events up to it (colonies founded,
systems claimed, taken or lost, communications opened, guardians slain, wars). Each save carries
`Snapshot.history` (READER 43, ~5 KB: `historyReading()` in `server/world.ts` — every system's
station owner, every planet colony with its `colonize_date` and system, the guardian kill flags,
names); `knownHistory()` diffs them along the branch. **What we know is decided at the branch's
latest save and applied to the whole past** (the user's rules; 2026-11-17: "only what I know
about empires, depending on my own intel, and only for empires I met"): our own history; of an
empire we met (a relation), its systems from military intel 1 ("Location of Starbases") and its
colonies from economy intel 1 ("Low Intel on Colonies") — both intel 30, the two categories' levels
being equal at every value (`common/intel_levels`) —, its wars from diplomacy intel 1 (intel 20);
of an empire not met nothing (it is "an unknown empire" where it takes a system from one we know),
named as we know them (relations: the pre-communications name until we talk; the save's own names
only with the cheat — a real name in the page data spoiled first contacts); guardians' falls
(common knowledge — the flags `killed_guardian`, `horror_killed`, `killed_wraith`,
`tiyanki_killed`, `killed_hatchling`, global `toxic_god_killed`, `guardians_zanaam_destroyed`:
**none seen in a save yet**), wars with a side we know (named by the save only where we know every side: its name is made of
theirs); not
others' discoveries nor battles we did not fight. Before the first save read only colonies are
known (by `colonize_date`; before 2200 — homeworlds, pre-FTLs at "2016.05.09" — read as
2200.01.01), and a system whose colony predates that save counts as its owner's since then. A
change between two saves is dated "≤" the later one. The `historyMet` spoiler shows everything about the empires we met, the `historyAll` cheat everything about every empire by its own name (both `intel`: off in multiplayer and Ironman; the user's split, 2026-11-17).
Checked 2026-11-01 on a DB copy (Roaming Korinth, 2207.02): known now us, Vivisandia Vestige and
Skull Clan — 10 colonies, 9 claims, 2 communications; with the spoiler 80 and 100. **Open:** when a
guardian was first discovered (the user's ask) is not read — its system is not tied to the flag;
arkship colonies (nomads') are not in the reading, which reads planets.

**Map rings and quadrants** (`#lib/quadrants.ts` pure, `server/quadrants.ts`; the user's ask
2026-11-01, after the mod Quadrant Fixed): every `GalaxyMap` draws them from the layout's
`quadrants` (`page.data`, so no page passes them) — the profile's `quadrants` setting (⚙: on by
default, rings between by galaxy size — about one per 100 units of the band — or 0–10, 4/8/16
sectors, the cross turned by half a sector — default 8, turned: N, NE, E …, the user's call
2026-11-01) and the campaign's radii. **The core is the galaxy's
origin**: the innermost system of Roaming Korinth's large galaxy sat at 113 from it, the save's
`galaxy.core_radius` 112.5. Inner ring 2 % of the outer radius inside the innermost system, outer
2 % outside the outermost — of the systems on the main hyperlane network, not the L-Cluster
(`mainNetwork()`; 2207.02.01: 104 → 480, the two systems at 488 and 524 off the network left
out). Every star is shown from the start, so the radii reveal nothing. Directions are the map's as
drawn (north up, x mirrored: `bearing()`). Drawn only in a browser — not seen yet.

**Fleets tab** (`/fleets`, `#lib/designStats.ts` pure; the user's ask 2026-11-09: "fleets and
ship designs — a ship with a design no longer saved: make it an unofficial design so I can still
see it"): the latest save's military fleets with their design mix (`Fleet.designs`) and our ship
designs (`Snapshot.designs`, `shipDesigns()` in save.ts, READER 53: saved ∪ used by non-station
fleets) — status saved / saved, unused / **unofficial** (used, not saved), unofficial first.
**Only sizes the player configures** (`configurable()`, the user's call 2026-11-09): data DB
`ship_size.class` `shipclass_military` (warships, bio ships) or `_military_special` (Colossus),
plus the Juggernaut (filed as `shipclass_starbase`); no civilian ships, transports, stations,
defense platforms, observation posts or starbases — without the data DB's sizes, by the key. A
design's detail: sections and components by name, the fleets using it, what its ships upgrade to,
and **base stats** from the data DB's `ship_size`, `section_template`, `component_template`
(`GameData.shipParts`, extractor 2026-11-09; empty with an older data DB — names and keys only):
hull (size + `ship_hitpoints_add`) × mult, armor, shields, evasion, speed × `ship_speed_mult`,
power drawn against reactor output × `ship_reactor_power_mult`, cost and upkeep summed over size,
sections and components, every other modifier listed, and per weapon its CSV row (damage,
cooldown, range, accuracy, tracking). **Techs and empire modifiers are not applied**, and the
"damage / cooldown" column compares designs only — the CSV's cooldown unit has not been matched
with the designer's damage per day. Not yet compared with the ship designer (`docs/open-checks.md` 33).

**Starbases tab** (`/starbases`, `#lib/starbases.ts` pure; the user's ask 2026-11-09: "overview
of my starbases — separate regular ones and shipyards like in the outliner, or a toggle"): the
latest save's `stations` as one table (system, level, modules and buildings by the data DB's
names, free slots, build queue, shipyard queue) with the profile's `starbaseView` — `yard` all /
shipyards / without shipyard (`Station.shipyard`), `outposts` (off by default: many, nothing to
build) and the planner's `range` —, the starbase capacity and the Shipyards panel. Free slots =
the level's (`freeSlots()`) less what is built, `?` for a level the data DB lacks; queued items are
not taken off. **A level's slots are its ship size's capacity** (`levelSlots()`:
`starbase_module_capacity_add` / `starbase_building_capacity_add` in the data DB's
`ship_size.modifiers_json`, joined on `starbase_level.ship_size`; the level's own slot list only
without one, or with a data DB from before `modifiers_json`) — 4.5.3 counts that way, and mods change
the ship size, not the list (2026-11-09: Slightly Larger Starbases [4.5] makes a starport 3/2 and a
citadel 12/6; vanilla's 41 levels are unchanged, the two agree everywhere). It also repaired the
arkships with BPVR, whose level lists the extractor counted as 0.
**Starbase planner** (same tab, `#lib/starbasePlanner.ts` pure, `server/starbasePlanner.ts`; the
user's ask 2026-11-09: "where in my empire and border + x would it make sense to build what —
resources in the systems, max deposit output, effects on my colonies, e.g. push automatic
migration on the colony with the highest pop growth"): per starbase module and building (data DB
`starbase_part` with `potential_json`/`possible_json`, `starbase_part_modifier`, extractor
2026-11-09 — `owner = { … }` unwrapped to the country's conditions; `GameData.starbaseParts`, `{}`
from an older data DB) and per candidate system (ours, and the discovered unclaimed ones up to
`starbaseView.range` beyond the border), what its modifiers would do there: station output mults
× the system's orbital deposits' base output (mining → gatherers, research → researchers; "stations
on k of n deposits"); `planet_resettlement_unemployed_mult` on the system's colonies by civilians

- last month's growth and assembly — **the Transit Hub** (`system_modifier` +200 %, needs a
  starport, Hyper Drive II and a colony of ours there; the user caught that it was missing from the
  first plan); `planet_stability_add` (colonies below 50 count fully); governing ethics attraction
  by pops. Everything else is listed unranked. Conditions: the empire's through `#lib/triggers.ts`
  (`atStarbase()` answers `is_normal_starbase`, rings, citadels, arkships, waystations and
  `has_starbase_size` at each level), so a part shows the level it needs ("upgrade to starport"),
  an outpost first outside the border, a free slot; what the save cannot answer (`solar_system = {
… }`) marks it `?`. Already built in the system: skipped. **None of this machine's saves has
  researched Hyper Drive II** (2026-11-09: every campaign, UNE 5's 2245 save too) — the Transit Hub
  row was seen only on a DB copy with the tech added to Planetforgers 2214.02.01 (Embrala, Embron
  +5 pops a month).

**Systems tab** (`/systems`, `#lib/systems.ts` pure; the user's ask 2026-10-22): our systems — and
the discovered ones up to +0…+10 jumps beyond the border, or all (`systemView.range`, facts only) —
with what the galaxy knows (star, bodies, deposits' base yield, anomalies, megastructures,
bypasses), what each **cost** and **earned**, cumulative per save, in trade (the shared values,
see the jobs tab — without them a system making only research could never break even), a
projection (12–120 months) and the break-even month. `+0` beyond the border is `mine` (the user's
call), so the ranges start at +1.
Monthly: the starbase's level, modules and buildings and the stations (`Snapshot.orbitalStations`,
since READER 5) have base upkeep and output in the data DB (`costs.ship`, `costs.module`,
`costs.starbaseBuilding`, deposits); the budget books them per kind empire-wide (`starbases`,
`starbase_modules`, `starbase_buildings`, `station_gatherers|researchers`,
`orbital_mining|research_deposits` — read from the 2212.03.05 save), and `allocate()` splits each
booked total over the systems by base share, so modifiers count. One-off: the outpost when a
system turns ours in `knownSystems` (100 alloys + influence **estimated** as
`EXPANSION_COST_BASE + EXPANSION_COST_DISTANCE × (jumps − 1)` from our nearest system, capped —
the engine's distance basis is not in the files); construction items in the system
(`Construction.systemId`, since READER 5; exact) when both saves list construction, else what the
starbase gained, at data DB prices; new stations at their size's cost. What the first save already
shows counts as "before history" (approximate), except the capital's starbase. The colonies
toggle (`systemView.colonies`) adds each colony's `produces`/`upkeep` and the construction on it
(colony → system from the latest galaxy's bodies). Not counted: ships built at a system's shipyard,
refunds of cancelled items, the influence of claims.

**System entry events** (the user's ask 2026-10-31: Bir's "Crystalline Asteroids" popup "on the
map and on the events tab"; `#lib/systemEvents.ts` pure, data DB `system_entry_event`): the popups
entering a system fires — the events of `on_entering_system_first_time`, `on_entering_system` and
`on_entering_system_fleet` that test star flags on the system (73 in 4.5.3: guardians, ruined
megastructures, gateways, Helito's "Missing Orbitals" on `on_entering_system_fleet`, …). The save
keeps star flags from galaxy generation (`galactic_object.<id>.flags`), so `systemEntries()`
(`save/country.ts`, handed the campaign's events by `toSnapshot()`'s `ReadingData`) lists the systems we entered
(`visited_objects` and our own) whose flags match one — all of its flags, one of its `OR` flags,
none forbidden (`entryEventsFor()`) — as `Snapshot.entryEvents` (READER 37). **A once-per-empire
popup** (`once_flag`: the trigger wants a country flag unset, the event sets it — apoc.1
`encountered_first_gateway`) counts only at a system first listed while that flag turned from
unset (at the last save that listed entries) to set (`firstEntries()`); several such systems in one
interval are each "one of N". Checked 2026-10-31 on a copy of this machine's DB (Roaming Korinth,
2206.10): of four abandoned gateways the L-Gate at Urakhannon's Maw (2204.01.01, `apoc.3`) and
Acamar (2205.07.21) — Achernar and Elissa came after the flag; Bir (2205.09.18) and Helito
(2206.03.28) as the user saw them. The events tab's kind `system-event` ("Bir: Crystalline
Asteroids"; not at the history's first save) and the map's layer "system entry events" (each
system at its first reading — the popup's own outcome may set a flag that no longer matches, as
Helito's `solarpunk_system_revealed`). **Likely, not certain**: the events' other conditions (a
ruined gateway in the system, global flags) are not checked. Companion mod 0.10.0 logs each first
entry (`system-entered`), which only re-dates a matching milestone to the day (`fromLog()`, `alone:
false`) — most first entries fire nothing.

**Megastructures tab** (`/megastructures`, `#lib/megastructures.ts`, pure): every system ranked
per structure (arc furnace, dyson swarm, dyson sphere, ring world, matter decompressor, stellar
cannon, quantum catapult, mega shipyard, sentry array), with a map coloured by score and a table,
filtered to my systems, up to +0…+10 jumps beyond the border, or all. Structure, range, the
fitting switch and the picked system are the profile's `megastructureView` (default Arc Furnace). `MEGA_RULES` is taken from 4.5.2
`common/megastructures/*` (file per rule; re-check on game updates): star classes, no
binary/trinary, no colonizable planet (`colonizable_planet`: the data DB's colonizable classes plus
city, relic, nuked, hive, machine, habitat), no non-gate megastructure already there (ruined ones
block too, though they can be restored), The Machine Age (arc furnace and swarm need it, the Dyson
Sphere only exists without it). Scores: the arc furnace's is the game's own `tooltip_system_score`
(bodies neither star nor colonizable without a research deposit; ≤ 10 poor, ≥ 16 good); the only
structure with one. The others are ours: swarm = the star's deposit amounts, sphere = colonizable
planets frozen + deposits, ring world = deposit amounts removed with every non-star body, catapult
= the farthest system on the 2D map (and how many lie within the stages' 300/450/750), mega
shipyard = the outermost body's distance from the star (the way out for new ships), sentry array
= systems not ours within 20 **hyperlane jumps** (stage 1; 40 and 60 shown, the finished array
sees everything — `has_full_sensor_range`). `sensor_range` is jumps: ship sensors are 1–4 and
starbases add 1, which in map units (~20 between systems) would not leave their own system. Jumps
run over discovered lanes, so early on the score saturates (2207.03.10: 37 for every reachable
system). Rules needing bodies are unknown (`?`) in unvisited systems.
The tab is dimmed in the tab bar (`megastructuresEmpty`, `#lib/tabData.ts`) until a structure is
found in a visited system (built or ruined, ours too; gateways and L-Gates not) or a structure's
tech is researched (`MEGA_RULES[*].tech`, the first stage's `prerequisites`) — the user's rule,
2026-11-15. It reads the stored galaxy, not the display switches' view of it.
2207.03.10: catapult best near the centre (Elthir: farthest 387, centre 83); arc furnace Sol 20.

**Pacts tab** (`/pacts`, `#lib/pacts.ts` pure; the user's ask 2026-11-05: "what do I get from
them, per type, then per empire"): every type we hold (`PACT_TYPES`: the relation flag and the
budget category) with partners and booked upkeep (0.25 influence for migration treaties, research
agreements, commercial pacts and NAPs, 1 defensive pact, 0.5 guarantee; free under some federation
perks and laws, `common/diplomacy_economy/00_diplomacy_economy.txt`). Dimmed while no relation
holds a pact.

- **Migration treaties** (`speciesExchange()`): our main (founder) species in each partner's
  empire and its main species in ours, save by save, from `Snapshot.speciesByEmpire` (READER 45:
  us and our treaty partners, pops by species name — a modified species keeps its parent's name,
  Oklarr 2214.02 had two "Pyrragthul" —, under 1 % left out). **The save has no per-species
  migration**: `last_month_growth_data.species` holds net growth per species and stratum only, the
  causes are per colony. Shown plainly, like `/migration`'s foreign colonies.
- **Our species abroad** (`ourSpeciesAbroad()`, READER 47): our species in every empire we have
  communications with, whether a treaty still holds or not (`EmpireSpecies.onlyOurs`: for
  non-partners only our species are read), with the change since the first save that showed them.
  Treaties end, emigrants stay: the throwaway Theian Preservers had 338 Theians in three
  Baanthurian colonies (2214.01) after that treaty had ended, which the treaty section no longer
  showed.
- **Commercial pacts** (`commercialSplit()`): we gain 10 % of the partner's trade production
  (`COMMERCIAL_PACTS_INCOME_PERCENTAGE`), booked as trade under `commercial_pacts`, not taken from
  the partner. **Fit**: Planetforgers 2214.02 booked 46.85, Σ 0.1 × (partner's trade income − its
  own `commercial_pacts` trade, `AiIntel.commercialPactTrade`) 46.83. The total and each
  partner's share are always shown (the user's ask 2026-11-17; before, a partner's share needed
  economy intel 3 with `pactIntel`, or `pactAll`).
- **Research agreements** (`researchValue()`, `techCounts()`, `techHints()`): +25 % research speed
  (`RESEARCH_AGREEMENT_SPEED_MULT`) on a tech the partner has, **added to the speed we already
  have — confirmed in game** (the user's point 2026-11-05; throwaway Theian Preservers 2200.07: the
  tooltip lists "Baanthurian Research Agreement: +25.00%" beside the other bonuses, +51 % = 26 +
  25, progress ×1.510 against ×1.260 without; multiplied would be ×1.575). On the tech tab it is a
  speed line of its own for the tech in progress (`agreementLines()` in
  `server/researchBonuses.ts`, scope `tech`): +0.25 × output a month, and 0.25 ÷ (factor + 0.25) of a tech's time saved — 20 % with
  no other bonus, 14.5 % at ×1.48. **The factor is measured, not modelled** (`researchSpeed()`,
  `#lib/researchSpeed.ts`): progress gained between two consecutive month-start saves ÷ the earlier
  one's research output — Planetforgers ×1.48 in every area and month (2213–2214), Roaming Korinth
  1.19 then 1.24, UNE 1.07, Yorphia 0.94. **Stored research comes on top, unboosted** (2214.02:
  2.48 = 1.48 + 1 while points were stored), so such months are skipped. Partners' own speed is
  unknown: their gain is read at ×1, an upper bound. Two partners with the same tech count once (seen in game: ×1.51 with both, one tooltip line)
  (open check 30). Plain: this month's extra research (where the tech in progress is one the
  partner has — the game shows the bonus on the tech) and our measured speed. `pactIntel`: the
  partner's techs per area at technology intel 1 (intel ≥ 30; an agreement keeps it there) — the
  game shows that number and **no intel level lists the techs** (`intel_tech_researched_all` is in
  the localisation, in no level). `pactAll`: which techs, research saved each way, and the hints
  (the cards on offer and techs `inReach()` a partner has, by research saved). From
  `AiIntel.techsWeLack` / `techsTheyLack` (READER 45, research
  partners only, to keep snapshots small); costs × `techCostFactor()`.

- **Pacts to offer** (`#lib/pactAdvice.ts` pure, the `pactAdvice` spoiler, `intel`; the user's ask
  2026-11-18: "build the research agreement recommendation as well as a commercial pact
  recommendation, grey out the ones which are not yet available because they won't accept, but
  keep them in their ranked position"): every empire we talk to without the pact, ranked by what it
  brings a month in trade (`valuesOf`) less the 0.25 influence upkeep. Research: +25 % of our output
  per area on the share (by cost) of the techs in progress and on the cards that they have and no
  partner already gives — every contact's `techsWeLack` since READER 64, `theyLackCount` for the
  acceptance; on 2217.06.01 "every tech in reach" (128, rare and arcane ones included) diluted a
  partner's 4–5 to almost nothing, the cards did not. Commercial: 10 % of their trade production.
  Greyed with the reason: the action's `possible` (trust ≥ 20 or our good opinion, an embassy or
  Diplomatic Networking, independence) and the AI acceptance from the defines, personalities
  (`*_acceptance`) and attitudes (`alliance`/`coexist`, extractor 2026-11-18; older data DB:
  unknown, "?"). Hidden: what is never possible — our or their purifier, inward-perfection, swarm
  or terminator civics, a research agreement with anything but a regular empire. The acceptance is
  ≈ and uncalibrated: `docs/open-checks.md` 10.

The route sends a partner's data only as far as the switches allow. `levelOf()` covers the economy
and technology categories too (`INTEL_LEVELS`, 00_intel_levels.txt: both move together).

**Diplomacy tab** (`/diplomacy`, `#lib/diplomacy.ts` pure, `diplomacy()` and `ourIntel()` in
`server/world.ts`; the user's ask 2026-10-23: "all the player knows(!) about all other empires"):
every country but `other`, the relations between them (pacts and rivalries are flags on each
country's `relations_manager.relation`; subjects `country.overlord`; wars every `war`), as a table,
a matrix (row's opinion of the column, pact abbreviations) and a graph — on the galaxy map at the
capitals (`GalaxyMap` `selected` bound to the empire whose capital is clicked; capitals not yet
discovered are added faint, the intel names them) or on a circle (`DiplomacyCircle.svelte`, the
default), its empires grouped by `clusters()`: **blocs** (federations, overlords with their
subjects), **mutual opinion** (average-linkage merging while the known opinions between two groups
average at least `diplomacyView.threshold`, 100; unknown pairs do not count) or **cooperation**
(`PACT_SCORE`: defensive pact 3 … rivalry −3, war −5 — our weights, not the game's; a group needs
on average one point per pair) — each group an arc, listed under the circle. Edge kinds toggle
(`diplomacyView.hiddenEdges`, all/none buttons, embassies and closed borders off by default); a click
focuses one empire and fades the rest (per viewer, Esc clears). **What we know is the game's intel
model**: our `intel_manager` value per country (0–100) → a level per category (4.5.2
`common/intel_levels/00_intel_levels.txt`), and what a level reveals
(`common/intel_categories/*`): government 1 (intel 10) ethics, civics, capital (and the ruler, not
stored); government 2 (40) origin; diplomacy 1 (20)
rivalries, federation; diplomacy 2 (50) pacts and opinions. A pact shows through either side,
their opinion of us always; subjects and wars are **assumed public** (`docs/open-points.md`). An
empire is never shown by its id (the user's ask 2026-11-17): a side we have no name for is
"unknown empire", and a war keeps the save's name ("Prikki - Kilik Xeno Filth Removal", made of
the sides' own names) only where every side is shown by a name. `diplomacyView()`
walks the branch's saves: a fact keeps its reading from the last save whose intel showed it — gone
if that save showed it gone, else **"unverified since"** that date when the intel no longer shows
it. Snapshots keep relations only among the diplomatic kinds (empires, fallen, enclaves, traders,
marauders) and with communications (`Snapshot.diplomacy`, `intel`, `allWars`, READER 14). The
`diplomacyAll` spoiler (⚙, `intel`) is the latest save's truth; the route strips nothing else, since the
model never passes hidden facts. 2214.01.01: 47 countries, 113 relations shown of 141, 115
opinions of 228.
**Ethics** (the user's ask 2026-10-27, `#lib/ethics.ts` pure): what government intel shows, as
`EthicChip`s (a dot per pole, `ethic-*` in `colors.ts`, bold when fanatic, `ethic:` popups), short
names on the circle (`Au`, `XI` fanatic, …), **steps apart from ours** — each ethic's place on its
axis from the data DB (`ethic.category_value` − 2: −2…+2, `GameData.ethicAxes`), summed over the
four axes, 0–16; gestalt against non-gestalt has no scale — and **changes seen**
(`ethicsHistory()`: two visible readings in a row that differ, dated between them). Two more
circle groupings: `ethics` (average linkage while the mean steps apart stay ≤
`diplomacyView.ethicsDistance`, 3) and `federation` (`agglomerateGroups()`: a group's ethics scored
whole by the defines — −0.15 per unique ethic beyond 3, −0.5 per axis held at both poles — while ≥
`cohesionFloor`, −0.3); unknown ethics stay alone. **The counting is a guess** (≈): a fanatic ethic
as its regular one, an opposition once per axis, and a gestalt is just one more ethic there, so it
joins anyone. Ethics' effect on AI opinion is not modelled — saves store no ethics opinion
modifier (2214: claims, insult, gift, GalCom, new contact only). 2214.02.01: we (Authoritarian,
Fanatic Materialist) group with the two other fanatic materialists; no change seen in the history.
**What we know of an empire** (the user's ask 2026-10-27, `empireFacts()`): every empire name —
table, matrix, circle — has it as a tooltip (`factsText()`): intel and its levels, government,
ethics, civics, origin, capital, federation, overlord, subjects, opinions, and for what intel does
not reach "unknown — from intel N"; the graph names each empire's government and civics under it
(`diplomacyView.details`). **Legend** above the graph: relation kinds, "unverified", each ethic once for both its variants
(`ethics:<regular>`, the user's call), every authority (`GameData.authorities`), and the civics
and origins our intel has shown of the empires on the graph (the user's call 2026-10-27: every
known empire's listed 42 civics, most of fallen empires, enclaves and pre-FTL civilisations the
graph filters out; all empires with `diplomacyAll`) — ethics and authorities no empire on the
graph has are greyed, the count of those that do beside each item. Hover lights what an
item stands for (`legendMatch()`: its edges and the empires on them, or the empires holding it), a
click keeps it lit (several at once, per viewer, not stored). The map draws only in a browser (`GalaxyMap` waits for its size), so its lines are unchecked here.

**DLCs and mods** (`/dlc`, `/mods`, `#lib/addons.ts`, pure): what is active comes from each
save's `meta` (`required_dlcs`, `mods`: names; `version`) → `Snapshot.dlcs|mods|gameVersion`;
the changelog is the `dlc` and `mod` milestones, so it follows the save graph and starts with the
first save read since 2026-10-18. The DLC catalogue is the data DB's `dlc` table (all 36 of
`dlc_info.txt`, category from the installed DLCs' descriptors, Steam release dates). Installed
mods are the launcher's descriptors, `<user dir>/mod/*.mod`, the user dir being
`STELLARIS_SAVE_DIR`'s parent (`server/mods.ts`, read at start); `supports()` compares their
`supported_version` (`v4.5.*`) with the save's version. A dev copy registered next to its workshop version (`link-mod.sh`) has the same name and id: rows are keyed by descriptor file, marked "local", and left out of the version notes (`trackedMods()`) — and of the two, only the one in the load order is active (the save names mods only; 2026-10-31 both showed active, the Workshop subscription in no playset) — keyed by name and id they once broke the tab (a duplicate key, client-side only). 2207.03.10: 28 DLCs, 17 mods. **Merged
DLCs**: Utopia, Synthetic Dawn and Humanoids are gameplay DLCs no script checks for (data DB
`dlc.host_checks` 0) and saves leave them out of `required_dlcs` though installed — shown as
"base game". **Mod updates**: the launcher's `launcher-v2.sqlite` (`mods.timeUpdated`, seconds;
`version` where the descriptor has none, read-only) completes the descriptors; at each start
`noteModVersions` notes every mod whose version, supported version or update time changed in
the `mod_version` table, with the head's game date — the mods tab's "Updates", since
2026-10-18 (many mods name no version: their update shows as a new update time). **Load order**
(`#`, the default sort): `<user dir>/dlc_load.json`'s `enabled_mods`, read per request — the
launcher writes it from the active playset's order (2026-10-31: the same order as
`launcher-v2.sqlite` `playsets_mods.position`) at a game start **and on every playset edit**
(2026-11-09: rewritten after the game had closed), so it is the active playset, not necessarily
the last game's. **Age**: days since the workshop's update (`ageDays()`, real time at the
request). The save's `meta.mods` is alphabetical, no source of the order. The DLC tab
opens per category.
