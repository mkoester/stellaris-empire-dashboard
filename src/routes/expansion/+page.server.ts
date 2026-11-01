import { error } from '@sveltejs/kit';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { expansionOf, expansionRows, habitatData, speciesChoices } from '#lib/server/expansion.ts';
import { display, expansionView } from '#lib/server/settings.ts';
import { arkshipsOf, campaignGalaxy } from '#lib/server/mapSystems.ts';
import { settleState } from '#lib/server/settle.ts';
import { ROW_LINES } from '#lib/profiles.ts';
import { settleOutcome, settleTargets } from '#lib/settle.ts';

// Where to expand next: surveyed planets nobody owns, within a chosen range of the borders. A nomad
// settles instead (above them: what it needs, where, what happens); a settled empire may embark.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	// the latest full save that read the candidates (the mod's lines carry none)
	const s = b.snaps.findLast((x) => x.expansion !== null);
	const species = speciesChoices(b.snaps.findLast((x) => x.species !== null)?.species ?? []);
	const planets = expansionRows(expansionOf(b.snaps), species);
	const settle = settleState(b.snaps);
	const save = b.snaps.findLast((x) => x.kind === 'save');
	const shownSpecies = expansionView().species ?? species[0]?.id ?? null;
	return {
		planets,
		settle: settle && {
			...settle,
			species: shownSpecies,
			...(settle.mode === 'settle' && save
				? {
						targets: settleTargets(
							planets,
							campaignGalaxy(save.campaign)?.systems ?? [],
							arkshipsOf(b.snaps),
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
		view: expansionView(),
		defines: {
			HABITABILITY_WRONG_PLANET: getGameData().defines.HABITABILITY_WRONG_PLANET,
			HABITABILITY_OPPOSITE_PLANET: getGameData().defines.HABITABILITY_OPPOSITE_PLANET
		}
	};
}
