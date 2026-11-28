import { buildingNeeds, ownSituations } from './buildingWays.ts';
import { forEmpire } from './costs.ts';
import { pretty } from './format.ts';
import { facts } from './government.ts';
import { evaluate, type Trigger } from './triggers.ts';
import type { Explanation, GameData, Resources, Snapshot } from './types.ts';

// The popup cards as this empire sees them. A card built once per data DB (`server/explain.ts`)
// may name what differs by empire: a tech's unlock lines the research card shows only for some
// (`show_tech_unlock_if`, 4.6: the wilderness empire's Chloroplastic Cyst beside the Energy
// Nexus), a building's or starbase module's cost (#lib/costs.ts), and how the empire gets a
// building it cannot build yet (#lib/buildingWays.ts). Pure.

/** A card's parts that depend on the empire, kept beside what it shows. */
export type CardVariants = {
	lines?: { line: string; when: Trigger | null }[]; // `text`'s lines, each with its condition
	costOf?: { source: 'building' | 'module'; key: string }; // the facts' costs come from there
};

/** "800 Minerals, 8 Energy", as the cards list resources. */
export const resourceList = (r: Resources) =>
	Object.entries(r)
		.map(([k, v]) => `${v} ${pretty(k)}`)
		.join(', ');

/** The cost and upkeep facts of a card, as `server/explain.ts` writes them. */
export const costFacts = (c: { cost: Resources; upkeep: Resources }) => [
	...(Object.keys(c.cost).length ? [`costs ${resourceList(c.cost)}`] : []),
	...(Object.keys(c.upkeep).length ? [`upkeep ${resourceList(c.upkeep)} per month`] : [])
];

/**
 * One card for an empire: unlock lines whose condition is false left out (unknown: kept), the
 * cost facts from `costs`. Without variants the card itself.
 */
export function cardFor(
	card: Explanation & CardVariants,
	holds: (t: Trigger | null) => boolean | null,
	costs: GameData['costs'] | null,
	more: string[] = [] // further facts for this empire (how it gets the building)
): Explanation {
	const { lines, costOf, ...shown } = card;
	if (!lines && !costOf) return card;
	const text = lines
		? lines
				.filter((l) => holds(l.when) !== false)
				.map((l) => l.line)
				.join('\n') || null
		: shown.text;
	const own = costOf && costs ? costs[costOf.source][costOf.key] : null;
	const facts = own
		? [
				...costFacts(own),
				...shown.facts.filter((f) => !f.startsWith('costs ') && !f.startsWith('upkeep '))
			]
		: shown.facts;
	return { ...shown, text, facts: [...facts, ...more] };
}

// per card set: the ids with variants, and the result per answer pattern
const index = new WeakMap<object, string[]>();
const memo = new WeakMap<object, Map<string, Record<string, Explanation>>>();

/** Every card as this empire sees them; the same object without a snapshot. */
export function cardsForEmpire(
	all: Record<string, Explanation & CardVariants>,
	data: GameData,
	s: Snapshot | null | undefined
): Record<string, Explanation> {
	if (!s) return all;
	const ids =
		index.get(all) ??
		index
			.set(
				all,
				Object.keys(all).filter((k) => all[k].lines || all[k].costOf)
			)
			.get(all)!;
	if (!ids.length) return all;
	const f = facts(s, data.scriptedTriggers, { shipKinds: data.shipKinds });
	const conditions = new Map<string, Trigger>();
	for (const id of ids)
		for (const l of all[id].lines ?? []) if (l.when) conditions.set(JSON.stringify(l.when), l.when);
	const answers = new Map([...conditions].map(([k, t]) => [k, evaluate(t, f)]));
	const empire = forEmpire(data, s);
	// how the empire gets each building it cannot build yet: flags and traditions change in play
	const how = new Map<string, string>();
	const running = data.buildingPotential ? ownSituations(s, [], data, f) : [];
	for (const id of ids) {
		const { costOf } = all[id];
		const potential = costOf?.source === 'building' ? data.buildingPotential?.[costOf.key] : null;
		const needs = potential ? buildingNeeds(potential, data, f, running) : null;
		if (needs && needs.now !== true && needs.ways.length)
			how.set(id, `comes with ${needs.ways.join(' or ')}`);
	}
	const signature = [...answers.values()].map((a) => (a === null ? 'n' : a ? 't' : 'f')).join('');
	// the costs' own answer pattern is in `empire`'s identity (forEmpire reuses one per pattern)
	const byData = memo.get(all) ?? memo.set(all, new Map()).get(all)!;
	const key = `${signature}|${costKey(empire)}|${[...how].join(';')}`;
	const hit = byData.get(key);
	if (hit) return hit;
	const holds = (t: Trigger | null) => (t ? (answers.get(JSON.stringify(t)) ?? null) : true);
	const out: Record<string, Explanation> = { ...all };
	for (const id of ids) {
		const more = how.get(id);
		out[id] = cardFor(all[id], holds, empire.costs, more ? [more] : []);
	}
	if (byData.size >= 32) byData.clear(); // a long session's past states
	byData.set(key, out);
	return out;
}

// a stable id per costs object, for the memo key
const costIds = new WeakMap<object, number>();
let nextCostId = 0;
const costKey = (d: GameData) =>
	costIds.get(d.costs) ?? costIds.set(d.costs, nextCostId++).get(d.costs)!;
