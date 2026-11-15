# Tabs: trade, growth, jobs, produce, influence, contracts

Trade, growth, pops charts, growth projection, job output bonuses, jobs and the shared values, produce, influence, contracts. Read before working on one of them. _Moved verbatim from `AGENTS.md` on 2026-11-14._

**Trade tab** (`/trade`, `#lib/aiTrade.ts` pure; the user's biggest pain point, 2026-10-22: "who
trades what, both directions, for how much, normalised by trade"): the empires we have
communications with — regular and fallen ones only (`TRADING_TYPES` in save.ts; pre-FTL
civilisations, monsters, enclaves and the game's event countries also have communications), and
not the berserk machine fallen empire (`offersTrade()`: `action_offer_trade_deal`'s `potential`;
whether war bars a deal is open, `docs/open-checks.md` 6) —
with what the diplomacy screen shows: personality and its `trade_willingness`, attitude towards
us (one that does not trade refuses everything: data DB `attitude.trade`), their opinion of us
with its modifiers, trust, our deals, a gift's "Favorable Trade Deal" (data DB `opinion_modifier`:
+1 a point, max 100, decay 2 — a year, on the first gift's anniversary, seen 2202.06.01). With the **`tradeIntel`**
spoiler (cheating — their stockpiles and income; the route strips them otherwise): the deal
finder (we give X, for Y: per empire the most Y it would give per X, against selling X and buying
Y on the market with the fee) and per empire and resource whether it is short (under a third of
its storage) or flush (over three quarters). **Estimated**: the AI's valuation is engine code;
measured 2026-10-23 on three empires (one fallen) and gifts to 13 more
(`docs/trade-calibration.md` → What we know; every tooltip line is a case in `aiTrade.test.ts`): the
acceptance is our side's worth × the AI's willingness minus its side's, linear in the amount
however large; a unit a month is worth 0.5 × the months of one at once, 10 years or 30; a unit is worth p ×
base/(base + its **gross** income of it), both per resource and fitted (`WORTH`; not `ai_weight`,
not the defines' income base of 50), every tooltip line within 3 % at its date; minerals and food drift
upward over time (at the same income: minerals 0.048 → 0.056, food 0.067 → 0.082 a unit from
2212.08 to 2213.08), energy rose 10 % then held, the rest held — the defines' "need"
(`TRADE_VALUE_RESOURCE`) is engine state; the curves hold the latest level (2213.08) and the test
checks older lines at their date's level (`LEVEL`); a gift buys that worth at the AI's willingness in opinion (`giftOpinion()`, whatever
its attitude — rivals and unfriendly ones took gifts; the "What a gift buys" table; "Favorable
Trade Deal", max 100 — −2 a year on the first gift's anniversary; worth nothing into
full storage); a resource not measured gets no estimate. It takes in at worth only up to 0.8 of its storage
(`room()`, `worthOf()`; the deal finder's "They take" column — the base max, storage modifiers
are not in the save). It gives at once its
stockpile above max(`ai_wants`, 500) (`spare()`, `TRADE_MIN_RESOURCE_STOCKPILE`) and a month at
most 0.3 of its **gross** income (`TRADE_MAX_RESOURCE_PERCENT`, `monthlyCap()`; `AiIntel.income`,
READER 12). Open: motes, gases, crystals and the other strategic resources (the nomad test game).
**Trade is a resource** there (default trade → energy) though it has no `ai_weight`: measured like
the rest. **Nomadic empires** (`AiIntel.nomadic`, READER 11) are those running
`situation_nomad_economy` — the origin misses most (2212.06.01: six such empires, one nomad
origin); they never give energy or minerals (`NOMAD_RESERVE`; the game's
`concept_operational_reserves_desc` says so for the market, for deals it is our assumption —
calibration rows 23–24), nor do we when nomadic. **Trader enclaves** (`Snapshot.traderEnclaves`,
flag `trader_enclave_country_1|2|3` = XuraCorp exotic gases, Riggans volatile motes, Muutagan rare
crystals) sell for energy only, 500·N at once plus 10·N a month for +N a month over 3600 days
(4.5.2 `leviathans.130–132`, `enclave_trade_N_*`) — 14.2 energy a unit whatever N
(`ENCLAVE_DEAL`); shown without the spoiler, our running deal from `countryModifiers`. **Pay once, receive monthly** (the deal finder's second mode, `lumpForMonthly()`): our lump's
worth buys a unit a month at 0.5 × the months of one at once (`TRADE_VALUE_RESOURCE_MONTHLY_MULT`),
so over the deal the AI pays twice a swap's units, the same total for any length — held to its
monthly cap; a deal breaks when the payer "can't afford the monthly rate" (seen in game), so the
mode shows its net income after paying and how long its stockpile lasts. **What a
resource costs in trade**: per empire the trade paid per unit (`wantPrice`) and received
(`offerPrice`), against the market's buy and sell price. Tables are `SortTable`s (a cell snippet
gets the column id, for matrices); willing, opinion and trust are tinted by `scaleColor()`. Not
yet: the produce tab's trade-deal option.

**Growth tab** (`/growth`, `#lib/growth.ts` pure; the user's ask 2026-10-22, built before the
capacity model — see "Pop growth: planet capacity" in `docs/open-points.md`): per colony, natural growth
(`GROWTH_CAT_GROWTH`) as the mean of its last six saves (fractions are a chance: Embron 5, 6, 5 …
→ 5.33, so the cap of 5 rounds up too), months per 100 pops, housing used of the total
(`Colony.housing`, `housingUsed` — `total_housing`, `housing_usage`, READER 8), free districts
under the limit and more behind blockers (`colonyDetails().caps`), habitability, and notes: at the
cap, overcrowded (growth stops at 1.15 × housing, `OVERCROWDING_NO_GROWTH_THRESHOLD`), low
habitability, not growing. Still to come once capacity is fitted: what +1 district, a cleared
blocker, a medical building or an edict would gain, and the colonies ranked by it.

**Pops charts** (all, growth and colony tabs; `popSeries()` / `colonyPopSeries()` in
`#lib/series.ts`, the user's ask 2026-11-01): pops on the left axis, the monthly change on the
right as the mean over the months around each point (`windowMean`, saves within one game month
counted once), each month's whole pops faint behind it (`Series.faint`: thin, dotted, the colour of
the line before — `lineStyles()`). The window is the profile's `popWindow` (`#lib/popWindow.ts`,
⚙ → Pops charts with a month strip): `back` 3 and `ahead` 2 by default, 0–6 each — ahead keeps the
line level with its month, and a chart's last `ahead` points average fewer months and change as
saves arrive. **The save at `GAME_START` (2200.01.01) has booked no month** (every colony's
`growth.by` empty): its change is unknown, a gap the mean bridges — read as 0 it dragged every
chart's start down. An empty `by` later is a real zero (UNE's Unity, 2202.07–08, pops unchanged).
The user's asks 2026-11-02. **Growth is booked in whole pops, the fraction
a chance of one more, and no remainder is kept or saved** (4.0 patch notes: "Fractional growth is
not retained from month to month"; checked in saves 2026-11-02 — `pop_groups.<id>.fractions` is
the faction-change remainder, keyed by faction id, `-1` = none), so one month is off the rate by up
to 1. The change comes from `Colony.growth.by` (`current_month_growth_details`) grouped by `popCause()`: growth,
assembly, migration (immigration, emigration, migration, resettlement), other; stratum, species,
ethos and faction changes and group merges are left out (they move pops between groups). The game
has **no refugee category** (4.5.x `GROWTH_CAT_*` localisation): refugees arrive as immigration.
Causes seen in this machine's DB (2026-11-01): growth, assembly, colonization, decline, emigration,
immigration, other, promotion (always 0). Empire-wide, migration between our own colonies cancels
out; a cause that never moved gets no line. The colony tab's jobs chart is `Pops (jobs)`.

**Growth projection** (`#lib/growthProjection.ts` pure, `GrowthProjection.svelte` on the growth tab
and each colony page, rows from `server/growth.ts`; the user's ask 2026-10-24): 10 to 200 years
(the pick remembered per viewer), per colony and summed, biological and mechanical apart — they follow different rules. Biological:
the logistic formula with the defines' floor (10 %), minimum pops (10) and cap (5), times a speed
**calibrated per colony** (measured growth ÷ the formula at today's pops), so every modifier counts
unlisted; without a capacity, the measured rate. Mechanical: assembly at its measured mean. Both
stop at `OVERCROWDING_NO_GROWTH|ASSEMBLY_THRESHOLD` × housing, housing need per pop as today.
Everything else is held at today's values (no new districts, colonies, migration, techs) — not
checked against a game run yet.

**Job output bonuses and how they stack** (jobs tab, first panel; the user's ask 2026-11-05;
`#lib/outputBonuses.ts` pure, `server/outputModel.ts`, `panels/OutputBonuses.svelte`): per colony
and resource, workforce (`ColonyJob.filled` + `bonus`, job efficiency's `bonus_workforce`, READER 46)
÷ 100 × (base + adds) × (1 + mults). Base: data DB `job_resource`. **Which modifiers reach a job**:
its economic category (`job.budget_source`) and every parent (data DB `economic_category`,
extraction 2026-11-05: physicists → researchers → jobs_specialist → jobs_productive → jobs →
planets → country); `<category>_produces_mult` and `<category>_<res>_produces_mult` of any of them,
`<own category>_<res>_produces_add` only (common/economic_categories README: adds do not inherit).
Sources: `empireSources()` (as research), the colony's buildings, designation, deposits and planet
modifiers (`heldOf`), its governor (`leaderRoles`, wasted ones out), the species' traits for their
share of each job (`ColonyJob.species`, READER 46; 4.5.x traits mostly change workforce, which the
save's `bonus_workforce` already holds), and the player's difficulty bonus
(`modifier:difficulty_<d>_player`: cadet +50 % to every job), and **High Stability**
(`stabilitySource()`: `planet_stability_high`'s +30 % × (stability − 50) ÷ 50, from 0 at 50 to all
of it at 100 — the game's Physicist tooltip at the throwaway Theian Preservers' capital: stability
73.345 → "High Stability +14.01%", 73.362 → +14.02 %; Roaming Korinth at 100 → +30 %), and **Low
Stability** below 50 the same way (`planet_stability_low`'s −50 % × (50 − stability) ÷ 50: 48.88 →
"Low Stability −1.11%", 2219.01). A governor's **sector** effect is not for its own colony (the
tooltip lists only "Governor Skill +6%"). Checked line by line on the 2219.01 Miner tooltip: (50 +
12.5 Mining Guilds) × (1 − 10 % Energy Shortages − 1.11 % + 2.5 % Mining Rush + 6 %) = 60.86, the
save books 60.86. **In a resource shortage** jobs whose inputs are short make less than the bonuses
say (alloys and consumer goods −59 % in Mineral Shortages III): a deficit, left in the rest. **Measured
against the save**: the colony's `produces` ÷ its base = the multiplier it got; the **rest**
(measured − counted) is what is not counted yet. Theian Preservers' capital: research and unity
rest 0.0, worker resources −1.0 % (Korinth −3 %: not crime, Korinth has none); Planetforgers'
capital research +10 % (Pleased, `pop_pleased` +25 % workers and specialists, never in a tooltip
yet?), alloys and minerals more (flat building output?) — open check 31. "+10 % is" values one more bonus against the measured
total (`realGain`).

**Bonuses tab** (`/bonuses`; the user's ask 2026-11-15: "how big is the impact of a +x bonus
to Y actually at this point in the game?"; `#lib/bonusPiles.ts` pure, `server/bonusPiles.ts`,
`panels/BonusCard.svelte`). One card per pile. Each card shows the lines that hold now, a dropdown
of typical values, "my own value…", and the result. Every pile works the same way: a bonus x
changes what is measured now by (1 + pile + x) ÷ (1 + pile) (`factor()`), or by the inverse for
a time a speed bonus shortens. −10 % upkeep on top of −20 % saves 12.5 %. A card's **parts** are
what it acts on, each with its own pile and what is measured now (`base`; null: the change is shown
relative only). A targeted bonus (an area, a resource, a ship size, a category) reaches only the
parts that name it (`reaches()`).

- **Presets** (`presets()`): every unconditional modifier the pile takes in the explanations of the
  sources a player picks (tech, tradition, perk, civic, edict, policy, agenda, ethic, origin,
  authority, resolution, trait, building, designation; static modifiers left out as one-offs). They
  are ranked by how many sources give a value, the top 6 kept, each naming one source as an
  example. The one shown first (`defaultPreset()`) is the most common one that helps (negative for
  cost and upkeep), and the smaller on a tie.
- **Research**: speed and cost from `researchBonuses()` (the tech tab's piles). Days are what is
  left on the tech in progress (its due date in Upcoming). Without one the change is relative.
- **Job output per resource**, research included (in the Research group): `outputModel()`, one part
  per job on each colony. Its base is its share of the colony's booked output (`output ÷
predicted`), its pile the colony's measured total (else counted), its targets its economic
  category chain. So `planet_researchers_produces_mult` reaches researchers only. Checked
  against the jobs tab's panel (2026-11-15, KhellZen 2210.01.01: food 101 at ×2.10, +10 % = +4.8).
- **Upkeep by economic category**: `<category>_upkeep_mult` and `<category>_<resource>_upkeep_mult`
  reach the category and every one below it, as output does (common/economic_categories README).
  Budget sources are categories, so their expenses are the parts. There is one card per category
  that has an upkeep bonus in the game data and expenses under it. The pile counts
  `empireSources()` only: not a building's or a planet's own, nor the penalty over naval or
  starbase capacity, so it carries ≈. No floor on upkeep mults in the defines; `TECH_COST_MIN`
  (0.25) and `TRADITION_COST_MIN` exist but are not applied here.
- **Pops**: `logistic_growth_mult` and `planet_pop_assembly_mult` on each colony's measured growth
  and assembly (`growthData()`). The pile counts only the empire-wide sources, while the measured
  rate holds every modifier, so it carries ≈.
- **Wellbeing**: `planet_stability_add`, `pop_happiness` (not for a gestalt), `planet_amenities_add`
  and `_mult` are flat, not a pile. They run through `whatIf()` (the colony what-ifs' chain), in the
  page for any value.
- **Speed**: buildings, ships (`starbase_shipyard_build_speed_mult`, plus a size's
  `shipsize_<size>_build_speed_mult` and its class's `shipclass_<class>_build_speed_mult`), starbase
  upgrades and modules, armies, blockers, megastructures, terraforming, colony development, planet
  decisions and excavation. What is queued now uses its base days (`GameData.buildDays`); otherwise
  the change of the time. Whether `progress_needed` already holds the speed is not known, so the
  queue's own numbers are not used. Open: the in-game check of a ship's upkeep and a building's
  time against the game's tooltips.

**Jobs tab and the shared values** (`/jobs`, `#lib/unitCosts.ts` pure, `server/unitCosts.ts`; the
user's asks 2026-10-22: "normalised costs for everything we produce" and "how well does each job
perform on each colony, which colonies should be specialised"):

- **Which job a budget source is** (`jobSources()`, `#lib/jobs.ts`): the budget books a job's
  output under its `resources.category` (data DB `job.budget_source`), **not** under its name —
  drone jobs share the organic jobs' (`technician_drone` → `planet_technician`, `fabricator` →
  `planet_metallurgists`), `patrol_drone` and others the generic `planet_jobs`. A source goes to
  the jobs the empire works with it, split by worked pops when several do (marked estimated).
  Matching by name left a gestalt's jobs panel empty but for Maintenance Drones (Yorphia
  2203.10.01). **What a stratum makes as such is booked under the stratum**
  (`pop_category_<stratum>s`, a gestalt's `pop_category_drones`): civilians' unity under Social
  Welfare, every stratum's trade (2201.01.01: civilians unity 11.24, trade 6.74). Its income goes
  to the stratum's worked jobs by pops; its expenses are the pops' upkeep (below).
- **What a unit costs us**, per source from the latest budget: a job's inputs plus its workers'
  upkeep — the stratum's `pop_category_<stratum>s` expenses per pop (a gestalt's three drone
  strata share one, `pop_category_drones`) **and** what every pop eats,
  `planet_pops_traits` (food; alloys for the Planetforgers' species) per pop; without the latter
  worker jobs came out near free (technicians 0.02 trade per energy) —, stations' and starbase
  modules' upkeep. Several outputs split the cost by value. Not counted: what building it cost,
  building and district upkeep.
- **Values** (`unitValues()`, `valuesOf(snaps)`): the market's base price where it sells (trade
  = 1), else the output-weighted mean of its sources' cost per unit, iterated to a fixed point.
  The systems, produce and trade-offs tabs value resources at these (the produce tab's own
  overrides on top, "ours" resets one). 2212.03.05: physics 0.74, society 1.53, engineering 1.49,
  unity 0.95.
- **Colonies × resources**: a colony's output (`Colony.produces`) against its filled jobs at the
  empire's mean per pop (budget `planet_<job>` income ÷ filled) — 100 % average; shown only where
  its jobs make at least 1 a month (flat building output read Caugantu's alloys as 604 %). The
  best colony per resource is bold; the per-job output per colony is not in the save, so this is
  per resource.

**Produce tab** (`/produce`, `#lib/produce.ts` pure, inputs from `server/produce.ts`; the user's
ask 2026-10-22: "the best way to generate resource X, real and normalised costs"): pick a
resource, every option that adds it ranked by **trade per unit** over a horizon (1, 5, 10 years):
(one-off cost + months × what it uses per month) ÷ (months × units), other resources at market
base prices — the market's buy price (`price × (1 + marketFee)`, the save's fluctuation) is the
same unit, shown above the table, and "beats buying after" is the payback against it. What else an
option yields is shown, **not netted**: netted, a mining district's minerals made it the cheapest
alloys source (Planetforgers' miners yield a little alloys) at a negative price. Options: the
trade-offs tab's stations, districts and buildings (`tradeoffData()`; `jobMeasure()` and
`paidFactor()` shared from `server/tradeoffs.ts`), starbase modules and buildings of types we have
built where a starbase has a free slot (data DB `starbase_level` slots; output and upkeep scaled
by what the budget books for the built ones), a blocker cleared plus a district in the room it
makes (cost both, days both), and edicts we could enact (`edictRows`: possible, unlocked, not
active) — their output modifiers (`edictModifiers`, data DB `tradition_modifier`) as a share of
what the group yields today (`groupFlows()`: per job, stratum and station kind; `changeGain()`),
marked `estimated`, an upper bound since the game adds multipliers. Values of what the market
does not sell (influence, unity, research) are the viewer's, in `produceView.weights`. Not
offered: buildings never built (no unlock data per building), designations, job swaps, new
colonies, trade deals (step 4).

**Influence tab** (`/influence`, `#lib/influence.ts` pure; the user's ask 2026-11-05: "how much
do I get and from which source, how much do I spend and for what, how much am I not collecting"):
the month by budget source (`resourceBudget()` with `INFLUENCE_LABELS`), the sources over time
(`influenceSeries()`), what the budget does not book (`unbooked()`, `namedSpending()`), and **Not
collected** (`uncollected()`):

- **Power projection** (budget `country_power_projection`): at most 2
  (`country_power_projection_influence_produces_add`, `empire_base`), × naval coverage —
  `navy_coverage_shortage` (1 − navy size ÷ empire size, clamped, mult −1). **Fitted on 40 saves
  (2026-11-05): navy size = 2 × `used_naval_capacity`**, so coverage = min(1, 2 × used ÷
  `empire_size`) — 15 at 52 → 1.1538, 28 at 70 → 1.6, 15 at 119 → 0.5042, exact. The maximum is
  read as booked ÷ coverage, so modifiers count (Planetforgers 2214.02 books 5.25 at full
  coverage). **A navy of 0 books 0.2**: Roaming Korinth (nomad) and the throwaway Theian
  Preservers (2200.03–05, fleet disbanded; 1.2 at 15 of size 50 before) — read as a 10 % coverage
  floor (a flat 0.2 minimum would read the same at the default maximum of 2).
- **Rival slots**: 0.5 influence a rival (`common/diplomacy_economy`, valued at what a rival books
  now when there is one); slots 3 (`empire_base`) + 2 with the Animosity stance
  (`diplo_stance_animosity*` policy flag) + 1 with `tr_enmity_adopt`.
- **Lost at the storage cap** (`lostAtCap()`): with companion mod's `storageMax`, the net while at
  it; without, a stockpile that did not move although the budget booked a gain (Planetforgers
  2214.01–02: 1000 both, +5.8 booked) — estimated; the unexplained row then says so.

**Contracts tab** (`/contracts`, `#lib/contracts.ts` pure, `server/contracts.ts`; the user's ask
2026-11-07: contracts for nomadic and settled empires, a tab and on the maps). `Snapshot.contracts`
(READER 52, `contracts()` in save.ts) is every contract in the galaxy — **the save does not say
who may see or accept one** (the game's `potential_operator` / `possible_operator`; scripts can
only count them: `count_visible_contracts`, `count_available_contracts`), so the rules are ours
(the user's call): a **nomad** (`nomadic()`) sees what it operates and the offers of issuers it
has communications with (an issuer needs that to issue at all, `can_issue_contracts_trigger`);
spoiler `contractSpoilers` (intel) the other offers; cheat `contractsAll` everything. A **settled**
empire sees what it issued; the spoiler adds others' contracts up to `contractView.range` jumps
beyond the border (`jumpsFromBorder()` over discovered lanes — Planetforgers 2214.02.01: 32 of 129
visited systems reachable, so most contracts need range "anywhere"), the cheat everything.
What the game shows a settled empire of others' contracts is not known (`docs/open-checks.md` 32).
Names and categories from the data DB's `contract` (`GameData.contractTypes`, `{}` without the
table: the key shows); kinds (military, science, resource, diplomacy, other) from the category's
name, symbols ours (`KIND_INFO`). The map tab has a `contracts` layer (`contractMarkers()`); the
systems, situations, diplomacy and megastructures maps draw `ContractMarks.svelte` in their
`layer` (`contractMarksAt()`), the history map not (it shows a past month). Checked 2026-11-07
on a fresh DB with Planetforgers 2214.02.01 (settled): 0 rows plain, 1 spoiler at +7 (Lolehndra's
Remote Physics Research), 18 with the cheat, every map 200; the nomad rules by unit tests only
(no nomad player save with contracts on this machine), the drawing not seen in a browser.
