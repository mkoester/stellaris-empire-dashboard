import type { CountryInfo, FirstContact, Relation } from './types.ts';

// The contacts tab: every empire we know, with what the save tells about it. Pure.

export const CONTACT_COLUMNS = [
	'type',
	'ethics',
	'government',
	'communications',
	'opinion',
	'trust',
	'threat',
	'agreements',
	'border',
	'firstContact'
] as const;
export type ContactColumn = (typeof CONTACT_COLUMNS)[number];

/** The contacts tab's filters and columns, in the profile. */
export type ContactView = {
	communicationsOnly: boolean;
	hostile: 'any' | 'hostile' | 'peaceful';
	hiddenTypes: string[]; // country types not shown, e.g. caravaneer_fleet
	columns: ContactColumn[];
};
export const DEFAULT_CONTACT_VIEW: ContactView = {
	communicationsOnly: false,
	hostile: 'any',
	hiddenTypes: [],
	columns: [...CONTACT_COLUMNS]
};

export function parseContactView(v: unknown): ContactView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<ContactView>;
	return {
		communicationsOnly: o.communicationsOnly === true,
		hostile: o.hostile === 'hostile' || o.hostile === 'peaceful' ? o.hostile : 'any',
		hiddenTypes: Array.isArray(o.hiddenTypes)
			? o.hiddenTypes.filter((t) => typeof t === 'string')
			: [],
		columns: Array.isArray(o.columns)
			? CONTACT_COLUMNS.filter((c) => (o.columns as unknown[]).includes(c))
			: [...CONTACT_COLUMNS]
	};
}

// The relation flags as the game's diplomacy screen names them; others show as their key.
const AGREEMENTS: Record<string, string> = {
	embassy: 'embassy',
	research_agreement: 'research agreement',
	commercial_pact: 'commercial pact',
	defensive_pact: 'defensive pact',
	non_aggression_pledge: 'non-aggression pact',
	guarantee: 'guarantee',
	closed_borders: 'closed borders'
};
export const agreementName = (key: string) => AGREEMENTS[key] ?? key.replaceAll('_', ' ');

export type ContactRow = Relation & {
	country: CountryInfo | null;
	firstContact: FirstContact | null; // an open one
};

export function contactTable(
	relations: Relation[],
	countries: CountryInfo[],
	contacts: FirstContact[]
): ContactRow[] {
	return relations.map((r) => ({
		...r,
		country: countries.find((c) => c.id === r.countryId) ?? null,
		firstContact:
			contacts.find((c) => c.countryId === r.countryId && c.status === 'in_progress') ?? null
	}));
}

export const shown = (rows: ContactRow[], v: ContactView) =>
	rows.filter(
		(r) =>
			(!v.communicationsOnly || r.communications) &&
			(v.hostile === 'any' || r.hostile === (v.hostile === 'hostile')) &&
			!v.hiddenTypes.includes(r.country?.type ?? '')
	);
