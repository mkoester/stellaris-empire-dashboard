import type { AttractionRule, AttractionSource } from './ethicSources.ts';
import type { EntryEvent, SystemEntry } from './systemEvents.ts';
// Shapes shared by server and pages.

import type { Trigger } from './triggers.ts';
import type { AiWeight } from './votes.ts';

export type Resources = Record<string, number>;

export type Colony = {
	planetId: number;
	name: string;
	designation: string;
	sector: string | null; // the sector its system belongs to; null outside any
	colonizing: boolean; // being settled; complete at 100 pops
	// last month's change in pops, by cause (signed: emigration negative), e.g.
	// { growth: 3, emigration: -18, promotion: 0 } — null when the save has none
	growth: { net: number; by: Record<string, number>; byStratum: Record<string, number> } | null;
	pops: number;
	employed: number; // employable pops minus civilians (the save has no direct count)
	civilians: number; // pops without a job (the 4.x "civilian" stratum)
	stability: number;
	freeHousing: number;
	housing: number | null; // total_housing; null before 2026-10-22
	housingUsed: number | null; // housing_usage: pops × their housing need
	freeAmenities: number;
	amenities?: number | null; // provided; since READER 28
	amenitiesUsage?: number | null; // needed by the pops; since READER 28
	crime?: number | null; // since READER 28
	// the flat stability (`planet_stability_add`) and its multiplier, which the game caps at 100
	// into `stability`; companion mod 0.8.0, READER 36 — null without the mod
	stabilityAdd?: number | null;
	stabilityMult?: number | null;
	ascensionTier?: number; // `ascension_tier`; since READER 29
	governorSkill?: number; // its governor's level + bonus_skill_level, 0 without one; since READER 29
	districts: number;
	districtList: ColonyDistrict[]; // per district type: built, zones and their buildings
	planetClass: string;
	planetSize: number;
	deposits: string[]; // deposit types on the planet, blockers included
	planet: PlanetState | null; // null in older snapshots
	timedFlags: TimedModifier[]; // the planet's timed flags (cooldowns of decisions …); since READER 21
	buildQueue: QueueItem[];
	buildSlots: number; // items the planet builds at once (queue `simultaneous`; >1 for wilderness, arkships, mods)
	jobs: ColonyJob[];
	openJobs: number; // unfilled positions, summed over the colony's jobs
	strata: Stratum[]; // pops and happiness per stratum (worker, specialist, …)
	happiness: number | null; // 0–1, pops-weighted over the strata
	approval?: number | null; // the Pop Approval Rating: happiness weighted by political power; READER 28
	habitability: number | null; // 0–1, pops-weighted over the pop groups
	speciesHabitability: Record<string, number>; // per species id living there, pops-weighted
	automation: { enabled: boolean; settings: string[] };
	produces: Resources; // the colony's monthly output and upkeep, as the planet view sums them
	upkeep: Resources;
};

/** happiness null: the save left it out (rulers and specialists at 2200.05) — unknown, not 0. */
export type Stratum = { category: string; size: number; happiness: number | null };

/** Ships by size (corvette, science, …) in one group. */
export type ShipCount = { group: 'military' | 'civilian' | 'station'; size: string; count: number };

/** The victory screen: rank and score, and the three power ratings behind diplomatic weight. */
export type Score = {
	rank: number;
	score: number;
	economy: number;
	tech: number;
	military: number;
};

export type Fleet = {
	fleetId?: number; // absent before READER 22
	name: string;
	ships: number;
	power: number;
	route: Route;
};

/**
 * Where a fleet is and which systems its orders take it to (current order first, then the queue),
 * with hyperlane jumps counted from where it is. The save holds no arrival dates.
 */
export type Route = {
	at: string;
	systemId?: number; // the system it is in (`coordinate.origin`); absent before READER 38
	moving: boolean;
	stops: { system: string; jumps: number | null; unexplored: boolean }[];
};

/** A ship order: what (`research_anomaly`, `survey_planet`, `build_orbital_station`, …), where, how far. */
export type ShipOrder = {
	kind: string;
	target: string | null;
	progress: number | null;
	orderId: number | null;
	size?: string; // build orders: the ship size being built (starbase_outpost, mining_station, …)
	anomaly?: string; // anomaly orders: the planet's anomaly category
	system?: string; // the target's system (absent in snapshots from before it was read)
};

export type CivilianShip = {
	fleetId: number;
	name: string;
	kind: string; // science_ship, constructor, colonizer, … (the fleet's class)
	size?: string; // the first ship's size: nomads_constructor, constructor, … (READER 38)
	stance: string | null; // fleet_stance: evasive, passive, aggressive (null: the game's default)
	automation: string[] | null; // automated: the enabled settings (survey, mining stations, …); null: manual
	leader: string | null;
	leaderLevel: number | null;
	order: ShipOrder | null; // null: idle
	queue: ShipOrder[];
	route: Route; // where it is and where its orders take it
	// where an idle ship waits: the planet it orbits (if any), and whether the system is the
	// country's (a starbase or outpost of its own there)
	parked: {
		planet: string | null;
		planetFree: boolean;
		system: string;
		systemOwned: boolean;
	} | null;
};

export type SpeciesInfo = { id: string; name: string; cls: string; traits: string[]; pops: number };

export type Sector = { name: string; type: string; systems: number; colonies: number };

/** A surveyed planet nobody owns; jumps from the capital system, null when unreachable. */
/** A system a habitat could go to (`habitatSites()` in save.ts; judged in #lib/habitats.ts). */
export type HabitatSite = {
	systemId: number;
	system: string;
	jumps: number | null; // from the capital
	shipyard: number | null; // from the nearest own shipyard
	beyond: number | null; // from the nearest own system; 0 = inside the borders, where one can build
	via: string[]; // bypass types on the way from the border
	major: number; // stars and planets
	minor: number; // moons and asteroids
	deposits: string[]; // deposit types on its surveyed bodies
};

export type ExpansionPlanet = {
	planetId: number;
	name: string;
	planetClass: string;
	size: number;
	system: string;
	jumps: number | null; // from the capital, over hyperlanes and usable bypasses
	beyond?: number | null; // from the nearest own system (0 inside the borders); absent in older snapshots
	via?: string[]; // bypass types on the way from the border
	shipyard?: number | null; // jumps from the nearest own shipyard; absent in older snapshots
	modifier: string | null;
	candidate: string | null; // terraforming candidate modifier, if any
	planet: PlanetState | null; // null in older snapshots
};

