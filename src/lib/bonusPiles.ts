import type { Explanation, Modifier } from './types.ts';

// What one more bonus would do at this point in the game — pure. Bonuses of a kind add up into a
// pile, and the pile multiplies what it acts on: × (1 + pile) for output and cost or upkeep, ÷ (1 +
// pile) on the time a speed bonus shortens (#lib/researchBonuses.ts measured that for research).
// So a bonus x changes what is measured now by (1 + pile + x) ÷ (1 + pile), or its inverse for a
// time: +10 % on top of +48 % is +6.8 %; −10 % upkeep on top of −20 % saves 12.5 %. A card is one
// pile; its parts are what it acts on (a colony's output, a budget source's upkeep, a research
// area's tech in progress), each with its own pile sum and what is measured now (`base`).

/** output: more of what is made; cost: more of what is paid (or of a time, for research cost); speed: a time shortened. */
export type Effect = 'output' | 'cost' | 'speed';

export type Part = {
	label: string;
	sum: number; // the pile as it stands for this part
	base: number | null; // what is measured now: a month's output or upkeep, days; null: relative only
	targets: string[]; // what a targeted bonus must name to reach it (an area, a resource, a ship size)
	resource?: string; // what `base` is in, where it is a resource
};

export type BonusLine = { ref: string; name: string; value: number; target: string | null };

export type Preset = {
	value: number;
	target: string | null; // null: reaches every part
	example: string; // a source that gives it
	count: number; // how many sources give it
};

/** What one more bonus is really worth in a pile that already sums to `sum`. */
export const realGain = (bonus: number, sum: number) => bonus / (1 + sum);

/** The factor a bonus `x` applies to what is measured now, in a pile summing to `sum`. */
export function factor(effect: Effect, sum: number, x: number): number {
	const now = Math.max(0, 1 + sum);
	const after = Math.max(0, 1 + sum + x);
	if (effect === 'speed') return after === 0 ? Infinity : now / after;
	return now === 0 ? 1 : after / now;
}

/** Whether a bonus aimed at `target` (null: at everything) reaches a part. */
export const reaches = (target: string | null, part: Pick<Part, 'targets'>) =>
	target === null || part.targets.includes(target);

export type PartImpact = { label: string; resource?: string; change: number | null; rel: number };

/** Each part's change under a bonus `x` aimed at `target`, and the sums per resource ('' for none). */
export function impact(effect: Effect, parts: Part[], x: number, target: string | null = null) {
	const each: PartImpact[] = parts
		.filter((p) => reaches(target, p))
		.map((p) => {
			const rel = factor(effect, p.sum, x) - 1;
			return {
				label: p.label,
				resource: p.resource,
				change: p.base === null ? null : p.base * rel,
				rel
			};
		});
	const totals: Record<string, number> = {};
	for (const p of each)
		if (p.change !== null) totals[p.resource ?? ''] = (totals[p.resource ?? ''] ?? 0) + p.change;
	return { each, totals };
}

/** A pile's lines among `sources`: each unconditional modifier `match` takes, × how many hold. */
export function matchLines(
	sources: {
		ref: string;
		name: string;
		modifiers: Pick<Modifier, 'key' | 'value' | 'when'>[];
		count?: number;
	}[],
	match: (key: string) => { target: string | null } | null
): BonusLine[] {
	return sources.flatMap((s) =>
		s.modifiers.flatMap((m) => {
			const t = m.when || m.value === 0 ? null : match(m.key);
			return t
				? [{ ref: s.ref, name: s.name, value: m.value * (s.count ?? 1), target: t.target }]
				: [];
		})
	);
}

/** A part's pile: the lines that reach it, summed. */
export const partSum = (lines: BonusLine[], part: Pick<Part, 'targets'>) =>
	lines.filter((l) => reaches(l.target, part)).reduce((t, l) => t + l.value, 0);

