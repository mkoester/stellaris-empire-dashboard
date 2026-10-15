import type { Colony, Snapshot } from './types.ts';

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
	leaders: null,
	ships: null,
	defaultAutomation: null,
	automationBlocked: null,
	planetBudget: null,
	score: null,
	fleets: null,
	edicts: null,
	species: null,
	sectors: null,
	expansion: null,
	stations: null,
	megaShipyards: null,
	progress: null
};

const COLONY: Omit<Colony, 'planetId' | 'name'> = {
	designation: '',
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
	automation: { enabled: false, settings: [] },
	produces: {},
	upkeep: {}
};

export function upgrade(
	stored: Partial<Snapshot> & Pick<Snapshot, 'kind' | 'campaign' | 'date'>
): Snapshot {
	const s = { fingerprint: '', empireName: '', ...SNAPSHOT, ...stored } as Snapshot;
	return {
		...s,
		colonies: s.colonies.map((c) => ({ ...COLONY, ...c })),
		progress: s.progress && { ...s.progress, researched: s.progress.researched ?? [] },
		expansion: s.expansion && s.expansion.map((p) => ({ ...p, candidate: p.candidate ?? null }))
	};
}
