import { error } from '@sveltejs/kit';
import { getExplanations } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { openJobs } from '#lib/jobs.ts';
import { colonySeries, xRange } from '#lib/series.ts';
import type { Colony } from '#lib/types.ts';

const pct = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 10);

// One colony over the branch's history. Months from the mod feed carry no colony data and show
// as gaps; so do months before the planet was colonised.
export function load({ url, params }) {
	const b = branch(url);
	const planetId = Number(params.id);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	// Not 404 when the planet is not (yet) a colony on this branch: the page keeps following the
	// empire pane and shows whatever history there is.
	const colonyAt = (s: (typeof snaps)[number]) => s.colonies.find((c) => c.planetId === planetId);
	const named = snaps.findLast(colonyAt);
	return {
		...rest,
		planetId,
		name: named ? colonyAt(named)!.name : `planet ${planetId}`,
		colony: colonyAt(b.latest) ?? null,
		jobRows: b.jobs[planetId] ?? [],
		explain: pick(
			getExplanations(),
			(b.jobs[planetId] ?? []).map((j) => `job:${j.type}`)
		),
		xRange: xRange(snaps),
		charts: {
			pops: colonySeries(snaps, planetId, {
				pops: (c) => c.pops,
				employed: (c) => c.employed,
				civilians: (c) => c.civilians,
				// enforcer posts left to crime automation do not count, as in the colony table
				'open jobs': (c) => openJobs(c).open
			}),
			stability: colonySeries(snaps, planetId, { stability: (c) => c.stability }),
			// Happiness in %, overall and per stratum; a stratum the save gives none for is a gap.
			happiness: colonySeries(snaps, planetId, {
				happiness: (c) => pct(c.happiness),
				...Object.fromEntries(
					['ruler', 'specialist', 'worker', 'civilian'].map((cat) => [
						cat,
						(c: Colony) => pct(c.strata?.find((s) => s.category === cat)?.happiness ?? null)
					])
				)
			}),
			free: colonySeries(snaps, planetId, {
				'free housing': (c) => c.freeHousing,
				'free amenities': (c) => c.freeAmenities
			}),
			districts: colonySeries(snaps, planetId, { districts: (c) => c.districts })
		}
	};
}
