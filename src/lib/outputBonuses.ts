// Job output bonuses and how they stack — pure. A job's resources are booked under its economic
// category (data DB `job.budget_source`, e.g. `planet_physicists`), which sits in a tree up to
// `country` (`economic_category.parent`: physicists → researchers → jobs_specialist →
// jobs_productive → jobs → planets → country). The folder's README (common/economic_categories):
// a `<category>_produces_mult` or `<category>_<resource>_produces_mult` applies to the category and
// every one below it; a `<category>_<resource>_produces_add` to the category alone. So a job's
// output of a resource per month = (workforce + job efficiency's extra) ÷ 100 × (base + adds) ×
// (1 + mults), its base from `job_resource` (per 100 workforce, `#lib/jobs.ts`). Mults of every kind
// add up, as research speed bonuses were measured to (#lib/researchBonuses.ts); checked against the
// colonies' booked output (`Colony.produces`).

import type { Modifier } from './types.ts';

/** A category and its ancestors, nearest first. */
export function categoryChain(category: string, parents: Record<string, string | null>): string[] {
	const out: string[] = [];
	for (let c: string | null | undefined = category; c && !out.includes(c); c = parents[c])
		out.push(c);
	return out;
}

/** Whether a modifier key multiplies or adds to a job's output of `resource`; null: neither. */
export function outputKind(key: string, chain: string[], resource: string): 'mult' | 'add' | null {
	if (!key.endsWith('_produces_mult') && !key.endsWith('_produces_add')) return null;
	if (key === `${chain[0]}_${resource}_produces_add`) return 'add';
	for (const c of chain)
		if (key === `${c}_produces_mult` || key === `${c}_${resource}_produces_mult`) return 'mult';
	return null;
}

export type OutputSource = {
	ref: string;
	name: string;
	modifiers: Pick<Modifier, 'key' | 'value' | 'when'>[];
	count?: number;
	species?: string; // a species' trait: only its pops' share of the workforce
};

export type OutputLine = {
	ref: string;
	name: string;
	kind: 'mult' | 'add';
	value: number; // as written (× count); a species' scaled by its share in `jobOutput`
	share: number; // of the workforce it reaches (1, or a species' share)
};

export type JobInput = {
	type: string;
	filled: number;
	bonus?: number;
	species?: Record<string, number>;
};

/**
 * One job's output of one resource on a colony, with the lines that reach it. A species' trait
 * counts for its share of the job's workforce (the share × the value, which is what a mult or add
 * on part of the workforce comes to).
 */
export function jobOutput(
	job: JobInput,
	resource: string,
	base: number,
	chain: string[],
	sources: OutputSource[]
) {
	const workforce = job.filled + (job.bonus ?? 0);
	const total = Object.values(job.species ?? {}).reduce((a, b) => a + b, 0);
	const lines: OutputLine[] = sources.flatMap((s) => {
		const share = s.species === undefined ? 1 : total ? (job.species?.[s.species] ?? 0) / total : 0;
		if (share === 0) return [];
		return s.modifiers.flatMap((m) => {
			const kind = m.when ? null : outputKind(m.key, chain, resource);
			return kind && m.value !== 0
				? [{ ref: s.ref, name: s.name, kind, value: m.value * (s.count ?? 1), share }]
				: [];
		});
	});
	const sum = (k: 'mult' | 'add') =>
		lines.filter((l) => l.kind === k).reduce((t, l) => t + l.value * l.share, 0);
	const add = sum('add');
	const mult = sum('mult');
	return {
		workforce,
		base,
		add,
		mult,
		lines,
		output: (workforce / 100) * (base + add) * (1 + mult)
	};
}

/** What one more bonus is really worth on top of a pile that sums to `sum`. */
export const realGain = (bonus: number, sum: number) => bonus / (1 + sum);
