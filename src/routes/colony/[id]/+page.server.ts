import { error } from '@sveltejs/kit';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { growthData } from '#lib/server/growth.ts';
import { display, popWindow } from '#lib/server/settings.ts';
import { colonyAutomation, colonyWhatIfs } from '#lib/server/whatIfs.ts';
import { colonyBlockerHints, colonyDetails } from '#lib/server/planets.ts';
import { openJobs } from '#lib/jobs.ts';
import { colonyDaySeries, colonyPopSeries, colonySeries, xExtent } from '#lib/series.ts';
import type { Colony } from '#lib/types.ts';
import { uncappedStability, wellbeingRules } from '#lib/wellbeing.ts';
import { jobOutput, LUXURY_MODIFIER, luxuryWhatIf } from '#lib/luxuries.ts';
import { heldOf, wellbeingLevers } from '#lib/wellbeingLevers.ts';
import { colonyLogistics } from '#lib/server/logistics.ts';
import { colonySpecies, enslavedPops, slaveryKeys } from '#lib/colonySpecies.ts';

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
	const rights = getGameData().speciesRights;
	const slavery = slaveryKeys(rights);
	const { whatIfs } = display();
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
		// who lives here: pops per species and their citizenship, from the latest save
		species: save && saved ? colonySpecies(saved, save, rights) : [],
		blockerHints: colonyBlockerHints(
			b.latest.colonies.filter((c) => c.planetId === planetId),
			b.snaps.findLast((s) => s.progress)?.progress?.researched ?? [],
			save
		),
		jobRows: b.jobs[planetId] ?? [],
		// what its deficits cost and whether making it here would be cheaper (#lib/colonyLogistics.ts)
		logistics: colony ? colonyLogistics(b, colony) : null,
		// what amenities, happiness and stability do (#lib/wellbeing.ts)
		wellbeing,
		gestalt,
		uncapped: colony ? uncapped(colony) : null,
		levers,
		// "Distribute Luxury Goods": what enacting it now would bring (#lib/luxuries.ts), or until when it runs
		// the what-ifs (⚙, a spoiler): designations and planet decisions on this colony
		whatIfs: colony && whatIfs ? colonyWhatIfs(b, colony) : null,
		// …and district automation: the next automation building per job line (#lib/jobAutomation.ts)
		automation: colony && whatIfs ? colonyAutomation(b, colony) : null,
		luxuries:
			colony && whatIfs
				? luxuryWhatIf(
						colony,
						jobOutput(b.jobs[planetId] ?? []),
						uncapped(colony),
						gestalt,
						wellbeing
					)
				: null,
		luxuriesUntil: colony?.planet?.modifiers.find((m) => m.key === LUXURY_MODIFIER)?.until ?? null,
		// each building's data DB category, for its icon (#lib/icons/icons.ts)
		buildingCategories: Object.fromEntries(
			(colony?.districtList ?? [])
				.flatMap((d) => d.zones.flatMap((z) => z.buildings))
				.map((b) => [b, getGameData().buildingCategory[b] ?? null])
		),
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
			pops: colonyDaySeries(snaps, planetId, named ? colonyAt(named)!.name : '', (c, s) => ({
				pops: c.pops,
				employed: c.employed,
				civilians: c.civilians,
				// enslaved pops work ordinary jobs: part of employed or civilians (#lib/colonySpecies.ts)
				enslaved: enslavedPops(c, s, slavery),
				// enforcer posts left to crime automation do not count, as in the colony table
				open: openJobs(c).open
			})),
			// as the all tab's Pops chart: pops and their monthly change by cause
			popChange: colonyPopSeries(snaps, planetId, popWindow()),
			// above the cap: how far, once the mod has read the colony (the right axis)
			stability: colonySeries(snaps, planetId, {
				stability: (c) => c.stability,
				'over 100': (c) => {
					const u = uncapped(c);
					// 0 at or under the cap; unknown (null) without the mod's reading
					return u === null ? null : Math.max(0, u - wellbeing.maxStability);
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
