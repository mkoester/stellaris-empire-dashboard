import { RESERVES } from './nomad.ts';
import { splitByGroup } from './resourceGroups.ts';
import type { BudgetSource, Resources } from './types.ts';

// Pop and planet budget sources as readable rows: `planet_farmers` → "farmers",
// `pop_category_workers` → "workers (pop upkeep)", each with income − expenses.

export const net = (a: Resources, b: Resources): Resources => {
	const out = { ...a };
	for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) - v;
	return out;
};

export function sourceLabel(source: string): string {
	if (source === 'market:monthly_trades') return 'market orders';
	if (source.startsWith('market:')) return `market: ${source.slice(7).replaceAll('_', ' ')}`;
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
	// The total is long; one row per resource group keeps it readable.
	return [
		...rows,
		...splitByGroup(total).map((g) => ({ label: `total ${g.name}`, flows: g.flows, strong: true }))
	];
}

export type ResourceBudgetRow = { label: string; income: number; expenses: number; net: number };

/**
 * One resource's month by budget source: what each source earns and spends of it, biggest
 * earner first, biggest spender last; sources that do not touch it left out. The total is the
 * resource's net per month. A nomad's Operational Reserves are energy and minerals together.
 */
export function resourceBudget(sources: BudgetSource[], key: string) {
	const keys = key === RESERVES ? ['energy', 'minerals'] : [key];
	const of = (r: Record<string, number>) => keys.reduce((t, k) => t + (r[k] ?? 0), 0);
	const rows: ResourceBudgetRow[] = sources
		.map((s) => {
			const income = of(s.income);
			const expenses = of(s.expenses);
			return { label: sourceLabel(s.source), income, expenses, net: income - expenses };
		})
		.filter((r) => r.income !== 0 || r.expenses !== 0)
		.sort((a, b) => b.net - a.net || a.label.localeCompare(b.label));
	const sum = (f: (r: ResourceBudgetRow) => number) => rows.reduce((t, r) => t + f(r), 0);
	return {
		rows,
		total: {
			income: sum((r) => r.income),
			expenses: sum((r) => r.expenses),
			net: sum((r) => r.net)
		}
	};
}
