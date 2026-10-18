import type { Colony, Snapshot, TradeDeal } from './types.ts';

// Snapshots stored by an older dashboard lack the fields added since. The game deletes old
// autosaves, so those snapshots cannot be rebuilt from the files: they are kept and brought up to
// the current shape on read, with what is not known as null or empty.
// A new Snapshot or Colony field needs its default here — no SCHEMA bump (that would drop history).

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
	score: null,
	fleets: null,
	idleLeaders: null,
	traditions: null,
	ascensionPerks: null,
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
	warLostDate: null,
	tradeDeals: null
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