/** One budget source (a job, a stratum's upkeep, ships, the market, …) for the month. */
export type BudgetSource = { source: string; income: Resources; expenses: Resources };

/** A district type on a colony: how many are built, its zones (specialisations) and their buildings. */
export type ColonyDistrict = {
	type: string;
	built: number;
	// buildings: every one built; disabled: those the player turned off (READER 27), by type
	zones: { type: string; buildings: string[]; disabled?: string[] }[];
};

/** One job on a colony. Positions null: unlimited (civilian). */
export type ColonyJob = { type: string; pops: number; filled: number; positions: number | null };

/** A system the country knows (visited or own), with its hyperlanes to other known systems. */
export type KnownSystem = {
	id: number;
	name: string;
	x: number;
	y: number;
	owned: boolean;
	capital: boolean; // the system of the capital planet (`country.capital`)
	lanes: number[];
};

/** One colony's migration last month, in pops (both amounts positive). */
export type MigrationColony = {
	colonyId: number;
	planetId: number;
	name: string;
	ownerId: number;
	owner: string; // empire name
	own: boolean;
	system: string;
	x: number; // galaxy map position of its system
	y: number;
	immigration: number;
	emigration: number;
};

/** A starbase: its own build queue (modules, buildings) and, with a shipyard, the ship queue. */
export type Station = {
	id: number;
	system: string;
	systemId?: number | null; // since 2026-10-22; older snapshots name the system only
	level: string; // outpost, starport, starhold, star fortress, citadel
	modules: string[];
	buildings: string[];
	queue: QueueItem[];
	slots: number;
	shipyard: { queue: QueueItem[]; slots: number } | null; // null: no shipyard module
	arkship: boolean;
};

/** A Mega Shipyard; `stage` from its type (mega_shipyard_0…3, _restored). */
export type MegaShipyard = {
	id: number;
	type: string;
	system: string;
	queue: QueueItem[] | null; // null: no ship queue found for it
	slots: number;
};

/** One entry of a planet's build queue, in queue order. */
/** A construction item the country pays for, wherever it is queued. */
export type Construction = {
	id: number; // construction.item_mgr.items.<id>
	kind: string; // as QueueItem
	name: string;
	design?: string;
	where: string | null; // the planet, else the starbase's system
	systemId?: number | null; // the system it is built in; since 2026-10-22
	cost: Resources;
};

/**
 * An empire we have communications with: its view of us (shown in game) and its economy (hidden —
 * the trade tab's `tradeIntel` spoiler).
 */
export type AiIntel = {
	countryId: number;
	nomadic: boolean; // runs the nomad economy: its energy and minerals are a reserve, never sold
	personality: string | null; // e.g. "peaceful_traders"
	attitude: string | null; // towards us, e.g. "cordial"
	opinion: number | null; // theirs of us
	trust: number;
	opinionModifiers: { key: string; value: number }[]; // e.g. opinion_trade_gift
	stockpile: Resources;
	net: Resources; // per month
	income: Resources; // per month, gross (the cap on what it pays a month); {} before READER 12
	max?: Resources; // storage, exact: companion mod 0.5.0's sdash_m_<res>; absent without it
};

/** A trader enclave we talk to; `kind` 1 XuraCorp, 2 Riggans, 3 Muutagan (#lib/aiTrade.ts). */
export type TraderEnclave = { countryId: number; name: string; kind: 1 | 2 | 3 };

/** A tech in a research queue: the first per field is being researched. */
export type QueuedTech = { area: string; tech: string; progress: number; since: string | null };

/** A mining, research or observation station in one of our systems, at the planet it orbits. */
export type OrbitalStation = { systemId: number; planetId: number; deposits: string[] };

export type QueueItem = {
	kind: string; // from buildable_<kind>: district, building, army, clear_deposit_blocker, …
	name: string; // what is built: district/building key, army type, blocker deposit type, ship size
	design?: string; // ships: the design's name
	progress: number;
	needed: number;
};

/**
 * Where an observation came from: a parsed save (complete) or the companion mod's monthly
 * game.log lines (stockpile and net income only — the other fields are null/empty).
 */
export type SourceKind = 'save' | 'log';

/** A static modifier on the empire or a planet (events, agendas, features …); `until` null = permanent. */
export type TimedModifier = { key: string; until: string | null };

/**
 * What the save says about a planet itself: its deposits (features and blockers; `swap` = the
 * feature a blocker hides, found once it is cleared) and its modifiers.
 */
export type PlanetState = {
	deposits: { key: string; swap: string | null }[];
	modifiers: TimedModifier[];
};

/** A standing monthly order on the market. */
export type MarketOrder = { kind: 'buy' | 'sell'; resource: string; amount: number };

/**
 * The market the country trades on: its own internal one, or the galactic market once it has
 * access. Fluctuations are percent off the base price, per resource the market trades.
 */
export type Market = { galactic: boolean; fluctuations: Record<string, number> };

/** What the empire is working towards; the inputs of the upcoming-events list. */
export type Progress = {
	research: { area: string; tech: string; progress: number }[]; // one per field being researched
	researched: string[]; // techs already researched (tech_status.technology)
	agenda: { key: string; progress: number } | null; // council agenda being prepared
	traditionsTaken: number; // adopted traditions, adoptions and finishers included
	nextElection: string | null;
	// galaxy setup: the cost sliders, and the difficulty with how much it raises tech costs
	// (`technology_difficulty_scale`; both unknown before READER 32)
	costSettings: {
		technology: number;
		traditions: number;
		difficulty?: string | null;
		techDifficultyScale?: string | null;
	};
};

