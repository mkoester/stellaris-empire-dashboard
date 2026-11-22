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
 * A proposal date as text: the month when the saves bracket it to one (`after` and `by` the 1st of
 * consecutive months: "2208.10"), else the range, or "by …" when the history starts with it.
 */
export function proposedLabel(d: { after: string | null; by: string }): string {
	if (d.after === null) return `by ${d.by}`;
	const [y, m, day] = d.after.split('.').map(Number);
	const next = m === 12 ? `${y + 1}.01.01` : `${y}.${String(m + 1).padStart(2, '0')}.01`;
	return day === 1 && d.by === next ? d.after.slice(0, 7) : `${d.after} – ${d.by}`;
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

// Before communications the game shows a contact's pre-communications name and its colour, nothing
// of what it is: `country` (real name, type, ethics …) only then, so neither the Type column, the
// kind badge nor the kind filter tells a first contact apart (the user's ask 2026-11-17). Fauna
// and the like get communications when their first contact finishes.
export type ContactRow = Relation & {
	country: CountryInfo | null; // with communications only
	flagColor: string | null; // its map colour, which the game shows anyway
	firstContact: FirstContact | null; // an open one
};

export function contactTable(
	relations: Relation[],
	countries: CountryInfo[],
	contacts: FirstContact[]
): ContactRow[] {
	return relations.map((r) => {
		const c = countries.find((x) => x.id === r.countryId) ?? null;
		return {
			...r,
			country: r.communications ? c : null,
			flagColor: c?.flagColor ?? null,
			firstContact:
				contacts.find((f) => f.countryId === r.countryId && f.status === 'in_progress') ?? null
		};
	});
}

/**
 * Each empire's galaxy-map colour by name — the name we know it by (before communications its
 * pre-communications one) and, once we talk or for ourselves, its own — for `EmpireName` on every
 * page. A real name we do not know yet stays out: the page data would spoil a first contact.
 */
export function empireColors(
	s:
		| { countries: CountryInfo[] | null; relations: Relation[] | null; countryId?: number | null }
		| undefined,
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
			...(s?.countries ?? []).filter(
				(c) =>
					c.id === s?.countryId ||
					s?.relations?.some((r) => r.countryId === c.id && r.communications)
			),
			...(s?.relations ?? []).map((r) => ({ id: r.countryId, name: r.name }))
		].flatMap((c) => {
			const hex = color.get(c.id);
			return hex ? [[c.name, hex]] : [];
		})
	);
}

/**
 * A fallen hive's fragment by its government (`gov_war_splinter` → "War Splinter"), whatever its
 * name — the three fragments of one hive are told apart by it; null for any other empire.
 */
export const splinterOf = (governmentType: string | null | undefined): string | null => {
	const m = /^gov_(\w+)_splinter$/.exec(governmentType ?? '');
	return m ? `${m[1].charAt(0).toUpperCase()}${m[1].slice(1).replaceAll('_', ' ')} Splinter` : null;
};

/**
 * Each fragment's splinter by the name we know it by, for `EmpireName` on every page: only those
 * we talk to — its government before communications would spoil the first contact.
 */
export function empireTags(
	s: { countries: CountryInfo[] | null; relations: Relation[] | null } | undefined
): Record<string, string> {
	const talking = new Set(
		(s?.relations ?? []).filter((r) => r.communications).map((r) => r.countryId)
	);
	return Object.fromEntries(
		(s?.countries ?? []).flatMap((c) => {
			const tag = talking.has(c.id) ? splinterOf(c.governmentType) : null;
			return tag ? [[c.name, tag]] : [];
		})
	);
}

export const shown = (rows: ContactRow[], v: ContactView) =>
	rows.filter(
		(r) =>
			(!v.communicationsOnly || r.communications) &&
			(v.hostile === 'any' || r.hostile === (v.hostile === 'hostile')) &&
			// a kind not known yet (no communications) is no reason to hide the row
			(!r.communications || v.kinds.includes(kindOf(r.country?.type ?? '')))
	);

