import type { BudgetSource, Resources } from './types.ts';

// Pop and planet budget sources as readable rows: `planet_farmers` → "farmers",
// `pop_category_workers` → "workers (pop upkeep)", each with income − expenses.

export const net = (a: Resources, b: Resources): Resources => {
	const out = { ...a };
	for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) - v;
	return out;
};

export function sourceLabel(source: string): string {
	if (source === 'planet_pops_traits') return 'pops (food)';
	if (source.startsWith('pop_category_')) return `${source.slice(13)} (pops)`;
	if (source.startsWith('planet_districts_')) return `${source.slice(17)} districts`;
	return source.replace(/^planet_/, '').replaceAll('_', ' ');
}

/** Jobs first (by name), then strata and the rest, plus a total. */
export function budgetRows(sources: BudgetSource[]) {
	const rank = (s: string) =>
		s.startsWith('pop_') || s === 'planet_pops_traits'
			? 1
			: /^planet_(buildings|districts)/.test(s)
				? 2
				: 0;
	const rows = sources
		.map((s) => ({
			label: sourceLabel(s.source),
			rank: rank(s.source),
			flows: net(s.income, s.expenses)
		}))
		.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
	const total = rows.reduce<Resources>((sum, r) => net(sum, net({}, r.flows)), {});
	return [...rows, { label: 'total', flows: total, strong: true }];
}
