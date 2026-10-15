// Shapes shared by server and pages.

export type Resources = Record<string, number>;

export type Colony = {
	planetId: number;
	name: string;
	designation: string;
	pops: number;
	employed: number; // employable pops minus civilians (the save has no direct count)
	civilians: number; // pops without a job (the 4.x "civilian" stratum)
	stability: number;
	freeHousing: number;
	freeAmenities: number;
	districts: number;
	buildQueue: QueueItem[];
	jobs: ColonyJob[];
	openJobs: number; // unfilled positions, summed over the colony's jobs
};

/** One job on a colony. Positions null: unlimited (civilian). */
export type ColonyJob = { type: string; pops: number; filled: number; positions: number | null };

/** One entry of a planet's build queue, in queue order. */
export type QueueItem = {
	kind: string; // from buildable_<kind>: district, building, army, clear_deposit_blocker, …
	name: string; // what is built: district/building key, army type, blocker deposit type
	progress: number;
	needed: number;
};

/**
 * Where an observation came from: a parsed save (complete) or the companion mod's monthly
 * game.log lines (stockpile and net income only — the other fields are null/empty).
 */
export type SourceKind = 'save' | 'log';

/** A standing monthly order on the market. */
export type MarketOrder = { kind: 'buy' | 'sell'; resource: string; amount: number };

/** What the empire is working towards; the inputs of the upcoming-events list. */
export type Progress = {
	research: { area: string; tech: string; progress: number }[]; // one per field being researched
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
	progress: Progress | null; // null from the mod feed
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
