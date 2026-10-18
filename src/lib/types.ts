// Shapes shared by server and pages.

import type { Trigger } from './triggers.ts';

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
	freeAmenities: number;
	districts: number;
	districtList: ColonyDistrict[]; // per district type: built, zones and their buildings
	planetClass: string;
	planetSize: number;
	deposits: string[]; // deposit types on the planet, blockers included
	planet: PlanetState | null; // null in older snapshots
	buildQueue: QueueItem[];
	buildSlots: number; // items the planet builds at once (queue `simultaneous`; >1 for wilderness, arkships, mods)
	jobs: ColonyJob[];
	openJobs: number; // unfilled positions, summed over the colony's jobs
	strata: Stratum[]; // pops and happiness per stratum (worker, specialist, …)
	happiness: number | null; // 0–1, pops-weighted over the strata
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

export type Fleet = { name: string; ships: number; power: number; route: Route };

/**
 * Where a fleet is and which systems its orders take it to (current order first, then the queue),
 * with hyperlane jumps counted from where it is. The save holds no arrival dates.
 */
export type Route = {
	at: string;
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
	kind: string; // science_ship, constructor, colonizer, …
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

/** One budget source of pops (a job, a stratum's upkeep, buildings, …) for the month. */
export type BudgetSource = { source: string; income: Resources; expenses: Resources };

/** A district type on a colony: how many are built, its zones (specialisations) and their buildings. */
export type ColonyDistrict = {
	type: string;
	built: number;
	zones: { type: string; buildings: string[] }[];
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
	costSettings: { technology: number; traditions: number }; // galaxy setup sliders
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
	income: Resources | null; // budget.current_month, summed over sources
	expenses: Resources | null;
	balance: Resources;
	colonies: Colony[];
	/** Year the end game starts (galaxy setting); null from the mod feed, which does not know it. */
	endGameYear: number | null;
	// Top-bar counters; null from the mod feed. Their caps' counterparts that the save does not
	// store (naval capacity, envoy slots) are computed by the game and not available here.
	empireSize: number | null;
	starbases: { used: number; capacity: number } | null;
	navalUsed: number | null;
	envoys: { used: number; total: number } | null;
	marketOrders: MarketOrder[]; // standing monthly buy/sell orders
	market: Market | null; // null from the mod feed and in older snapshots
	// Null from the mod feed:
	leaders: Record<string, number> | null; // by class
	ships: ShipCount[] | null;
	defaultAutomation: string[] | null; // automation settings new colonies start with
	automationBlocked: string[] | null; // resources planet automation may not spend
	planetBudget: BudgetSource[] | null; // the budget's planet_* and pop_* sources
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
	ruler: { id: number; name: string; level?: number } | null; // level: since 2026-10-18
	agendasDone: string[] | null; // agendas on cooldown, i.e. passed recently
	policies: Record<string, string> | null; // policy → selected option
	government: string[] | null; // civics, ethics and authority keys
	governmentType: string | null; // e.g. gov_representative_democracy
	origin: string | null; // e.g. origin_default
	wars: War[] | null; // wars the country takes part in
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
	countries: CountryInfo[] | null; // empires in contact, or owning a station in a visited system
	relations: Relation[] | null;
	firstContacts: FirstContact[] | null;
	situations: SituationInfo[] | null;
	anomalies: AnomalyInfo[] | null; // found, not yet researched
	specialProjects: ProjectInfo[] | null;
	digSites: DigSite[] | null; // archaeological sites in visited systems
	// The focus, tech and leaders tabs; null from the mod feed and in older snapshots.
	focus: EmpireFocus | null;
	techOptions: Record<string, string[]> | null; // research field → the cards on offer
	leaderList: LeaderInfo[] | null; // every hired leader
};

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
	age: number | null;
	traits: string[];
	job: string | null;
	species: string | null; // its species' name
	council: boolean; // holds a council seat
	ruler: boolean;
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
	anomaly: string | null; // category, if the empire surveyed the planet
	dist: number; // from the system's centre (in-system coordinates)
};

export type CountryInfo = {
	id: number;
	name: string;
	type: string; // default, fallen_empire, enclave, caravaneer_home, primitive …
	shipset: string | null; // graphical_culture
	ethics: string[];
	authority: string | null;
	civics: string[];
	governmentType: string | null;
	origin: string | null;
};

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
	daysLeft: number | null;
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
	stage: string | null;
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
	daysLeft: number | null;
	excavating: boolean;
};

/** A council seat: `council_positions.<id> = { country type leader }`. */
export type CouncilSeat = {
	type: string;
	leaderId: number | null;
	leaderName: string | null;
	leaderLevel: number | null;
};

/** A war the country is in. UNVERIFIED shape — no war seen in a save yet (see AGENTS.md). */
export type War = { id: string; name: string; start: string | null; enemies: string[] };
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
};

/** Names, costs and rules from the extraction's SQLite (STELLARIS_DATA_DB), loaded once. */
export type GameData = {
	techs: Record<string, { name: string; cost: number | null; area: string; tier: number | null }>;
	agendas: Record<string, { name: string; cost: number | null; unlockedBy: string[] }>;
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
	names: Record<string, string>; // display names of buildings, deposits, districts and zones
	districtColors: Record<string, string>; // district → its colour in game, '#rrggbb'
	// civics, origins, authorities, ethics and government types by key
	identityNames: Record<string, string>;
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
		{ name: string; category: string | null; approaches: Record<string, string> }
	>;
	projects: Record<
		string,
		{ name: string; days: number | null; department: string | null; outcomes: Outcome[] }
	>;
	anomalyCategories: Record<string, { name: string; level: number | null; outcomes: Outcome[] }>;
	depositCategories: Record<string, string>; // e.g. d_energy_5 → orbital_mining_deposits
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
			}
		>;
		rewards: Record<string, { category: string | null; cost: number | null; techs: string[] }>;
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
