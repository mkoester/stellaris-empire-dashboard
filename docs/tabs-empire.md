# Tabs: colonies, expansion, government and the one-route tabs

Colonies, habitability, expansion, settle down / embark, milestones, council, government, nomads, situations, and focus, traditions, tech, leaders, species, contacts. Read before working on one of them. _Moved verbatim from `AGENTS.md` on 2026-11-14._

**Colonies tab** (`/colonies`; rows from `server/colonies.ts`, logic in `#lib/colonyTable.ts` and
`#lib/colonyProfile.ts`, both pure; `ColonyTable.svelte`): one table or one per sector (with the
sector's summed net output, as the game's sector row), sortable, filtered, columns picked; in
one-table mode each row carries its sector's colour (`CATEGORICAL`). Under each colony its **pros
and cons**: district caps per type, every non-cap effect of its features and planet modifiers
(good or bad by `positiveIsGood`), blockers, habitability < 100 %, free district room. Temporary planet modifiers (with an end date) count
too, marked ⏳ and counted apart: `6 (5+1)` is 5 lasting and 1 temporary (`countLabel()`). **Suits**
ranks resources by that evidence (a cap counts its size, a tagged pro +2, a con −2;
`resourceOf()` reads the resource from the key); a designation whose resources score under half
the best gets a ⚠ (capitals and cities aim at nothing). **Needs attention** (`problems()`):
stability < 50, housing or amenities short, habitability < 70 %, over a quarter of the pops
without a job (civilians are normal in 4.x). Orbital deposits are left out — the station mines
them, not the colony. Mode, sort, filters and columns are the `colonyView` setting, replaced
whole on PUT. The `all` tab's Colonies panel is still its own compact table. Pros and cons are
`TraitChip.svelte`; both tables sort through `#lib/sort.ts`.

**Habitability per species** (`#lib/habitability.ts`; the colonies and expansion tabs' "habitability
for" picker, main species = most pops): where the species lives, the save's value (pop groups,
`Colony.speciesHabitability`); elsewhere an estimate from the data DB — its traits'
`pc_<class>_habitability`, 100 % on `ideal` classes, plus `pop_environment_tolerance` (traits,
planet modifiers and features) only where the class gives it any, at least
`habitability_floor_add`. Empire-wide bonuses are not counted. Matched the game's Expansion
Planner at 2207.03.10 (Mars 0 %, Arid and Savanna 30 %, Tundra with Atmospheric Aphrodisiac 35 %).
The Hab. column takes the game's colours: yellow below `HABITABILITY_WRONG_PLANET`, red below
`HABITABILITY_OPPOSITE_PLANET` (0.7 / 0.4, data DB defines). Class names take their climate's
colour (`#lib/climate.ts`, `climate-*` in `colors.ts`), sampled from the climate-preference trait
icons: dry, wet, cold, volcanic, gold for the other colonizable classes; toxic worlds (no icon) an
olive of our own. Volcanic worlds are an ordinary colonizable class in 4.5.2 (climate dry,
`initial = yes`), good only for volcanic-preference species.

