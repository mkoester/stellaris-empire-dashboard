import type { Combat, CountryInfo, FirstContact, GalacticCommunity, Relation } from './types.ts';

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

// Kinds of contact, as the filters offer them; every country type not listed is `other` (factions,
// the Shroud, the game's event countries). From 4.5.2 `common/country_types/*` — re-check on game
// updates. An entry ending in `*` is a prefix.
const KIND_TYPES = {
	empires: ['default'],
	fallen: ['fallen_empire', 'awakened_fallen_empire'],
	enclaves: ['enclave', 'mindwarden_enclave', 'enclave_mercenary'],
	traders: ['caravaneer_home', 'caravaneer_fleet'],
	preFtl: ['primitive'],
	fauna: [
		'tiyanki*',
		'amoeba*',
		'crystal*',
		'drone*',
		'cloud',
		'voidworms*',
		'frenzied_voidworms',
		'cutholoids',
		'guardian*',
		'ldragon_country',
		'behemoth_hatchling',
		'abandoned_hatchery',
		'clutch_of_whelps',
		'lured_fauna_faction'
	],
	marauders: ['dormant_marauders', 'ruined_marauders', 'awakened_marauders', 'marauder_raiders'],
	other: []
} as const satisfies Record<string, readonly string[]>;
export type ContactKind = keyof typeof KIND_TYPES;
export const CONTACT_KINDS = Object.keys(KIND_TYPES) as ContactKind[];
export const KIND_LABELS: Record<ContactKind, string> = {
	empires: 'other empires',
	fallen: 'fallen empires',
	enclaves: 'enclaves',
	traders: 'traders',
	preFtl: 'pre-FTL civilisations',
	fauna: 'space fauna',
	marauders: 'marauders',
	other: 'other'
};
/** The country types a kind covers, for its tooltip (prefixes end in `*`). */
export const kindTypes = (k: ContactKind): readonly string[] => KIND_TYPES[k];

const matches = (type: string, t: string) =>
	t.endsWith('*') ? type.startsWith(t.slice(0, -1)) : type === t;
export function kindOf(type: string): ContactKind {
	for (const k of CONTACT_KINDS) if (KIND_TYPES[k].some((t) => matches(type, t))) return k;
	return 'other';
}

/** The contacts tab's filters and columns, in the profile. */
export type ContactView = {
	communicationsOnly: boolean;
	hostile: 'any' | 'hostile' | 'peaceful';
	kinds: ContactKind[]; // kinds shown
	columns: ContactColumn[];
	galcomFlat: boolean; // resolutions in force as one list, not by category
};
export const DEFAULT_CONTACT_VIEW: ContactView = {
	communicationsOnly: true,
	hostile: 'any',
	kinds: ['empires'],
	columns: [...CONTACT_COLUMNS],
	galcomFlat: false
};

/** A stored list of kinds, repaired; the default where none is stored. */
export const parseKinds = (v: unknown): ContactKind[] =>
	Array.isArray(v) ? CONTACT_KINDS.filter((k) => v.includes(k)) : ['empires'];

export function parseContactView(v: unknown): ContactView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<ContactView>;
	return {
		communicationsOnly: o.communicationsOnly !== false,
		hostile: o.hostile === 'hostile' || o.hostile === 'peaceful' ? o.hostile : 'any',
		kinds: parseKinds(o.kinds),
		columns: Array.isArray(o.columns)
			? CONTACT_COLUMNS.filter((c) => (o.columns as unknown[]).includes(c))
			: [...CONTACT_COLUMNS],
		galcomFlat: o.galcomFlat === true
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
	closed_borders: 'closed borders',
	migration_access: 'migration treaty',
	waystation_pact: 'wayline pact',
	is_rival: 'our rival',
	rivals_us: 'rivals us',
	subject: 'subject'
};
export const agreementName = (key: string) => AGREEMENTS[key] ?? key.replaceAll('_', ' ');

/**
 * How a resolution we voted on stands for us: `ahead` when our side has more weight, `behind`
 * otherwise (a tie too); null when we have not voted.
 */
export function voteStanding(
	ours: 'for' | 'against' | null,
	forWeight: number,
	againstWeight: number
): 'ahead' | 'behind' | null {
	if (ours === null) return null;
	const mine = ours === 'for' ? forWeight : againstWeight;
	const theirs = ours === 'for' ? againstWeight : forWeight;
	return mine > theirs ? 'ahead' : 'behind';
}

/**
 * When each resolution was proposed, as far as the saves tell — the game stores no date: proposed
 * after the last save without it (`after`; null when the first save with a Galactic Community
 * already had it) and by the first save showing it (`by`). Keyed by resolution id and type.
 */
export function proposalDates(
	snaps: { date: string; galcom: GalacticCommunity | null }[]
): Record<string, { after: string | null; by: string }> {
	const out: Record<string, { after: string | null; by: string }> = {};
	let previous: string | null = null; // the last save that had a Galactic Community
	for (const s of snaps) {
		if (!s.galcom) continue;
		for (const r of [s.galcom.voting, ...s.galcom.proposed, ...s.galcom.passed])
			if (r) out[`${r.id}:${r.type}`] ??= { after: previous, by: s.date };
		previous = s.date;
	}
	return out;
}

/**
 * Every combat any save along the branch caught (a fleet's record is cleared some time after the
 * fight), newest first; a combat seen in several saves keeps its latest reading.
 */
export function combatLog(snaps: { combats: Combat[] | null }[]): Combat[] {
	const byKey = new Map<string, Combat>();
	for (const s of snaps) for (const c of s.combats ?? []) byKey.set(`${c.fleetId}:${c.date}`, c);
	return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date));
}

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

/**
 * Each empire's galaxy-map colour by name — the name we know it by (before communications its
 * pre-communications one) and its own — for `EmpireName` on every page.
 */
export function empireColors(
	s: { countries: CountryInfo[] | null; relations: Relation[] | null } | undefined,
	flagColors: Record<string, string>
): Record<string, string> {
	const color = new Map(
		(s?.countries ?? []).flatMap((c) => {
			const hex = flagColors[c.flagColor ?? ''];
			return hex ? [[c.id, hex]] : [];
		})
	);
	return Object.fromEntries(
		[
			...(s?.countries ?? []),
			...(s?.relations ?? []).map((r) => ({ id: r.countryId, name: r.name }))
		].flatMap((c) => {
			const hex = color.get(c.id);
			return hex ? [[c.name, hex]] : [];
		})
	);
}

export const shown = (rows: ContactRow[], v: ContactView) =>
	rows.filter(
		(r) =>
			(!v.communicationsOnly || r.communications) &&
			(v.hostile === 'any' || r.hostile === (v.hostile === 'hostile')) &&
			v.kinds.includes(kindOf(r.country?.type ?? ''))
	);
