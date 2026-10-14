// Shapes shared by server and pages.

export type Resources = Record<string, number>;

export type Colony = {
	planetId: number;
	name: string;
	designation: string;
	pops: number;
	employablePops: number;
	stability: number;
	freeHousing: number;
	freeAmenities: number;
	districts: number;
	buildQueueId: number | null;
};

/** One observed state of the player's empire at one game date. */
export type Snapshot = {
	campaign: string;
	date: string; // game date as the save writes it, "2200.01.01"
	fingerprint: string;
	countryId: number;
	empireName: string;
	pops: number;
	stockpile: Resources;
	income: Resources; // budget.current_month, summed over sources
	expenses: Resources;
	balance: Resources;
	colonies: Colony[];
};

export type TimelineNode = {
	id: number;
	campaign: string;
	date: string;
	fingerprint: string;
	parentId: number | null;
	ambiguous: boolean;
};
