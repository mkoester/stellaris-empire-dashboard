import { getExplanations, getGameData } from './app.ts';
import { pick } from './explain.ts';
import { expansionRows } from './expansion.ts';
import { colonyBlockerHints } from './planets.ts';
import { expansionView } from './settings.ts';
import { branch } from './branch.ts';
import { totalEffects } from '#lib/effects.ts';
import { pretty } from '#lib/format.ts';
import type { Snapshot } from '#lib/types.ts';
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
	// empire-wide modifiers at the latest save that read them
	const modifiers = snaps.findLast((s) => s.countryModifiers !== null)?.countryModifiers ?? [];
	const government = identity(snaps.findLast((s) => s.government !== null));
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
			...(latest.ascensionPerks ?? []).map((k) => `perk:${k}`),
			...modifiers.map((m) => `modifier:${m.key}`),
			...(government?.rows.flatMap((r) => r.items.map((i) => i.id)) ?? [])
		]),
		government,
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
		// what clearing blockers would give, at the latest full save
		blockerHints: colonyBlockerHints(
			b.snaps.findLast((s) => s.kind === 'save')?.colonies ?? [],
			b.snaps.findLast((s) => s.progress)?.progress?.researched ?? []
		),
		// Researched techs per field and tier, at the latest full save.
		tiers: techTiers(b.snaps.findLast((s) => s.progress)?.progress?.researched ?? [], data.techs),
		// Overview panels, named from the game data.
		modifiers: modifiers.map((m) => ({
			...m,
			name: getExplanations()[`modifier:${m.key}`]?.title ?? null
		})),
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
		expansion: expansionRows(latest.expansion ?? []),
		expansionView: expansionView(),
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

/**
 * The Government panel: government type, authority, ethics, civics and origin as popup ids
 * (`<kind>:<key>`), and their modifiers summed. The save lists authority, ethics and civics in one
 * list; each key is sorted by the kind the data DB knows it as — unknown ones (mods) under "other".
 */
function identity(s: Snapshot | undefined) {
	if (!s?.government) return null;
	const all = getExplanations();
	const KINDS = ['authority', 'ethic', 'civic'];
	const kindOf = (key: string) => KINDS.find((k) => all[`${k}:${key}`]) ?? 'other';
	const item = (id: string) => ({ id, name: all[id]?.title ?? pretty(id.replace(/^\w+:/, '')) });
	const ids = (kind: string) =>
		s.government!.filter((k) => kindOf(k) === kind).map((k) => item(`${kind}:${k}`));
	const rows = [
		{ label: 'Government', items: s.governmentType ? [item(`gov:${s.governmentType}`)] : [] },
		{ label: 'Authority', items: ids('authority') },
		{ label: 'Ethics', items: ids('ethic') },
		{ label: 'Civics', items: ids('civic') },
		{ label: 'Origin', items: s.origin ? [item(`origin:${s.origin}`)] : [] },
		{ label: 'Other', items: ids('other') }
	].filter((r) => r.items.length);
	return {
		date: s.date,
		rows,
		effects: totalEffects(
			['Ethics', 'Authority', 'Civics', 'Origin'].flatMap(
				(label) =>
					rows
						.find((r) => r.label === label)
						?.items.filter((i) => all[i.id])
						.map((i) => ({ name: i.name, modifiers: all[i.id].modifiers })) ?? []
			)
		)
	};
}

export type EmpireData = Extract<ReturnType<typeof empireData>, { empty: false }>;