/** One observed state of the player's empire at one game date. */
export type Snapshot = {
	kind: SourceKind;
	campaign: string;
	date: string; // game date as the save writes it, "2200.01.01"
	fingerprint: string;
	countryId: number | null;
	empireName: string;
	pops: number | null;
	stockpile: Resources;
	// storage per resource, exact: companion mod 0.5.0's sdash_m_<res>; null without it (or the feed)
	storageMax: Resources | null;
	income: Resources | null; // budget.current_month, summed over sources
	expenses: Resources | null;
	balance: Resources;
	colonies: Colony[];
	/** Year the end game starts (galaxy setting); null from the mod feed, which does not know it. */
	endGameYear: number | null;
	// Top-bar counters; null from the mod feed. The save does not store the naval capacity:
	// companion mod 0.6.0 exports it (`sdash_nc`), else null. Envoy slots are not available.
	empireSize: number | null;
	starbases: { used: number; capacity: number } | null;
	navalUsed: number | null;
	navalMax: number | null;
	envoys: { used: number; total: number } | null;
	marketOrders: MarketOrder[]; // standing monthly buy/sell orders
	market: Market | null; // null from the mod feed and in older snapshots
	// Null from the mod feed:
	leaders: Record<string, number> | null; // by class
	ships: ShipCount[] | null;
	defaultAutomation: string[] | null; // automation settings new colonies start with
	automationBlocked: string[] | null; // resources planet automation may not spend
	planetBudget: BudgetSource[] | null; // the budget's planet_* and pop_* sources
	budget: BudgetSource[] | null; // every budget source, the market's as `market:<source>`
	construction: Construction[] | null; // construction items we pay for, with their cost
	orbitalStations: OrbitalStation[] | null; // stations in our systems; since 2026-10-22
	aiIntel: AiIntel[] | null; // empires we talk to: their view of us, their economy; since 2026-10-22
	traderEnclaves: TraderEnclave[] | null; // since READER 11
	score: Score | null;
	fleets: Fleet[] | null; // military fleets
	idleLeaders: { id: number; class: string; name: string }[] | null; // hired, without a post
	traditions: string[] | null; // adopted traditions, in pick order (adopt and finish included)
	ascensionPerks: string[] | null;
	canDetox: boolean | null; // can terraform toxic worlds (Detox perk or the Toxic Knights)
	habitatSites: HabitatSite[] | null;
	habitats: { can: boolean; voidDweller: boolean } | null; // can build them; Void Dwellers get more
	civilianShips: CivilianShip[] | null; // science, construction, colony ships with their orders
	edicts: string[] | null; // active edicts (keys)
	countryModifiers: TimedModifier[] | null; // country.timed_modifier: empire-wide effects
	countryTimedFlags: TimedModifier[] | null; // country.flags with an end (cooldowns, event timers); READER 21
	// when a government reform, dismissing a focus card and changing the focus are possible again
	// (null: now); READER 21. Moving the capital, each species right changed and each empire
	// insulted: READER 23
	cooldowns: {
		reform: string | null;
		focusDismiss: string | null;
		focusChange: string | null;
		capital?: string | null;
		rights?: { species: string; right: string; until: string }[];
		insults?: { country: string; until: string }[];
	} | null;
	species: SpeciesInfo[] | null; // species with pops in the empire
	sectors: Sector[] | null;
	expansion: ExpansionPlanet[] | null; // surveyed, unowned rocky planets
	stations: Station[] | null; // starbases with their queues and shipyards
	migration: MigrationColony[] | null; // last month, per colony; own colonies always, foreign ones with any
	knownSystems: KnownSystem[] | null; // visited or own systems, for maps
	megaShipyards: MegaShipyard[] | null;
	progress: Progress | null; // null from the mod feed
	// For milestones (#lib/milestones.ts); null from the mod feed and in older snapshots.
	leaderRoster: { id: number; name: string; class: string }[] | null; // all hired leaders
	// level, bonus (bonus_skill_level) and traits: since 2026-10-18
	ruler: { id: number; name: string; level?: number; bonus?: number; traits?: string[] } | null;
	agendasDone: string[] | null; // agendas on cooldown, i.e. passed recently
	// …and when each can be picked again (`council_agenda_cooldowns.start_date`); since 2026-10-18
	agendaCooldowns?: { key: string; until: string }[] | null;
	policies: Record<string, string> | null; // policy → selected option
	government: string[] | null; // civics, ethics and authority keys
	governmentType: string | null; // e.g. gov_representative_democracy
	origin: string | null; // e.g. origin_default
	wars: War[] | null; // wars the country takes part in
	subjects: Subject[] | null; // subject agreements, either side; null before 2026-10-19
	galcom: GalacticCommunity | null; // null before it forms, and before 2026-10-19
	claims: Claim[] | null; // ours, and on our systems; null before 2026-10-19
	factions: Faction[] | null; // ours; null before 2026-10-19
	ethics: EthicsState | null; // our pops' ethics and attraction; null before READER 24
	combats: Combat[] | null; // our fleets' last combats this save still holds; null before 2026-10-19
	shroud: Shroud | null; // null before access to the Shroud, and before 2026-10-19
	warLostDate: string | null; // `last_date_war_lost` ("0.01.01" = never)
	tradeDeals: TradeDeal[] | null;
	// From the save's `meta`; null from the mod feed and in older snapshots.
	gameVersion: string | null; // e.g. "Cygnus v4.5.2"
	dlcs: string[] | null; // DLCs active in this save (`required_dlcs`), by name
	mods: string[] | null; // mods active in this save, by name
	// The government tab's facts (#lib/triggers.ts); null from the mod feed and in older snapshots.
	countryType: string | null; // country.type, "default" for a normal empire
	policyFlags: string[] | null; // country.policy_flags, set by the selected policy options
	countryFlags: string[] | null; // keys of country.flags
	council: CouncilSeat[] | null; // in the game's seat order, the ruler's seat not among them
	councilSlots: number | null; // country.government.unlocked_civic_council_slots
	edictTimes: { key: string; start: string | null; end: string | null }[] | null; // end null: perpetual
	// What the empire knows of the galaxy and the others (server/world.ts); null from the mod feed
	// and in older snapshots.
	galaxy: GalaxySystem[] | null;
	// expansion and habitat sites as if every planet were surveyed (the surveyAll spoiler); stored
	// with the galaxy, not per snapshot
	surveyedAll: { expansion: ExpansionPlanet[]; habitatSites: HabitatSite[] } | null;
	countries: CountryInfo[] | null; // empires in contact, or owning a station in a visited system
	relations: Relation[] | null;
	// our intel on each country (`intel_manager`, 0–100) and the galaxy's relations, for the
	// diplomacy tab; since READER 14
	intel: { countryId: number; intel: number }[] | null;
	diplomacy: DiploCountry[] | null;
	allWars: WarSides[] | null;
	firstContacts: FirstContact[] | null;
	situations: SituationInfo[] | null;
	anomalies: AnomalyInfo[] | null; // found, not yet researched
	specialProjects: ProjectInfo[] | null;
	digSites: DigSite[] | null; // archaeological sites in visited systems
	stationsSeen: StationSighting[] | null; // stations where our fleets are, null before 2026-10-18
	// The focus, tech and leaders tabs; null from the mod feed and in older snapshots.
	focus: EmpireFocus | null;
	techOptions: Record<string, string[]> | null; // research field → the cards on offer
	techQueued: QueuedTech[] | null; // every queued tech with its progress; since 2026-10-22
	techPermanent: string[] | null; // options kept until researched (`always_available_tech`); since 2026-10-22
	// stored research per field (`stored_techpoints`): from events or while nothing is researched;
	// each month up to the monthly gain of it is used on top, so research runs at up to double speed
	techStored: Record<string, number> | null; // since 2026-10-22
	leaderList: LeaderInfo[] | null; // every hired leader
	// the recruitable leaders (`country.modules.standard_leader_module.leaders`), each with the date
	// it joined the pool (`date_added`); null before READER 30
	leaderPool: PoolLeader[] | null;
	// the Wanderlust perk's progress (#lib/wanderlust.ts); null without it, or before READER 31
	wanderlust: Wanderlust | null;
	// the systems we entered (visited or own) whose star flags fire an entry event (#lib/systemEvents.ts);
	// READER 37
	entryEvents: SystemEntry[] | null;
	founderClass: string | null; // its founder species' class (`NECROID`); since READER 35
	// species id → right kind (citizenship, living_standard, …) → the right set; null before 2026-10-18
	speciesRights: Record<string, Record<string, string>> | null;
	// The companion mod's timeline id of the month (saves: country variable sdash_tl), and the one
	// before; names the branch point when a save is loaded. null without the mod (0.2.0+).
	timelineId: number | null;
	previousTimelineId: number | null;
	// From the mod's log only, kept through a merge with the save: what happened since the month
	// before, exactly dated, and the daily stockpiles.
	logEvents: LogEvent[] | null;
	ticks: Tick[] | null;
};

