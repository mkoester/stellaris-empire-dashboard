import { addGameDays } from '#lib/series.ts';
import type { Resources } from '#lib/types.ts';

// The small readers every part of the save reading shares: jomini's untyped values as numbers,
// lists and names. Pure, like everything after `readSave` (../save.ts).

// jomini returns untyped JS values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Raw = any;

/** A save flag, `x=yes` (parsed as true, or the string when the parser leaves it). */
export const isYes = (v: Raw) => v === true || v === 'yes';

const FLAG_HOURS_2200 = 62808000; // a flag's value is the hour it was set, +24 a day
/** The day a flag was set, from its value (`x=63029520`, or `{ flag_date }` for a timed one). */
export const flagDate = (v: Raw): string | null => {
	const h = typeof v === 'number' ? v : typeof v?.flag_date === 'number' ? v.flag_date : null;
	return h === null || h < FLAG_HOURS_2200
		? null
		: addGameDays('2200.01.01', Math.floor((h - FLAG_HOURS_2200) / 24));
};

export const countBy = (keys: string[]): Record<string, number> =>
	keys.reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {});

/** Sums `{ <source>: { <resource>: n } }` into `{ <resource>: n }`. */
export function sumSources(bySource: Raw): Resources {
	const out: Resources = {};
	for (const res of Object.values(bySource ?? {})) {
		for (const [k, v] of Object.entries(resources(res))) out[k] = (out[k] ?? 0) + v;
	}
	return out;
}

export function addResources(a: Resources, b: Resources): Resources {
	const out = { ...a };
	for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
	return out;
}

/** Readable approximation of a localisation key: `SPEC_Dar-Hesh_planet` → `Dar-Hesh`. */
// The prescripted names `displayName` reads with (`ReadingData`). Not an argument of its own: some
// sixty calls below would each have to be handed them. Set for the length of one synchronous call
// only (`withNames`), so no reading can see another's.
let prescripted: Record<string, string> = {};

/** Whether the names being read with hold this loc key. */
export const isPrescripted = (key: string): boolean => key in prescripted;

/** Runs `f` (synchronous) with these prescripted names; the ones before are back afterwards. */
export function withNames<T>(names: Record<string, string>, f: () => T): T {
	const before = prescripted;
	prescripted = names;
	try {
		return f();
	} finally {
		prescripted = before;
	}
}

