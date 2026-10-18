import { climateOf } from '#lib/climate.ts';
import { profile } from '#lib/colonyProfile.ts';
import type { ExpansionRow, SpeciesChoice } from '#lib/expansion.ts';
import { pretty } from '#lib/format.ts';
import { estimate, livesOnPlanets } from '#lib/habitability.ts';
import { HABITAT_DISTRICTS, habitatRow } from '#lib/habitats.ts';
import type { ExpansionPlanet, Snapshot, SpeciesInfo } from '#lib/types.ts';
import { getExplanations, getGameData } from './app.ts';
import { pick } from './explain.ts';
import { planetDetails } from './planets.ts';
import { campaignGalaxy } from './mapSystems.ts';
import { display } from './settings.ts';

/**
 * The empire's species habitability applies to (a climate preference or the like), the main one —
 * the most pops — first. Pickers on the colonies and expansion tabs choose from these.
 */
export function speciesChoices(species: SpeciesInfo[]): (SpeciesChoice & { traits: string[] })[] {
	const data = getGameData();
	return species
		.filter((s) => livesOnPlanets(s.traits, data))
		.sort((a, b) => b.pops - a.pops)
		.map((s) => ({ id: s.id, name: s.name, traits: s.traits }));
}

/**
 * Expansion candidates named and judged from the game data: their planet details, the effects of
 * their features and modifiers, and their habitability for each of `species`.
 */
export function expansionRows(
	planets: ExpansionPlanet[],
	species: { id: string; traits: string[] }[]
): ExpansionRow[] {
	const data = getGameData();
	const explain = getExplanations();
	return planets.map((p) => {
		const refs = [
			...(p.planet?.deposits ?? []).map((d) => `deposit:${d.key}`),
			...(p.planet?.modifiers ?? []).map((m) => `modifier:${m.key}`)
		];
		const { pros, cons } = profile({
			colony: { designation: '', habitability: null, planet: p.planet },
			caps: null,
			hints: [],
			explain: pick(explain, refs),
			names: {}
		});
		return {
			...p,
			className: data.planetClasses[p.planetClass]?.name ?? pretty(p.planetClass),
			colonizable: data.planetClasses[p.planetClass]?.colonizable ?? false,
			details: p.planet
				? planetDetails(p.planet, {
						size: p.size,
						planetClass: p.planetClass,
						buildings: [],
						built: {}
					})
				: null,
			effects: { pros, cons },
			climate: climateOf(p.planetClass, data.planetClasses),
			hab: Object.fromEntries(
				species.map((s) => [s.id, estimate(p.planetClass, s.traits, p.planet, data)])
			)
		};
	});
}

/**
 * With the surveyAll spoiler, the expansion candidates and habitat sites as if every planet were
 * surveyed (the campaign's latest reading, kept with its galaxy); null otherwise or before a save
 * has written them.
 */
export function surveyedAll(snaps: Snapshot[]): Snapshot['surveyedAll'] {
	const last = snaps.at(-1);
	return display().surveyAll && last ? (campaignGalaxy(last.campaign)?.surveyedAll ?? null) : null;
}

/** The expansion candidates: the surveyed planets of the branch's latest full save, or all. */
export const expansionOf = (snaps: Snapshot[]) =>
	surveyedAll(snaps)?.expansion ?? snaps.findLast((x) => x.expansion !== null)?.expansion ?? [];

/**
 * Habitat sites at the branch's latest save that read them (or as if all were surveyed), judged for the empire — shown once it
 * can build habitats, or always with the config tab's `habitatsAlways`.
 */
export function habitatData(snaps: Snapshot[]) {
	const data = getGameData();
	const s = snaps.findLast((x) => x.habitatSites !== null);
	const can = s?.habitats?.can ?? false;
	const show = can || display().habitatsAlways;
	const researched = snaps.findLast((x) => x.progress)?.progress?.researched ?? [];
	const empire = { researched, voidDweller: s?.habitats?.voidDweller ?? false };
	return {
		show,
		can,
		rows: show
			? (surveyedAll(snaps)?.habitatSites ?? s?.habitatSites ?? []).map((site) =>
					habitatRow(site, empire, data.habitatEffects)
				)
			: [],
		names: pick(data.names, HABITAT_DISTRICTS),
		colors: pick(data.districtColors, HABITAT_DISTRICTS)
	};
}