export type MilestoneLogKind =
	'colony' | 'war-started' | 'war-ended' | 'leader-died' | 'ruler' | 'combat' | 'system-entered'; // mod 0.10.0: a ship's first entry into a system
/** Spending the budget does not book (mod 0.3.0): what and where, not the item or its cost. */
export type SpendLogKind =
	| 'district-queued'
	| 'district-unqueued'
	| 'building-queued'
	| 'building-unqueued'
	| 'edict'
	| 'decision'
	| 'leader-hired'
	| 'colonization-started'
	| 'megastructure-started';

/** One `SDASH|2|<date>|event|…` line of the companion mod; fields as `feed.ts` documents them. */
export type LogEvent = {
	date: string;
	kind: MilestoneLogKind | SpendLogKind;
	fields: string[];
};

/** The stockpile on one day, from the mod's daily tick. */
/** The nomads' Wanderlust perk: its categories' progress and the systems an arkship counted. */
export type Wanderlust = {
	categories: { key: string; seen: number; count: number; done: boolean }[];
	// `visited_by_nomad@<country>` star flags, dated by their value (game hours)
	visits: { systemId: number; system: string; date: string; categories: string[] }[];
	complete: boolean; // all eight: the game clears the counters then (`nomad_exploration_complete`)
};

/**
 * A leader the empire may recruit: one of the pool, which the game replaces as a whole; its
 * details since READER 32 (before: id, class and `added` only).
 */
export type PoolLeader = Pick<LeaderInfo, 'id' | 'class'> &
	Partial<Omit<LeaderInfo, 'id' | 'class'>> & { added: string | null };

export type Tick = {
	date: string;
	stockpile: Resources;
	// companion mod 0.9.0: the colonies whose jobs or pops changed that day, by colony name
	colonies?: Record<string, ColonyDay>;
};

/**
 * A colony's day from the mod (0.9.0): the game's `free_jobs`, `num_unemployed` and
 * `pop_amount` triggers (pop_amount counts every pop, the save's `num_sapient_pops` sapient ones only). Unemployed read as the civilians, employed as pops − unemployed.
 */
export type ColonyDay = { openJobs: number; unemployed: number; pops: number };

/** `country.focus` with its cards (top-level `focus_cards`). */
export type EmpireFocus = {
	priority: string | null; // the category picked, e.g. "development"
	cards: { key: string; done: boolean }[]; // the active cards; `status=1` read as done
	rewards: { category: string; current: string; progress: number }[]; // the next reward per category
};

export type LeaderInfo = {
	id: number;
	name: string;
	class: string;
	level: number;
	bonus?: number; // its own extra levels (`bonus_skill_level`); since READER 32
	// towards its next level, from 0 at each level-up (the overflow kept); envoys have none; READER 33
	experience?: number | null;
	immortal?: boolean; // `leaders.<id>.immortal` (spelling assumed); READER 34
	age: number | null;
	traits: string[];
	job: string | null;
	species: string | null; // its species' name
	council: boolean; // holds a council seat
	ruler: boolean;
	ethic?: string | null; // `leaders.<id>.ethic`; since READER 26
	governor?: boolean; // governs one of our colonies; since READER 26
	governs?: string | null; // … that colony's name; since READER 32
	home?: string | null; // its home colony's name (`background_planet`); since READER 34
	governsHome?: boolean | null; // a governor: whether of its home (its home bonus); READER 34
	// where else it is assigned: a fleet (a commander's, or the science ship a scientist leads), an
	// army; since READER 32
	assigned?: { kind: string; name: string | null } | null;
};

/**
 * A system of the galaxy. Every system has its place, star and hyperlanes (the game shows the
 * whole map); owner, bodies and megastructures only once visited (or owned) — no fog-free peeking.
 */
export type GalaxySystem = {
	id: number;
	name: string;
	x: number;
	y: number;
	star: string; // star_class, e.g. "sc_g", "sc_pulsar", "sc_black_hole", "sc_binary_1"
	lanes: number[]; // hyperlanes to systems with a higher id
	visited: boolean;
	owned: boolean;
	ownerId: number | null; // the station's owner, in a visited system
	bodies: Body[] | null; // visited only
	megastructures: string[]; // types, built or ruined, in a visited system
	bypasses?: string[]; // wormholes, gateways, L-gates (`bypasses.<id>.type`) in a visited system; since 2026-10-18
	wormholes?: number[]; // where a wormhole here leads, explored or not (a spoiler); since 2026-10-18
	lgate?: boolean; // an L-Gate here (`lgate_base` megastructure), in any system; since 2026-10-18
	lcluster?: boolean; // one of the L-Cluster's systems (star flag lcluster*), once spawned
	lgateTo?: number[]; // an L-Gate's link to the L-Cluster's entrance, once the gates are open
	sector?: string | null; // own systems: the sector (`sectors.<id>.systems`); since 2026-10-18
	lanesKnown?: boolean; // in `country.hyperlane_systems`: its hyperlanes are on our map (sensors); since 2026-10-18
	wanderlust?: string[]; // its Wanderlust categories (star flags), in any system — a spoiler where not visited; READER 31
};

