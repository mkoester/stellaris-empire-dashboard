import { evaluate, type Facts, type Trigger } from './triggers.ts';
import type { Resources } from './types.ts';

// Planet decisions (data DB `decision`, extractor 2026-11-02) on one colony — pure: whether the
// colony may take one, what it costs there, and which modifiers it adds or removes. Their
// conditions are in planet scope (`owner = { … }` is unwrapped to the country's by the
// extractor): the planet's own leaves are answered here, the country's by #lib/triggers.ts,
// the rest stays unknown.

export type PlanetDecision = {
	key: string;
	name: string;
	costs: { when: Trigger | null; cost: Resources }[];
	potential: Trigger | null;
	allow: Trigger | null;
	adds: { modifier: string; days: number }[];
	removes: string[];
};

/** What the save tells about the planet, for the leaves a decision's conditions ask. */
export type PlanetFacts = {
	modifiers: string[]; // the planet's modifiers (keys)
	designation: string;
	planetClass: string;
	pops: number;
	capital: boolean;
};

const CMP: Record<string, (a: number, b: number) => boolean> = {
	'<': (a, b) => a < b,
	'<=': (a, b) => a <= b,
	'>': (a, b) => a > b,
	'>=': (a, b) => a >= b,
	'=': (a, b) => a === b
};

const known = (v: boolean | null): Trigger | null =>
	v === null ? null : { leaf: 'always', value: v ? 'yes' : 'no' };

/** The planet's leaves answered (as `always`), every other node kept for #lib/triggers.ts. */
export function planetTrigger(t: Trigger | null, p: PlanetFacts): Trigger | null {
	if (t === null) return null;
	if (!('leaf' in t)) return { op: t.op, args: t.args.map((a) => planetTrigger(a, p) ?? a) };
	const yes = (v: boolean) => (t.value === 'no' ? !v : v);
	let v: boolean | null = null;
	switch (t.leaf) {
		case 'has_modifier':
			v = p.modifiers.includes(t.value);
			break;
		case 'has_designation':
			v = p.designation === t.value;
			break;
		case 'is_planet_class':
			v = p.planetClass === t.value;
			break;
		case 'is_capital':
			v = yes(p.capital);
			break;
		case 'pop_amount':
			v = t.cmp && CMP[t.cmp] ? CMP[t.cmp](p.pops, Number(t.value)) : null;
			break;
	}
	return known(v) ?? t;
}

/** Whether the colony may take it: potential and allow, three-valued. */
export function decisionPossible(d: PlanetDecision, p: PlanetFacts, f: Facts): boolean | null {
	const vals = [d.potential, d.allow].map((t) => evaluate(planetTrigger(t, p), f));
	return vals.includes(false) ? false : vals.includes(null) ? null : true;
}

/** Its cost on this colony: the first tier that holds, or null where none can be told. */
export function decisionCost(d: PlanetDecision, p: PlanetFacts, f: Facts): Resources | null {
	for (const tier of d.costs) {
		const v = evaluate(planetTrigger(tier.when, p), f);
		if (v === true) return tier.cost;
		if (v === null) return null;
	}
	return d.costs.length ? null : {};
}

/**
 * The modifiers taking it would change on the planet, summed: each added static modifier's
 * (`modifiersOf`), and each removed one the planet has, negated.
 */
export function decisionModifiers(
	d: PlanetDecision,
	p: PlanetFacts,
	modifiersOf: (key: string) => Record<string, number>
): Record<string, number> {
	const out: Record<string, number> = {};
	const add = (key: string, sign: number) => {
		for (const [k, v] of Object.entries(modifiersOf(key))) out[k] = (out[k] ?? 0) + v * sign;
	};
	for (const a of d.adds) add(a.modifier, 1);
	for (const r of d.removes) if (p.modifiers.includes(r)) add(r, -1);
	return out;
}
