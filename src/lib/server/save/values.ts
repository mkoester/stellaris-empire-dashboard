import type { Resources } from '#lib/types.ts';

// The small readers every part of the save reading shares: jomini's untyped values as numbers,
// lists and names. Pure, like everything after `readSave` (../save.ts).

// jomini returns untyped JS values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Raw = any;

/** A save flag, `x=yes` (parsed as true, or the string when the parser leaves it). */
export const isYes = (v: Raw) => v === true || v === 'yes';

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
	if (prescripted[key]) return prescripted[key];
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
	if (/\$\w+\$/.test(key) && Array.isArray(name?.variables)) {
		return key.replace(/\$(\w+)\$/g, (_, k: string) =>
			displayName(name.variables.find((x: Raw) => x?.key === k)?.value)
		);
	}
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

export function resources(obj: Raw): Resources {
	const out: Resources = {};
	for (const [k, v] of Object.entries(obj ?? {})) if (typeof v === 'number') out[k] = v;
	return out;
}

// FirstContact-MeaningfulLabels' types, as its localisation names them
// (`fc_meaningful_labels/localisation/english/fc_labels_l_english.yml`): change both together.
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