/** A star, planet, moon or asteroid in a visited system. */
export type Body = {
	id: number;
	name: string;
	class: string; // planet_class
	size: number;
	star: boolean;
	moonOf: number | null;
	ownerId: number | null;
	colonized: boolean;
	deposits: string[];
	anomaly: string | null; // category; shown only where surveyed unless `surveyAll` (surveyView)
	dist: number; // from the system's centre (in-system coordinates)
	surveyed?: boolean; // by us (`surveyed_by`); since 2026-10-18
	station?: boolean; // a station mines or researches its deposit; since 2026-10-22
};

export type CountryInfo = {
	id: number;
	name: string;
	type: string; // default, fallen_empire, enclave, caravaneer_home, primitive …
	shipset: string | null; // graphical_culture
	flagColor?: string | null; // its flag's first colour (flag.colors), a flag_color swatch; since 2026-10-18
	ethics: string[];
	authority: string | null;
	civics: string[];
	governmentType: string | null;
	origin: string | null;
};

/**
 * Another empire's station in a system one of our fleets was in when the game saved: what we saw
 * there (its shipset), as opposed to what the save knows of systems we only passed once. The owner
 * stays on the server unless we talk to them (or the contactStations spoiler is on).
 */
export type StationSighting = { systemId: number; ownerId: number; shipset: string | null };

/** `country.relations_manager.relation`: what we know of another empire. */
export type Relation = {
	countryId: number;
	name: string; // the pre-communications name until communications
	contact: boolean;
	communications: boolean;
	hostile: boolean;
	opinion: number | null; // relation_current
	trust: number;
	threat: number;
	borderRange: number | null; // null: not bordering (2147483647)
	// its other `<key>=yes` flags: embassy, research_agreement, commercial_pact, defensive_pact,
	// non_aggression_pledge, guarantee, closed_borders (4.5.2), and whatever else the game adds
	agreements: string[];
};

/**
 * One country's relation to another, as the save has it (`relations_manager.relation` of `from`):
 * true whatever we know — the diplomacy tab decides what our intel shows (#lib/diplomacy.ts).
 */
export type DiploRelation = {
	countryId: number; // the other side
	opinion: number | null; // relation_current: `from`'s opinion of it
	hostile: boolean;
	// pacts and rivalry, as flags: embassy, research_agreement, commercial_pact, defensive_pact,
	// non_aggression_pledge, guarantee, closed_borders, migration_access, waystation_pact, is_rival
	agreements: string[];
};

/** A country in the galaxy's diplomacy (every kind but `other`, #lib/contacts.ts), us included. */
export type DiploCountry = {
	id: number;
	capitalSystem: number | null;
	overlord: number | null;
	federation: string | null; // its federation's name
	nomadic: boolean;
	// to other countries kept here, with communications; only between the diplomatic kinds
	// (empires, fallen, enclaves, traders, marauders) — fauna and pre-FTL civilisations have none
	relations: DiploRelation[];
};

/** A war anyone fights: `war.<id>`'s sides. */
export type WarSides = {
	id: string;
	name: string;
	start: string | null;
	attackers: number[];
	defenders: number[];
};

/** `first_contacts.contacts.<id>`, ours. */
export type FirstContact = {
	id: number;
	countryId: number;
	name: string;
	systemId: number;
	leaderId: number | null; // the envoy on it
	leaderName: string | null;
	date: string; // discovered
	daysLeft: number | null; // to the envoy's next roll
	lastRoll?: number | null; // `last_roll`; absent before READER 22
	difficulty: number;
	clues: number;
	stage: string;
	status: string; // in_progress, finished, aborted
};

export type SituationInfo = {
	id: number;
	type: string;
	progress: number;
	monthly: number | null; // last month's progress
	approach: string | null;
	stage: number | null; // index into the situation's stages (data DB `situation_stage`); null before READER 25
	ends?: number[]; // where each stage ends (`stage_durations`); the last is the most there is
};

export type AnomalyInfo = { planetId: number; planet: string; systemId: number; category: string };
export type ProjectInfo = {
	id: number;
	key: string;
	planetId: number | null;
	systemId: number | null;
};
export type DigSite = {
	id: number;
	type: string;
	planetId: number;
	systemId: number | null;
	clues: number;
	difficulty: number;
	daysLeft: number | null; // to the excavation's next roll
	lastRoll?: number | null; // `last_roll`; absent before READER 22
	excavating: boolean;
};

/** A council seat: `council_positions.<id> = { country type leader }`. */
export type CouncilSeat = {
	type: string;
	leaderId: number | null;
	leaderName: string | null;
	leaderLevel: number | null;
	leaderBonus?: number; // bonus_skill_level: the leader's own extra levels (since 2026-10-18)
	leaderTraits?: string[];
};

/** A war the country is in. UNVERIFIED shape — no war seen in a save yet (see AGENTS.md). */
/** A war we take part in: top-level `war.<id>` (4.5.2, first seen 2026-10-19). */
export type War = {
	id: string;
	name: string;
	start: string | null;
	enemies: string[];
	allies: string[]; // our side without us
	attacker: boolean | null; // null in snapshots before 2026-10-19
	goal: string | null; // our side's war goal, e.g. wg_subjugation
	enemyGoal: string | null;
	exhaustion: number | null; // ours, 0–1
	enemyExhaustion: number | null;
	battles: Battle[];
};
/** Our relation to one patron of the Shroud: top-level `patron_relations.<id>` with `owner` = us. */
export type PatronRelation = {
	patron: string; // key, e.g. the_composer_of_strands
	x: number; // its position on the Shroud plane
	y: number;
	contact: string; // none, completed
	calling: { key: string; tier: number; start: string | null; completed: boolean } | null;
	deeds: string[]; // the deeds it currently counts (save picks 5 of its pool)
};
/**
 * Our standing in the Shroud: `modules.standard_shroud_module = { attunement = { x y }
 * month_start_attunement … last_delve_date }` and the patron relations (4.5.2, first seen
 * 2026-10-19). A patron's standing is the month-start attunement towards it × 1000.
 */
