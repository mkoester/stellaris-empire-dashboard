import type { Trigger } from '#lib/triggers.ts';

// What a condition asks the empire to research, for the planner (the user's ask 2026-11-27: a
// chosen ascension perk should bring "what else is needed to finish the ascension"). An ascension
// tree's adoption asks for a tech, and which one depends on the empire: 4.6.1 `tr_cybernetics_adopt`
// wants Integrated Cybernetics on every branch, `tr_synthetics_adopt` Synthetic Workers or, for a
// machine taking Synthetic Age, Robomodding. Pure.

type Possible = (t: Trigger | null) => boolean | null;

const ALWAYS: Trigger = { op: 'and', args: [] };

/**
 * The condition with every tech it asks for counted as researched, and every perk or tradition in
 * `held` (the plan's) as taken: whether the empire could meet it once it has them. What it must
 * *not* have (under a `not`) stays as it is.
 */
export function withTechs(t: Trigger, held: Set<string> = new Set(), negated = false): Trigger {
	if ('leaf' in t) {
		if (negated) return t;
		if (t.leaf === 'has_technology') return ALWAYS;
		if ((t.leaf === 'has_ascension_perk' || t.leaf === 'has_tradition') && held.has(t.value))
			return ALWAYS;
		return t;
	}
	return { ...t, args: t.args.map((a) => withTechs(a, held, t.op === 'not' ? !negated : negated)) };
}

/**
 * The techs a condition asks for, along the branch this empire can take: every one of an `and`,
 * and of an `or` the first alternative it could meet with its techs researched and `held` taken
 * (one it meets then first, else one the save cannot rule out). Techs under a `not` are not asked.
 */
export function techsAsked(
	t: Trigger | null,
	possible: Possible,
	held: Set<string> = new Set()
): string[] {
	if (t === null) return [];
	if ('leaf' in t) return t.leaf === 'has_technology' ? [t.value] : [];
	if (t.op === 'not') return [];
	if (t.op === 'and') return [...new Set(t.args.flatMap((a) => techsAsked(a, possible, held)))];
	const branch =
		t.args.find((a) => possible(withTechs(a, held)) === true) ??
		t.args.find((a) => possible(withTechs(a, held)) !== false);
	return branch ? techsAsked(branch, possible, held) : [];
}

// what a situation's blocks ask for (data DB `situation_block`): the checks an ascension needs met
const NEED_LEAVES = ['has_technology', 'has_tradition', 'owns_building', 'num_buildings'];
// the situation's own state: whether a block applies to this empire does not hang on it
const SITUATION_LEAVES = [
	'current_stage',
	'situation_progress',
	'has_situation_flag',
	'has_country_flag',
	'current_situation_approach'
];

export type Needs = { techs: string[]; traditions: string[]; buildings: string[] };

/**
 * What a situation's block asks of the empire: a tech, tradition or building (a colony's,
 * `owns_building`) it stops without — under a `not` —, and a building it has fewer than one of
 * (`num_buildings < 1`). Null when the block cannot apply to this empire: what is left of it once
 * the asked things and the situation's own state count as met is false (the Augmentation Bazaar
 * variant without that civic).
 */
export function blockNeeds(t: Trigger, possible: Possible): Needs | null {
	// each asked or situation leaf as what makes the block hold: true, or false under a `not`
	const neutral = (x: Trigger, negated = false): Trigger =>
		'leaf' in x
			? NEED_LEAVES.includes(x.leaf) || SITUATION_LEAVES.includes(x.leaf)
				? { op: negated ? 'or' : 'and', args: [] }
				: x
			: { ...x, args: x.args.map((a) => neutral(a, x.op === 'not' ? !negated : negated)) };
	if (possible(neutral(t)) === false) return null;
	const out: Needs = { techs: [], traditions: [], buildings: [] };
	const add = (list: string[], v: string) => {
		if (!list.includes(v)) list.push(v);
	};
	const walk = (x: Trigger, negated: boolean) => {
		if (!('leaf' in x)) return x.args.forEach((a) => walk(a, x.op === 'not' ? !negated : negated));
		if (negated && x.leaf === 'has_technology') add(out.techs, x.value);
		if (negated && x.leaf === 'has_tradition') add(out.traditions, x.value);
		if (negated && x.leaf === 'owns_building') add(out.buildings, x.value);
		const b = (x as { building?: string }).building;
		if (!negated && x.leaf === 'num_buildings' && b && x.cmp === '<' && x.value === '1')
			add(out.buildings, b);
	};
	walk(t, false);
	return out;
}
