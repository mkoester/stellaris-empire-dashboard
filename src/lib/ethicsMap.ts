import type { Territory } from './territories.ts';

// The ethics tab's map of governing ethics (the user's ask 2026-11-26, after a review of 4.6:
// the game has no such map mode, so seeing where an ideology cannot spread meant opening every
// empire's communications). Each empire's territory in the colour of its strongest ethic among the
// ticked ones: fanatic (or absolute, or gestalt) in full, a plain ethic lighter — or, with
// `stripes`, in bands of every ticked ethic it holds, a fanatic one twice as wide. Its ethics come
// from the diplomacy tab's intel-aware view, so an empire our intel does not show stays grey.
// Pure.

/** The eight ethics and gestalt consciousness, by their base key (`ethic_<base>`), in the game's
 * axis order. */
export const ETHIC_BASES = [
	'authoritarian',
	'egalitarian',
	'xenophobe',
	'xenophile',
	'militarist',
	'pacifist',
	'spiritualist',
	'materialist',
	'gestalt_consciousness'
] as const;
export type EthicBase = (typeof ETHIC_BASES)[number];

/** An ethic key's base ("ethic_fanatic_militarist" → "militarist"), or null for none of ours. */
export function ethicBase(key: string): EthicBase | null {
	const b = key.replace(/^ethic_(absolute_|fanatic_)?/, '');
	return (ETHIC_BASES as readonly string[]).includes(b) ? (b as EthicBase) : null;
}

/** How strongly an empire holds an ethic: absolute 3, fanatic 2, plain 1; gestalt counts full. */
export function ethicStrength(key: string): number {
	if (key.startsWith('ethic_absolute_') || key === 'ethic_gestalt_consciousness') return 3;
	return key.startsWith('ethic_fanatic_') ? 2 : 1;
}

/** One empire's governing ethics as our intel shows them; null: unknown. */
export type EmpireEthics = {
	id: number;
	name: string; // as the diplomacy tab names it: "unknown empire" until we may know it
	ethics: string[] | null;
	asOf: string | null;
	stale: boolean; // our intel no longer confirms it
};

export const GESTALT = '#e0c400'; // gestalt on this map: the ethics' own slate grey vanishes
export const UNKNOWN = '#cccccc'; // the map modes' "no contact" grey
export const NONE = '#9ca3af'; // known, and none of the ticked ethics

/** A colour mixed towards white by `t` (0–1): a plain ethic, beside a fanatic one. */
export function lighter(hex: string, t = 0.45): string {
	const n = parseInt(hex.slice(1), 16);
	const mix = (c: number) => Math.round(c + (255 - c) * t);
	return `#${[n >> 16, (n >> 8) & 255, n & 255]
		.map((c) => mix(c).toString(16).padStart(2, '0'))
		.join('')}`;
}

const countryOf = (key: string) => {
	const m = /^country:(\d+)$/.exec(key);
	return m ? Number(m[1]) : null;
};

/**
 * The territories coloured by governing ethics: the strongest ticked ethic an empire holds
 * (ties in `ETHIC_BASES` order), its ethics named after the territory's name. `colors`: each
 * base's colour; `names`: ethic key → name. Guessed territories and empires without readable
 * ethics grey; our sectors are dropped, so the colour shows.
 */
export function ethicTerritories(
	territories: Territory[],
	empires: EmpireEthics[],
	ticked: ReadonlySet<EthicBase>,
	colors: Record<EthicBase, string>,
	names: Record<string, string> = {},
	stripes = false
): Territory[] {
	const byId = new Map(empires.map((e) => [e.id, e]));
	return territories.map((t) => {
		const id = countryOf(t.key);
		const e = id === null ? undefined : byId.get(id);
		if (!e?.ethics || t.guess)
			return { ...t, color: UNKNOWN, label: `${t.label} — ethics unknown`, parts: undefined };
		const named = [...e.ethics]
			.sort((a, b) => ethicStrength(b) - ethicStrength(a))
			.map((k) => names[k] ?? k)
			.join(', ');
		const since = e.stale && e.asOf ? `, unverified since ${e.asOf}` : '';
		const held = e.ethics
			.flatMap((k) => {
				const b = ethicBase(k);
				return b && ticked.has(b) ? [{ b, s: ethicStrength(k) }] : [];
			})
			.sort((x, y) => y.s - x.s || ETHIC_BASES.indexOf(x.b) - ETHIC_BASES.indexOf(y.b));
		const bands = held.flatMap((h) => Array<string>(Math.min(h.s, 2)).fill(colors[h.b]));
		return {
			...t,
			color: held[0] ? (held[0].s >= 2 ? colors[held[0].b] : lighter(colors[held[0].b])) : NONE,
			...(stripes && held.length > 1 ? { stripes: bands } : {}),
			label: `${t.label} — ${named || 'no ethics'}${since}`,
			guess: e.stale,
			parts: undefined
		};
	});
}

/** How many empires hold each ethic, among those whose ethics we know. */
export function ethicCounts(empires: EmpireEthics[]): Record<EthicBase, number> {
	const out = Object.fromEntries(ETHIC_BASES.map((b) => [b, 0])) as Record<EthicBase, number>;
	for (const e of empires)
		for (const b of new Set((e.ethics ?? []).map(ethicBase))) if (b) out[b]++;
	return out;
}

/** An ethic key as its intensity and ethic: "fanatic" / "absolute" / "" and the base. */
export function intensity(key: string): {
	level: 'absolute' | 'fanatic' | '';
	base: EthicBase | null;
} {
	const level = key.startsWith('ethic_absolute_')
		? 'absolute'
		: key.startsWith('ethic_fanatic_')
			? 'fanatic'
			: '';
	return { level, base: ethicBase(key) };
}

/** The table by ethic: each ethic with the empires holding it, the strongest first. */
export function ethicGroups(
	empires: EmpireEthics[]
): { base: EthicBase; empires: { e: EmpireEthics; key: string }[] }[] {
	return ETHIC_BASES.map((base) => ({
		base,
		empires: empires
			.flatMap((e) =>
				(e.ethics ?? []).filter((k) => ethicBase(k) === base).map((key) => ({ e, key }))
			)
			.sort(
				(a, b) => ethicStrength(b.key) - ethicStrength(a.key) || a.e.name.localeCompare(b.e.name)
			)
	}));
}