export type Shroud = {
	attunement: { x: number; y: number };
	monthStart: { x: number; y: number };
	lastDelve: string | null;
	preferred: string | null; // is_preferred_patron
	patrons: PatronRelation[];
};

/**
 * Our pops' ethics: `country.<id>.ethics_distribution | pops_ethics_attraction | pops_ethics_change
 * | ethics_attraction` and `pops_ethics_on_colonies = { { colony num_pops change } }` (4.5.2; a colony id, kept as its planet), each
 * a list by the game's ethic index — the order of `common/ethics/` (data DB `ethic.sort_order`,
 * `GameData.ethicOrder`). Kept as the save's lists, mapped to keys on read (`#lib/ethicsTab.ts`).
 */
export type EthicsState = {
	pops: number[]; // pops per ethic
	attraction: number[]; // attraction-weighted pops: where the pops are heading
	change: number[]; // pops gained or lost last month
	weight: number[]; // `ethics_attraction`, empire-wide per ethic; meaning unverified
	colonies: { planetId: number; pops: number[]; change: number[] }[]; // by colony, its planet
};

/**
 * One of our factions: top-level `pop_factions.<id> = { country type name support_percent
 * support_power faction_approval members last_month_pops … }` (4.5.2, first seen 2026-10-19 on an
 * AI; `<id>=none` once dissolved).
 */
export type Faction = {
	type: string; // faction type key, e.g. supremacist
	name: string;
	support: number; // 0–1, share of the empire's political power
	approval: number; // 0–1
	pops: number | null; // last month
	change: number | null; // pops_change, the game's "(+51)"; null before 2026-10-19
};

/**
 * A claim on a system: `galactic_object.<id>.claims = { { owner date claims } }` (4.5.2, first
 * seen 2026-10-19), `owner` being the claimant. Ours, and others' on our systems — as the game's
 * claims view and notifications show them.
 */
export type Claim = {
	systemId: number;
	system: string;
	holder: string | null; // whose station the system has; null: nobody's
	claimant: string;
	ours: boolean; // we claim it (else: someone claims a system of ours)
	claims: number; // claim strength, the times claimed
	since: string | null;
};

/** A resolution proposed or being voted on: top-level `resolution.<id>`. */
export type ResolutionVote = {
	id: number;
	type: string; // resolution key
	proposer: string;
	support: string[]; // empire names
	oppose: string[];
	ours: 'for' | 'against' | null;
};
/**
 * The Galactic Community: top-level `galactic_community = { members proposed voting
 * community_formed … }` (4.5.2, first seen 2026-10-19). `days` and `election` are not understood
 * yet and left out.
 */
export type GalacticCommunity = {
	formed: string | null;
	members: string[];
	member: boolean; // we are one
	voting: ResolutionVote | null;
	proposed: ResolutionVote[];
	passed: ResolutionVote[]; // in force: `galactic_community.passed = { <ids> }`
	voteEnds: string | null; // the vote's end: `days` in session of RESOLUTION_VOTE_TIMER (1440)
	nextVote: string | null; // the recess's end: `cooldown` days (SENATE_RECESS_TIMER 720)
	// each member's diplomatic weight by name: exact from companion mod 0.4.0's `sdash_dw`, else
	// estimated (`estimatedWeight()`); since READER 15
	weights: Record<string, { value: number; exact: boolean }>;
	// when a resolution of each category was last voted on (`category_timers`): another may be
	// proposed CATEGORY_VOTE_COOLDOWN days later; and the global flags (`flags`) resolutions test
	// (galactic_market_founded, galactic_council_formed, …); since READER 17
	categoryTimers: Record<string, string>;
	globalFlags: string[];
};
/**
 * One of our fleets' combats, from its last-combat record (`fleet.<id>.fleet_stats.combat_stats`,
 * 4.5.2, first seen 2026-10-19) — war or not. Ship counts are summed over the sizes.
 */
export type Combat = {
	fleetId: number;
	fleet: string;
	date: string;
	enemy: string; // their empire(s)
	enemyFleets: string;
	ships: number;
	lost: number;
	enemyShips: number;
	enemyLost: number;
};

/** One battle of a war, seen from our side: `war.<id>.battles`. */
export type Battle = {
	date: string;
	system: string;
	type: string; // ships, armies
	won: boolean;
	lost: number; // our losses
	killed: number; // theirs
};
/**
 * A subject agreement we are part of: top-level `agreements.agreements.<id> = { owner target
 * active_status date_added term_data subject_specialization }`, owner = the overlord (4.5.2, first
 * seen 2026-10-19). Loyalty is the subject country's `loyalty`.
 */
export type Subject = {
	countryId: number;
	name: string;
	weAreOverlord: boolean;
	preset: string; // term_data.agreement_preset, e.g. preset_protectorate
	since: string | null;
	terms: Record<string, string>; // term_data.discrete_terms: key → value
	subsidies: Record<string, number>; // term_data.resource_terms
	specialistLevel: number;
	specialistExperience: number;
	loyalty: number | null;
};
/** What one side of a trade deal hands over: resources monthly or once, and anything else. */
export type DealSide = { monthly: Resources; once: Resources; other: string[] };

/**
 * A trade deal with another empire. UNVERIFIED shape — none seen in a save yet (see AGENTS.md):
 * `raw` keeps the deal as the save wrote it, so the first one seen can be checked on /deals.
 */
export type TradeDeal = {
	id: string;
	partner: string;
	start: string | null; // game date the deal was made
	years: number | null; // its length; null = no end
	gives: DealSide; // the player's side
	gets: DealSide; // the partner's side
	understood: boolean; // false: the sides were not found, everything is in `gives.other`
	raw: string; // the save's block, JSON, cut at 2000 characters
};

export type TimelineNode = {
	id: number;
	kind: SourceKind;
	campaign: string;
	date: string;
	fingerprint: string;
	parentId: number | null;
	ambiguous: boolean;
	seq: number; // the node's number within its campaign (1, 2, …); `id` is global
};

/** Names, costs and rules from the extraction's SQLite (STELLARIS_DATA_DB), loaded once. */
/** Base cost, upkeep and output of a thing the game builds (data DB, before modifiers). */
export type Costs = { cost: Resources; upkeep: Resources; produces: Resources };

/** What a player does that runs on a timer (data DB `action_timer.action_kind`). */
export type ActionKind =
	| 'decision'
	| 'artifact_action'
	| 'astral_action'
	| 'relic'
	| 'diplomatic_action'
	| 'federation_law'
	| 'enclave';

