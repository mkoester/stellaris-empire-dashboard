import { getExplanations, getGameData } from '#lib/server/app.ts';
import { pick } from '#lib/server/explain.ts';
import { branch } from '#lib/server/branch.ts';
import { pretty } from '#lib/format.ts';
import { traitBudget } from '#lib/species.ts';
import {
	fieldSeries,
	popSeries,
	researchSeries,
	resourceSeries,
	scalarSeries,
	withoutResearch,
	xRange
} from '#lib/series.ts';

export function load({ url }) {
	const b = branch(url);
	if (b === null) return { empty: true as const };
	const { snaps, ...rest } = b;
	const data = getGameData();
	const latest = b.latest;
	return {
		empty: false as const,
		...rest,
		// Popup texts for what the page names: traits, edicts, research, agenda, jobs.
		explain: pick(getExplanations(), [
			...(latest.species ?? []).flatMap((s) => s.traits.map((t) => `trait:${t}`)),
			...(latest.edicts ?? []).map((e) => `edict:${e}`),
			...b.upcoming.flatMap((e) => (e.ref ? [e.ref] : [])),
			...b.empireJobs.map((j) => `job:${j.type}`)
		]),
		// Overview panels, named from the game data.
		edicts: (latest.edicts ?? []).map((key) => ({
			key,
			name: data.edicts[key]?.name ?? pretty(key)
		})),
		species: (latest.species ?? []).map((s) => ({
			...s,
			className: data.speciesClasses[s.cls]?.name ?? s.cls,
			traits: s.traits.map((key) => ({ key, name: pretty(key.replace(/^trait_(pc_)?/, '')) })),
			budget: traitBudget(s, data)
		})),
		expansion: (latest.expansion ?? []).map((p) => ({
			...p,
			className: data.planetClasses[p.planetClass]?.name ?? pretty(p.planetClass),
			colonizable: data.planetClasses[p.planetClass]?.colonizable ?? false
		})),
		xRange: xRange(snaps),
		charts: {
			pops: popSeries(snaps),
			score: fieldSeries(snaps, {
				score: (s) => s.score?.score ?? null,
				economy: (s) => s.score?.economy ?? null,
				technology: (s) => s.score?.tech ?? null,
				military: (s) => s.score?.military ?? null
			}),
			empireSize: scalarSeries(snaps, 'empire size', (s) => s.empireSize),
			research: researchSeries(snaps),
			stockpile: resourceSeries(snaps, (s) => withoutResearch(s.stockpile)),
			balance: resourceSeries(snaps, (s) => withoutResearch(s.balance)),
			income: resourceSeries(snaps, (s) => withoutResearch(s.income))
		}
	};
}