export function displayName(name: Raw): string {
	const key = String(name?.key ?? name ?? '');
	// a prescripted text may be a template itself: `AofB` = "$1$ of $2$" (taken by the extractor
	// since 2026-11-20, which showed a contract's issuer as "$1$ of $2$")
	const pre = prescripted[key];
	if (pre && Array.isArray(name?.variables) && pre.includes('$')) return fill(pre, name.variables);
	// one without a placeholder is a name part with parts inside: a fallen hive's fragments,
	// `Indomitable` + `%ADJECTIVE%` (Myrran, Aggression) = "Indomitable Myrran Aggression" — the
	// part alone named all three "Indomitable" or "Forgotten" (2026-11-21)
	if (pre && Array.isArray(name?.variables))
		return [pre, ...name.variables.map((v: Raw) => displayName(v.value)).filter(Boolean)].join(' ');
	if (pre) return pre;
	// `%SEQ%` with fmt (e.g. HUMAN1_FLEET) and num: "1st Fleet".
	if (key === '%SEQ%' && Array.isArray(name?.variables)) {
		const v = (k: string) => name.variables.find((x: Raw) => x.key === k)?.value?.key;
		const n = Number(v('num'));
		const kind =
			String(v('fmt') ?? '')
				.split('_')
				.pop() ?? '';
		return `${ordinal(n)} ${kind.charAt(0)}${kind.slice(1).toLowerCase()}`;
	}
	// New colonies: `NEW_COLONY_NAME_<n>` = "$NAME$ Prime" … "$NAME$ Decimus" (localisation, 4.5.2).
	const colony = /^NEW_COLONY_NAME_(\d+)$/.exec(key);
	if (colony && Array.isArray(name?.variables)) {
		const base = name.variables.map((v: Raw) => displayName(v.value)).join(' ');
		return `${base} ${COLONY_SUFFIX[Number(colony[1]) - 1] ?? colony[1]}`;
	}
	// War names: `war_vs_adjectives` / `war_vs_names` = "$1$ - $2$ $3$" (4.5.2 localisation).
	if (/^war_vs_/.test(key) && Array.isArray(name?.variables)) {
		const part = (k: string) => displayName(name.variables.find((x: Raw) => x?.key === k)?.value);
		return `${part('1')} - ${part('2')} ${part('3')}`;
	}
	// Our FirstContact-MeaningfulLabels mod names a contact site `fc_label_<type>` with the
	// contact's own name as its variable: "Voidworms (Space Fauna)".
	const fc = /^fc_label_(\w+)$/.exec(key);
	if (fc && Array.isArray(name?.variables)) {
		const inner = name.variables.map((v: Raw) => displayName(v.value)).filter(Boolean);
		return `${inner.join(' ')} (${FC_LABELS[fc[1]] ?? fc[1]})`;
	}
	// Inline templates: `$affix$$base$` (a modified species: base "Yorphid", affix "Trans-" →
	// "Trans-Yorphid"), `$base$ $affix$` — each `$k$` filled by the variable keyed k.
	if (/\$\w+\$/.test(key) && Array.isArray(name?.variables)) return fill(key, name.variables);
	// Name templates with numbered parts (4.5 localisation, `common/random_names/00_empire_names.txt`):
	// `AofB` = "$1$ of $2$" — "Pact of Fellnoll", read as "AofB Pact Fellnoll" before 2026-11-17.
	const template = NAME_TEMPLATES[key];
	if (template && Array.isArray(name?.variables)) return fill(template, name.variables);
	// Name parts with a part inside — faction names, `{<names_1> {<names_2>}}` (4.5.2
	// common/random_names/00_pop_faction_names.txt): the outer part's own words come first.
	// `Council` + `of_Scientific_Betterment` → "Council of Scientific Betterment". Name-part keys
	// mirror their text; placeholders (`%ADJ%`) and formats (`PLANET_NAME_FORMAT`) are not parts.
	if (Array.isArray(name?.variables) && !key.startsWith('%') && key !== key.toUpperCase()) {
		const inner = name.variables.map((v: Raw) => displayName(v.value)).filter(Boolean);
		return [displayName({ key }), ...inner].join(' ');
	}
	// Templates with variables — `%ADJECTIVE%`, `PLANET_NAME_FORMAT` (PARENT + NUMERAL: "Barnards
	// Star I"), `PREFIX_NAME_FORMAT` (ship: "UNS Jordan"), `STAR_NAME_1_OF_1` — read as their parts.
	if (Array.isArray(name?.variables)) {
		// a prescripted species' adjective holds the noun's place: "Human $1$" + "Commonwealth"
		// (`PRESCRIPTED_species_adjective_humans1`) is "Human Commonwealth"
		const adj = name.variables.find((v: Raw) => v?.key === 'adjective');
		const adjText = adj ? displayName(adj.value) : '';
		if (key === '%ADJECTIVE%' && adjText.includes('$1$')) {
			const rest = name.variables
				.filter((v: Raw) => v !== adj)
				.map((v: Raw) => displayName(v.value))
				.filter(Boolean)
				.join(' ');
			return adjText.replace('$1$', rest).trim();
		}
		// a noun as the adjective takes the game's ending: "Mishar" + "Pact" is "Misharan Pact"
		if (key === '%ADJECTIVE%' && adj) {
			const rest = name.variables
				.filter((v: Raw) => v !== adj)
				.map((v: Raw) => displayName(v.value))
				.filter(Boolean);
			return [adjective(adjText), ...rest].join(' ');
		}
		return name.variables
			.filter((v: Raw) => v?.key !== 'PREFIX') // the ship prefix ("UNS") is localisation only
			.map((v: Raw) => displayName(v.value))
			.filter(Boolean)
			.join(' ');
	}
	return (
		key
			.replace(/^(SPEC|NAME|PRESCRIPTED)_/, '')
			// name lists: HUMAN1_SHIP_Byzantium, HUMAN1_CHR_Gabriela, NECROID1_FLEET_Vanguard,
			// HUMAN1_PLANET_Hope; one whose text differs from its tail ("Maelstrom Fleet", "St.
			// Pomeroy") is a prescripted name (extractor 0.1.5+, planets since 2026-11-14)
			.replace(/^[A-Z0-9]+_(SHIP|CHR|FLEET|ARMY|PLANET)_/, '')
			.replace(/_(planet|system|star)$/, '')
			.replaceAll('_', ' ')
	);
}