/**
 * An ethic's place on its axis (`col`, `xen`, `mil`, `spi`; gestalt `hive`): −2 fanatic, −1 regular
 * on the first pole (authoritarian, xenophobe, militarist, spiritualist), +1 / +2 on the second —
 * the game's `category_value` − 2 (4.5.2 `common/ethics/99_documentation.txt`).
 */
export type EthicAxis = { axis: string; pos: number };

export type GameData = {
	// per timed modifier or flag (`modifier:<key>`, `flag:<key>`): the actions that wait for it to
	// end (`cooldown`), whose effect only sets it again once it has ended (`bonus`), or only set it
	actionTimers: Record<
		string,
		{ kind: ActionKind; key: string; name: string; cooldown: boolean; bonus?: boolean }[]
	>;
	// module, starbaseBuilding: a starbase's modules and buildings
	costs: Record<
		'district' | 'ship' | 'building' | 'deposit' | 'module' | 'starbaseBuilding',
		Record<string, Costs>
	>;
	districtJobs: Record<string, Record<string, number>>; // district → job → positions (pops)
	buildingJobs: Record<string, Record<string, number>>;
	buildDays: Record<string, number>; // districts, ship sizes, buildings: base days
	depositCategory: Record<string, string | null>; // orbital_mining_deposits, …
	buildingCategory: Record<string, string | null>; // government, manufacturing, research, …
	growthModifiers: Record<string, Record<string, number>>;
	starbaseSlots: Record<string, { modules: number; buildings: number }>;
	resourceInfo: Record<
		string,
		{
			name: string;
			aiWeight: number | null;
			aiWants: number | null;
			max: number | null;
			tradable: boolean;
		}
	>;
	personalities: Record<string, { name: string; willingness: number | null }>;
	attitudes: Record<string, { name: string; trade: boolean }>;
	opinionModifiers: Record<string, { name: string; max: number | null; decay: number | null }>; // per level: outpost, starport …
	edictModifiers: Record<string, Record<string, number>>; // edict → modifier → value
	// what researching a tech needs: prerequisites, who can get it (`potential`), rarity
	techRequirements: Record<
		string,
		{ prerequisites: string[]; potential: Trigger | null; rare: boolean; dangerous: boolean }
	>; // `tech:`/`tradition:` key → cost and output modifiers
	techs: Record<string, { name: string; cost: number | null; area: string; tier: number | null }>;
	agendas: Record<
		string,
		{
			name: string;
			cost: number | null;
			unlockedBy: string[];
			finishDays?: number | null; // how long its after-launch modifier lasts
			cooldownDays?: number | null; // from launch until it can be picked again
			potential?: Trigger | null; // whether the empire can ever have it
			allow?: Trigger | null; // whether it may be launched now
		}
	>;
	defines: Record<string, number>;
	jobs: Record<string, { name: string; category: string | null }>;
	edicts: Record<
		string,
		{
			name: string;
			category: string | null; // edicts, campaigns, rare_edicts …
			length: number | null; // days, −1 perpetual
			cost: Record<string, Resources>; // cost / upkeep → resources, before multipliers
			potential: Trigger | null;
			unlockedBy: string[]; // traditions / perks
			prerequisites: string[]; // techs
		}
	>;
	policies: {
		key: string;
		name: string;
		category: string | null;
		options: { key: string; name: string; potential: Trigger | null; valid: Trigger | null }[];
	}[];
	factionTypes: {
		key: string;
		name: string;
		description: string | null;
		ethic: string | null;
		demands: {
			title: string;
			unfulfilledTitle: string | null;
			description: string | null;
			fulfilled: number | null; // approval while met (±0.001 = none)
			unfulfilled: number | null;
			potential: Trigger | null; // when the demand applies
			trigger: Trigger | null; // met when true
		}[];
	}[];
	traits: Record<string, { cost: number | null }>;
	speciesClasses: Record<string, { name: string; archetype: string | null }>;
	archetypes: Record<string, { points: number; maxTraits: number }>;
	planetClasses: Record<
		string,
		{
			name: string;
			colonizable: boolean;
			ideal: boolean;
			standard: boolean;
			climate: string | null;
		}
	>;
	names: Record<string, string>; // display names of buildings, deposits, districts, zones, starbase modules and buildings
	districtColors: Record<string, string>; // district → its colour in game, '#rrggbb'
	// civics, origins, authorities, ethics and government types by key
	identityNames: Record<string, string>;
	// resolutions, resolution categories, subject agreement terms, term values and presets by key
	diploNames: Record<string, string>;
	resolutionCategories: Record<string, string>; // resolution → its category key
	resolutionGroups: Record<string, string>; // category → its group (commerce_industry, …)
	// every resolution a category lists, in file order: what proposing it takes (#lib/proposable.ts)
	resolutions: Record<
		string,
		{
			category: string | null;
			level: number | null; // its tier in the category's chain
			target: boolean; // names a target empire
			cost: number | null; // influence, before multipliers
			repeal: boolean; // fire_and_forget: repeals one in force
			potential: Trigger | null;
			allow: Trigger | null;
			validTarget: Trigger | null; // target: which empire it may name
			aiWeight: AiWeight | null; // how an AI weighs it (#lib/votes.ts)
		}
	>;
	resolutionCostMult: Record<string, number>; // `tradition:<key>`, `modifier:<key>` → resolutions_cost_mult
	shroud: {
		patrons: Record<
			string,
			{
				name: string;
				category: string | null;
				color: string | null;
				covenant: string | null;
				accords: { kind: string; name: string }[];
			}
		>;
		callings: Record<string, { name: string; tiers: Record<number, number | null> }>;
		deeds: Record<string, { name: string; attunement: number }>;
	};
	habitatEffects: Record<string, Record<string, number>>; // deposit → what a habitat gets from it
	// what habitability is made of (#lib/habitability.ts): the species traits' `pc_<class>_habitability`,
	// `pop_environment_tolerance` and `habitability_floor_add`, and the planet's own tolerance
	// modifiers by popup id (`modifier:<key>`, `deposit:<key>`)
	habitability: {
		traits: Record<string, Record<string, number>>;
		planet: Record<string, number>;
	};
	traditionTrees: Record<
		string,
		{ name: string; traditions: { key: string; name: string; role: string }[] }
	>;
	perks: Record<string, string>; // ascension perk names
	flagColors: Record<string, string>; // flag colour swatch → its galaxy-map colour (#rrggbb)
	ethicAxes: Record<string, EthicAxis>; // ethic → its place on its axis
	ethicOrder: string[]; // ethic keys by the game's ethic index (`EthicsState` lists)
	ethicRules: Record<string, AttractionRule[]>; // per ethic, its own attraction rules
	electionTypes: Record<string, string>; // authority → democratic / oligarchic / none
	speciesArchetypes: Record<string, string>; // species class → archetype (MACHINE, BIOLOGICAL …)
	buildingUnlocks: Record<string, string[]>; // building → the civics or origins that unlock it
	// civic → the authorities it needs or forbids ('gestalt': the gestalt consciousness ethic)
	civicAuthority: Record<string, { require: string[]; forbid: string[] }>;
	attractionSources: AttractionSource[]; // every modifier moving an ethic's attraction or the shift
	authorities: string[]; // every authority, in the game's order
	anomalyLevels: Record<string, number | null>; // anomaly category → level
	blockers: string[]; // deposit keys that are blockers
	// what clearing each blocker takes
	blockerInfo: Record<
		string,
		{ days: number | null; cost: Resources; prerequisites: string[]; natural: boolean }
	>;
	// District caps (`district_*_max_add|mult`, `planet_max_districts_add|mult`) of what can sit on
	// a planet, keyed `deposit:<key>`, `modifier:<key>` (static modifier), `building:<key>`
	capEffects: Record<string, CapEffect[]>;
	dlcs: Dlc[]; // every DLC the game knows (dlc_info.txt), in release order
	situationTypes: Record<
		string,
		{ name: string; category: string | null; approaches: Record<string, string>; stages: string[] }
	>;
	projects: Record<
		string,
		{ name: string; days: number | null; department: string | null; outcomes: Outcome[] }
	>;
	anomalyCategories: Record<string, { name: string; level: number | null; outcomes: Outcome[] }>;
	depositCategories: Record<string, string>; // e.g. d_energy_5 → orbital_mining_deposits
	prescriptedNames: Record<string, string>; // loc key → name, e.g. PRESCRIPTED_ruler_name_humans1
	entryEvents: EntryEvent[]; // the popups a first entry into a system fires (system_entry_event)
	scriptedTriggers: Record<string, Trigger | null>; // parameter-free scripted triggers, normalised
	// species rights per kind, in the game's order, each with its options
	speciesRights: {
		kind: string;
		options: {
			key: string;
			name: string;
			// a citizenship whose species takes a slavery / purge type (the types do nothing otherwise)
			isSlavery: boolean;
			isPurge: boolean;
			potential: Trigger | null;
			allow: Trigger | null;
		}[];
	}[];
	// `councilor_skill_add` by source: `tradition:` (traditions, edicts, policy options, agendas'
	// `#finish`), `civic:`, `modifier:` (static modifiers)
	councilorSkill: Record<string, number>;
	// what raises a class's leader limit: source (`tradition:<key>` — perks, edicts, policies too —,
	// `civic:`, `origin:`, `tech:`, `modifier:`) → class (`leader`: every class) → +n
	leaderCap: Record<string, Record<string, number>>;
	// what changes a class's recruitment cost, as `leaderCap`: source → class (`leader`) → mult
	leaderCost: Record<string, Record<string, number>>;
	focus: {
		categories: Record<string, string>; // key → name
		cards: Record<
			string,
			{
				category: string | null;
				tier: number | null;
				name: string;
				hint: string | null;
				requirement: string | null;
				gives: { category: string; amount: number }[]; // focus progress when done
			}
		>;
		// each reward adds one research option, which depends on the empire (if/else, not a choice)
		rewards: Record<
			string,
			{
				category: string | null;
				cost: number | null;
				options: { tech: string; when: Trigger | null }[];
			}
		>;
	};

	// council seats; modifiers (per leader level) are the `seat:<key>` explanations
	councilPositions: Record<
		string,
		{ name: string; civic: string | null; classes: string[]; possible: Trigger | null }
	>;
};

