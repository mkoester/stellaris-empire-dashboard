import { error } from '@sveltejs/kit';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { growthData } from '#lib/server/growth.ts';
import { colonyBlockerHints, colonyDetails } from '#lib/server/planets.ts';
import { openJobs } from '#lib/jobs.ts';
import { colonySeries, xExtent } from '#lib/series.ts';
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
	const growth = growthData(snaps);
	return {
		...rest,
		planetId,
		// this colony's growth as measured, for its projection
		growth: {
			rows: growth.rows.filter((r) => r.planetId === planetId),
			date: growth.growthDate,
			defines: growth.defines
		},
		name: named ? colonyAt(named)!.name : `planet ${planetId}`,
		// the dropdown: the colonies at the tip
		colonies: b.latest.colonies
			.filter((c) => c.planetId >= 0)
			.map((c) => ({ planetId: c.planetId, name: c.name })),
		colony: colonyAt(b.latest) ?? null,
		details: colonyDetails(colonyAt(b.latest), b.snaps.findLast((s) => s.kind === 'save') ?? null),
		blockerHints: colonyBlockerHints(
			b.latest.colonies.filter((c) => c.planetId === planetId),
			b.snaps.findLast((s) => s.progress)?.progress?.researched ?? [],
			b.snaps.findLast((s) => s.kind === 'save') ?? null
		),
		jobRows: b.jobs[planetId] ?? [],
		classNames: Object.fromEntries(
			Object.entries(getGameData().planetClasses).map(([k, v]) => [k, v.name])
		),
		explain: pick(
			getExplanations(),
			(b.jobs[planetId] ?? []).map((j) => `job:${j.type}`)
		),
		xExtent: xExtent(snaps),
		charts: {
			pops: colonySeries(snaps, planetId, {
				pops: (c) => c.pops,
				employed: (c) => c.employed,
				civilians: (c) => c.civilians,
				// enforcer posts left to crime automation do not count, as in the colony table
				'open jobs': (c) => openJobs(c).open
			}),
			stability: colonySeries(snaps, planetId, { stability: (c) => c.stability }),
			// last month's change in pops by cause (growth, immigration, emigration, …) and net
			growth: colonySeries(snaps, planetId, {
				net: (c) => c.growth?.net ?? null,
				...Object.fromEntries(
					[
						...new Set(
							snaps.flatMap((s) =>
								s.colonies
									.filter((c) => c.planetId === planetId)
									.flatMap((c) => Object.keys(c.growth?.by ?? {}))
							)
						)
					]
						.sort()
						.map((cause) => [cause, (c: Colony) => c.growth?.by[cause] ?? (c.growth ? 0 : null)])
				)
			}),
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
