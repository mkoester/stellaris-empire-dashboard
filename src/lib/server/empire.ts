import { getExplanations, getGameData } from './app.ts';
import { pick } from './explain.ts';
import { branch } from './branch.ts';
import { pretty } from '#lib/format.ts';
import { traitBudget } from '#lib/species.ts';
import { techTiers } from '#lib/techTiers.ts';
import { adoptedTrees } from '#lib/traditions.ts';
import { orderTotal } from '#lib/ships.ts';
import {
	agendaSeries,
	fieldSeries,
	popSeries,
	researchSeries,
	resourceSeries,
	scalarSeries,
	withoutResearch,
	xRange
} from '#lib/series.ts';

// The empire's data at a branch tip: what the `all` tab shows and custom tabs pick from.
export function empireData(url: URL) {
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
			...b.empireJobs.map((j) => `job:${j.type}`),
			...(latest.traditions ?? []).map((k) => `tradition:${k}`),
			...(latest.ascensionPerks ?? []).map((k) => `perk:${k}`)
		]),
		// what each civilian ship's current order counts to (anomalies need the game data's levels)
		shipTotals: Object.fromEntries(
			(latest.civilianShips ?? []).map((s) => [
				s.fleetId,
				s.order ? orderTotal(s.order, s, data.anomalyLevels) : null
			])
		),
		trees: adoptedTrees(latest.traditions ?? [], data),
		perks: (latest.ascensionPerks ?? []).map((key) => ({
			key,
			name: data.perks[key] ?? pretty(key)
		})),
		// Researched techs per field and tier, at the latest full save.
		tiers: techTiers(b.snaps.findLast((s) => s.progress)?.progress?.researched ?? [], data.techs),
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
			agenda: agendaSeries(snaps),
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

export type EmpireData = Extract<ReturnType<typeof empireData>, { empty: false }>;
