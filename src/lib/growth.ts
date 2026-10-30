import type { Colony, Snapshot } from './types.ts';

// Pop growth per colony, as measured — pure. The game's rule (wiki "Population", 4.5): logistic
// growth 1/400 × (pops − pops² / planet capacity − 1), all species together capped at the galaxy's
// ceiling (5), times the species' growth speed; fastest at half the capacity, slow when the colony
// is small and again near its capacity. Capacity, which the save does not hold: housing + 400 per
// free district slot, queued districts counting as taken (matched to the game's "Colony Capacity"
// over five readings, Planetforgers 2212.03–06; species habitability and housing usage do not
// enter). Growth here is the save's `GROWTH_CAT_GROWTH` (natural growth, pop units); assembly
// (`GROWTH_CAT_ASSEMBLY`: a machine empire's Replicators, robot assembly) is its own column — a
// machine world has no natural growth at all (Yorphia 2201.10: assembly +4, as the game's "Monthly
// Pop Summary"); migration is not here.

export const GROWTH_CAP = 5; // LOGISTIC_CEILING_DEFAULT; the save's galaxy `logistic_ceiling_v2`
const SAVES = 6;
/**
 * Capacity per free district slot on a normal planet (volcanic and arid matched). Players measured
 * other values in 3.0 (×100 since 4.0): habitats 300, Gaia worlds ~600, tomb worlds ~200 —
 * unconfirmed, so habitats get no capacity here.
 */
export const CAPACITY_PER_FREE_DISTRICT = 400; // growth is rolled (fractions are a chance): the mean of the colony's last saves

export type GrowthRow = {
	planetId: number;
	name: string;
	designation: string;
	pops: number;
	growth: number | null; // mean natural growth per month over the last saves
	assembly: number | null; // mean pops assembled per month over the last saves; null: none seen
	last: number | null; // the latest save's
	samples: number;
	housing: number | null;
	housingUsed: number | null;
	free: number | null; // districts the planet's limit still allows, queued ones taken
	blocked: number | null; // more once its blockers are cleared
	queued: number; // districts in the build queue: their room is gone already
	capacity: number | null; // the game's planet capacity
	habitability: number | null;
	monthsPer100: number | null; // at the mean growth
	flags: string[];
};

export type Room = { free: number | null; blocked: number | null };

/** Districts in a colony's build queue. */
export const queuedDistricts = (c: Colony) =>
	c.buildQueue.filter((q) => q.kind === 'district').length;

/** Planet capacity: housing plus each free district slot's room; null where either is unknown. */
export const planetCapacity = (housing: number | null, free: number | null) =>
	housing === null || free === null ? null : housing + CAPACITY_PER_FREE_DISTRICT * free;

/** One growth cause of a colony in the saves along `history` (newest last), where the save has it. */
export function growthSamples(
	history: Snapshot[],
	planetId: number,
	cause: 'growth' | 'assembly' = 'growth'
): number[] {
	return history
		.filter((s) => s.kind === 'save')
		.flatMap((s) => {
			const g = s.colonies.find((c) => c.planetId === planetId)?.growth?.by[cause];
			return g === undefined ? [] : [g];
		});
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** What stands out about a colony's growth. */
export function growthFlags(
	c: Colony,
	growth: number | null,
	cap = GROWTH_CAP,
	assembly: number | null = null
): string[] {
	const flags: string[] = [];
	if (growth !== null && growth >= cap - 0.25) flags.push(`at the cap (${cap})`);
	if (c.housing !== null && c.housingUsed !== null && c.housingUsed > c.housing)
		flags.push(
			c.housingUsed / c.housing >= 1.15
				? 'overcrowded: growth stops (1.15 × housing)'
				: 'overcrowded'
		);
	if (c.habitability !== null && c.habitability < 1)
		flags.push(`habitability ${Math.round(c.habitability * 100)} %: slower growth`);
	if ((growth !== null || assembly !== null) && (growth ?? 0) + (assembly ?? 0) <= 0)
		flags.push('not growing');
	const queued = queuedDistricts(c);
	if (queued)
		flags.push(
			`${queued} queued district${queued > 1 ? 's' : ''}: −${queued * CAPACITY_PER_FREE_DISTRICT} capacity now`
		);
	return flags;
}

export function growthRows(
	history: Snapshot[],
	latest: Snapshot,
	room: (c: Colony) => Room
): GrowthRow[] {
	return latest.colonies
		.filter((c) => !c.colonizing)
		.map((c) => {
			const samples = growthSamples(history, c.planetId).slice(-SAVES);
			const growth = mean(samples);
			const assembly = mean(growthSamples(history, c.planetId, 'assembly').slice(-SAVES));
			const total = (growth ?? 0) + (assembly ?? 0);
			const r = room(c);
			return {
				planetId: c.planetId,
				name: c.name,
				designation: c.designation,
				pops: c.pops,
				growth,
				assembly,
				last: c.growth?.by.growth ?? null,
				samples: samples.length,
				housing: c.housing,
				housingUsed: c.housingUsed,
				...r,
				queued: queuedDistricts(c),
				capacity: planetCapacity(c.housing, r.free),
				habitability: c.habitability,
				monthsPer100: total > 0 ? 100 / total : null, // growth and assembly together
				flags: growthFlags(c, growth, GROWTH_CAP, assembly)
			};
		});
}
