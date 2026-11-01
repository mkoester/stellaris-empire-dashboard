import { error } from '@sveltejs/kit';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { growthData } from '#lib/server/growth.ts';
import { colonyBlockerHints, colonyDetails } from '#lib/server/planets.ts';
import { openJobs } from '#lib/jobs.ts';
import { colonyDaySeries, colonySeries, xExtent } from '#lib/series.ts';
import type { Colony } from '#lib/types.ts';
import { uncappedStability, wellbeingRules } from '#lib/wellbeing.ts';
import { jobOutput, LUXURY_MODIFIER, luxuryWhatIf } from '#lib/luxuries.ts';
import { heldOf, wellbeingLevers } from '#lib/wellbeingLevers.ts';

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
	const wellbeing = wellbeingRules(
		getGameData().defines,
		(key, mod) => getExplanations()[`modifier:${key}`]?.modifiers.find((m) => m.key === mod)?.value
	);
	const gestalt = (b.latest.government ?? []).some(
		(k) => k === 'auth_machine_intelligence' || k === 'auth_hive_mind'
	);
	// stability as the game sums it before the cap (companion mod 0.8.0), null without the mod
	const uncapped = (c: Colony) =>
		uncappedStability(
			c.stabilityAdd,
			c.stabilityMult,
			c.approval ?? c.happiness,
			gestalt,
			wellbeing
		);
	const colony = colonyAt(b.latest) ?? null;
	const save = b.snaps.findLast((s) => s.kind === 'save') ?? null;
	// what could go to lower happiness or amenities, from the latest save (#lib/wellbeingLevers.ts)
	const saved = save && colonyAt(save);
	const levers =
		save && saved
			? wellbeingLevers(getExplanations(), heldOf(save, saved), gestalt)
			: { happiness: [], amenities: [] };
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
		colonies: b.latest.colonies.map((c) => ({ planetId: c.planetId, name: c.name })),
		colony,
		details: colonyDetails(colonyAt(b.latest), save),
		blockerHints: colonyBlockerHints(
			b.latest.colonies.filter((c) => c.planetId === planetId),
			b.snaps.findLast((s) => s.progress)?.progress?.researched ?? [],
			save
		),
		jobRows: b.jobs[planetId] ?? [],
		// what amenities, happiness and stability do (#lib/wellbeing.ts)
		wellbeing,
		gestalt,
		uncapped: colony ? uncapped(colony) : null,
		levers,
		// "Distribute Luxury Goods": what enacting it now would bring (#lib/luxuries.ts), or until when it runs
		luxuries: colony
			? luxuryWhatIf(
					colony,
					jobOutput(b.jobs[planetId] ?? []),
					uncapped(colony),
					gestalt,
					wellbeing
				)
			: null,
		luxuriesUntil: colony?.planet?.modifiers.find((m) => m.key === LUXURY_MODIFIER)?.until ?? null,
		classNames: Object.fromEntries(
			Object.entries(getGameData().planetClasses).map(([k, v]) => [k, v.name])
		),
		explain: pick(getExplanations(), [
			...(b.jobs[planetId] ?? []).map((j) => `job:${j.type}`),
			...[...levers.happiness, ...levers.amenities].map((l) => l.ref)
		]),
		xExtent: xExtent(snaps),
		charts: {
			// the saves' months, and between them the days the mod logged a change (0.9.0)
			pops: colonyDaySeries(snaps, planetId, named ? colonyAt(named)!.name : '', (c) => ({
				pops: c.pops,
				employed: c.employed,
				civilians: c.civilians,
				// enforcer posts left to crime automation do not count, as in the colony table
				open: openJobs(c).open
			})),
			// above the cap: how far, once the mod has read the colony (the right axis)
			stability: colonySeries(snaps, planetId, {
				stability: (c) => c.stability,
				'over 100': (c) => {
					const u = uncapped(c);
					return u !== null && u > wellbeing.maxStability ? u - wellbeing.maxStability : null;
				}
			}),
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
