import type { Colony, Snapshot, TradeDeal, War } from './types.ts';

// Snapshots stored by an older dashboard lack the fields added since. The game deletes old
// autosaves, so those snapshots cannot be rebuilt from the files: they are kept and brought up to
// the current shape on read, with what is not known as null or empty.
// A new Snapshot or Colony field needs its default here — no table change (`MIGRATIONS` in db.ts).

const SNAPSHOT: Omit<Snapshot, 'kind' | 'campaign' | 'date' | 'fingerprint' | 'empireName'> = {
	countryId: null,
	pops: null,
	stockpile: {},
	income: null,
	expenses: null,
	balance: {},
	colonies: [],
	endGameYear: null,
	empireSize: null,
	starbases: null,
	navalUsed: null,
	envoys: null,
	marketOrders: [],
	market: null,
	leaders: null,
	ships: null,
	defaultAutomation: null,
	automationBlocked: null,
	planetBudget: null,
	budget: null,
	construction: null,
	score: null,
	fleets: null,
	idleLeaders: null,
	traditions: null,
	ascensionPerks: null,
	canDetox: null,
	habitatSites: null,
	habitats: null,
	civilianShips: null,
	edicts: null,
	countryModifiers: null,
	species: null,
	sectors: null,
	expansion: null,
	stations: null,
	migration: null,
	knownSystems: null,
	megaShipyards: null,
	progress: null,
	leaderRoster: null,
	ruler: null,
	agendasDone: null,
	policies: null,
	government: null,
	governmentType: null,
	origin: null,
	wars: null,
	subjects: null,
	galcom: null,
	claims: null,
	factions: null,
	combats: null,
	shroud: null,
	warLostDate: null,
	tradeDeals: null,
	gameVersion: null,
	dlcs: null,
	mods: null,
	countryType: null,
	policyFlags: null,
	countryFlags: null,
	council: null,
	councilSlots: null,
	edictTimes: null,
	galaxy: null,
	countries: null,
	relations: null,
	firstContacts: null,
	situations: null,
	anomalies: null,
	specialProjects: null,
	digSites: null,
	stationsSeen: null,
	surveyedAll: null,
	focus: null,
	techOptions: null,
	leaderList: null,
	speciesRights: null,
	timelineId: null,
	previousTimelineId: null,
	logEvents: null,
	ticks: null
};

const COLONY: Omit<Colony, 'planetId' | 'name'> = {
	designation: '',
	colonizing: false,
	growth: null,
	pops: 0,
	employed: 0,
	civilians: 0,
	stability: 0,
	freeHousing: 0,
	freeAmenities: 0,
	districts: 0,
	districtList: [],
	planetClass: '',
	planetSize: 0,
	deposits: [],
	buildQueue: [],
	buildSlots: 1,
	jobs: [],
	openJobs: 0,
	strata: [],
	happiness: null,
	habitability: null,
	speciesHabitability: {},
	sector: null,
	automation: { enabled: false, settings: [] },
	produces: {},
	upkeep: {},
	planet: null
};

// what a war stored before 2026-10-19 lacks
const WAR: Omit<War, 'id' | 'name' | 'start' | 'enemies'> = {
	allies: [],
	attacker: null,
	goal: null,
	enemyGoal: null,
	exhaustion: null,
	enemyExhaustion: null,
	battles: []
};

export function upgrade(
	stored: Partial<Snapshot> & Pick<Snapshot, 'kind' | 'campaign' | 'date'>
): Snapshot {
	const s = { fingerprint: '', empireName: '', ...SNAPSHOT, ...stored } as Snapshot;
	return {
		...s,
		colonies: s.colonies.map((c) => ({ ...COLONY, ...c })),
		progress: s.progress && { ...s.progress, researched: s.progress.researched ?? [] },
		expansion:
			s.expansion &&
			s.expansion.map((p) => ({ ...p, candidate: p.candidate ?? null, planet: p.planet ?? null })),
		knownSystems:
			s.knownSystems && s.knownSystems.map((k) => ({ ...k, capital: k.capital ?? false })),
		tradeDeals: s.tradeDeals && s.tradeDeals.map(upgradeDeal),
		wars: s.wars && s.wars.map((w) => ({ ...WAR, ...w })),
		factions: s.factions && s.factions.map((f) => ({ ...f, change: f.change ?? null })),
		galcom: s.galcom && { ...s.galcom, passed: s.galcom.passed ?? [] },
		relations: s.relations && s.relations.map((r) => ({ ...r, agreements: r.agreements ?? [] })),
		// stored as plain keys for a day (2026-10-17), without the end date
		countryModifiers:
			s.countryModifiers &&
			s.countryModifiers.map((m) => (typeof m === 'string' ? { key: m, until: null } : m))
	};
}

// Deals were stored as `{ id, partner, items }` (a one-line summary) before they had sides.
function upgradeDeal(d: TradeDeal | { id: string; partner: string; items: string }): TradeDeal {
	if ('gives' in d) return d;
	const empty = { monthly: {}, once: {}, other: [] };
	return {
		id: d.id,
		partner: d.partner,
		start: null,
		years: null,
		gives: { ...empty, other: [d.items] },
		gets: empty,
		understood: false,
		raw: ''
	};
}
