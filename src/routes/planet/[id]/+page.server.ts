import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { colonySeries, xRange } from '#lib/series.ts';

// One colony over the branch's history. Months from the mod feed carry no colony data and show
// as gaps; so do months before the planet was colonised.
export function load({ url, params }) {
	const b = branch(url);
	const planetId = Number(params.id);
	const colony = b?.latest.colonies.find((c) => c.planetId === planetId);
	if (!b || !colony) error(404, 'not a colony of yours at this point of the game');
	const { snaps, ...rest } = b;
	return {
		...rest,
		colony,
		xRange: xRange(snaps),
		charts: {
			pops: colonySeries(snaps, planetId, {
				pops: (c) => c.pops,
				employed: (c) => c.employed,
				civilians: (c) => c.civilians
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
