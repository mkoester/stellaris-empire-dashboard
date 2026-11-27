# Tabs: planner and trade-offs

Read before working on `/planner` or `/tradeoffs`. _Moved verbatim from `AGENTS.md` on 2026-11-14._

**Planner tab** (`/planner`, the user's ask 2026-10-31: "plan certain things — adding, removing,
reordering, history, automatically marked as done, a warning if no longer possible"; pure
`#lib/planner/` — `replay.ts`, `kinds.ts`, `ops.ts`, `status.ts` —, server `server/planner.ts`,
`POST /api/plan`): goals for the playthrough, stored as a **log of changes** (`plan_event`,
migration 17: add, edit, remove, order, park, unpark, check, uncheck), each tagged with the node
the page showed. **The plan at a node is the replay of the changes along its path** (`planAt()`),
so a reload's branch has its own plan from the branch point on (the user's call), and a branch
point moved on `/timeline` carries the plan along. The client sends the node it shows
(`planAction(data.tip, …)`), never the head, so an autosave or reload between page load and click
cannot move a change to another branch; changing the plan at an old node reaches every later
branch below it (the page says how many). Goals of other branches missing here (by id, or by
kind and target — `goalKey()`, free-text goals by their text) are offered to copy; one not
possible here is copied **parked** ("a potential step to plan again", the user's ask). Each goal
is **want, later or avoid**; an avoided goal that comes true shows "happened" in red. **Later**
(the user's ask 2026-11-16: "I might want to delay some tech options, so a `-want` button"):
wanted, but not yet — it counts as wanted everywhere (status, alerts, what a tech needs), and only
Upcoming tells it apart: on offer, its row says to pick another card (`plannedOnOffer()`). The
"− want" button on tech goals, shortcuts and potential goals sets it ("+ want" undoes it), ⏸ marks
it; the add form offers "want it later". Stored as `polarity: 'later'` in `plan_event` (no
migration: `planAt()` reads an unknown polarity as want, `parsePlanRequest()` refuses one). **Status**
(`check()`): done, under way, open, no longer possible (blocked), unknown — against the branch's
latest full save and the campaign's galaxy as the viewer may see it (`campaignGalaxy()`, spoilers
respected); "since" walks back over the saves (`holdsSince()`, "by" where a save cannot tell —
the galaxy is the campaign's latest reading, so galaxy-only checks stop there). Anomalies, dig
sites and situations count done once seen and gone (`seenAlong()`; the save cannot tell finished
from lost). Phase 1 kinds (`KINDS`): survey, anomaly, dig site, Wanderlust category and arkship
visit, outpost, colony (planet, habitat, ring segment), starbase level/module/building, districts
(blocked under the cap with blockers cleared), building, megastructure (blocked by
`MEGA_RULES`' `candidates()`), tech (blocked by `potential`), tradition (a tree by its `adopt`),
perk, focus card, situation approach and end, first contact (aborted = blocked), civic/authority/
ethic (blocked by `civicAuthority`), government type, free text (ticked by hand). **Nomads**
(`nomadic()`: running `situation_nomad_economy`; the user's asks 2026-10-31) claim no systems:
`unavailable()` drops outposts from the add form, the suggestions and the map menu (an existing
outpost goal shows blocked) and offers instead **waystations** (4.5.3
`megastructures/30_nomad_waystation.txt`: nomads only, one per system, an unowned system fully
surveyed, an owned one intel on its owner's deposits; done = a station of ours whose level starts
`waystation` — `starbase_level_waystation_<n>`, spelling as `stations()` strips it; seen in
`roamingcybergang` 2213.08, the AI nomads' 33) — the roaming tab adds them, a whole wayline at once,
and their modules as `station_module` goals and **arkships** per type (civilian, science, military — `<type>_arkship_megastructure`
in `megastructures/29_nomad_arkships.txt`; counted from `Snapshot.ships` sizes
`<type>_arkship_tier_<n>`, any tier; a settled empire gets neither). **Goals the save implies**
(`autoGoals()`, passed to `planAt()` as seeds with stable ids `auto-tr-<key>` / `auto-ap-<key>`):
every tradition of each adopted tree — taken ones show done with their date and land in the
history's "reached" list, the rest are the tree's remaining picks — and every perk taken; they
can be ordered, noted and removed (a removal sticks), and give way to the same goal added by hand.
**Wanderlust** (the user's ask 2026-11-17: prioritise categories, pick targets on the map, see
what was found; `outlook()` in `#lib/wanderlust.ts`). Per category: counted / needed, **found**
(targets in systems visited or owned — never a spoiler), still open = found − counted (every
counted system is one we entered, so this needs no `visited_by_nomad` flag) and **finishable**
when the open ones cover what is missing. A system flagged twice counts for its first category
only (`countsFor()`: nomads.4720 tests the flags with else_if). The category goal says it ("1 of
2, 1 found to visit: enough to finish"), the suggestions list finishable categories first, the
map's Wanderlust line underlines them; the map's right-click offers an arkship visit as a _want_
for a target not yet counted whose category is not done (an unvisited one only with the spoiler).
The chain does not end at the fourth category: the perk's second modifier comes at four done (a
category with no targets in the galaxy counts as done), and every category keeps paying out until
all eight end it (`complete_nomad_exploration_effect`).
**Popups** (`explanations()`): the game data's for techs, traditions, perks, buildings and
civics; a Wanderlust category its reward, the static modifier `<category>_modifier` (4.5.3
`missions/01_missions_nomads.txt`); focus cards built here (`focuscard:`: requirement, progress
per category and that category's next reward); an outpost or waystation goal what the system
would bring (`systemInfo()`, `#lib/planner/systemInfo.ts`: station deposits summed per resource —
for a waystation with the module collecting it, from `collected_system_resources` in
`starbase_modules/00_waystation_modules.txt` —, a pre-FTL civilisation to observe, colonizable
planets, unsurveyed bodies, anomalies, structures, passages). **Deposits only on surveyed bodies**
unless `surveyAll`: the galaxy as shown (`surveyView()`) hides an unsurveyed body's anomaly but
not its deposits, which the game hides — whether other tabs show them too is not checked.
**What a planned tech needs** (`techNeeds()`, `#lib/planner/needs.ts`, the user's ask: "adding
Mega-Engineering should add all direct and indirect requirements"): `planFor()` replays the plan,
then seeds, for every wanted tech not parked, each unresearched prerequisite recursively and each
unmet **tier gate** (kind `tech_tier`: 6 techs of the tier below in that area, as `techTiers()`),
ids `auto-tech-<key>` / `auto-tier-<area>-<tier>`, noted "needed for …"; of an `OR` group
(data DB `technology_requirement.prerequisites_any_json`, extractor 2026-10-31 — before, any
prerequisite block holding an OR read as empty) the first alternative whose `potential` is not
false, the others named ("or instead Citadel"); `inReach()` wants one of each group too. **The hull
line follows the shipset**: every hull tech gates on `country_uses_bio_ships` (Corvettes …
Battleships `no`, Harbingers and Stingers `yes`; 4.5.2 `scripted_triggers/07_scripted_triggers_ships.txt`:
`uses_ship_category = bio_ship`), which `#lib/triggers.ts` answers from `Snapshot.shipset` (the
country's `graphical_culture`, READER 40) and the data DB's `graphical_culture.ship_kinds_json`
(`GameData.shipKinds`; the three Biogenesis shipsets list `bio_ship`) — before, it was unknown,
so a bio-ship empire got Corvettes … Battleships for Mega-Engineering (the user's catch,
2026-10-31; checked after: Harbingers → Stingers). Checked
2026-10-31 on Roaming Korinth (nomad): Mega-Engineering → the power, hull and arkship lines and
seven tier gates, Arkship Mastery chosen over Citadel. They go with the tech: removing it removes
them. **Group order follows the game's rules** (`arrange()`'s `constrain`, Kahn's algorithm
keeping the plan's order wherever the rules leave a choice): traditions (`orderTraditions()`)
taken ones first as picked (the save's `traditions` is pick order), each after its tree's
adoption and the picks it needs (data DB `tradition_prereq`, `GameData.traditionPrereqs`), a
finisher after its tree's other picks; research (`orderResearch()`) a tech after the planned
techs it needs and the tier gates below it, a gate after the one below and after the planned techs
of its own tier and area (they count towards it); of the goals free to go next the lowest tier goes
first (a gate of tier k as k + ½), so each goes as early as it can ("Fusion Power before 6 Physics
techs of tier 1", the user's ask) and the plan's order decides within a tier. **Badges**
(`badgeOf()`, `areaOf()`): a tech's and tier gate's tier (T1…) and research area in the game's
colours (`<area>_research`), a tradition's place — adopt, pick, finisher (the community's word;
the game says "… Traditions Finished"; its tree's colour from the data DB as a stripe,
`tintOf()` → `tintColor()`) —, perk; ascension-path trees and path perks also carry an `ascension`
badge. The research group filters by area (per viewer, none on = all, suggestions too). Potential
goals list traditions and perks; same-name perk variants collapse to the one whose
availability is best established for this empire. Ascension trees with duplicate names appear once;
trees whose potential or adoption rules are known to fail for this empire are dimmed and labelled.
Planning a perk that opens a tradition tree also plans that tree and its traditions; trees known to
be unavailable are skipped. **An adoption brings the techs its `possible` asks of this empire**
(the user's ask 2026-11-27, "what else is needed to finish the ascension"; `#lib/planner/asks.ts`
`techsAsked()`: of an `or` the branch it can meet, planned perks and traditions counted as taken —
Integrated Cybernetics for Cybernetics, Robomodding for a machine's Synthetics), and a tree counts
as available when its adoption would hold once it has them (`withTechs()`; before, a missing tech
read as unavailable and planning The Flesh is Weak planned no Cybernetics). **A path's situation
brings what stops it** (`ASCENSION_SITUATIONS` in `kinds.ts`, data DB `situation_block`: a
`monthly_progress` modifier with `mult = 0`; `blockNeeds()`): its techs, traditions, and a building
on any colony (kind `building_any`) — 4.6.1 the Genomic Research Facility, Augmentation Center,
Identity Complex; a data DB without the table brings nothing. A situation seen and gone counts as
finished. **Next up skips a goal that waits** (`Status.waiting`: a tech out of reach, an arkship
whose class tech is missing — that tech is planned with it); its needs come up instead. The history shows badges with the goal's group,
its reorderings behind "show reordering". **Removing a goal** asks about the automatic goals only it brings
(`planWithNeeds()` → `GoalRow.dependents`: a tech's own `techNeeds`, an adoption's tree, or a
perk's linked tree; none that another goal or the save implies): OK removes them with it (they are derived, so nothing is
stored), Cancel keeps them as goals of their own (an add each). **Focus** (the user's ask 2026-10-31: "split this — tasks give points to one of three areas; the
rewards per area as entries of their own"): a **task** (`focus_card`) carries its area and points
as a badge in the area's colour (`tintOf()`: `focus-<area>`; "all +10" for core cards), its popup
each area's progress to the tier it unlocks; a **reward** (`focus_reward`, one per
`<area>_rewards_<n>`) is named as the game's Empire Progression panel names it ("Conquest tier
4: Improved Weaver Development" — the option this empire gets: `country_uses_bio_ships` picks
Destroyers or Weavers), done once the area's current reward is past it, under way while current
("20 / 40 points"), else the points still to go: a reward costs its points and the rest carries
over (the saves 2026-10-31: Planetforgers exploration 30 → tier 2 at 0, UNE development 0 →
tier 2 at 40). Suggested: each area's next four tiers; the group keeps an area's tiers in order
(`orderFocus()`); its popup is the tech's. Checked against the game's panels on Roaming Korinth
(nomad, bio ships: Conquest tiers 1–4, Harbingers at 7, Stingers at 9; the five tasks on offer
with their areas and points) and a new campaign's Exploration tiers (screenshots
`~/Pictures/Screenshots/screenshot_2026-10-31_22-38-29`, `-40-29`). **Perks** (`GameData.perkRules`,
data DB `ascension_perk.potential_json|possible_json`): `potential` false is blocked; `possible`
false stays open with a warning — The Flesh is Weak's `num_ascension_perks > 1` reads "⚠ needs 2
ascension perks taken first (1 now)" (`perksNeeded()`; `#lib/triggers.ts` now answers
`num_ascension_perks` and `num_tradition_categories`). A planned adoption brings
its whole tree, a planned pick its adoption and the picks it needs (`autoGoals(…, wanted)`). On
the page one change runs at a time (`busy`): the user's ▲▼ clicks 5–20 ms apart each moved from
the same old order (~40 orders in seconds, 2026-10-31); ▲▼ pass the next goal shown, as done
goals keep their place folded away below. **Traditions** are labelled with their tree ("Statecraft: Amongst Peers", "… (adopt)",
"… (finished)"), perks carry a badge; a planned or taken perk that a tree's adoption names
(`GameData.perkTrees`: `has_ascension_perk` in the adopt tradition's `possible`) suggests that
tree first ("Cybernetics (adopt) · opened by The Flesh is Weak"). Nomads settle no planets either
(`unavailable()`: outposts and colonies; the layout's `plan.unavailable` hides those "+ goal"
buttons on other tabs). Potential goals start folded, per group, their "+ want" and "⊘" (avoid)
buttons at the left of each row, the row lit on hover. **Shortcuts** (the user's ask 2026-11-06:
"techs almost every player would want, offered as shortcuts"; `#lib/planner/shortcuts.ts`,
`shortcuts()` in `server/planner.ts`): bundles of techs above the potential goals — **nomads** (first; every tech has `potential =
is_nomadic`, so only nomads see it; the user's ask 2026-11-16: "things I need rather fast, e.g.
more logistic ships": logistic ships are capped by `nomadic_constructor_limit_add`, 2 from the
start, +2 each from Waystations II and III, +1 per Logistics Hub waystation module — nothing else
in the 4.5.4 files; then the arkship techs), economy core,
research buildings (`tech_physics_1`, `tech_society_1`, `tech_engineering_1`: each field's lab),
its second step, strategic resources, habitats and terraforming, military, late game — each tech
with "+ want", each bundle with "+ add all"; prerequisites and tier gates follow via `techNeeds()`.
Only techs whose `check()` is open are offered (not researched, under way, planned or blocked), so
playstyles need no conditions: the hull line follows `country_uses_bio_ships` (Battleships or
Stingers), robots drop out for hive minds. **The list is ours**: a web search (2026-11-06) found
no reliable 4.x consensus, so each entry is a tech whose unlock the 4.5.3 files show — the
resource districts' zone slot each (`common/zone_slots/00_zone_slots.txt`: `tech_power_hub_1`,
`tech_mineral_purification_1`, `tech_food_processing_1`, via `has_tech_or_functional_civic`, so
a civic can stand in), Societal Unification's campaign edicts (`edicts/01_campaigns.txt`), Colonial
Bureaucracy's Administrative Park (`08_unity_buildings.txt`), the zone buildings' upgrades (`*_2`, `03_resource_buildings.txt`), each strategic resource's two techs — `tech_mine_<res>` (its deposits, `deposits/01_planetary_deposits.txt`, and its zone) and `tech_<res>` (its refinery, `04_manufacturing_buildings.txt`), habitat slots
(`01_habitat_zone_slots.txt`) — or a modifier (Galactic Administration +1 civic slot). Re-check on
game updates. **Not "city zone slots 4–5"**: `slot_city_04|05` (gated by those two techs and an
upgraded capital) are not the city district's — `district_city` has the government slot and
`slot_city_01|02`; `slot_city_04` is the ring world commercial districts' alone, `slot_city_05`
no district's (4.5.3; the first list said otherwise, the user caught it). **Left out on purpose**:
Weather Control (+100 housing per city district, +10 %; Anti-Gravity Engineering's prerequisite,
so it comes along) and Galactic Markets (rare; only the Galactic Stock Exchange, one per planet:
−5 % market fee, traders — not the Galactic Market). Checked 2026-11-06 on a DB copy: UNE 2 offers
Battleships, Roaming Korinth (bio ships) Stingers; "+ want" and "+ add all" work in the browser
(the user). **Later phases** (not built): diplomacy (befriend,
rivals, pacts wanted or avoided), GalCom and federation (federation tables not loaded, none seen
in a save), market prices and trade deals, leaders, Shroud, jobs and resource priorities, orbital
rings (their `Station.level` not yet seen in a save), espionage (nothing in the save or the data
DB). **Other
tabs**: `AddGoal.svelte` ("+ goal", ✓ once planned, from the layout's `plan.keys`) on the tech
offers, traditions and perks, the colony page (districts up to their cap, queued buildings),
expansion candidates, megastructure rows and the frontier tab's first contacts, anomalies and
dig sites; the map's right-click (`GalaxyMap` `onsystemmenu`, left button only for pan and pick;
`ContextMenu.svelte`; `GET /api/plan?node=&system=` → `systemGoals()`) and its `planned` layer.
The tab bar's badge counts blocked wanted goals and avoided ones that happened (`planSummary()`,
cached by tip and plan). Reordering is native drag and drop plus ▲▼ buttons; groups fold per
viewer (localStorage). Checked 2026-10-31 on a DB copy (Roaming Korinth, head #387 and branch
leaf 363): goals stayed on their branch, each offered on the other, a bad body 400, a node of
another campaign 409, every touched tab 200. Drag, the right-click menu and the buttons need a
browser — not seen yet.

**When a goal is paid for and built** (`#lib/planner/cost.ts`, `#lib/planner/eta.ts`, the user's ask
2026-11-17: "how long it takes me to gather all the resources to build another planned arkship, some
megastructure, etc."). Every open goal of a kind with a known cost shows a line under its status:
what it still costs, **start** (the stockpile holds the cost) and **built** (start + its base build
days), each at this month's net and at the **mean net of the last N game months** (⚙ "Planner: mean
income", default 6, `incomeWindow`). A second pair, **in plan order**, pays the queued goals above it
first (wanted or later, not done, blocked or parked; page order, groups top to bottom) out of the same
stockpile and income, so its time is that of their sum with its own — behind the ⚙ switch
`planOrder` ("Planner: also time each goal in plan order", off by default; the user 2026-11-17).
The line highlights **start at this month's net**; the mean's time stays grey beside it. The
tooltip lists every resource needed: amount, what is in stock, and when it is there at either income
(`CostRow.resources`, from `eta().each`).

- **Costs:** the data DB's base costs, before modifiers, so always ≈. Arkships: the ones still
  missing × `<type>_arkship_megastructure`; megastructures: every stage after the one in the system
  (`stageChain()`, numbered stages along `upgrade_from`; ruins and restorations are not planned);
  waystation, outpost, starbase levels (each level up to the wanted one), modules, starbase
  buildings, districts (the ones still missing) and buildings. The bio-ship variant from the shipset
  (`shipKinds` has `bio_ship`: half the alloys, the rest as food); unknown shipset → the regular cost.
  Megastructure costs need extractor 2026-11-17 (`megastructure`, `megastructure_resource`); an older
  data DB has neither, and those goals show no line.
- **One-time spending is out by construction:** the net is the budget's (`balance`), which books
  recurring flows only; construction, edicts and decisions move the stockpile, not the net
  (`unbooked()` in `#lib/series.ts` is what the budget does not explain). The mean takes each game
  month's last reading once.
- **Never:** no income of a needed resource, or the cost above its storage ("exceeds storage" —
  megastructures are paid up front; storage exact with the companion mod, else the base estimate of
  `#lib/storage.ts`). The plan-order sum is not held against storage: it is paid as it goes.
- Checked 2026-11-17 on Roaming Cybergang (bio shipset, 2215.01): a Scientific Arkship 500 influence,
  5000 alloys, 17 500 food; start (17 500 − 2752 food) / 163.43 a month = 90 months, matching the
  page.

**Trade-offs tab** (`/tradeoffs`, behind the profile's `tradeoffs` switch in ⚙ — exploratory, the
user's ask 2026-10-22: "when to spend scarce resources on what"; `#lib/tradeoffs.ts` pure,
inputs from `server/tradeoffs.ts`): what can be built now — stations at surveyed deposits in our
systems without one (`Body.station`, the planet's `shipclass_orbital_station`), districts where a
colony has room (the colonies tab's caps; jobs from data DB `district_job`), buildings of a type
we have built before (so unlocked; not `government` ones) on the colony with most idle pops — with
base costs (data DB, scaled by what our queued items of that kind cost), upkeep, build days
(`build_time`; stations have none, ≈ 100 as their orders count) and outputs **measured**: a job's
output per working pop from the budget (`jobFlows` ÷ filled), a station's as its deposit's base ×
our stations' budget income ÷ their deposits' base. Ranked by payback (cost ÷ net value per
month, values in energy at market base prices — editable weights); simulated month by month per
strategy (best payback, each kind first, waiting for a cost cut, nothing), saving up for the next
option, which needs the colony's idle pops. **Changes** ("from month M, output of station
gatherers +10 %") come from presets — the research queue at its due dates, every tech **within
reach** (`inReach()` in `#lib/techTiers.ts`: prerequisites researched — data DB
`technology_requirement` —, its tier open **per field** (physics, society, engineering; the
user's word), `potential` not false) dated as if researched next in its field, the traditions open
in adopted trees at the next tradition — or the viewer's own. Not the cards on offer: those are
chance (the user's call). Changes scale measured values, an approximation (the game adds
multipliers). Not modelled: pop growth, housing, free building slots (not in the save), storage
caps, one build at a time per queue. 2207.04.02: Civilian Industries on Earth 10 months, rural
districts 11–20, stations 20–50; over 60 months every strategy ends within 1 % of the others
(everything affordable gets built within ~2 years), 11 % above building nothing.

**Trade-offs presets** have a popup each (`Preset.ref`: `tech:`, `tradition:`, `perk:`; the
explanations of the tech tab), grouped and folded by source; untaken ascension perks are presets
too, dated at the next tradition (when a slot opens is not in the save; their modifiers are in
the data DB's `tradition_modifier`). Weights are in trade.