/** An event an anomaly or special project can lead to, with its title where it has one. */
export type Outcome = { event: string; name: string | null };

/** A DLC from the data DB's `dlc` table. */
export type Dlc = {
	name: string; // as the save's `required_dlcs` names it
	key: string; // dlc_info.txt block key, "dlc029"
	category: string | null; // expansion | story_pack | species_pack | content_pack; null if not installed
	releaseDate: string | null; // ISO date from the Steam store
	gameplay: boolean; // affects_gameplay
	// merged into the base game: a gameplay DLC no script checks for (`host_checks` 0; 4.5.2:
	// Utopia, Synthetic Dawn, Humanoids — and saves leave them out of `required_dlcs`)
	baseGame: boolean;
};

/** A mod descriptor from the Stellaris user dir's mod folder (`<name>.mod`). */
export type ModInfo = {
	name: string;
	version: string | null;
	supportedVersion: string | null; // e.g. "v4.5.*"
	tags: string[];
	steamId: string | null; // remote_file_id; null for local mods
	updated: string | null; // ISO time of the workshop's last update (launcher-v2.sqlite timeUpdated)
	file: string | null; // the descriptor's file name; null for a mod known only from the save
	local: boolean; // a descriptor not written by the workshop (`ugc_<id>.mod`), e.g. a dev copy
};

/** A mod's version as the dashboard saw it at one start (`mod_version` rows). */
export type ModVersionSeen = {
	name: string;
	version: string | null;
	supportedVersion: string | null;
	updated: string | null;
	seenAt: string; // ISO time of the dashboard start that saw it
	gameDate: string | null; // the head's game date then
};

/** One district cap modifier, e.g. `{ key: 'district_farming_max_add', value: 3 }`. */
export type CapEffect = { key: string; value: number };

/** One modifier as the game files give it, labelled from modifier_label. */
export type Modifier = {
	key: string;
	value: number;
	label: string | null;
	positiveIsGood: boolean;
	when?: Trigger | null; // a leader trait's triggered one: its condition (THIS the leader)
};

/** What a popup explains about a game object: from the extraction's descriptions and modifiers. */
export type Explanation = {
	title: string;
	description: string | null;
	modifiers: Modifier[];
	text: string | null; // effect or tooltip text the game shows besides the modifiers
	after?: { label: string; modifiers: Modifier[] }; // e.g. an agenda's finish modifier
	facts: string[]; // short lines: cost, tier, …
};
