import { automationSummary } from '#lib/automation.ts';
import { profile } from '#lib/colonyProfile.ts';
import { problems, type ColonyRow } from '#lib/colonyTable.ts';
import { net } from '#lib/flows.ts';
import { pretty } from '#lib/format.ts';
import { estimate } from '#lib/habitability.ts';
import { climateOf } from '#lib/climate.ts';
import { speciesChoices } from './expansion.ts';
import { getExplanations, getGameData } from './app.ts';
import type { branch } from './branch.ts';
import { pick } from './explain.ts';
import { colonyBlockerHints, colonyDetails } from './planets.ts';

/**
 * The colonies tab's rows at the branch tip, with what naming and explaining them needs: display
 * names (districts, blockers, features, techs), district colours and the popups of every pro and
 * con.
 */
export function colonyRows(b: NonNullable<ReturnType<typeof branch>>) {
	const data = getGameData();
	const explain = getExplanations();
	const colonies = b.latest.colonies.filter((c) => c.planetId >= 0);
	const species = speciesChoices(b.snaps.findLast((s) => s.species !== null)?.species ?? []);
	const save = b.snaps.findLast((s) => s.kind === 'save') ?? null;
	const hints = colonyBlockerHints(
		colonies,
		b.snaps.findLast((s) => s.progress)?.progress?.researched ?? [],
		save
	);
	const details = new Map(colonies.map((c) => [c.planetId, colonyDetails(c, save)]));
	const names = {
		...b.names,
		...hints.names,
		...Object.assign({}, ...[...details.values()].map((d) => d?.names ?? {}))
	};
	const rows: ColonyRow[] = colonies.map((c) => {
		const caps = details.get(c.planetId)?.caps ?? null;
		const own = hints.hints.filter((h) => h.planetId === c.planetId);
		const refs = [
			...(c.planet?.deposits ?? []).map((d) => `deposit:${d.key}`),
			...(c.planet?.modifiers ?? []).map((m) => `modifier:${m.key}`)
		];
		const capOf = (type: string) => caps?.types.find((t) => t.district === type)?.cap ?? null;
		return {
			planetId: c.planetId,
			name: c.name,
			sector: c.sector,
			designation: c.designation,
			colonizing: c.colonizing,
			planetClass: data.planetClasses[c.planetClass]?.name ?? pretty(c.planetClass),
			climate: climateOf(c.planetClass, data.planetClasses),
			size: c.planetSize,
			pops: c.pops,
			growth: c.growth?.net ?? null,
			stability: c.stability,
			happiness: c.happiness,
			habitability: c.habitability,
			hab: Object.fromEntries(
				species.map((s) => [
					s.id,
					s.id in c.speciesHabitability
						? { value: c.speciesHabitability[s.id], exact: true }
						: { value: estimate(c.planetClass, s.traits, c.planet, data), exact: false }
				])
			),
			freeHousing: c.freeHousing,
			freeAmenities: c.freeAmenities,
			civilians: c.civilians,
			openJobs: c.openJobs,
			net: net(c.produces, c.upkeep),
			// every type built or allowed, as the game's district boxes
			districts: [
				...new Set([
					...c.districtList.map((d) => d.type),
					...(caps?.types.filter((t) => t.cap).map((t) => t.district) ?? [])
				])
			].map((type) => ({
				type,
				built: c.districtList.find((d) => d.type === type)?.built ?? 0,
				cap: capOf(type)
			})),
			room: caps && caps.limit !== null ? caps.limit - caps.built : null,
			blockers: own.length,
			queue: c.buildQueue,
			automation: c.automation.enabled ? automationSummary(c.automation.settings) : 'off',
			profile: profile({ colony: c, caps, hints: own, explain: pick(explain, refs), names }),
			problems: problems(c)
		};
	});
	const refs = rows.flatMap((r) =>
		[...r.profile.pros, ...r.profile.cons].flatMap((t) => (t.ref ? [t.ref] : []))
	);
	return {
		rows,
		names,
		colors: pick(data.districtColors, [
			...rows.flatMap((r) => r.districts.map((d) => d.type)),
			...rows.flatMap((r) => r.queue.map((q) => q.name))
		]),
		explain: pick(explain, refs),
		species: species.map(({ id, name }) => ({ id, name })),
		// the game's habitability colours
		defines: {
			HABITABILITY_WRONG_PLANET: data.defines.HABITABILITY_WRONG_PLANET,
			HABITABILITY_OPPOSITE_PLANET: data.defines.HABITABILITY_OPPOSITE_PLANET
		}
	};
}
