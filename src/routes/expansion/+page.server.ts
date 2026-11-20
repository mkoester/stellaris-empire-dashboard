import { error } from '@sveltejs/kit';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { expansionOf, expansionRows, habitatData, speciesChoices } from '#lib/server/expansion.ts';
import { display, setting } from '#lib/server/settings.ts';
import { arkshipsOf, campaignGalaxy } from '#lib/server/mapSystems.ts';
import { settleState } from '#lib/server/settle.ts';
import { ROW_LINES } from '#lib/profiles.ts';
import { settleOutcome, settleTargets } from '#lib/settle.ts';
import { getExplanations } from '#lib/server/app.ts';
import { pick } from '#lib/server/explain.ts';
import { planSummary } from '#lib/server/planner.ts';
import { territoriesOf, reveal } from '#lib/server/mapSystems.ts';
import { valuesOf } from '#lib/server/unitCosts.ts';
import { waylinesOf } from '#lib/server/waylines.ts';
import { ownOnMap } from '#lib/mapLayers.ts';
import { mapView } from '#lib/situations.ts';

// Where to expand next: surveyed planets nobody owns, within a chosen range of the borders. A nomad
// roams instead — the tab is "roaming" then: its waylines (where to put waystations, which
// modules, whose space), and settling down (what it needs, where, what happens); a settled
// empire may embark.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	// the latest full save that read the candidates (the mod's lines carry none)
	const s = b.snaps.findLast((x) => x.expansion !== null);
	const species = speciesChoices(b.snaps.findLast((x) => x.species !== null)?.species ?? []);
	const planets = expansionRows(expansionOf(b.snaps), species);
	const settle = settleState(b.snaps);
	const save = b.snaps.findLast((x) => x.kind === 'save');
	const shownSpecies = setting('expansionView').species ?? species[0]?.id ?? null;
	const arkships = arkshipsOf(b.snaps);
	const waylines =
		settle?.mode === 'settle' && save
			? waylinesOf(
					save,
					planSummary(b.tip).keys,
					arkships.flatMap((a) => (a.systemId === null ? [] : [a.systemId])),
					valuesOf(b.snaps)
				)
			: null;
	const g = waylines && save ? campaignGalaxy(save.campaign) : null;
	return {
		// the node shown: the "+ goal", "+ wayline" and ✕ buttons plan at it
		tip: b.tip,
		waylines,
		// the map beside the waylines: as the map tab shows it
		...(waylines && {
			map: {
				systems: mapView(g?.systems ?? [], reveal()),
				territories: territoriesOf(b.snaps),
				own: ownOnMap(b.latest),
				arkships
			},
			explain: pick(
				getExplanations(),
				[
					...waylines.sites.flatMap((s) => s.byTier.flatMap((t) => t.best.map((p) => p.key))),
					...waylines.stations.flatMap((s) => [...s.modules, ...s.next.map((p) => p.key)]),
					...waylines.waylines.flatMap((l) => l.modules.map((m) => m.key))
				].map((k) => `module:${k}`)
			)
		}),
		planets,
		settle: settle && {
			...settle,
			species: shownSpecies,
			...(settle.mode === 'settle' && save
				? {
						targets: settleTargets(
							planets,
							campaignGalaxy(save.campaign)?.systems ?? [],
							arkships,
							shownSpecies
						),
						outcome: settleOutcome(save)
					}
				: {})
		},
		species: species.map(({ id, name }) => ({ id, name })),
		canDetox: b.snaps.findLast((x) => x.canDetox !== null)?.canDetox ?? false,
		habitats: habitatData(b.snaps),
		rowLine: ROW_LINES[display().expansionRowLine],
		date: s?.date ?? b.latest.date,
		isHead: b.isHead,
		view: setting('expansionView'),
		defines: {
			HABITABILITY_WRONG_PLANET: getGameData().defines.HABITABILITY_WRONG_PLANET,
			HABITABILITY_OPPOSITE_PLANET: getGameData().defines.HABITABILITY_OPPOSITE_PLANET
		}
	};
}