// The game's rules for turning a noun into an adjective (4.5.4 localisation/english/
// name_system_l_english.yml, `adj_NN*`): its last two letters, else its last one, replaced.
const ADJ_ENDINGS: Record<string, string> = {
	us: 'an',
	is: 'an',
	es: 'an',
	ss: 'an',
	id: 'an',
	ed: 'an',
	ad: 'an',
	od: 'an',
	ud: 'an',
	yd: 'an',
	i: 'ian',
	r: 'ran',
	a: 'an',
	e: 'an'
};

/** A noun as an adjective, as the game makes it: "Mishar" → "Misharan", "Barcalid" → "Barcalan". */
export function adjective(noun: string): string {
	for (const n of [2, 1]) {
		const end = ADJ_ENDINGS[noun.slice(-n)];
		if (end && noun.length > n) return noun.slice(0, -n) + end;
	}
	return noun;
}

/** `template`'s `$k$` filled with the name of the variable keyed k ("" where none is). */
// a scope command kept as a placeholder has dots: `$fotd_country.GetSpeciesName$` (extractor 2026-11-21)
const fill = (template: string, variables: Raw[]): string =>
	template.replace(/\$([\w.]+)\$/g, (_, k: string) =>
		displayName(variables.find((x: Raw) => x?.key === k)?.value)
	);

export function resources(obj: Raw): Resources {
	const out: Resources = {};
	for (const [k, v] of Object.entries(obj ?? {})) if (typeof v === 'number') out[k] = v;
	return out;
}

// FirstContact-MeaningfulLabels' types, as its localisation names them
// (`fc_meaningful_labels/localisation/english/fc_labels_l_english.yml`): change both together.
// Templates an empire's name is made with (4.5 `localisation/english`, the `AofB` block).
const NAME_TEMPLATES: Record<string, string> = {
	AofB: '$1$ of $2$', // "Empire of Sol"
	AofBpfx: '$1$ $2$', // its ship-prefix form
	AassocB: '$1$ $2$' // "Omega Initiative"
};

const FC_LABELS: Record<string, string> = {
	drones: 'Mining Drones',
	fauna: 'Space Fauna',
	artisans: 'Artisan Troupe',
	merchants: 'Trader Enclave',
	scholars: 'Curator Order',
	enclave: 'Alien Enclave',
	marauders: 'Marauders',
	caravaneers: 'Caravaneers',
	drifters: 'Unaligned Vessels'
};

const COLONY_SUFFIX = [
	'Prime',
	'Secundus',
	'Tertius',
	'Quartus',
	'Quintus',
	'Sextus',
	'Septimus',
	'Octantus',
	'Novantus',
	'Decimus'
];
const ordinal = (n: number) =>
	`${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
export const num = (v: Raw) => (typeof v === 'number' ? v : 0);
export const numOrNull = (v: Raw) => (typeof v === 'number' ? v : null);
export const strOrNull = (v: Raw) => (typeof v === 'string' ? v : null);
/** Every `country=<id>` anywhere below `v` (wars and trade deals name their sides this way). */
export function countryIds(v: Raw): number[] {
	if (!v || typeof v !== 'object') return [];
	return Object.entries(v).flatMap(([k, x]) =>
		k === 'country' && typeof x !== 'object' ? [Number(x)] : countryIds(x)
	);
}

export const items = (v: Raw): Raw[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
export const list = (v: Raw): number[] =>
	(Array.isArray(v) ? v : v === undefined ? [] : [v]).map(Number);
export const first = (v: Raw) => (Array.isArray(v) ? v[0] : v);
