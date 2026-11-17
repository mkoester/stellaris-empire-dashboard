# Tabs: shell, settings and what every tab shares

Upcoming events, cooldowns and expiries, popups, tabs and settings, the `all` and custom tabs, the time window, colours, and the profile switches for spoilers and cheats. Read before working on the layout, ⚙, a popup or a chart shared by tabs. Where the tab list says a tab is described "below", its notes are in the `tabs-*.md` file that `AGENTS.md`, "Tabs", lists for it. _Moved verbatim from `AGENTS.md` on 2026-11-14._

**Upcoming events** (`events.ts`, pure): research per field, next tradition, council agenda, build
queue items, the next election and **deficits** (`deficits()`: when a stockpile runs empty at its
monthly balance, or "in deficit" once empty — the game applies `<resource>_deficit` then, 4.5.2
`09_static_modifiers_deficit.txt`, without warning ahead; the row's popup shows its effects),
sorted by due date. Checked 2026-10-19: at 2210.01.01 (24.65 energy, −30.56/month) it gave
2210.02.01, the date of the save's `timeline_first_deficit`. In the save an empty resource is
**missing from the stockpile**, and no `*_deficit` modifier is stored. 4.5.2's `energy_deficit`
has every effect commented out — an energy shortage costs nothing directly. Rates are _measured_ — progress between the
branch's two latest saves, so every speed bonus counts — and costs are base costs from the data DB
scaled by empire size and the galaxy sliders. Checked against the game at 2200.04.01: research
53/71/108 months, tradition 2200.09.01 exact; the agenda is 164 vs. the game's 163 (rounding).

**Cooldowns and expiries** (`expiries()`, the user's ask 2026-10-25: "track everything with a
cooldown or that expires"; built in `branch()` next to `upcoming()`, as it names modifiers by
their popup titles): every timed modifier and timed flag on the empire and its colonies
(`countryModifiers`, `Colony.planet.modifiers`, `countryTimedFlags`, `Colony.timedFlags`), edicts
with an end, trade deals (start + years), the GalCom recess (`galcom.nextVote`) and
`Snapshot.cooldowns` (reform, focus dismiss and change, capital, species rights, insults). Decisions, artifact and astral actions and
enclave deals keep their cooldown as a timed modifier (`arcane_deciphering_cooldown`, 720 days) or
a timed flag (`curator_guidance_cooldown`); the data DB's `action_timer` names the actions waiting
on each (`cooldown` rows: "<action> available again", ⚠ — the game does not announce it) and those
that only set it ("ends", "from <action>"). **Timed flags**: `flag = { flag_date flag_days }`,
`flag_days` = days left, `flag_date` the set date in hours (2200.01.01 = 62808000)
(`timedFlags()`, READER 21). A flag no action names is an event chain's timer
(`curator_clue_purchased`, 10–13 years at random): only with the `hiddenTimers` spoiler; `sdash_*`
(the mod's own) never. Not read: a leader's `cooldown` (days, meaning unknown), the designation
change date (only the AI has a cooldown, `AI_DESIGNATION_COOLDOWN`). **The engine's own cooldowns,
checked against the game's tooltips 2026-10-25** (throwaway `unitednationsofearth_-15512622`,
`~/Pictures/Screenshots/screenshot_2026-10-25_19-52-10` … `20-02-32`), all "possible again" dates
the save holds: `government_date` (reform; "we must wait at least 18 years (2220.07.21)" in a game
started 2200.01.01), `capital_date` ("not possible to move capital until 2212.07.01"),
`last_changed_<right>` in the species' rights block — despite the name the date it may change
again (2212.05.01 after a change on 2202.05.01) — and `country.ai.last_diplo_actions = { { country
action creation_date } }`, insult + 30 days (INSULT_COOLDOWN_DAYS), per empire: another empire
could be insulted the same day (READER 23). A 30-day insult cooldown rarely spans two monthly
saves, so its run-out row is often missed.
`action_timer` covers decisions, artifact and astral actions, relics (every relic waits on
`relic_activation_cooldown`: one row "A relic triumph available again" — `ACTION_GROUPS` names
a timer that blocks more than three actions of one kind), diplomatic actions (Satisfying Insults:
gated in the effect's own `limit` — role `bonus`: Insult stays possible, the row reads "Satisfying
Insult available again · with the next Insult", as the game's tooltip has it), federation laws (their timers sit on the federation, not
read yet) and enclave deals.

**Run-out cooldowns stay** (`timedOut()`, the user's ask 2026-10-25): along the branch's saves each
cooldown instance (a timer an action waits on, per scope — the empire or a colony, so one decision
on two colonies is two rows —, launched agendas, reform and focus) keeps its latest end seen; once
passed it is a row "<action> available" (`months` 0, at the top) until renewing it in game sets a
later end, or the player dismisses it (✕ → `POST /api/upcoming { dismiss }`, setting row
`dismissed:<campaign>`, ids `<scope>:<kind>:<key>:<until>` — a new round is a new id). Checked in
game 2026-10-25: Find Applications run out on a reloaded 2202.07.01, ✕, a month on unused — gone
(`~/Pictures/Screenshots/screenshot_2026-10-25_21-05-23`); used again on the left branch, its row
went by itself. Distribute Luxury Goods on Earth and Unity: two rows.
**Idle stays too** (`#lib/idle.ts`, the user's ask 2026-10-31: "prevent anything being idle unless
I decide it should be idle right now"): a research field without a tech, no agenda in
preparation, a colony queue or a shipyard with nothing in it (an arkship has no queue of its own for ships:
it builds them through its colony's shared one, so its colony's row covers it — READER 39), a leader
without a post, an empty council seat, free leader slots (`leaderLimits`, ≈) — rows of kind `idle`,
⚠, ✕ — and the idle civilian ships' own rows get ✕ (`withIdleShips()`). The dismiss id ends with
the first save of the idle spell, walked back along the branch's saves: busy again, then idle,
is a new row. 2206.10.08 (Roaming Korinth): 2 official and 2 commander slots free, the arkship's
shipyard (before READER 39: since then the arkship's colony row), one idle science ship.
**Planned techs on offer** (`plannedOnOffer()` in `#lib/techOffers.ts`, the user's ask 2026-11-06:
"when I planned some tech, I want to get notified once it pops up in my current list of available
tech options"; in Upcoming for now, its own place if more such notices come): every wanted, unparked
tech goal — the prerequisites `techNeeds()` adds included, with their "needed for …" note —
among the latest save's cards and not the field's research is a row of kind `offer`, ⚠ (the game
does not point it out), ✕. `planSummary()` hands the wanted techs to `branch()` (cached with the
plan). The dismiss id ends with the offer's first save (`techOffers()`: a run of saves with the
same cards), so a later draw offering it again is a new row; picking it in game ends the row.
Checked 2026-11-06 on a DB copy (Yorphian Extractorate, node 533): no row before planning; rows for
`tech_lasers_2` and `tech_bio_reactor` (on offer), none for `tech_physics_1` (being researched); ✕
removed only its own row. Seen in game 2026-11-06 (the user): "2200.02.02 · now · Quantum Computing ✕ · ⚠ planned tech · physics · on offer since 2200.01.01".
**A tech planned for later or to avoid** gets a row too (2026-11-16; `later`, "avoided tech":
"pick another card"), and with companion mod 0.13.0 the rows follow the cards it logs on the 2nd
of each month (`withLiveOptions()`, `docs/companion-mod.md` "Research options").
**Rolls** (`rolls()`): an envoy's next roll on a first contact and an excavation's, the save's
`days_left` (`last_roll` stored too, READER 22). **Ships on their last task always show**: without
a measured rate a civilian order is ≈ its days at the base rate (one a day), else its travel;
military fleets (`Fleet.fleetId`, READER 22) on a move ≈ jumps left × days per jump — the fleet's
own since the save before (`daysPerJump()`), else our ships' median (`measuredDaysPerJump()`), else
`DEFAULT_DAYS_PER_JUMP` (10, a placeholder: monthly saves give one measurement, 30, a bound).

**Popups** (`InfoPopup.svelte`, `server/explain.ts`): traits, edicts, council agendas, techs,
jobs, colony designations (`designation:`, data DB `colony_type`; `Designation.svelte` reads them
from the page's `designations`, which `branch()` picks for every page) and the empire's identity (`civic:`, `origin:`, `authority:`, `ethic:`, `gov:`) explained from
the extraction DB — descriptions, modifiers (edict/agenda ones live in `tradition_modifier`, techs
in `technology_modifier`), a few facts. **A tech's popup is its research card** (the user's ask
2026-11-06: "more than the flavour text, aligned with the planner"; `#lib/techCard.ts`, a copy of
which builds the planner's): tier, base cost, rare/dangerous, what it needs (OR groups as "A or
B") and leads to, its modifiers, and the card's unlock lines from the data DB's `technology_unlock`
("Unlocks Building: Field Dynamics Center", "Unlocks Feature: Auto-Research Technologies") — none
from a data DB without that table (extractor before 2026-11-06). **The popup lives in the top
layer** (`popover="manual"`, placed by `#lib/popup.ts` in viewport coordinates, below the name or
above it where there is more room): a scrolling panel cut it off while it was positioned inside it
(Upcoming, the user's catch 2026-11-06), and every panel with `overflow-*` had the same problem; a
scroll anywhere but in the card closes it. **Every tech named anywhere has its card** (the
user's ask 2026-11-06: "check every place you display specific techs"): `InfoPopup`'s `ref`
(`tech:<key>`) fetches the card on first hover from `GET /api/explain?ref=` when the page carries
none (`getExplanations()`, the data DB's cards only — built ones like `focuscard:` are not served).
Places: Upcoming, the tech tab, focus rewards, trade-off presets (all carried), the planner tab's
goals, suggestions, shortcuts, history and "reached" lists (`About.ref`), researched events
(`Milestone.ref`), attraction sources and their needs, blocker hints ("needs …"), the research
bonuses' tech in progress, locked edicts ("🔒 needs …", formerly a native title), research
agreements (sped-up tech, their techs we lack, hints) and the shipyards' capital sizes. Left as
text: techs inside sentences — a goal's "needs …"/"needed for …" note and status, the charts'
event strip. Not yet seen in a browser. Civics and origins follow the planner's pages: the effects
tooltip as text, job swaps, unlocked buildings, granted traits, the council seat (its modifiers
per leader level as `after`); ethics their implications (`ethic_tag_label`) and forbidden
policies. The **Government panel** (`panels/Government.svelte`, `identity()` in `server/empire.ts`)
sorts the save's flat `government` list by the kind the data DB knows each key as, and sums the
choices' flat modifiers in `#lib/effects.ts` — **adapted from the planner's `collectEffects`**. Each
part keeps its kind (`EffectKind`), shown as a `SourceBadge` (origin, civic, ethic, gestalt for the
gestalt consciousness ethic, authority, tradition, perk, GalCom, …); the empire modifiers panel
badges a timed modifier `agenda` (`agenda_*`), `situation` (`*_stage_<n>`) or else `event`. The modifier formatting in
`modifiers.ts` is **copied from the planner's `src/lib/civics.ts`** — keep the two in step. The
popup itself is plain CSS: the planner's needs Skeleton UI.

**Tabs and settings:** the layout's tab bar shows the custom tabs, then `all` (`/`), `planner`
(`/planner`, see "Planner tab"), `colonies`
(`/colonies`: all colonies in one table, see below), `colony` (`/colony` → first colony,
`/colony/[id]` with a dropdown; old `/planet/[id]` links redirect; its "Pops by species" panel and
the Pops (jobs) chart's `enslaved` line come from `Colony.speciesPops` (READER 51) and the species'
citizenship, `#lib/colonySpecies.ts` — **4.x has no slave stratum**: enslaved pops are `worker`,
`specialist` or `civilian` (`slave_unemployment` only when jobless), so `employed` includes them),
`map` (`/map`, the discovered galaxy, see below), `history` (below), `migration`, `expansion`
(`/expansion`: the Expansion panel full-size, see below), `growth` (`/growth`, see below), `jobs` (`/jobs`, see below), `bonuses` (`/bonuses`, what one more bonus is worth: `docs/tabs-economy.md`), `trade` (`/trade`, see below), `produce` (`/produce`, see below), `systems` (`/systems`, see below), `trade deals`
(`/deals`: running and ended deals, their monthly resources, `#lib/deals.ts`), `market`
(`/market`: prices over time and the standing orders, `#lib/market.ts`), `slave market`
(`/slaves`, `#lib/slaveMarket.ts`: offers now and before, the mod's sales; shown where our policy
`slavery` is `slavery_allowed`, else per ⚙'s `slaveMarket` mode — `mine` (default: while a species
of ours with `citizenship_full*` is offered, matched by name), `all`, `hide`; `slaveTab()` per tip;
sales between two other empires barred under `viewedNoCheats()`), `resources`
(`/resources`: per resource, in the Resources strip's order (`stripOrder()`), a chart — stockpile
left, net per month right (`resourcePanelSeries()`) — and the latest save's month by budget source
(`Snapshot.budget`, every source, the market's as `market:<source>`; `resourceBudget()` in
`#lib/flows.ts`; its total is the save's balance: 2207.04.02 energy +3.455 both), and below it
what the budget does not explain (`unbooked()` in `#lib/series.ts`, see "One-off spending" in `docs/save-format.md`)),
`influence` and `pacts` (below),
`trade-offs` (only with its switch, below) and `events`
(`/events`: the milestone log, searchable, filtered in the page), `government`, `ethics`, `situations`, `shroud` (patrons and attunement), `focus`,
`traditions`, `tech`, `leaders`, `species`, `contacts`, `galcom`, `diplomacy`, `subjects`, `megastructures` (all below), `galaxy` (the galaxy setup, below), `mods`,
`dlc` (see "DLCs and mods" below) and `about` (last: thanks to the mods, projects and libraries the
dashboard learned from — **a feature inspired by a mod gets its line there**); tabs keep `?node=`.
**A tab with nothing to show yet is dimmed** (the user's ask 2026-11-01; `#lib/tabData.ts` pure,
`emptyTabsAt()` per tip in the layout): migration, trade deals, galcom, shroud, diplomacy,
subjects and situations, each while no snapshot of the branch holds its data — its title says why, it stays a
link. A tab whose field no snapshot knows (an older reader's null) is unknown, never dimmed; a new
check goes into `CHECKS`. **Every list is a `SortTable.svelte`** (the user's ask
2026-10-23: "make all tables sortable"; columns as `Column<T>` from `#lib/sort.ts`; `sort={{
column: '', desc: false }}` keeps the given order — the game's, a queue's — until a header is
clicked; `rowClass`/`rowStyle` set a row apart, `below` adds a details line under each row). Left
plain: key/value layouts (council seats, policies, species rights, tech queues and cards by
field, the Government panel), the matrices (migration heatmap, research tiers, the diplomacy
matrix), the build queue (its order is the queue) and the forms on ⚙. **Empire names are
`EmpireName.svelte`**: its colour is the page's `empireColors` (name → map colour, from
`branch()`, so every page has it) unless passed. Maps through `GalaxyMap.svelte`
(pan, zoom, resize, lanes, systems with an optional `fill`; the page draws its `layer`;
`MigrationMap` is one such layer). **Maps show only what is discovered**: visited or own systems
(the save's `terra_incognita.systems` is the same list; its 256×256 `data` grid is run-length
encoded, row-major, but its scale is not pinned down) plus first contact sites, lanes only among
them (`discovered()`, `mapView()`, `server/mapSystems.ts`). As the game, a map also draws every
lane of a system whose lanes the empire knows — `country.hyperlane_systems` (`GalaxySystem.lanesKnown`):
visited plus hyperlane detection range, which sensors and the Map the Stars edict raise
(2207.03.10: 60 = 41 visited + 10 one jump out + 9 further; matches the game's map around Craxima
and Rimmock) — the systems at their far ends faint, "Unknown". **Special stars** (the user's ask 2026-11-06; `#lib/stars.ts` pure): the star classes with a
`modifier` in `common/star_classes/00_star_classes.txt` — pulsar and `sc_binary_1` (shields −100 %),
neutron star and `sc_binary_2` (sublight speed −50 %), black hole (disengage chance −50 %,
emergency FTL minimum days +50 %), toxoid star (armor −100 %), the `sc_crisis_binary_*` like their
originals; the Astral Scar's is empty — get an icon per effect left of the system (a dot for a
binary), their effects in its hover, and one "special stars" legend entry below every map
(`GalaxyMap` draws it; `mapView()` passes `star` on, unknown systems' too: the game shows every
star's class). Re-check on game updates. Explored wormholes are dashed arcs, behind the profile's `wormholeLinks` switch (on). Explored =
**both ends visited**: the save marks no wormhole as explored (bypasses carry no such field, the
country only `seen_bypass_types`), and exploring one is a fleet's jump through it (4.5.2
`common/bypass/00_bypasses.txt`, `on_pre_explore`), which visits the far end; one end visited is
not enough (2207.03.10: Phiroza visited, Eye of Bal not — no link). `wormholePairs` (spoiler) shows
every pair (`wormholeLinks()` stores them all), both ends. Fit
buttons: capital, my empire (a nomad's: **my waystations**, starbase level `waystation_*`;
disabled without one), explored, the page's own, everything; the map and systems tabs pass `own`
(`ownOnMap()` in `#lib/mapLayers.ts`), which adds "my stations and ships" and our ships as a
marker per system (`Route.systemId`, READER 38) — all, fleets or civilian, the profile's
`mapFilter.ships`, shared by both tabs (the user's ask 2026-10-31). **A nomad's arkships**
(`Snapshot.arkships`, READER 41; `arkships()` in save.ts: the ships carrying a colony we control,
with size, tier, planet size and system — the ship's `coordinate.origin`, else its fleet's,
`shipSystemId()`) are drawn on the map, systems and migration maps whatever the ships filter (a
violet hexagon above the system, the capital ringed; `GalaxyMap` `arkships`), with a fit "my
arkships" (the user's ask 2026-11-01). **The capital button** goes to `capitalId()`
(`server/mapSystems.ts`): the capital arkship where it is now, else `knownSystems`' capital, which
`capitalSystem()` now finds through the capital colony's carrier — a planet's system or the
arkship's; before READER 41 `country.capital` was read as a planet id, so a nomad's button went to
its old home star (Roaming Korinth: planet 0, system 532, instead of the arkship at 563), and the
systems tab had none at all. Snapshots of saves no longer on disk keep the old reading. A per-viewer `sectors` checkbox
splits our territory by sector (`GalaxySystem.sector`, the colonies tab's `sectorColors`). Profile switches: `unknownStars`
adds every other star, faint, named "Unknown" and without lanes, but not the special systems off
the main hyperlane network (`mainNetwork()`; 2207.03.10: Kleeia `distar_sealed_1_2` and Ultima
Vigilis `surveillance_supercomputer_system`, no lane at all — the game reveals such systems by a
trigger) (the game shows all stars from the start, only the
connections are hidden); `wholeGalaxy` shows every system and lane. With `unknownStars` the
star-only megastructure rules (catapult, stellar cannon, matter decompressor's star) count those
systems too. Megastructure candidates, the catapult's farthest system and the jumps beyond the border
count discovered systems only. Table rows tied to a system (`SortTable` `link`) and the map share a
bindable `hovered` system: the row is highlighted, the system ringed; binding `selected` too
makes a click (row or system, not a drag) pick a system, ringed in sky blue, its row scrolled into
view. **Borders** (`territories` on `GalaxyMap`; `#lib/borders.ts`, `#lib/territories.ts`,
`territoriesOf()` in `server/mapSystems.ts`): a smooth field, as the game blends territory — each
owned system radiates exp(−3·(d/R)²), R = `REACH` (0.8) × the median nearest-neighbour distance
(`claimRadius`), and each lane between two systems of one owner the same over its distance from
the lane scaled by `CORRIDOR` (0.5); an owner holds where its summed field passes a lone system's
value at R and beats every other owner's, traced by marching squares (R/5 grid) into rings drawn
even-odd. **Only owned systems count** — an unowned one is covered, not cut out. Iterations that
looked wrong against the game's map (2205.07, Cydran Concern): Voronoi cells clipped to circles
left far systems as islands; every system as a site cut a territory where an unowned system sat
beside a lane; cells plus corridors left seams and dents; the field at REACH 1.25 covered 57 of
362 unowned systems (40 owned: "looks like they own more"), at 0.8 12 — and those are cut out,
a hole of `HOLE` (¼ R) around each unowned system inside a territory (the user's call). ~180 ms for 14 owners on a 400-system
galaxy, once per owner change. Colours are the game's: a country's first `flag.colors` swatch, its
`map` rgb from `flags/colors.txt` (data DB `flag_color`). Shown: ours, empires we have
communications with, every visited station's owner with `contactStations`; stations we saw but
cannot name are **guessed** (one shipset within `GUESS_JUMPS` = 3 jumps = one empire), dashed, in
a colour of ours; other visited stations grey, "unknown owner". **Map tab** (`/map`,
`#lib/mapLayers.ts`): borders and the markers of what was discovered — open first contacts,
stations seen, anomalies, dig sites, special projects, wormholes, gateways and L-gates
(`GalaxySystem.bypasses`), megastructures and their ruins (`*_ruined`) — each layer hidden by the
profile's `mapFilter`, plus a table with what is worked on and how far (an envoy on a contact,
an excavation running; stage, clues, days — anomalies and special projects carry no progress in
the save), an anomaly's, project's or dig site's outcome as the tooltip of its name and of its
system on the map (`MapMarker.tip`, behind the three outcome spoilers; the frontier tab's
Outcome column has the same) and a system search (known names completed; picks and centres, `GalaxyMap.show()`). **Every
map's width** is the viewer's (`GalaxyMap`'s `width` buttons: normal, wide = the window's full width,
wide + table = that with the page's table beside the map) — one localStorage key for all maps
(`MAP_WIDTH_KEY`, `#lib/mapView.ts`). Until a browser's buttons pick one, a map opens at ⚙'s **Map width**
(`Display.mapWidth`, per profile, default normal; the layout's `mapDefaults`), and it opens fitted
to ⚙'s **A map opens fitted to** (`mapFit`: explored — the default —, my empire, everything;
everything where that set is empty), following the size; the "everything" button follows it too
(the user's ask, 2026-11-17). ⚙ shows what this browser keeps of its own — its width pick, how many
map heights were dragged — each with a reset (`forget()` in `#lib/browserStore.ts`), so a default
can take effect again. A page with a table of what its map shows (map: Found;
systems; megastructures; frontier: First contacts) defines it as a top-level snippet, passes it
as `beside` and binds `width`: it renders the table itself unless `width === 'side'`. Legends and
filters stay above the map. **A map that is the page's last element is as high as it is wide
where the window has room for that**, else as high as the window allows with its controls and
legend in sight once scrolled to (`fitFill()`), until the viewer drags it (the user's asks,
2026-11-15 and 2026-11-17 — square, or the window's bottom where that was more, pushed the legend
out of a low window): `square` where the page ends with it (the frontier tab), and every map in
"wide + table". **The height is dragged at the box's bottom edge** (a handle of its own, not the
browser's `resize-y` corner, 2026-11-17): within 48px of the window's bottom the page scrolls
along and the map grows into the room that makes, so a map at the page's end grows in one drag
(the user's ask: before, it grew only to the window's edge per drag). A drag that changed the
height is stored on release. Without `beside` (diplomacy, migration) the third button is not offered
and a stored `side` draws as wide. **Full window** (the user's ask 2026-11-02; `GalaxyMap`'s "⛶ full
window" button, per viewer in localStorage `MAP_FULL_KEY`): the map lays itself over the whole
browser window (`fixed`, `z-40` — below the context menu and popups, `z-50`), its toolbar on top,
the swatches below, the table beside it still offered; the page behind does not scroll, Esc leaves
it, and the height chosen for the page is not overwritten. A page's own map controls go into
`GalaxyMap`'s `controls` snippet so they stay in reach there: the map tab's modes and layers. **The table beside is independent of the map's height** (the
user's ask, 2026-11-01): it reaches the window's bottom, scrolls on its own with its header pinned,
and sticks below the window's top while the page scrolls (`fitAside()`). Open: a cell's `InfoPopup`
(`absolute`) at its bottom scrolls the column instead of overlapping the map. The table
also shows each marker's **difficulty** (first contacts and dig sites as the save holds it, an
anomaly its category's `level`), when it was **seen** and its **age** in months (the user's ask
2026-10-31): a first contact its own `date`, a station its first sighting, an anomaly or dig site
the first save listing it, a wormhole, gateway, L-Gate or megastructure the first save listing its
system in `knownSystems` (`firstSeen()` in `#lib/mapLayers.ts`), an entry event its first reading;
"≤" where that is the first save showing the field at all (then or earlier), none for what a
spoiler shows unvisited. **Found & done** (the user's ask 2026-10-31): what is no longer to do moves from "Found" to
a folded table below it, and onto the map (faded) only while that is unfolded — per viewer, not
stored. Done (`MapMarker.done`, `tracked()` over the branch's saves, `doneAt` the first save
showing it): an anomaly or special project gone from the save's list (resolved; seen on the
Planetforgers' history, where both lists shrink), a dig site gone (**assumed** — no site has been
excavated to its end in our saves yet), a first contact `finished` or `aborted` (they stay listed),
a station seen once the contact with its owner is `finished` (the user's call: aborted leaves it
unnamed), a Wanderlust target counted, a ruin in a system someone owns ("claimed"; the structure's
own owner is not stored), an entry popup in a system whose gateway, megastructure or ruin has its
own row (the Abandoned Gateway). Wormholes, gateways, L-Gates and megastructures stay open. Say
**colony** wherever a colony is meant; planet only for the planet itself (`planetId`, Expansion,
`PlanetInfo`).
**Map modes** (the map tab's mode buttons, the profile's `mapFilter.mode`; `#lib/mapModes.ts`
pure; the user's ask 2026-11-02, after 4.5.2 `common/map_modes/00_map_modes.txt`). Each mode
recolours the territories (`recolor()`) and names after each empire why, in the swatches and on a
system's hover. The modes: empire (default), union, diplomatic, opinion, intel, AI attitude, trust,
threat, intel freshness, and claims, which fills systems (`claimFill()`) and leaves the borders
alone. Union, diplomatic and attitude take the game's hsv colours (`hsv()`); diplomatic takes the
first relation that holds in the game's order, federation › war › subject/overlord › defensive pact
› NAP › research agreement › commercial pact › rival › closed borders › migration treaty. The
gradients use `scaleColor()`, and opinion is clamped at ±140 as the game's bands are. The data is
`modeData()` on the server, built from the diplomacy tab's `diplomacyView()`, so the intel model
and its "unverified since" apply: no communications is grey, and an unverified reading is dashed.
Intel freshness is the age of the oldest unverified reading, red at 2 years. **The save's
`relations_manager.relation.hostile=yes` is not the game's `is_hostile`**: it sat on our subject
Lolehndra (Planetforgers 2214.02.01), so the war colour comes from wars alone. Trust and threat
are our relation record's (`Relation.trust|threat`); which side's view `threat` is has not been
checked. Not built yet: neighbours (`is_neighbor_of` is engine-side), storm forecast (none of the
last 40 saves on this machine holds a storm, so its format is unknown), and ethics, GalCom, weight,
trade, wars and border-change modes. Checked 2026-11-02 on a DB copy (Planetforgers 2214.02.01,
Roaming Korinth 2207.02.01): `/map` returned 200 in every mode and each mode's colours were
recomputed from `__data.json`. The drawing needs a browser, and the colours have not been compared
with the game's map yet (`docs/open-checks.md` 27).

The `all` tab and custom tabs (`/tab/[id]`; the header is a switch, not a panel) render their panels
by id (`EmpirePanel.svelte`); Recommendations is All-only, beside Upcoming, and follows the What-ifs
spoiler. It groups positive estimated trade or stability changes across edicts, policies, colony
designations and planet decisions. Its “Show all options, ranked” browser toggle lists every
estimated option together, ordered by net trade and then stability;
`LAYOUT` in `#lib/settings.ts` lists them, in `all`'s order and grouping — **a new empire panel
goes there and into `EmpirePanel`**. **A new profile setting is a key of `ProfileSettings` with its
default and its parser in `SETTING_PARSERS`** (`#lib/profiles.ts`): the API, the stored profile and
`setting('<key>')` on the server all follow from that table. Settings are stored server-side in the `setting` table
(`PUT /api/settings`), which no migration touches. The theme (`system`/`light`/`dark`)
is global; everything else (custom tabs, chart events, the colonies and expansion views, display options) lives
in a **profile** (`#lib/profiles.ts`, `server/settings.ts`): rows `profiles`, `profile:<id>`,
`activeProfile`, `campaignProfiles`. The profile in use is the **viewed** campaign's — the
`?node=` one, else the head's (`campaignAt()`; the settings getters take the node from the request
being answered, `requestedNode()` in `server/request.ts`, the one place that reads it unasked; API
calls carry the page's `?node=`, `api()` in `#lib/settings.ts`) — else the last picked; picking one makes it the
viewed campaign's. **Campaigns** (one per save folder) switch in the header's `game` dropdown,
shown from two on: each is its tip node (`campaignTips()` in `#lib/timeline.ts`: the head for the
one being played, else its last observed node), named after its latest save's empire
(`campaignName()`); the tab stays, a colony or custom tab goes to `all`. The **config
tab** (`⚙`, `/settings`) manages them (`/api/profiles`: create, rename, delete, select, import;
`GET /api/profiles/<id>` exports `{ format: 'stellaris-dashboard-profile', version: 1, name,
settings }`). The first read made profile `default` from the rows stored before profiles; those
stay, unread. The theme is a class on `<html>`, put there by `hooks.server.ts` (no flash); `layout.css`
defines the `dark:` variant on it. Canvases (uPlot) pick axis colours per draw and redraw on
`onThemeChange` (`#lib/theme.ts`).

**Revealing what the game hides is the user's choice, off by default** (their rule, 2026-10-18):
the tabs show what the game's own panels show — agendas, edicts, policies, council seats as the
game lists them, maps only discovered space, factions only once formed. Everything beyond is a
profile switch in ⚙ (`Display`), labelled as spoilers or cheating where it is: `showLocked`,
`factionTypes` / `allFactionTypes`, `anomalySpoilers`, `projectSpoilers`, `digSiteSpoilers`, `contactStations`,
`unknownStars`, `wholeGalaxy`, `wormholePairs`, `lgates`, `surveyAll`, `tradeIntel`, `diplomacyAll`, `historyMet`, `historyAll`, `whatIfs`, `pactIntel`, `pactAll`, `contractSpoilers`, `contractsAll`. A new view of hidden information follows the same pattern
(and in multiplayer and Ironman: "No cheats in multiplayer or Ironman").
**⚙ is organised like a browser's settings** (the user's ask 2026-11-01; `#lib/displaySwitches.ts`
pure): every switch in `SWITCHES` with its group, label, note, search tags and **kind** —
`normal`, `spoiler` (what the game hides until found) or `cheat` (what it never tells a player;
`habitatsAlways` now one). Found includes more intel or exploring: what a higher intel level would
show is a spoiler with `intel`, not a cheat (`diplomacyAll`, `historyMet`); a cheat
is what no intel level shows (`pactAll`: another empire's techs; `historyAll`: empires never met) —, a left-hand section list and a search over all of it. Two gates,
`showSpoilers` / `showCheats` (off by default; a profile from before them starts with a gate on
when it had one of its switches on), list those kinds; **hidden also means off**:
`display()` (`server/settings.ts`) returns `effectiveDisplay()`, the stored values kept, so
showing a kind again brings each switch back as it was. **Read `display()` once per request,
never in a loop**: each call reads the active profile and every node (~6 ms), and the Ironman and
multiplayer checks behind it (`campaignIronman|Multiplayer`, cached until the DB connection writes,
`cachedScan()`) parse every snapshot of a campaign that is neither (~100 ms uncached). Called per
body, the planner's waystation suggestions hung Roaming Korinth's planner (8155 bodies, ~15 min;
found 2026-11-06), per system the map tab took seconds. **A new switch goes into `SWITCHES`**
(a test checks every `Display` boolean is there once). **The
check is the user's in-game screenshot** of the matching panel (workspace `AGENTS.md`): it caught
the edicts (58 → the game's 5), policies, agendas and focus cards here.

**Time window** (the user's ask 2026-10-28): every history chart (`Chart` with `extent`, the
history's first and last save from `xExtent()`) shows one shared window
(`#lib/timeWindow.svelte.ts`, session-only by the user's call — a reload starts at the default):
`{ years }` follows the latest save (the last N years and one ahead, default 20; `all` from the
first save) or `{ from, to }` stays put (`windowRange()`, `zoomWindow()`, `panWindow()`,
`spanWindow()` in `#lib/series.ts`, pure; bounded by 2200 and a year ahead, a month at least;
panning back to the right edge follows again). In a chart: drag selects (uPlot's own zoom and
double-click reset are off), Ctrl/⌘+wheel zooms around the cursor, Shift+wheel moves, a
double-click resets; the plain wheel scrolls the page. The bar under the tabs (`TimeWindow.svelte`,
on pages whose data has `xExtent`) has presets, from/to years, ◀ ▶ half a window and "now".
Projections (growth, trade-offs, the systems horizon) keep their own `range`. Drawn only in a
browser: the interactions are unchecked here.

**Colours** (`colors.ts`) follow the game: resources and research fields after their icons, other
events after the game's text colours. Charts and the upcoming list both use them. **Districts**
take theirs from the data DB (`district.color`, the border of the game's grid-box icon), shown as
a swatch and tinted name by `DistrictName.svelte`; pages get them as `colors` next to `names`.
