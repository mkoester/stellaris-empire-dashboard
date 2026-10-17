// Shapes shared by server and pages.

export type Resources = Record<string, number>;

export type Colony = {
	planetId: number;
	name: string;
	designation: string;
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
export type ExpansionPlanet = {
	planetId: number;
	name: string;
	planetClass: string;
	size: number;
	system: string;
	jumps: number | null;
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
	ruler: { id: number; name: string } | null;
	agendasDone: string[] | null; // agendas on cooldown, i.e. passed recently
	policies: Record<string, string> | null; // policy → selected option
	government: string[] | null; // civics, ethics and authority keys
	wars: War[] | null; // wars the country takes part in
	warLostDate: string | null; // `last_date_war_lost` ("0.01.01" = never)
	tradeDeals: TradeDeal[] | null;
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
	agendas: Record<string, { name: string; cost: number | null }>;
	defines: Record<string, number>;
	jobs: Record<string, { name: string; category: string | null }>;
	edicts: Record<string, { name: string }>;
	traits: Record<string, { cost: number | null }>;
	speciesClasses: Record<string, { name: string; archetype: string | null }>;
	archetypes: Record<string, { points: number; maxTraits: number }>;
	planetClasses: Record<string, { name: string; colonizable: boolean }>;
	names: Record<string, string>; // display names of buildings, deposits, districts and zones
	traditionTrees: Record<
		string,
		{ name: string; traditions: { key: string; name: string; role: string }[] }
	>;
	perks: Record<string, string>; // ascension perk names
	anomalyLevels: Record<string, number | null>; // anomaly category → level
	blockers: string[]; // deposit keys that are blockers
	// District caps (`district_*_max_add|mult`, `planet_max_districts_add|mult`) of what can sit on
	// a planet, keyed `deposit:<key>`, `modifier:<key>` (static modifier), `building:<key>`
	capEffects: Record<string, CapEffect[]>;
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
