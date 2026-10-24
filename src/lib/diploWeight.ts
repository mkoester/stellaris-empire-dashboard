import type { Modifier } from './types.ts';

// Our diplomatic weight as the game's tooltip builds it ("Base Diplomatic Weight": Fleet Power,
// Pops, Economy, Technology, each with its modifiers), from the save's power values and the
// defines (4.5.2 `00_defines.txt` DIPLOMACY_WEIGHT_*):
// - fleet power: naval power × 0.025 ("From Fleets"), × (1 + diplo_weight_naval_mult)
// - pops: 0.01 a pop × (1 + 2 × their happiness), × (1 + diplo_weight_pops_mult) — the defines'
//   "BASE + HAPPINESS × happiness" read per pop as 0.01 × (1 + 2 h): 2214.02.01, 5875 pops at
//   65.7 % → 135.95, the tooltip's 136
// - economy: economy power × 0.15, × (1 + diplo_weight_economy_mult)
// - technology: tech power × 0.1, × (1 + diplo_weight_technology_mult)
// then × (1 + diplo_weight_mult). Checked against the game's tooltip at 2214.02.01 (screenshot
// 2026_10_23_9): 22 + 136 + 163 + 74 = 395. Pure.

export type WeightSource = { name: string; modifiers: Modifier[] };
export type WeightPart = {
	id: 'fleet' | 'pops' | 'economy' | 'technology';
	label: string;
	raw: number; // before modifiers
	basis: string; // how the raw value comes about
	mods: { name: string; value: number }[];
	value: number;
};
export type WeightBreakdown = {
	parts: WeightPart[];
	overall: { name: string; value: number }[]; // diplo_weight_mult
	total: number;
	exact: number | null; // the game's value (companion mod 0.4.0)
	// modifiers that act only in some votes or seats (council, envoys, rivals, …): not counted
	notCounted: { name: string; key: string; value: number }[];
};

const PART_KEY: Record<WeightPart['id'], string> = {
	fleet: 'diplo_weight_naval_mult',
	pops: 'diplo_weight_pops_mult',
	economy: 'diplo_weight_economy_mult',
	technology: 'diplo_weight_technology_mult'
};

export function diploWeight(
	p: { military: number; economy: number; tech: number; pops: number; happiness: number | null },
	sources: WeightSource[],
	exact: number | null
): WeightBreakdown {
	const mods = (key: string) =>
		sources.flatMap((s) =>
			s.modifiers.filter((m) => m.key === key).map((m) => ({ name: s.name, value: m.value }))
		);
	const h = p.happiness ?? 0;
	const raws: Omit<WeightPart, 'mods' | 'value'>[] = [
		{
			id: 'fleet',
			label: 'Fleet Power',
			raw: p.military * 0.025,
			basis: `naval power ${Math.round(p.military)} × 0.025`
		},
		{
			id: 'pops',
			label: 'Pops',
			raw: p.pops * 0.01 * (1 + 2 * h),
			basis: `${Math.round(p.pops)} pops × 0.01 × (1 + 2 × ${Math.round(h * 100)} % happiness)`
		},
		{
			id: 'economy',
			label: 'Economy',
			raw: p.economy * 0.15,
			basis: `economy power ${Math.round(p.economy)} × 0.15`
		},
		{
			id: 'technology',
			label: 'Technology',
			raw: p.tech * 0.1,
			basis: `technology ${Math.round(p.tech)} × 0.1`
		}
	];
	const parts = raws.map((r) => {
		const m = mods(PART_KEY[r.id]);
		return { ...r, mods: m, value: r.raw * (1 + m.reduce((n, x) => n + x.value, 0)) };
	});
	const overall = mods('diplo_weight_mult');
	const total =
		parts.reduce((n, x) => n + x.value, 0) * (1 + overall.reduce((n, x) => n + x.value, 0));
	const counted = new Set([...Object.values(PART_KEY), 'diplo_weight_mult']);
	const notCounted = sources.flatMap((s) =>
		s.modifiers
			.filter((m) => m.key.startsWith('diplo_weight') && !counted.has(m.key))
			.map((m) => ({ name: s.name, key: m.key, value: m.value }))
	);
	return { parts, overall, total, exact, notCounted };
}