**Expansion** (`panels/Expansion.svelte`, the `all` tab compact — modifiers by name, effects on
hover — and the expansion tab with each effect shown): sortable, including per district type;
jumps from the capital, the nearest own shipyard and the border; filters by range (+0…+10, any),
class and district types (all of those picked); toxic worlds behind their own toggle until the
empire can detox them (`Snapshot.canDetox`: the `ap_detox` perk or the `knights_detox` country
flag — 4.5.2 `common/terraform/02_special_terraform_links.txt`; Climate Restoration is needed as
for every candidate), then among the terraforming candidates; below it the **habitat sites**
(`habitatSites()` in save.ts, `#lib/habitats.ts`), shown once the empire can build habitats
(`tech_habitat_1`, the Diadochi / Great Khan's Legacy civics, `democratic_khanate_flag`) or always
with the config tab's `habitatsAlways`: one habitat per system, inside the borders to build; its
district limit after `max_habitat_districts_value` (6 + ¼ per star and planet, again with Habitats
II and III, + ¼ per moon and asteroid for Void Dwellers), its mining, energy and science caps from
the surveyed orbital deposits' `habitat_modifier` (data DB `deposit_habitat_modifier`); filtered by
the same range and a minimum size (default 10, the game's "poor" threshold); district numbers are what the planet allows once its blockers are
cleared, now in brackets (`DistrictCap.blocked`, `PlanetCaps.limitCleared`: the blockers' hidden
features and their district loss). Matched the game at 2207.03.10 (Alpha Centauri IV farming 11
(8), generator 7 (5), mining 3 (2)) once the extraction resolved
`@DISTRICTS_FROM_SR_DEPOSITS` (swamps and bogs: +3 farming). Its view (range, toggles, filters,
sort, species) and both tables' row lines belong to the profile.

**Roaming** (a nomad's expansion tab, renamed — the user's ask 2026-11-16: "instead of expand
they need a waylines tab … where would I build waystations, which modules — only 2 slots at the
start, so choose wisely —, where would I make best use of waylines, where might I get in trouble
for collection with other empires"; the user chose one tab for waylines and settling, named
"roaming"; `#lib/waylines.ts` pure, `server/waylines.ts`, `panels/Waylines.svelte`, above the
Settle down panel). From the 4.5.4 files (sources in `waylines.ts`'s header): a waystation collects
only its own system's station deposits, one module per resource group (`COLLECTS`, from each
module's `collected_system_resources`), × 0.75 / 1 / 1.25 by tier, 2 / 4 / 6 slots; flat
`starbase_collected_system_<r>_add` the empire qualifies for counts too (the Hydroponics Bay's
food, ≈ the tier factor on it — `open-points.md`). **Waystations** — map and table: every visited
system with a deposit a module collects, its best modules for the 2 slots of Waystation I, what they
collect a month in trade (`valueOf` with `valuesOf`: the market's base price, else what a unit
costs us — the systems, produce and trade-offs tabs' values), jumps from our nearest waystation (the arkships before the first), the
waylines it would extend or link, and whose space it is — another empire's without a Wayline
Pact is ⚠ (their stations there collect 25 % less, −10 opinion each to −200, the Expel Nomads war
goal), someone else's waystation ✕. "+ goal" plans a waystation or a module, "+ wayline (n)" the
waystation and every one on the shortest way from our waylines (`chainTo`, past no one else's
waystation). The value of each site, in trade a month (two decimals; hover it for each module's share), also
shows under its star, and the map shows it as the system's colour or, toggled, as a green dot
whose area grows with what lies above the baseline of 10 (the smallest dot up to it); our
waystations are blue on the map, with what they collect now, and have a table of their own above
the sites (both beside the map in "wide + table"); research, unity and whatever else the market does not sell count at what a unit
costs us (`unitValues`: our own sources' running cost — about 1 trade a point in
`roamingcybergang` 2213.08); a toggle rates the sites
for Waystation I, II or III (2 / 4 / 6 slots, × 0.75 / 1 / 1.25 — tiers not yet researched say
"later"), with the modules the empire has today. **Pre-FTL civilisations**: the extraction keeps
a `solar_system = { … }` condition as an opaque leaf, so `SOLAR_SYSTEM` in `waylines.ts` answers it
per module and modifier — the Research Observatory's means a pre-FTL planet without an observation
post (society research 2 / 3 / 4 / 5 by the interference policy, ∓ 2 by the favoured approach, the
Galactic Community's pre-FTL resolutions), except its +2 energy, which needs a trade pact with that
civilisation (not read: no). A site with a pre-FTL civilisation and no deposit counts too (👁 in
the table; ≈ no one else's observation post there). **Planned waystations** (the user's ask 2026-11-16): a `waystation` goal moves its system from the
sites into the waystations table — italics, tier "planned", its `station_module` goals as modules
(none: the best ones count for its worth), ✕ beside ✓ planned on each — and shows ⚑ and light blue
on the map. "✓ planned" has a ✕ on every tab (`AddGoal`, the goal id from `planSummary().ids`).
The roaming tab returns `tip` itself: without it (0.1.23) none of its plan buttons showed. **Your waylines**: our waystations grouped by neighbouring systems (`networks()`, the
same five groups as the save's `waystation_networks` for the AI nomads of 2213.08), planned ones
in italics, each with its fill, stockpile and the best modules for its free slots; the wayline
modules (any `waystation_network_*` modifier) it has and lacks; the collection point
(`collectionPoint()`, fewest jumps to the rest — where a Logistics Hub, Waystations III, collects
the whole line). **Unlicensed waystations**: per empire, ours in its space without a pact and the
opinion they cost. Module popups (`module:<key>` explanations) list their station effects and,
apart, those along the whole wayline. A waystation claims no space: since READER 60 neither a
system's owner nor our systems count one (`stationOwner`, `ownSystems`).

**Settle down / Embark** (the expansion tab, above the Expansion panel; the user's ask
2026-11-01: "help to settle down as a nomadic empire" — "the other way is possible, too";
`#lib/settle.ts` pure, `server/settle.ts`, `panels/SettleDown.svelte`). From 4.5.2's files:
**settling** is the arkship action `arkship_settle` (`common/scripted_actions/03_arkships.txt`,
started from the expansion planner): the empire needs `nomad_can_settle_trigger`
(`scripted_triggers/09_scripted_triggers_nomads.txt`, mirrored by the game rule `can_nomad_settle`)
— Adaptability finished (Versatility for a machine intelligence) and independence; The Sacred Path
and Heirs of the Khan never settle, Forever Cruise after its planetfall (`forever_cruise_planetfall`)
and the Knights of the Toxic God once at the Toxic God (`visited_toxic_god_system`) or, keep
destroyed, with the tree; a target is colonizable, in a surveyed system no one owns, not
consecrated. 250 influence, 360 days ÷ arkship action speed, one at a time. Outcome `nomads.4705`:
with one arkship it settles; with more, settle and scuttle the others (their pops move over, each
returns 10 % of its cost — 1000 / 1500 / 2000 minerals and alloys by tier,
`settlement_scuttle_arkships_effect`), keep roaming (the settling arkship a settled subject) or
settle with the others as a nomadic subject — those two not for homicidal empires, the Knights or
gestalts but a Progenitor Hive. Waystations become outposts, logistic ships construction ships;
the planet keeps Arkship Remains (`arkship_parts`: +60 % environment tolerance, +2 districts).
**Embarking** is the planet decision `decision_nomad_embarkation`
(`decisions/15_nomads_dlc_decisions.txt`; 500 influence, 10,000 alloys, 3600 days; our other
colonies become a subject): `can_embark_trigger` — the same trees (or `doomsday_embark_unlocked`),
not wilderness or homicidal, no Cosmogenesis, none of ten origins, no Red Giant Expansion or Deep
Excavation running — plus independence, not embarking already, no colony being settled. The tab
shows a checklist (three-valued, **costs left out — the user's call: they fluctuate**), for a
nomad the targets (`settleTargets()`: today's habitability, ≈ with Arkship Remains — assumed to
count on every colonizable class, `docs/open-checks.md` 26 —, deposits on the system's other
bodies ≈, jumps from the nearest and the capital arkship) and the outcomes with our numbers
(`settleOutcome()`, assuming the capital arkship settles). **The tab's name is dimmed**
while a nomad cannot settle, its title naming what is missing; still a link. **For a nomad the tab
is named "settle"** (the user's call 2026-11-01: settling is no expansion), the route stays
`/expansion` (`settleTab()` in the layout, per tip). A settled empire's tab is "expansion", never
dimmed.

**Milestones** (`#lib/milestones.ts`, pure): the campaign's bigger events — systems, colonies
(colonization started / established / gained / lost), districts built and buildings done per
colony, wars, traditions, perks, research, species,
trade deals, passed agendas, leaders, ruler, civics/ethics/authority (by name, `identityNames`),
government type and origin, policies, edicts, sectors —
**derived on read** by diffing consecutive _saves_ along the branch (`branch()` → `milestones`), so
they follow the save graph and cover all history for fields already stored. A field is compared
only between saves that both have it (null = unknown; an empty colony list too), and an event is
dated to the first save showing it. New kind: `KINDS` + a detector + a colour in `colors.ts`. Each
chart has an "events" picker (`EventPicker.svelte`); choices are stored per `<scope>:<title>`
(`empire:`/`colony:` — stored `planet:` keys are renamed on read; `log` for the Events panel) in the `chartEvents` setting, merged on PUT. **To challenge** (the user, 2026-11-01): keying by
title moves a viewer's picks when a chart is renamed or a new chart takes an old title — the
colony page's `Pops` became `Pops (jobs)`, so its picks went to the new `Pops` chart — and a title
that changes with live data (`Pops (jobs) — <date>: …`) keys a different entry while it shows.

**Council** (government tab): the ruler's seat (`councilor_ruler_<authority>`; not in the save's
seat list, `possible = { always = no }`) and the seats held, each with what it gives **at the
leader's level** — 4.5.2 `common/governments/councilors/000_councilor_documentation.txt`: a seat's
`modifier` "is multiplied by assigned Leader's level" (`atLevel`; `seat:<key>` popups hold the
per-level values), shown per level and, in brackets, at the **councilor level** = leader level +
its `bonus_skill_level` + the empire's `councilor_skill_add` the save shows active (traditions,
edicts, policy options, civics, the authority — oligarchic +2, missed until 2026-11-05: the
throwaway Theian Preservers' level-1 Head of Research gave +6 % in game, 3 × 2 % —, timed
modifiers; `councilorBonus()`, data DB `councilorSkill`).
Each seat's leader classes are chips in the game's colours; the leader's traits add their
`councilor_modifier` ("applied to country if leader is on the Council", flat — 4.5.2
`common/traits/000_documentation_leader_traits.txt`; `ltraitcouncil:<key>`). Possible seats are our
civics' seats and the base and enclave seats known to be open (`possible` true): the enclaves' seats need a
leader with the enclave's trait, hired at that enclave (4.5.2 `events/overlord_enclaves_events.txt`,
e.g. `enclave.7100`: 50 influence and energy by empire size), so the extraction rewrites
`any_owned_leader = { has_trait = X }` as `has_owned_leader_trait` leaves, checked against our
leaders; the Thought Warden (`has_leader_flag = mindwarden_commander`, the Mindwardens origin)
stays unknown, hidden. Agendas show "while preparing" (`modifier`, active while being enacted —
`99_README_AGENDAS.txt`) and "once launched" (launch effect text, `finish_modifier` for its
duration); edicts their effects, in the table. Factions are on the ethics tab (`docs/tabs-ethics.md`).
`unlocked_civic_council_slots` is the number of
seats (3 at 2207.03.10, all held). The agenda being prepared shows progress / cost (at empire size),
percentage and months; every other open one "~N months if picked next" — the measured rate and
size factor of the current agenda, started from 0. Same-status agendas sort alphabetically.

**Government tab** (`/government`, `#lib/government.ts` and `#lib/triggers.ts`, both pure): the
identity panel, ruler and council seats, the agenda with its due date (`events.ts`), the agendas this
empire can have (`potential` not false: current, cooldown, open, open? — `allow` not answerable —,
not allowed now, locked — none of the traditions or perks in its `unlocked_by` taken; 2207.03.10:
7 open, matching ethics such as Open Arms and Give and Take), policies with the options this empire can have, edicts (active with their
start, the others by unlock); factions moved to the ethics tab (2026-10-28), whose faction
demands use the same evaluation. The data DB's normalised triggers
(`*_json`) are evaluated **three-valued** against the save (`facts()`: country type, civics,
ethics, authority, origin, DLCs, policy and country flags, traditions, perks, techs, war): what
the save cannot answer (`num_rivals`, scopes like `any_owned_pop_group`) is unknown, shown `?`,
never guessed — except that a leaf naming a parameter-free scripted trigger is evaluated by its
body (data DB `scripted_trigger`; `is_dark_consortium_empire` → its civics). As the game lists
them: policies are the save's `active_policies` (2207.03.10: 27, the game's panel; War
Philosophy under both its categories), edicts those whose potential holds and that are unlocked
(traditions, perks and `prerequisites` techs; 2207.03.10: exactly the game's five). The profile's
`showLocked` switch (⚙) adds the rest: locked agendas and edicts, all policies and options.
**What-ifs** (⚙ What-ifs, a spoiler; `#lib/whatIf.ts`, `server/whatIfs.ts`): three paths, all ≈ —
output (`*_produces_mult` as a share of today's output), wellbeing (amenities → stability → output)
and upkeep (a `_mult` × what the budget books for its group: `pop_category_*` for the pops'
consumer goods, `planet_pops_traits` for organics' food, `planet_<job>`, `planet_buildings`,
`ships`, `edicts`, …; an `_add` per 100 workforce of a job or per 100 pops of a stratum — 3606
specialists × 0.5 = the 18.03 consumer goods booked, 2203.09). An edict's price is its base cost and
upkeep × the budget's `edicts` expenses over the active edicts' base (`edict_size_effect`,
`edicts_upkeep_mult`); with no active edict of that resource, base, marked "(base)". The net is
trade a month at the produce tab's values (`whatIfValues()`, as `logistics.ts`). The same what-if
runs on the species tab (Living Standards: the two options' modifiers swapped, on that species'
strata — each colony's strata × its share of the pops, ≈), the traditions tab (traditions not
taken in adopted trees, other trees' adoption, perks whose `potential`/`possible` is not false) and
the tech tab (the cards on offer). Happiness per stratum (`pop_cat_*_happiness`) is not counted.
**Colony what-ifs** (2026-11-15): a designation swap counts `pop_bonus_workforce_mult` (the nomad
capital's +10 % on every job) and `worker_and_simple_drone_cat_bonus_workforce_mult` as output —
before, the swap away showed only gains. "losing <current>" leaves out what every alternative of
the family has at the same value (`ownModifiers()`: a capital's +5 stability and housing). Planet
decisions answer `planet_crime` (`Colony.crime`) and `has_carrier_flag`/`has_planet_flag`
(`Colony.flags`, READER 59) — Introduce Chaos no longer shows as (?). A one-time cost reads
"costs … once". **The crime decisions** (`#lib/crime.ts`) are valued at the enforcers holding
crime at 25 (what crime automation holds, under the 30 where Criminal Underworld may appear), so
crime's engine-side stability penalty is the same either way: the campaign needs fewer enforcers
(25 → 35 a job) and the freed workforce fills open jobs at the colony's average net output; the
deal's criminals (200 + 3 per crime point) and the enforcers for its +50 % crime come out of other
jobs. Not counted: the deal keeps a colony out of the crime events, and ending it costs −10
stability for 5 years. The user's rule of thumb recommends the campaign wherever crime ≥ 10 and the
colony has open jobs (`Recommendation.rule`, kept by `worthwhile()` whatever the estimate). Policy
what-ifs say "then locked for 10 years" (`POLICY_YEARS`; the save keeps no change date). Game
mechanics: `stellaris-modding-insights/docs/25-crime.md`.
**Species rights** (species tab, `#lib/rights.ts`): `country.modules.standard_species_rights_module
.primary = { species_index citizenship living_standard … }` for the founder species and
`.species_rights = { { species_index … } … }` for every other (READER 51; before, other species had
no rights at all — Fangnaur 2200.08's enslaved Quenti), every option of each kind
whose potential is not false (`from` = the country, folded in; `has_trait` = the species'),
2207.03.10: Human as the game's panel, a few options more than the game shows (their conditions
read scopes the save cannot answer). **Slavery and purge types only for a species whose
citizenship enslaves or purges** (data DB `species_right.is_slavery` / `is_purge`; 4.5.2
`slavery_normal`'s allow: "triggers covered in citizenship_slavery") — the save keeps a default
type of each for every species. Each option explains itself on hover (`right:<key>`: the game's
`<key>_tooltip` and the unconditional `pop_group_modifier`s). `is_nomadic` is
built into the game; read as running `situation_nomad_economy` (the origin misses most nomads,
see the trade tab).

**Nomads: Operational Reserves** (`#lib/nomad.ts` pure; throwaway nomad game
`roamingkorinth_1232667372`, 2026-10-30, screenshot `2026_10_30_1`): a nomadic empire has no
energy and minerals storage — both live in one pool (4.5.2 `resource_converters`,
`nomadic_operational_reserves`: `bottomless`, each payable with the other, `visible_stockpile = no`).
The pool **is** the situation `situation_nomad_economy`: `progress` the stock (10069.85, the game's
"Stored: 10069 / 20000"), the last `stage_durations` end the capacity (base 15000 + 5000 for a
tier I arkship; ends 1000/5000/15000/20000), `stage` its level (data DB `situation_stage`:
Critical, Low, Medium, High — the top bar's "Medium"), and each unit of energy or minerals net
moves it by one (2200.02.01: +98.91 − 29.06 = the game's "69.8"; it started at
`initial_progress` 10000). The save's energy and minerals stockpiles are their start values
(1200 / 15000) plus their own nets — ignored by the game. `withReserves()` folds them into
`operational_reserves` for the top bar, its storage line, the stockpile and net charts and the
resources tab (whose budget for it is energy's and minerals' together; `stripOrder()` puts it
first, as the game); a month only the mod logged is ≈ the last save plus its net
(`reservesAlong()`); Upcoming has "Operational Reserves fall/rise to <level>" instead of energy or
minerals running out (`reserveLevels()`). Income and every economic tab keep the real energy and
minerals flows. `SituationInfo.stage` is the save's number (it was read as a string, always
null, before READER 25) with `ends`. **The arkship is the colony's place**: `colony.<id>.carrier =
{ type=ship reference }`, the ship holding `colony`, `planet_class="pc_ark"`, `planet_size`,
`build_queue` and its name — `colonyPlaces()` gives it the id −1 − ship id (ship 0 stays −1, as
stored before) and its name from the name lists (data DB `prescripted_name` now holds ship names
that differ from their key: `HUM1_SHIP_PeshnabtheFaithful` = "Peshnab the Faithful"). **A negative
`planetId` is the arkship, a full colony** (districts, buildings, jobs; the capital,
`col_capital_nomad`) — never filter colonies by `planetId >= 0`, which hid it from every colony
list until 2026-10-30. A save's colony carriers are `type=planet` or `type=ship` only (checked on
Roaming Korinth 2203.02.01: 75 / 11); habitats and ringworlds are planets. Nomads get the engine's
static modifier `nomadic_empire` (+100 % empire size from colonies and districts; see Top bar). Not yet
nomad-aware: other places that map a colony to its planet themselves (construction, growth; the
capital and migration are since READER 41), the trade tab's valuation of energy and minerals for us, and whether the
approaches (Conserve, Balance, Burn) scale the monthly move — the 2200.02.01 reading was
Balance at ×1.

**Frontier tab** (`/frontier`; the situations tab until 2026-11-15 — renamed because situations and
events are the game's own terms for one panel each, `/situations` redirects; `#lib/situations.ts` pure,
readers in `server/world.ts`). Two columns on a wide window (first contacts, stations seen,
situations, a link to events | anomalies, dig sites, special projects), the first-contact map
below them at full width (the user's ask, 2026-11-15): first
contacts as a table (age in months, difficulty, clues, stage — its number alone, `contactStage()`:
the game's stage keys name the contact's kind and way, spoilers, the user's ask 2026-11-17 —, days left, envoy, jumps from our
border along hyperlanes, their stations) and a map (open contacts by difficulty and age, ✉ with
an envoy); situations, anomalies, special projects (no progress in the save), dig sites (named,
with their next chapter: the save's `index` + 1, `DigSite.chapter` since READER 58), a link to
events. **The user's asks 2026-11-20:** situations' progress and ±/mo to two decimals; a ±/mo the
save gives as 0 (`last_month_progress`, kept 0 by a situation that script effects move rather than
its `monthly_progress` — Operational Reserves read 0 three months running while falling ~230 a
month) is taken from the last earlier save with that situation, marked ≈ (`observedMonthly()`).
Later the same day: a Next column, when the situation reaches its next stage at that ±/mo — the end of
its stage going up, its start going down (`nextStage()`, from the save's `stage_durations`); progress
shows "/ end" where its one stage does not end at 100 (the Alarm Clock mod's reminders, 1000), and
with several stages each from where it starts, the current one bold (`stageLadder()`; the user's ask:
Operational Reserves "Critical 0 · Low 1300 · Medium 6500 · **High 19500** – 26000"), and the "runs to 100" note says so only where every row does. A situation the
data leaves unnamed (its text a scripted loc the game fills in, the Alarm Clock mod's
`[This.GetAlarmLabel]`) is named by `fallbackName()`: Alarm Clock's `alarm_for_<what>` situation
flag ("Reminder: Celebrate Diversity"; `SituationInfo.flags`, READER 70), else its type. A permanent
situation (`permanent = yes`, data DB `situation.permanent` since 2026-11-20: in 4.5.4 only every
nomad's Operational Reserves and the Forever Cruise origin's Passenger Satisfaction) stays on top
whatever the sort, a line below it (SortTable's `pinned`, `pinFirst()`); with an older data DB, none
is pinned. Unplugged's Embodied Identity has no ending effects but is not permanent: it ends at
either extreme. An **L-Gate badge** (2026-11-20, `lgateRelated()` in `#lib/lgates.ts`) marks an anomaly,
special project or dig site whose name or outcome tree names the L-Gates or the L-Cluster: L-Gate
Insights (`distar.9000`, 3 in 10 on 24 anomaly categories in 4.5.4), the L-Gate Activation tech, the
L-Cluster project. The tree is behind the outcomes spoiler, so with it off only the name tells. "Still to
gain" lists its resources in the `all` header's order (`inStripOrder()`, research last). Between
Situations and Events, **L-Gate** and **Precursors** (2026-11-20, `#lib/frontierChains.ts`): the
situation log's chains (`Snapshot.eventChains`, READER 71; data DB `event_chain` with each chain's
counters and their maximum). L-Gate: insights of `l_cluster_chain`'s `clues` (7), the first L-Gate
(`encountered_first_lgate`), L-Gates in known systems (bypass `lgate`), L-Gate Activation, and the
sources now — the repeatable L-Gate Insight tech on offer, the open rows with the badge. Precursors:
each precursor chain we started (category `precursors`), its artifacts (6) and its home system's
chain. Which precursor a galaxy has is a secret until found (`precursor_<n>` system flags: 5 is the
Cybrex, 92 systems in Roaming Cybergang), so none shows before. The cheat `precursorsAll` (intel, so off in
multiplayer and Ironman; the user's ask 2026-11-20) adds everything the save holds
(`Snapshot.precursorIntel`, READER 72, dropped by `pageLatest()`; `precursorGalaxy()`): every precursor
the game knows (`PRECURSORS`: Vultaum 1, Yuht 2, First League 3, Irassians 4, Cybrex 5, Baol, Zroni,
Inetian Traders, adAkkaria), whether the setup disabled it, its flagged systems visited / all (the five
with a star flag of their own), and every empire collecting it with its artifacts and home system.
Roaming Cybergang 2226.08.01: only the Cybrex, 58 of 92 systems visited, nobody collecting. With it
the first-contact map also rings every precursor place (`precursorPlaces()`: the systems with a star
flag, the Zroni and Baol dig sites), the precursor on hover; undiscovered ones too, dashed, at their
position only (the server sends it, the map draws no star there; `extra` fits the view to them, a
"precursors" fit button). Roaming Cybergang: 92, 34 undiscovered.
**Nomads get precursors as anyone** (4.5.4): the intro is an `on_survey` random event (`precursor.2000`
for the Cybrex: weight 6 against 100 for nothing, so ≈ 6 % per body surveyed without an anomaly in one
of its systems), with no `is_nomadic` anywhere in the chain; the home system's link spawns at a
waystation of ours in one of its systems, else any waystation, else a colony
(`precursor_capital_spawn_system_effect`). The nomads' `precursor_system_*` variables are Wanderlust's
exploration tracker (the `precursor_system` star flag), not this chain. The spoiler `precursorBadges` (the user's ask
2026-11-20) puts a **Precursor badge** on anomalies, special projects and dig sites that lead to a
precursor, the precursor named in its tooltip (`precursorsOf()` in `#lib/precursorLinks.ts`, from the
whole unresolved outcome tree whatever the outcome spoilers say: 62 anomaly categories, 88 projects,
20 dig sites in 4.5.4; Grunur counts as the Baol). None in Roaming Cybergang 2226.08.01, which has no
precursor chain yet. "Still to gain" has a **Leads to** filter (L-Gate, and Precursor while
that spoiler is on): both unticked show every source, a ticked one only the sources leading there
(`leadsTo()`; the server sends the gains four ways, `gains[all|lgate|precursor|either][kind]`). A
source chip's click unfolds its kind's panel first when folded (Panel's bindable `open`), then
scrolls to the row.
Stations seen hides an empire we talk to by the system's owner now, not the one at the sighting
(Aphris, seen 2219 under another empire). The first-contacts table scrolls sideways inside its
column; anomalies, dig sites and special projects fold by their title (`Panel`'s `collapse`, kept
per browser). Stations seen: each shipset in a colour of its own, and "group by likely empire"
(the Owner column's territories: a known empire, or a guess — one shipset within `GUESS_JUMPS`
jumps; clusters of one shipset far apart are numbered, `SeenRow.group`). Still to gain: each
resource in its game colour (`colorOf`; minor artifacts, nanites, astral threads and the rare
resources sampled from their icons 2026-11-20). **Gone, kept greyed** (the user's ask 2026-11-16: "some decisions come after I officially
finished something like anomalies … keep them in the overview, at the bottom and greyed out"):
below each of situations, anomalies, dig sites and special projects, what earlier saves of the
branch had and the shown one no longer has (`gone()` in `#lib/situations.ts`; finished or lost —
the save cannot tell), with "Last seen" and the same columns, Outcome included. Roaming Cyber Gang
2213.08.02: 8 anomalies. **Hidden until asked for, newest first** (the user's ask 2026-11-17): a
checkbox per panel, "also no longer in the save (n)", off on every load; the table starts sorted by
Last seen, descending. **≈ finished, inferred** (the same ask; `#lib/inferDone.ts` pure): a
Status column on gone anomalies, projects and dig sites says `≈ finished` (a dig site `≈ chapter n
done` short of its last) where the save has an effect only that one source gives —
`uniqueMarks()` over every outcome tree: the country flags its events set (data DB
`outcome.flags_json`, extraction since 2026-11-17; read only where `PRAGMA table_info` has it, so
an older data DB infers from the rest), the modifiers and deposits in its tree. Checked against the
save the gone lists compare with: `countryFlags`; `countryModifiers` and colonies' planet
modifiers; deposits on the source's own planet (`campaignGalaxy` bodies, colonies). The tooltip
names the evidence. Techs never count (research gives them too); ship and uncolonised-planet
modifiers are not in the save reading. DB copy 2026-11-17: 1 of 14 gone anomalies
(Interference, flag `lcluster_clue_sonic`) — the rest give only resources and research, which
leave nothing to find. Spoilers are display switches in the profile (`anomalySpoilers`, `projectSpoilers`,
`digSiteSpoilers`): the **Outcome** column (the user's ask 2026-11-15, `#lib/outcomes.ts` pure,
`Outcome.svelte`, `server/outcomes.ts`) — the data DB's `outcome` trees, a project's own tree
filled in where an anomaly leads to it (`withProjects()`), as markers, the first rewards, and the
whole tree on opening (its plain text as the tooltip), **every level folding on its own**
(an event, option, branch, chapter, project; open at the first level and where only effects
follow; the user's ask 2026-11-17). **What this empire cannot get is greyed** (the same ask):
the data DB's conditions (`c`, extraction since 2026-11-17: an event's `trigger`, an option's
conditions, an `if` chain's limits, a weighted branch's modifier — in a ship event only its
`owner = { … }` part) read by `resolve()` against `facts()` of the latest save, three-valued:
`holds()` takes a false answer only from what the empire _is_ (ethics, civics, origin,
authority, DLC, gestalt…) — a flag, tech or modifier the chain may still bring is unknown while
absent (Shattered Frontier's hostile reply hangs on a flag its own dialog sets). Greyed: `off`
events and options with the condition on hover, `if` branches not `taken`, a weighted branch
settled at 0; `prune()` leaves them out of markers, summary and gains, and a row with nothing
left is greyed. An older data DB has no `c`: nothing greys. A dig site's chapters before the next
one are greyed as done. **What a reward comes to now** (`Now`, `outcomeNow()`; the user's ask
2026-11-17), in the tree, its summary and every tooltip (map, planner, upcoming): months of income
"≈ +543 now" (`monthsNow()`, the latest save's gross income, clamped — the same as Still to gain),
its "(min …, max …)" greyed; tech progress "≈ 165 physics, 3.6 months of ours" (the share × the
tech's cost at the save's cost factors, `techCost()`; the time at our research in that field,
none for a tech researched). The page gets the techs as a table (`nowTable()`, every tech the
outcome trees give progress in): a function does not serialise. **Where a tech stands, and what kind of reward** (the user's ask
2026-11-19: does a research option help my plan, is it researched, is it already a permanent
option): every tech reward and research option carries chips (`techFlags()` / `techMarkFlags()`,
`TechMark` from `outcomeNow()`): _researched_ (wasted; outranks the rest), _already an option_
(`techPermanent`: a further one adds nothing) or _permanent option_ beside progress, and the plan's
goal — _planned_, _helps your plan_ (a wanted tech's prerequisite, `planSummary().plannedTechs`,
note "needed for …" on hover), _planned later_, _avoided_; the tooltip text appends them as
`[label]`. Only the frontier passes the plan: the map, planner and upcoming tooltips show researched
and permanent alone. Beside the markers, tinted, **reward badges** (`rewardBadges()`, on the pruned
tree): physics / society / engineering (research points, months of research income, tech progress,
a tech), research option, each resource, fleet (ours), _leader offered_ (only behind a choice's
option) or _granted_, leader xp, trait(s) by name, then relic, specimen, deposit, modifier, new
pops, megastructure, planet changes. Still to gain lists research options as rows of their own
(`option:<tech>`, struck through when researched or already permanent) and a tech given outright
as +100 % of it. **Still to gain** (`#lib/outcomeGains.ts`, the user's ask 2026-11-17),
above the anomalies while one of the three spoilers is on: the pruned trees of the open
anomalies, projects and dig sites (from the next chapter) summed per reward — _sure_ on every
path, _expected_ by the odds (an unsettled `if` as even odds); at an event's options the one
worth most in trade; projects an outcome leads to count; months of income from the latest save's
gross income, clamped, ≈. The resources' worth in trade (`valuesOf()`), sure and expected.
Each reward names its sources, one chip each in its kind's colour (anomaly, project, dig site;
with how long it takes, as in its table; the user's ask 2026-11-17: kinds alone hid which one gives it), a certainty badge (sure; likely ≥ 50 %; possible) and the popup of a tech, modifier,
trait or deposit (`GainRow.ref`, `effectRef()`). Tech progress names the tech's tier, area, its
cost to us now (`techCost()` in `#lib/events.ts`, shared with Upcoming's research) and the
expected progress in research, its area in the field's colour; a tech already researched is struck
through (the progress is lost). **Filters** (the user's ask 2026-11-17): sure / possible, and which
kinds of source count — the route sends one `gainRows()` list per kind and the page merges the
ticked ones (`mergeGainRows()`), so the amounts and totals follow the filter. Hovering a source
chip highlights every reward it gives and its row in its table (matched by kind and name);
clicking it scrolls to that row (`SortTable`'s `anchor`, `data-anchor`), lit for 2 s. **Time** (the user's ask 2026-11-17,
`#lib/frontierTime.ts`): each table's Time column, before speed bonuses, with our best scientist
on a science ship (`civilianShips`, max `leaderLevel`): an anomaly by
SCIENCE_SHIP_ANOMALY_RESEARCH_DAYS (`anomalyDays()`, shared with the ships' order totals); a
ship's project its `days_to_research`; a research project ≈ its `cost` (data DBs since
2026-11-17) at the gross monthly research of its department, which halts meanwhile; a dig site ≈
the expected rolls of its remaining chapters (`expectedRolls()`: a d10 + skill + clues −
difficulty, 14 finishes, 11–13 +2 clues, 6–10 +1, `standard_archaeological_site_on_roll_failed_case`;
the next chapter from its clues and `days_left`, later chapters' difficulties from the tree, so
only the next one without the spoiler) — its assumptions are open check A5.
**Stations seen hides empires we have communications with** (the user's ask 2026-11-17;
`SeenRow.talking` from the latest save's relations, the owner id stays on the server): their
territory is on the map; a checkbox shows them again. Checked
2026-11-17 on a DB copy: 52 nodes greyed (origin Evolutionary Predators, civic Determined
Exterminator …), 8913 trade sure, 11509 expected. **Markers** (`markers()`): _known_ — no
chance, no choice, no condition anywhere, projects included; _random_ — a random list with two
branches or more; _choice_ — an event with two options open to one empire (conditional options
count as one variant: "Study the orb." / "Eat the orb."); _depends_ — a conditional option, a
weighted branch with conditions, or an `if` whose branches differ; _project_ — leads to a further
special project; _later_ — something fires a year or more later (the Orb's explorer: ~100 years);
_risk_ — a leader killed, a ship or fleet destroyed, resources taken, or a fleet not ours. Random
branches show percentages, or weights where a branch has conditions (the Mineral Cluster: 0, or 1
while the scientist lacks the trait the branch gives). The same text is the tooltip on the map tab,
on the planner's anomaly and dig-site suggestions and on Upcoming's excavation rolls. An older data
DB has no tree: the column falls back to the outcome events' titles. So is `contactStations` a switch: visited systems coloured by their
station's owner, and every map's borders named — the save names it before communications, a
spoiler. **Stations seen** (`Snapshot.stationsSeen`, `stationsSeen()` in `server/world.ts`): other
empires' stations in the systems our fleets are in when the game saves (`fleet.<id>.movement_manager.coordinate.origin`),
with the owner's shipset (`graphical_culture`) — what the player saw being there. A snapshot field,
so it follows the save graph; `mergeSightings()` keeps first and last date per system. The owner id
stays on the server unless we talk to them. Monthly autosaves catch only the fleets present then
(2207.03.10: none yet — every fleet abroad sat in a station-less system). **The galaxy is not stored per snapshot** (~1.6 MB at 2207.03.10): `Snapshot.galaxy` and
`Snapshot.surveyedAll` (expansion candidates and habitat sites as if every planet were surveyed: 2448
planets vs. 51) go to the `galaxy` table, one row per campaign holding its latest reading
(`galaxyOf()`; rows before 2026-10-18 hold the systems alone); every system's place, star, lanes
and bodies (each `surveyed` or not), owner and megastructures only for visited or own systems.
Pages read it through `campaignGalaxy()` (`server/mapSystems.ts`), which applies `surveyView()`:
bodies of visited or own systems only, anomalies only on surveyed planets — or everything with the
`surveyAll` spoiler, which also swaps the expansion and habitat lists (`expansionOf()`,
`surveyedAll()` in `server/expansion.ts`; the campaign's latest reading, not the branch's).
**L-Gates** (`lgates` spoiler): every L-Gate system (`GalaxySystem.lgate`, an `lgate_base`
megastructure; 2207.03.10: Eye of Bal, Ribellan Vortex), named, with an L-Gate marker. The
L-Cluster (`lcluster`: star flags `lcluster*`) only exists once the gates open — 4.5.2
`events/distant_stars_events_3.txt` `distar.11000` spawns it then, 550–560 from the galactic
core at 44–46°, its other systems relative to that within ranges; then every gate links to its
entrance `lcluster1` (`lgateTo`, a star), drawn like a wormhole in cyan. Before that the spoiler
links every gate to `PREDICTED_LCLUSTER` (`situations.ts`, id −1): 555 from the core at 45° from
−x towards −y — calibrated 2026-10-19 by `event distar.11000` in a throwaway game: `lcluster1`
(Final Egress) at (−395, −396), its eight other systems (`lcluster2`… `lcluster4b`) around it
within ~70; the event did not set `lgates_activated_globally`. Without the spoiler a
gate's link shows once both ends are visited. **First contact** markers take the game's map icon
blue (`#6478c8` on `#284088`, sampled from a screenshot: `firstcontact_map_icon.dds` is a cyan
saucer the map does not show).

**Focus, traditions, tech, leaders, species, contacts** (one route each):

- **focus** (`#lib/focus.ts`): the open and done cards (hint, requirement, the progress each
  gives: 10 / 25 / 50 by tier, core cards to all three) and per category the next reward and the
  one after. A reward is `add_research_option` — "permanent until researched" (4.5.2
  `logs/script_documentation/effects.log`): no research, no progress. Several options are an
  if/else on the empire, not a choice; the one ours is evaluated (`is_diplomatic` …) and the
  ⓘ popup says why. Categories in the game's colours (`focus-*` in `colors.ts`). ▸ on a category
  unfolds every tier (`FocusRewardRow.tiers`, the game's Empire Progression panel; the user's ask
  2026-10-31): unlocked, current with its progress, or its cost and the points still to go (a
  tier costs its points, the rest carries over), each with "+ goal". Checked against the panel
  (Roaming Korinth, nomad with bio ships: all ten Conquest tiers; Exploration tier 5 Planetary
  Engineering for nomads, Terrestrial Sculpting otherwise — `is_nomadic` in the reward).
- **traditions**: the active effects in two tables, traditions and perks (`totalEffects()`,
  `EffectTotals.svelte`, shared with the Government panel; text-only effects listed apart), every
  adopted tree in full with each tradition's effects (not yet active ones grey), the other trees,
  every perk (taken first, conditions not checked). **Each tradition and perk as this empire's
  variant** (data DB `tradition_swap`, `#lib/swaps.ts`, the user's report 2026-11-18): a nomad's
  Mastery of Nature raises harvest output and unlocks no decision, Expansion's Colonization Fever
  is Arkship Armada. The first swap whose trigger holds; its name, text and modifiers (the owner's
  where it `inherit_effects`) under `<kind>:<swap id>` in the explanations. The same lookup feeds
  the empire tab's popups and size estimate, district caps, the galcom tab's diplomatic weight and
  leader recruitment cost (the sums any swap's modifiers reach, checked 2026-11-18 in the 4.5.4 data);
  councilor skill and the other `tradition:` sums still read the owner's.
- **tech**: the three queues with due dates (`events.ts`), the cards on offer **now**
  (`tech_status.alternatives`; the game redraws a field's cards once its tech is done) with ▶ the
  one being researched, ★ the permanent options and the progress of queued ones, ↺ that of techs
  switched away from (`Snapshot.techKept`, READER 49; the user's ask 2026-11-06), and under
  "Researching" every tech holding kept progress, "on offer" where it is a card again, "offered over
  time" (`#lib/techOffers.ts`: a run of saves with the same cards is one offer, the pick = the
  field's tech researched meanwhile), research tiers, everything researched. **Research bonuses
  and how they stack** (the user's ask 2026-11-05: "the good ones are applied multiplicatively,
  the regular ones additively"; `#lib/researchBonuses.ts` pure, `server/researchBonuses.ts`,
  `panels/ResearchBonuses.svelte`): per area three piles — **speed** (`all_technology_research_speed`,
  `country_<area>_tech_research_speed`, `category_<field>_research_speed_mult` for the tech's field,
  `rare_tech_research_speed_mult`), **output** (`country_`/`planet_jobs_<area>_research_produces_mult`)
  and **cost** (`<area>_tech_cost_mult`, difficulty × tier, slider, empire size +0.2 % above 100).
  Sources: every empire-wide one `empireHeld()` lists (species traits and rights left out: they act
  on their pops' jobs), policies by policy (`policyModifiers()`: the data DB keys options by name,
  so General Studies — an option of all three research policies — holds the physics one; read with
  the policy's area), the council through `leaderRoles()` (seats at the councilor level, councilor
  traits with their conditions weighed: the councilor subclass's +5 % is conditional), and
  situations at their stage (`GameData.situationStageModifiers`, extraction 2026-11-05; `{}` with an
  older data DB). **Speed bonuses add up — measured**: the speed applied (`researchSpeed()`,
  progress ÷ output between month-start saves) equals 1 + the sum of the lines, exactly, in every
  area: Planetforgers ×1.48 (Discovery 0.10, fanatic materialist 0.10, Administrative AI 0.05,
  General Studies 0.10, Head of Research 0.02 × 4, Statistician 0.05; multiplied they would give
  ×1.555), Roaming Korinth ×1.19 (Science Officer 0.02 × 3, Spark of Genius 0.03, Nomad Economy
  at Operational Reserves: High 0.10) and ×1.24 in engineering (+ Improved Energy Initiative on
  Materials 0.05), Yorphia ×0.94 (Energy Extractors −0.10, council 0.04), UNE 2 ×1.02 (measured on
  stored points: an area researching nothing stores at the same speed). So one more bonus is worth
  bonus ÷ (1 + pile) (`realGain()`); the piles multiply (time = cost ÷ (output × speed)). The
  panel says when the lines miss the measured factor.
- **leaders**: `Snapshot.leaderList`, traits explained by `ltrait:<key>` (data DB `leader_trait`,
  each modifier labelled with its scope); class colours (`class-*` in `colors.ts`, envoys ours);
  envoys behind a switch, off by default. **Leader modifiers from the empire** (the user's ask
  2026-10-31: "other sources of leader properties apart from their traits, e.g. experience gain";
  `#lib/leaderSources.ts`): every held source (`empireHeld()`, shared with the colony levers)
  whose popup carries a leader modifier (`isLeaderModifier()`: experience, skill, lifespan, limits
  and pool, upkeep and cost, council, envoys), summed per modifier. Traditions' and perks'
  triggered modifiers now carry their condition (`Modifier.when` from
  `tradition_modifier.potential_json`) and are weighed against the save — ap_wanderlust's second
  −10 % upkeep only once a category is completed; "?" where the save cannot tell.
- **species**: traits with their effects in a grid (the climate preference, one line per planet
  class, a row of its own; more picks wrap into more rows), trait budget, rights. System names
  from random-name lists that are localisation keys (`VOIDWORM_SYSTEM_12` = Papqaqtet) resolve
  through the data DB's `prescripted_name`.
- **contacts** (`#lib/contacts.ts`): the relations table ("Relations"), its filters and columns
  being the profile's `contactView` (stored at once, `PUT /api/settings`). Filters by **kind**
  (`kindOf()`, `KIND_TYPES` from 4.5.2 `common/country_types/*` — re-check on game updates):
  other empires (`default`, the only one on by default), fallen, enclaves, traders (the
  Caravaneers), pre-FTL civilisations (`primitive`), space fauna (leviathans and guardians
  included), marauders, other (factions, the Shroud, event countries). Names are `EmpireName`
  (map-colour swatch) with `EmpireBadges` (fallen, enclave, nomadic, … — shared with the trade tab).

**Tech tree** (the tech tab, under Researching and On offer; the user's ask 2026-11-16: "tech
tree plus the +/− want buttons", after androdawton's stellaris-tech-tree; `#lib/techTree.ts` pure,
`TechTree.svelte`, `planner/WantButtons.svelte`). One field at a time; every tech the empire can
still get — a `potential` the save rules out leaves it out (lists follow the playthrough), an
unknown one stays. A column per step of prerequisites within the field, never left of the tech's
tier (techs without a tier — events, Fallen Empires — by depth alone); rows by a few barycentre
sweeps over prerequisites and what each leads to, so edges cross less. Dashed edges: one of an
`OR` group; ↖: a prerequisite in another field (listed, not drawn). Colours: researched, being
researched, on offer, within reach (`inReach()`), not yet; badges: want, later, avoid (the
plan's `plannedTechs`, which carry their goal id since 2026-11-16 so the buttons can edit and
remove). Hover: + want / − want, or switch and ✕ once planned. Click: what it needs and leads to,
both clickable; "show" fades all but the techs within reach, the wanted ones with what they need,
or the clicked tech's path. Tooltips are built from the tree's own data, not the `tech:`
explanations, which would put ~650 popups on the page.
