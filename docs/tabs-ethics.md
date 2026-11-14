# Tabs: ethics

Read before working on `/ethics`. _Moved verbatim from `AGENTS.md` on 2026-11-14._

**Ethics tab** (`/ethics`, `#lib/ethicsTab.ts` pure; the user's ask 2026-10-28: "which ethic gets
how much attraction, now and over time", and the factions' details): our pops per ethic, their
share, the **attraction share** — the country's `pops_ethics_attraction` (attraction-weighted
pops) as a share: where the pops are heading; above its pop share an ethic gains — last month's
change, and the save's empire-wide `ethics_attraction` per ethic as "×" (the product of the ethic's
`country_attraction` factors, below). **Checked against the game's Ethics Attraction tooltips
2026-10-30** (throwaway nomad game, 2200.05.01, screenshots
`~/Pictures/Screenshots/screenshot_2026-10-30_20-09-12` … `20-09-53`): pops, change and the
"Average Ethic Attraction" match — that average is `pops_ethics_attraction` ÷ `pops_with_ethic`
(egalitarian 64509.70 / 5218 = 12.36), its percentage the attraction share; the game **cuts**
percentages and the average (26.38 % → 26.3 %, 6.305 → 6.30), so the tab does too. Every reason
the game listed per ethic is ✓ on the tab and none more (governing ethic, High Living Standards,
Democratic Authority, council, governor; "− Pop works as a Priest" for materialist — a
spiritualist's bureaucrat). `Snapshot.ethics` keeps the save's lists **by index** (READER 24) and
the tab maps them through `GameData.ethicOrder` (data DB `ethic.sort_order`, the order of
`common/ethics/` — 4.5.2: fanatic authoritarian 0 … materialist 15, gestalt 16), so a wrong
order is fixed without re-reading saves. The real-save test checks it: the pop groups' named
`ethos` summed per ethic give the same ethics as the lists (UNE 2207.04, Planetforgers 2214.02,
spiritualist and materialist included), the counts a few pops apart (4032 vs. 4042 — the lists
lag). The governing ethic an embrace of a new ethic would remove is marked (the lowest attraction,
none while a fanatic ethic is held — it is demoted instead; insights doc 18). Charts: share and
attraction per ethic, faction support and approval (lines by faction type, named by the latest
reading — older readings hold shorter names, "of Scientific Betterment"); per colony
`pops_ethics_on_colonies` (a colony id, stored as its planet). **Factions** (`FactionCard.svelte`,
moved from the government tab): support, approval, pops as the game's factions screen (confirmed
2212.03.05, below), its guiding ethic, promoted / suppressed (`promoted_<ethic>`,
`suppressed_<ethic>` country modifiers, 4.5.2 `inline_scripts/pop_faction_types/actions/`), what
embracing it needs (`embrace()`: support > 20 %, 5000 unity, no `embraced_faction_timer`, not
already fanatic) and its demands; faction types not formed only with the `factionTypes` /
`allFactionTypes` switches (cheating). The ethics history starts with READER 24's re-read of the
saves on disk: 5 of 32 UNE snapshots, 32 of 191 Planetforgers' on the 2026-10-28 DB copy.
**What draws pops to each ethic** (the user's ask 2026-10-30: "all sources of ethics attraction,
grouped by ethic, and governing ethics attraction; which apply; which can be changed";
`#lib/ethicSources.ts` pure, `AttractionSources.svelte`): per ethic (ours first), then the
governing ethics (`pop_government_ethic_attraction`) and the shift speed
(`pop_ethics_shift_speed_mult`). **The ethic's own rules** (data DB `ethic_attraction`, from
`common/ethics/00_ethics.txt`): `country_attraction` factors — their product is the save's
`ethics_attraction` (the "×" column, now explained: held ×2, fanatic ×3, Democratic Authority
×1.25 for egalitarian and ×0.75 for authoritarian, Unrestricted Warfare ×0.75 for pacifist …) —
and the `pop_attraction_tag` reasons the game's tooltip lists, each evaluated three-valued by
`#lib/triggers.ts`, which now also answers `has_edict`, `has_faction`, `has_federation`,
`is_subject`, `exists = overlord` and `has_election_type` (data DB `authority.election_type`),
and the scopes the reasons look into, which the extraction turns into leaves
(`attraction_structured()`): `council_leader_ethic` / `governor_ethic` (leaders' `ethic` and our
colonies' `governor`, READER 26), `assigned_jobs` (jobs with a pop), `has_living_standard` and
`species_has_living_standard` / `species_has_trait` / `species_is_robotic` (our species' rights and
traits), `other_organic_species` / `all_organic_full_citizenship` / `enslaved_organic_species`
(our species, their citizenship; slavery = data DB `species_right.is_slavery`). Relations stay
"?". "Pop is enslaved" is positive for egalitarian in the files (slaves are drawn to it).
**How to get each source** (`unlockOf()`, the user's ask 2026-10-30): edicts and agendas their
unlocking traditions or perks (alternatives, "or"), techs and the progress their `potential`
asks for (`has_technology`, `has_tradition`, `has_ascension_perk` — not yet, not never: Hearts
and Minds is an ambition behind Ascension Theory); policy options their policy; council seats
their civic; buildings the civics or origins that unlock them (data DB `building_unlock`, no
techs known); leader traits the leaders who have one. `forUs` false — a potential false on who
the empire is (`identityOnly()`: nomadic, gestalt, civics …) — hides a source but under
"everything": the nomads' twins of agendas and policy options (Open Arms, Isolationist) showed
twice before. An agenda's two modifiers are one row, preparing then after launch.
**A building's planet modifier stacks per building** (checked 2026-10-30 in the nomad game's
saves, no screenshot needed): the arkship's second Temple (between 2201.01.01 and 02.01) took a
pop group's spiritualist attraction (`pop_groups.<id>.ethics_attraction`, by ethic index) from
6.7925 to 7.05375 = 5.225 × 1.30 → × 1.35 (Veneration of Saints +25 %, +5 % per Temple); so
`holdings()` counts every building. Pop groups take a change up one by one — another group still
read 6.7925 at 2201.04.01.
**Amenities, happiness and stability** (the user's ask 2026-10-30: "when do I have enough amenities
on a colony, when does it make sense to provide more?"; `#lib/wellbeing.ts` pure,
`ColonyWellbeing.svelte` on the colony page; the rules in `stellaris-modding-insights/docs/19`):
amenities provided ÷ needed (`colony.amenities`, `amenities_usage`, READER 28) count between 25 %
and 200 % (`MIN|MAX_PLANET_AMENITIES`): −50 % happiness at 25 %, +20 % citizen happiness at 200 %
(`planet_amenities_low|high`; a gestalt's stability −50 / +20), so the panel says what is short,
how much more still helps, and what beyond twice the need is wasted; the Pop Approval Rating
(happiness weighted by `pop_groups.<id>.power`) moves stability −50 at 0 % … +30 at 100 %
(`LOW|HIGH_HAPPINESS_STABILITY_EFFECT`, neutral at `BASE_HAPPINESS` 0.5); stability scales job
output −50 % at 0 … +30 % at 100 (`planet_stability_low|high`, neutral at 50). Defines and the
static modifiers' values come from the data DB (`wellbeingRules()`). **The scaling is linear for
approval → stability and stability → job output** (Roaming Korinth 2203.02.01: approval 97.5 % →
+28.5, stability 98.143 → +28.88 %, the game's tooltips); **amenities between the ends are still
assumed linear**, marked ≈ (`docs/open-checks.md` 17). Civilians use no amenities (need there:
500 base + 1 per elite, specialist and worker pop). Civic needs carry their authority
(`civicAuthority`, data DB `civic_requirement`): the three Memorialist civics differ only by it,
ours first, the others greyed.
**Room above the stability cap** (the user's ask 2026-10-31: "by how much I am over the ceiling of
100, by how much happiness and amenities could be decreased, what I could change, and its side
effects"; `ColonyStabilityRoom.svelte` beside it while stability ≥ `MAX_PLANET_STABILITY`): **the
save holds stability capped** (`stability=100`, no breakdown), and the data DB cannot rebuild it —
the arkship's tooltip (2205.06.01, screenshot `screenshot_2026-10-31_08-50-48`: base 50, Economic 10,
Capital Arkship 5.6, + Pop Jobs 17 + approval 27 = 109.6) took 10 from the nomad economy
situation's stage modifiers and most of 17 from triggered job modifiers, none in the data DB. So
companion mod 0.8.0 exports `planet_stability_add|mult` per colony (`docs/companion-mod.md`) and
`uncappedStability()` adds base and approval's share — assumptions in `docs/open-checks.md` 22.
`approvalRoom()` / `amenityRoom()` invert the linear scales: approval points (and amenities,
wasted ones first) that may go before the overshoot is spent; without the mod `roomRates()`
(2205.06: 1.67 approval points per stability point, ≈ 310 amenities per approval point). The
Stability chart's right axis shows "over 100". **What holds them up** (`#lib/wellbeingLevers.ts`):
every popup explanation that holds now (`heldOf()`: this colony's active buildings, designation,
worked jobs, deposits, planet modifiers; the empire's traditions, perks, edicts, policies, civics,
ethics, authority, origin, council seats, species rights, techs, species traits, country
modifiers) with a modifier that raises happiness or amenities (`raises()`: a cut in amenity usage
counts, a gestalt's `no_happiness` ones instead); its other modifiers are the side effects. Only
unconditional modifiers — living standards' happiness, most job variants and leader traits are
triggered and missing; 2205.07 listed Prosperous Unification, the capital building and Medical
Workers.
**Colony deficits** (`#lib/colonyLogistics.ts` pure, `server/logistics.ts`, `ColonyLogistics.svelte`
on the colony page, the colonies tab's `logistics` column; the user's ask 2026-11-02: "what deficit is
costing me per colony, so I can see whether specialising is worth it"): the budget's
`planet_resource_deficit` (trade, empire-wide only). Rule from MattMills/stellarstellaris-win
`docs/economy.md` ("Planetary deficits", inferred there): per colony and resource, upkeep − produces
× the resource's `deficit_trade_conversion_mult` (data DB `strategic_resource.deficit_trade`, since
extractor 2026-11-02; an older DB falls back to 0.125 × base price, the same numbers) × the galaxy's
`logistics_planet_deficit_costs`; **the capital's shortfall less the country's `country_base`
income** (`isCapital()`: `col_capital*`). Checked 2026-11-02: 15 of 17 AI empires exact
(dashboardtest1 2210.01.01; the misses are pre-FTL colonies), ours −2.0 % (Planetforgers
2214.02.01), +0.1 % (Roaming Korinth 2207.02.01), +4.4 % (UNE 2202.08.01), +2.4 % (UNE3
2207.04.02); without the capital rule +29 … +67 %. The colonies tab shows the sum against what the
budget booked (✓ within 5 %, `fitCheck()`). **Make it here instead** (`localAlternatives()`): the
produce tab's cheapest option on the colony (districts with room, a cleared blocker's district,
building types we have — slots unknown), as many as cover the shortfall; its net cost a month =
(cost over the produce view's horizon + upkeep + what the moved workers make now − the unit's value)
× all it makes, surplus included; civilians take the jobs first, a worker is worth the colony's job
output ÷ employed (`perWorker()`). Wins when that is below the fee on the shortfall. Not counted:
designation bonuses. Not yet compared with the game's budget tooltip.
**Distribute Luxury Goods** (`#lib/luxuries.ts`, `LuxuryGoods.svelte` on the colony page; the user's
ask 2026-10-31): `decision_planet_luxuries_boost` costs 100 Consumer Goods per started 1000 pops
(8500–9999: 900, at most 1000; 4.5.3 `common/decisions/00_resource_decisions.txt`), then
`planet_luxuries_boost` for 3600 days — `planet_amenities_mult` +25 %. The what-if runs the chain
above: +25 % of today's amenities (≈: other amenity multipliers make it less) → happiness, taken
as approval → stability (× `stabilityMult`, from the uncapped value with the mod) → job output,
on today's job output scaled back by stability's share (`jobOutput()` from the job rows' flows),
× 120 months. **Stability raises output, not upkeep** (the game's job tooltip 2026-10-31,
`screenshot_2026-10-31_18-16-28`: physicists' "High Stability +30 %" under Produces, upkeep 5.16
without it); job efficiency (`screenshot_…18-16-11`: +72 % → 344 of 200 workforce) is extra
workforce and scales both. Not offered to gestalts, on a Nanotech World or while it runs.
**What-ifs** (the profile's `whatIfs` switch, a **spoiler**, off by default — the user's ask
2026-11-02: "more what-ifs like Distribute Luxury Goods, for edicts and policies, guarded by a
setting"; it gates Distribute Luxury Goods' too; `#lib/whatIf.ts` pure, `server/whatIfs.ts`,
`WhatIfLine.svelte`, `ColonyWhatIfs.svelte`): what a set of modifiers would do from now, ≈. Two
paths: output modifiers as the produce tab prices edicts (`changesOf()` → `changeGain()`, a share
of today's output, an upper bound), plus — in `whatIf.ts` only, the trade-offs tab's rules leave
them out on purpose — `country_<res>_produces_mult` (a share of the jobs' output of it) and
`<job>_jobs_bonus_workforce_mult` (designations; extra workforce, its upkeep not counted); and
amenities, `pop_happiness` and `planet_stability_add` colony by colony along the Luxury Goods chain
(`wellbeingChain()`, which `luxuryWhatIf()` now runs on). Every other key is listed "not counted"
(most edict and policy modifiers are military, leaders, diplomacy). **Government tab**: per edict
"if enacted now" (an active one "if cancelled now"), per policy option the switch from the selected
one (`swapModifiers()`; data DB `tradition_modifier` of the option, `GameData.policyModifiers`).
**Colony page**: designations of the colony's own kind (`designationCandidates()`: same district
set, capital among capitals, gestalt ones for gestalts — the game's `potential`s are planet-scope
triggers the save cannot answer, so ≈), each with the deficit fee's change; and every planet
decision not ruled out (data DB `decision`, extractor 2026-11-02, `#lib/planetDecisions.ts`: the
planet's own leaves — `has_modifier`, `has_designation`, `is_planet_class`, `is_capital`,
`pop_amount` — answered there, the country's by `#lib/triggers.ts`, "(?)" otherwise) that adds a
static modifier (its explanation's modifiers) or removes one the planet has, with its cost tier and
duration. Checked 2026-11-02 on a DB copy (Planetforgers 2214.02.01, UNE 2202.08.01): every page
200; switch off → none shown, on → shown, spoilers hidden → off again. Not compared with the game
(`docs/open-checks.md` 28).
**District automation** (the user's ask 2026-11-12; `#lib/jobAutomation.ts` pure,
`colonyAutomation()` / `automationRanking()` in `server/whatIfs.ts`, `AutomationLine.svelte`, the
colonies tab's `AutomationRanking.svelte`): per colony the next building of each automation line —
data DB buildings of category `pop_assembly` whose every modifier is a `job_<job>_automated_workforce_mult`
(4.5.4: farmers, miners, technicians and their drones, 25 % then 50 %), techs from `technology_unlock`
— on the job rows: the share × positions on top of the save's `automated_workforce` (READER 54),
open positions first, then pops' work (freed). **Output** (the user's ask 2026-11-12): what the automated workforce makes and what the freed pops made there, at one rate per workforce (the row's output ÷ (workforce + job efficiency's bonus)) — pops add the bonus, automation does not (in game: 900 pops + 90 + 300 automated, every multiplier on all 1290); only the job's own resources (data DB `job_resource`), not its stratum's trade. **Its monthly cost scales
with the districts**: the building's upkeep plus each automated job's stratum rate (data DB
`pop_category_automation`, extractor 0.1.16; none from an older one), checked against the budget's
`planet_automated_jobs` (1519.6 predicted, 1527.8 booked). Tankbound (1.0 by civic) and wilderness
build none. **It stands in a zone of its district** (4.5.4 `common/zones/00_zones.txt`: the government and urban zones exclude the `*_automation` sets; the user's catch 2026-11-12): while no built district holding its jobs has a zone, the line says "needs a zone in the … first" (`zoneNeeded()`, the save's `districtList`). Free slots unknown → "(?)". Checked 2026-11-12 on a DB copy (Yorphian 2203.11.01, with
Assembly Patterns added to the copy: Yorphia technicians +225, 17 energy). Seen in game 2026-11-12 (Earth: 300 of 1200 farmer positions automated, open ones first, 12 + 8 energy; `docs/open-checks.md` 35).
**Icons** (`#lib/icons/`, the user's ask 2026-11-09: "come up with some svg icons for the
building — we might use original images at some point, but not for now"): our own 24×24 stroke
icons in `currentColor` (no game art, workspace `AGENTS.md`), `iconFor(key, category?)` resolves a
district, zone or building key by its words (first match in `BY_WORD`: strategic resources and the
district's family before its specialisation), then a building's data DB `category`, then a
hexagon — mods' keys get one too. The colony page's districts panel shows them as cards
(`panels/ColonyLayout.svelte`, per viewer `localStorage` `colonyDistrictsView`, the table kept as
the other view); no empty slot is drawn, free building slots are not in the save. **Two rows**
(`#lib/colonyLayout.ts`, the user's ask 2026-11-09: "city district, additional zones as a 2nd
district; the special districts; five tiles"): the city district (named like one — city, hive,
nexus, housing; else the uncapped district) with its first zone, the government zone, and beside
it a tile of its other zones; below, the other districts, then those the planet's caps allow but
has none of (×0, faded) — usually generator, mining and agriculture. A planet with more special
districts (Planetforgers' capital: geothermal, magma, mining, thermotechnic) wraps to three a row.
**Building popups everywhere** (`building:<key>`, `server/explain.ts`; `BuildingName.svelte`):
cost, upkeep, output, jobs (workforce ÷ 100), modifiers, unlocking civics; `branch()` picks those
of every building on our colonies or queued (`buildings`, like `designations`), so the districts
panel, build queues, trade-offs and produce tabs show them.
The group header shows the save's ×, the known product and the rest "from N rules the save cannot
tell" (council, relations, federation, script values). Checked 2026-10-30 on the nomad game
(2200.02.01): authoritarian ×0.75 and pacifist ×0.75 fully explained; egalitarian ×3 = known ×2.5
× 1.2 unknown. **Modifiers** (every data DB modifier table: traditions, perks, edicts, agendas
— `#finish` = after launch —, policy options, civics, origins, buildings, designations, council
seats, leader traits, static modifiers, deposits, relics): ✓ / ×N colonies / ✗ / ? (`applies()`
from `holdings()` of the latest save), and how to change it (`changeOf()`: now — edict, policy,
building, designation, leader, agenda, promote/suppress; slowly — tradition, perk, reform; not —
events, origin, deposits). Filters (per viewer): what applies or can be changed (default), what
applies, everything. Not covered: job modifiers (bureaucrats, enforcers, telepaths add governing
attraction on their planet) — the data DB's `job_modifier` holds a job's unconditional modifiers
only (the colony page's levers use them), most of these are triggered.
