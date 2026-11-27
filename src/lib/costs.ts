import { facts } from './government.ts';
import { evaluate, type Trigger } from './triggers.ts';
import type { Costs, GameData, Resources, Snapshot } from './types.ts';

// What a building, district, ship size or starbase part costs this empire. The data DB's
// `*_resource` rows are the regular empire's; `resource_variant` (extractor 2026-11-27) holds
// every block of a kind that has a triggered one, and the game sums the blocks whose trigger
// holds (4.6 `buildings/nomadic_cost_switcher`: 800 minerals, or 80 rare crystals for a nomad;
// bio ships, wilderness, megacorp surcharges). Pure.

export type CostSource = 'district' | 'ship' | 'building' | 'module' | 'starbaseBuilding';
export type CostKind = keyof Costs;
export type CostVariant = {
	kind: CostKind;
	block: number; // the kind's blocks in file order
	resource: string;
	amount: number;
	when: Trigger | null; // null: always
};
export type CostVariants = Partial<Record<CostSource, Record<string, CostVariant[]>>>;

/** The data DB table each source's variants come from (`resource_variant.source`). */
export const VARIANT_SOURCES: Record<string, CostSource> = {
	building_resource: 'building',
	district_resource: 'district',
	ship_size_resource: 'ship',
	starbase_module_resource: 'module',
	starbase_building_resource: 'starbaseBuilding'
};

/**
 * One definition's costs for an empire: per kind with variants, the sum of the blocks whose
 * condition holds; a kind where any condition cannot be told (a planet's deposit) keeps the
 * regular empire's row.
 */
export function resolveCosts(
	base: Costs | undefined,
	variants: CostVariant[],
	holds: (t: Trigger | null) => boolean | null
): Costs {
	const out: Costs = { cost: {}, upkeep: {}, produces: {}, ...base };
	for (const kind of ['cost', 'upkeep', 'produces'] as const) {
		const mine = variants.filter((v) => v.kind === kind);
		if (!mine.length) continue;
		const blocks = new Map<number, CostVariant[]>();
		for (const v of mine) blocks.set(v.block, [...(blocks.get(v.block) ?? []), v]);
		const taken = [...blocks.values()].map((b) => holds(b[0].when));
		if (taken.includes(null)) continue;
		const sum: Resources = {};
		[...blocks.values()].forEach((b, i) => {
			if (taken[i]) for (const v of b) sum[v.resource] = (sum[v.resource] ?? 0) + v.amount;
		});
		out[kind] = sum;
	}
	return out;
}

/** Every source's costs for an empire; untouched where a definition has no variants. */
export function empireCosts(
	costs: GameData['costs'],
	variants: CostVariants,
	holds: (t: Trigger | null) => boolean | null
): GameData['costs'] {
	const out = { ...costs };
	for (const [source, byKey] of Object.entries(variants) as [
		CostSource,
		Record<string, CostVariant[]>
	][]) {
		const table = { ...costs[source] };
		for (const [key, list] of Object.entries(byKey))
			table[key] = resolveCosts(costs[source][key], list, holds);
		out[source] = table;
	}
	return out;
}

// per data DB: the costs per answer pattern of the distinct conditions (few empires differ)
const memo = new WeakMap<GameData, Map<string, GameData>>();

/**
 * The game data with this empire's costs. Same object back when the data DB has no variants (an
 * older extractor's) or no snapshot is given.
 */
export function forEmpire<T extends GameData>(data: T, s: Snapshot | null | undefined): T {
	const variants = data.costVariants;
	if (!s || !variants || !Object.keys(variants).length) return data;
	const f = facts(s, data.scriptedTriggers, { shipKinds: data.shipKinds });
	const conditions = new Map<string, Trigger>();
	for (const byKey of Object.values(variants))
		for (const list of Object.values(byKey))
			for (const v of list) if (v.when) conditions.set(JSON.stringify(v.when), v.when);
	const answers = new Map([...conditions].map(([k, t]) => [k, evaluate(t, f)]));
	const signature = [...answers.values()].map((a) => (a === null ? 'n' : a ? 't' : 'f')).join('');
	const cache = memo.get(data) ?? memo.set(data, new Map()).get(data)!;
	const hit = cache.get(signature);
	if (hit) return hit as T;
	const holds = (t: Trigger | null) => (t ? (answers.get(JSON.stringify(t)) ?? null) : true);
	const out = { ...data, costs: empireCosts(data.costs, variants, holds) };
	if (cache.size >= 32) cache.clear();
	cache.set(signature, out);
	return out;
}