/**
 * The latest snapshot as every page gets it: the countries it may know of in full (ourselves and
 * those we talk to), and nothing galaxy-wide — the history reading, every empire's relations
 * (`diplomacy`) and wars (`allWars`); the tabs that need them read them on the server. Page data
 * is visible to the viewer: anything more spoils a first contact (the user's ask 2026-11-17).
 */
export const pageLatest = <
	S extends {
		countries: CountryInfo[] | null;
		relations: Relation[] | null;
		countryId: number | null;
		history?: unknown;
		diplomacy?: unknown;
		allWars?: unknown;
		contracts?: unknown;
		storms?: unknown;
		precursorIntel?: unknown;
		archives?: { countryId: number }[] | null;
	}
>(
	s: S
): S => ({
	...s,
	...('history' in s ? { history: null } : {}),
	...('diplomacy' in s ? { diplomacy: null } : {}),
	...('allWars' in s ? { allWars: null } : {}),
	// every contract in the galaxy, issuers we never met by name: the contracts tab sends its own rows
	...('contracts' in s ? { contracts: null } : {}),
	// every storm's path, a forecast only movement intel gives: the map tab sends what we may see
	...('storms' in s ? { storms: null } : {}),
	// every empire's precursor chains and every precursor system (a cheat): the frontier tab sends
	// them only with it on
	...('precursorIntel' in s ? { precursorIntel: null } : {}),
	// every empire's specimens: the archive and trade tabs send others' per switch
	...('archives' in s
		? { archives: s.archives?.filter((a) => a.countryId === s.countryId) ?? null }
		: {}),
	countries:
		s.countries?.filter(
			(c) =>
				c.id === s.countryId ||
				(s.relations ?? []).some((r) => r.countryId === c.id && r.communications)
		) ?? null
});

/** A first contact's change since the previous save that read it; difficulty null where unknown. */
export type ContactChange = { difficulty: number | null; clues: number };

/**
 * Each first contact's change between the branch's last two readings of them (`saves` in order):
 * the difficulty rises with each stage, the clues with each roll. The difficulty compares only
 * readings that both carry the country's part (`defense`, READER 76) — an older one holds the
 * stage's alone. A contact new in the last reading has none.
 */
export function contactChanges(
	saves: { firstContacts: FirstContact[] | null }[]
): Record<number, ContactChange> {
	const readings = saves.flatMap((s) => (s.firstContacts ? [s.firstContacts] : []));
	const [prev, last] = readings.slice(-2);
	if (!last) return {};
	const before = new Map(prev.map((c) => [c.id, c]));
	return Object.fromEntries(
		last.flatMap((c) => {
			const p = before.get(c.id);
			if (!p) return [];
			const known = c.defense !== undefined && p.defense !== undefined;
			return [
				[c.id, { difficulty: known ? c.difficulty - p.difficulty : null, clues: c.clues - p.clues }]
			];
		})
	);
}

/** A change as an arrow: "▲2", "▼1", nothing when none or unknown. */
export const changeMark = (n: number | null | undefined) => (!n ? '' : n > 0 ? `▲${n}` : `▼${-n}`);

/** A first contact's difficulty as shown: ≈ unless the country's part is the game's own sum. */
export const difficultyText = (f: Pick<FirstContact, 'difficulty' | 'defenseExact'>) =>
	`${f.defenseExact ? '' : '≈'}${f.difficulty}`;

/** What a first contact's difficulty is made of, for its tooltip. */
export function difficultyTitle(
	f: Pick<FirstContact, 'difficulty' | 'defense' | 'defenseExact' | 'defenseParts'>
) {
	const stage = f.difficulty - (f.defense ?? 0);
	const parts = (f.defenseParts ?? []).map((p) => `, +${p.value} ${p.label}`).join('');
	return f.defenseExact
		? `the stage's ${stage}${parts}`
		: `≈ the stage's ${stage}${parts}; companion mod 0.16.0 reads their modifiers as the game sums them`;
}
