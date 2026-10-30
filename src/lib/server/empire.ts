import {
	levelTone,
	nextStage,
	NOMAD_ECONOMY,
	RESERVES,
	reservesAlong,
	withReserves,
	type Reserves
} from '#lib/nomad.ts';
import { storageRows } from '#lib/storage.ts';
import { getExplanations, getGameData } from './app.ts';
import { pick } from './explain.ts';
import { expansionOf, expansionRows, habitatData, speciesChoices } from './expansion.ts';
import { colonyBlockerHints } from './planets.ts';
import { display, expansionView } from './settings.ts';
import { ROW_LINES } from '#lib/profiles.ts';
import { branch } from './branch.ts';
import { totalEffects, type EffectKind } from '#lib/effects.ts';
import {
	empireSizeEstimate,
	sizeFloor,
	sizeModifiers,
	sizeParts,
	speciesSizeMult
} from '#lib/empireSize.ts';
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
	stockpileSeries,
	withoutResearch,
	xExtent
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
	const species = speciesChoices(latest.species ?? []);
	const government = identity(snaps.findLast((s) => s.government !== null));
	// a nomad's energy and minerals as the one pool its top bar shows (#lib/nomad.ts)
	const reserves = reservesAlong(snaps);
	const shown = snaps.map((s, i) => withReserves(s, reserves[i]));
	const top = shown[shown.length - 1];
	const pool = reserves[reserves.length - 1];
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
			b.snaps.findLast((s) => s.progress)?.progress?.researched ?? [],
			b.snaps.findLast((s) => s.kind === 'save') ?? null
		),
		// Researched techs per field and tier, at the latest full save.
		tiers: techTiers(b.snaps.findLast((s) => s.progress)?.progress?.researched ?? [], data.techs),
		// storage under the resources panel: exact from the latest save with companion mod 0.5.0, else ≈ base
		storage: [
			...storageRows(
				top.stockpile,
				b.snaps.findLast((s) => s.kind === 'save')?.storageMax ?? null,
				data.resourceInfo
			),
			...(pool?.capacity
				? [
						{
							resource: RESERVES,
							name: 'Operational Reserves',
							have: pool.stock,
							max: pool.capacity,
							exact: !pool.estimated
						}
					]
				: [])
		],
		// the top bar: a nomad's energy and minerals folded into its reserves, and their level
		topBar: {
			stockpile: top.stockpile,
			balance: top.balance,
			reserves:
				pool && reserveLine(pool, data.situationTypes['situation_nomad_economy']?.stages ?? [])
		},
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
		expansion: expansionRows(expansionOf(snaps), species),
		expansionSpecies: species.map(({ id, name }) => ({ id, name })),
		canDetox: snaps.findLast((s) => s.canDetox !== null)?.canDetox ?? false,
		habitats: habitatData(snaps),
		// the game's habitability colours
		habDefines: {
			HABITABILITY_WRONG_PLANET: data.defines.HABITABILITY_WRONG_PLANET,
			HABITABILITY_OPPOSITE_PLANET: data.defines.HABITABILITY_OPPOSITE_PLANET
		},
		expansionRowLine: ROW_LINES[display().expansionRowLine],
		expansionView: expansionView(),
		xExtent: xExtent(snaps),
		charts: {
			pops: popSeries(snaps),
			agenda: agendaSeries(snaps),
			score: fieldSeries(snaps, {
				score: (s) => s.score?.score ?? null,
				economy: (s) => s.score?.economy ?? null,
				technology: (s) => s.score?.tech ?? null,
				military: (s) => s.score?.military ?? null
			}),
			empireSize: empireSizeSeries(snaps),
			research: researchSeries(snaps),
			stockpile: stockpileSeries(shown),
			balance: resourceSeries(shown, (s) => withoutResearch(s.balance)),
			income: resourceSeries(snaps, (s) => withoutResearch(s.income))
		}
	};
}

/** The top bar's second line for a nomad's reserves: level, share, the next level and how far. */
function reserveLine(pool: Reserves, names: string[]) {
	const name = (i: number) => names[i] ?? `stage ${i + 1}`;
	const next = nextStage(pool);
	return {
		level: pool.stage === null ? null : name(pool.stage),
		tone: pool.stage === null ? ('neutral' as const) : levelTone(pool.stage, pool.ends.length),
		share: pool.capacity ? pool.stock / pool.capacity : null,
		capacity: pool.capacity,
		next: next && {
			level: name(next.stage),
			tone: levelTone(next.stage, pool.ends.length),
			amount: next.amount,
			months: next.months,
			down: pool.monthly < 0
		},
		estimated: pool.estimated
	};
}

/**
 * Empire size as the save stores it and, while that sits at the floor (50), the unfloored size
 * estimated from its parts and the modifiers the explanations know (`#lib/empireSize.ts`).
 */
function empireSizeSeries(snaps: Snapshot[]) {
	const all = getExplanations();
	const { defines } = getGameData();
	const floor = sizeFloor(defines);
	const of = (ids: string[]) => ids.flatMap((id) => all[id]?.modifiers ?? []);
	const estimate = (s: Snapshot) => {
		if (s.empireSize === null || s.empireSize > floor) return null;
		const traits = new Map((s.species ?? []).map((sp) => [sp.id, sp.traits]));
		const parts = sizeParts(s, (id) =>
			speciesSizeMult(of((traits.get(id) ?? []).map((t) => `trait:${t}`)))
		);
		if (!parts) return null;
		const mods = sizeModifiers(
			of([
				...(s.government ?? []).flatMap((k) => [`civic:${k}`, `ethic:${k}`, `authority:${k}`]),
				...(s.origin ? [`origin:${s.origin}`] : []),
				...(s.traditions ?? []).map((k) => `tradition:${k}`),
				...(s.ascensionPerks ?? []).map((k) => `perk:${k}`),
				...(s.progress?.researched ?? []).map((k) => `tech:${k}`),
				...(s.countryModifiers ?? []).map((m) => `modifier:${m.key}`),
				// the engine's static modifier for nomads: +100 % from colonies and districts
				...(s.situations?.some((x) => x.type === NOMAD_ECONOMY) ? ['modifier:nomadic_empire'] : [])
			])
		);
		return empireSizeEstimate(parts, mods, defines);
	};
	const series = fieldSeries(snaps, {
		'empire size': (s) => s.empireSize,
		'actual (estimated)': estimate
	});
	if (series.lines['actual (estimated)'].every((v) => v === null))
		delete series.lines['actual (estimated)'];
	return series;
}

/**
 * The Government panel: government type, authority, ethics, civics and origin as popup ids
 * (`<kind>:<key>`), and their modifiers summed. The save lists authority, ethics and civics in one
 * list; each key is sorted by the kind the data DB knows it as — unknown ones (mods) under "other".
 */
export function identity(s: Snapshot | undefined) {
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
						.map((i) => ({
							name: i.name,
							modifiers: all[i.id].modifiers,
							kind: sourceKind(i.id)
						})) ?? []
			)
		)
	};
}

/** A popup id's kind as a badge: `civic:x` → civic; the gestalt consciousness ethic → gestalt. */
const sourceKind = (id: string): EffectKind =>
	id === 'ethic:ethic_gestalt_consciousness' ? 'gestalt' : (id.split(':')[0] as EffectKind);

export type EmpireData = Extract<ReturnType<typeof empireData>, { empty: false }>;
