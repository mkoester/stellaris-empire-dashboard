import type { Colony, Snapshot } from './types.ts';

// Pop growth per colony, as measured — pure. The game's rule (wiki "Population", 4.5): logistic
// growth 1/400 × (pops − pops² / planet capacity − 1), all species together capped at the galaxy's
// ceiling (5), times the species' growth speed; fastest at half the capacity, slow when the colony
// is small and again near its capacity. Capacity is housing plus room from undeveloped districts
// (more with better habitability) plus what cleared blockers add — the game computes it and the
// save does not hold it, so this shows what feeds it, not the number. Growth here is the save's
// `GROWTH_CAT_GROWTH` (natural growth, pop units), not migration or assembly.

export const GROWTH_CAP = 5; // LOGISTIC_CEILING_DEFAULT; the save's galaxy `logistic_ceiling_v2`
const SAVES = 6; // growth is rolled (fractions are a chance): the mean of the colony's last saves

export type GrowthRow = {
	planetId: number;
	name: string;
	designation: string;
	pops: number;
	growth: number | null; // mean natural growth per month over the last saves
	last: number | null; // the latest save's
	samples: number;
	housing: number | null;
	housingUsed: number | null;
	free: number | null; // districts the planet's limit still allows
	blocked: number | null; // more once its blockers are cleared
	habitability: number | null;
	monthsPer100: number | null; // at the mean growth
	flags: string[];
};

export type Room = { free: number | null; blocked: number | null };

/** Natural growth of one colony in the saves along `history` (newest last), where known. */
export function growthSamples(history: Snapshot[], planetId: number): number[] {
	return history
		.filter((s) => s.kind === 'save')
		.flatMap((s) => {
			const g = s.colonies.find((c) => c.planetId === planetId)?.growth?.by.growth;
			return g === undefined ? [] : [g];
		});
}

/** What stands out about a colony's growth. */
export function growthFlags(c: Colony, growth: number | null, cap = GROWTH_CAP): string[] {
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
	if (growth !== null && growth <= 0) flags.push('not growing');
	return flags;
}

export function growthRows(
	history: Snapshot[],
	latest: Snapshot,
	room: (c: Colony) => Room
): GrowthRow[] {
	return latest.colonies
		.filter((c) => !c.colonizing && c.planetId >= 0)
		.map((c) => {
			const samples = growthSamples(history, c.planetId).slice(-SAVES);
			const growth = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null;
			return {
				planetId: c.planetId,
				name: c.name,
				designation: c.designation,
				pops: c.pops,
				growth,
				last: c.growth?.by.growth ?? null,
				samples: samples.length,
				housing: c.housing,
				housingUsed: c.housingUsed,
				...room(c),
				habitability: c.habitability,
				monthsPer100: growth !== null && growth > 0 ? 100 / growth : null,
				flags: growthFlags(c, growth)
			};
		});
}