// The sources a player picks or works towards; static modifiers (events, situations, the engine's
// own) are left out — they would crowd the typical values with one-offs.
const CHOICES = [
	'tech',
	'tradition',
	'perk',
	'civic',
	'edict',
	'policy',
	'agenda',
	'ethic',
	'origin',
	'authority',
	'resolution',
	'trait',
	'building',
	'designation'
];

/**
 * The typical values of a pile in the game data: every chosen source's unconditional modifier that
 * `match` takes, grouped by value and target, the `top` most common — those reaching everything
 * first — sorted by target and value. Each
 * names one source that gives it, the earliest kind in `CHOICES` first (a tech before a building).
 */
export function presets(
	explain: Record<string, Pick<Explanation, 'title' | 'modifiers'>>,
	match: (key: string) => { target: string | null } | null,
	top = 6
): Preset[] {
	const by = new Map<string, Preset & { rank: number }>();
	for (const [ref, e] of Object.entries(explain)) {
		const rank = CHOICES.indexOf(ref.slice(0, ref.indexOf(':')));
		if (rank < 0) continue;
		for (const m of e.modifiers) {
			const t = m.when || m.value === 0 ? null : match(m.key);
			if (!t) continue;
			const value = Math.round(m.value * 1e6) / 1e6;
			const k = `${t.target}|${value}`;
			const was = by.get(k);
			if (!was) by.set(k, { value, target: t.target, example: e.title, count: 1, rank });
			else {
				was.count++;
				if (rank < was.rank) Object.assign(was, { example: e.title, rank });
			}
		}
	}
	// the bonuses that reach everything first, then the targeted ones, each by how common
	return [...by.values()]
		.sort(
			(a, b) =>
				Number(a.target !== null) - Number(b.target !== null) ||
				b.count - a.count ||
				Math.abs(b.value) - Math.abs(a.value)
		)
		.slice(0, top)
		.sort((a, b) => (a.target ?? '').localeCompare(b.target ?? '') || a.value - b.value)
		.map(({ value, target, example, count }) => ({ value, target, example, count }));
}

/**
 * The preset to show first: the most common one that helps (`good` 1: a positive bonus, −1: a
 * reduction, as of cost and upkeep), on a tie the smaller; -1 where there is none.
 */
export function defaultPreset(list: Preset[], good: 1 | -1): number {
	let best = -1;
	list.forEach((p, i) => {
		if (Math.sign(p.value) !== good) return;
		const b = list[best];
		if (!b || p.count > b.count || (p.count === b.count && Math.abs(p.value) < Math.abs(b.value)))
			best = i;
	});
	return best;
}

/**
 * What a change of empire size does to a cost that grows with it: +`per` for each point above
 * `base` (EMPIRE_SIZE_TECH_COST_PENALTY and the like), as a share of the cost now.
 */
export function sizeCostChange(size: number, delta: number, base: number, per: number): number {
	const penalty = (n: number) => 1 + Math.max(0, n - base) * per;
	return penalty(size + delta) / penalty(size) - 1;
}

/**
 * A `<category>_<side>_mult` or `<category>_<resource>_<side>_mult` key's category and resource:
 * the longest category it starts with, followed by nothing or a resource; null for any other key
 * (`country_claim_influence_cost_mult` is not the country's "claim_influence").
 */
export function categoryKey(
	k: string,
	side: string,
	cats: Record<string, string | null>,
	resources: Set<string>
): { cat: string; res: string | null } | null {
	const m = new RegExp(`^(\\w+)_${side}_mult$`).exec(k);
	if (!m) return null;
	if (m[1] in cats) return { cat: m[1], res: null };
	const cat = Object.keys(cats)
		.filter((c) => m[1].startsWith(`${c}_`) && resources.has(m[1].slice(c.length + 1)))
		.sort((a, b) => b.length - a.length)[0];
	return cat ? { cat, res: m[1].slice(cat.length + 1) } : null;
}
