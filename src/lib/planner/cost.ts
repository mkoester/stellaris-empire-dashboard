import { stagePrefix } from '#lib/megastructures.ts';
import type { GalaxySystem, GameData, MegaStage, Resources, Snapshot } from '#lib/types.ts';
import { arkships, STATION_LEVELS } from './kinds.ts';

// What a planned goal still costs to build, from the data DB's base costs (before modifiers, so
// always ≈) and its base build days. Pure.

export type CostData = Pick<GameData, 'costs' | 'buildDays' | 'megastructures'>;
export type CostWorld = {
	latest: Snapshot;
	galaxy: GalaxySystem[] | null;
	data: CostData;
	bio: boolean | null; // `country_uses_bio_ships`; null: unknown, read as a regular empire
};
/** What is left to pay, and the days its builds take one after another (null: some unknown). */
export type GoalCost = { cost: Resources; days: number | null };

type Step = { cost: Resources | null; days: number | null };

export const addResources = (a: Resources, b: Resources, times = 1): Resources => {
	const out = { ...a };
	for (const [r, v] of Object.entries(b)) out[r] = (out[r] ?? 0) + v * times;
	return out;
};

const stageCost = (stage: MegaStage | undefined, bio: boolean | null): Resources | null =>
	stage
		? addResources(stage.cost.any ?? {}, (bio ? stage.cost.bio : stage.cost.regular) ?? {})
		: null;

/**
 * A structure's stages in build order, along `upgrade_from`: the numbered ones only
 * (`dyson_sphere_0` … `_5`, `ring_world_1` → `ring_world_2_intermediate` → `ring_world_2` …), not
 * ruins, restorations or the Dyson Sphere's disco variant.
 */
export function stageChain(prefix: string, mega: Record<string, MegaStage>): string[] {
	const own = (k: string) => k.startsWith(`${prefix}_`) && /^\d/.test(k.slice(prefix.length + 1));
	const keys = Object.keys(mega).filter(own).sort();
	const chain: string[] = [];
	for (
		let at = keys.find((k) => !mega[k].from.some(own));
		at && !chain.includes(at);
		at = keys.find((k) => mega[k].from.includes(at!))
	)
		chain.push(at);
	return chain;
}

const repeat = (step: Step, times: number): Step[] =>
	Array.from({ length: Math.max(0, times) }, () => step);

/** The builds a goal still needs; null when its kind has no cost or the target is unknown. */
function steps(kind: string, t: Record<string, unknown>, w: CostWorld): Step[] | null {
	const { costs, buildDays: days, megastructures } = w.data;
	const of = (table: Record<string, { cost: Resources }>, key: string): Step => ({
		cost: Object.hasOwn(table, key) ? table[key].cost : null,
		days: days[key] ?? null
	});
	const mega = (key: string): Step => ({
		cost: stageCost(megastructures[key], w.bio),
		days: days[key] ?? null
	});
	const s = (k: string) => String(t[k] ?? '');
	const n = (k: string) => Number(t[k]);
	switch (kind) {
		case 'arkship':
			return repeat(
				mega(`${s('type')}_arkship_megastructure`),
				n('count') - arkships(w.latest, s('type'))
			);
		case 'waystation':
			return [mega('waystation_megastructure')];
		case 'megastructure': {
			const chain = stageChain(stagePrefix(s('structure')), megastructures);
			const there = w.galaxy?.find((x) => x.id === n('system'))?.megastructures ?? [];
			const done = Math.max(...there.map((m) => chain.indexOf(m)), -1);
			return chain.length ? chain.slice(done + 1).map(mega) : null;
		}
		case 'outpost':
			return [of(costs.ship, 'starbase_outpost')];
		case 'station_level': {
			const st = w.latest.stations?.find((x) => x.systemId === n('system'));
			const have = st ? STATION_LEVELS.indexOf(st.level.replace(/\s/g, '')) : 0;
			const want = STATION_LEVELS.indexOf(s('level'));
			if (want < 0) return null;
			return STATION_LEVELS.slice(have + 1, want + 1).map((l) => of(costs.ship, `starbase_${l}`));
		}
		case 'station_module':
			return [of(costs.module, s('module'))];
		case 'station_building':
			return [of(costs.starbaseBuilding, s('building'))];
		case 'district': {
			const col = w.latest.colonies.find((x) => x.planetId === n('planet'));
			const built = col?.districtList.find((d) => d.type === s('district'))?.built ?? 0;
			return repeat(of(costs.district, s('district')), n('count') - built);
		}
		case 'building':
			return [of(costs.building, s('building'))];
		default:
			return null;
	}
}

/** What a goal still costs and how long its builds take; null when unknown or nothing is left. */
export function goalCost(
	kind: string,
	target: Record<string, unknown>,
	w: CostWorld
): GoalCost | null {
	const list = steps(kind, target, w);
	if (!list?.length || list.some((x) => x.cost === null)) return null;
	return {
		cost: list.reduce((a, x) => addResources(a, x.cost!), {} as Resources),
		days: list.some((x) => x.days === null) ? null : list.reduce((a, x) => a + x.days!, 0)
	};
}
