import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { colonySeries, xRange } from '#lib/series.ts';

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
		xRange: xRange(snaps),
		charts: {
			pops: colonySeries(snaps, planetId, {
				pops: (c) => c.pops,
				employed: (c) => c.employed,
				civilians: (c) => c.civilians,
				'open jobs': (c) => c.openJobs
			}),
			stability: colonySeries(snaps, planetId, { stability: (c) => c.stability }),
			free: colonySeries(snaps, planetId, {
				'free housing': (c) => c.freeHousing,
				'free amenities': (c) => c.freeAmenities
			}),
			districts: colonySeries(snaps, planetId, { districts: (c) => c.districts })
		}
	};
}
