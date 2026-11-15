import {
	automationBarred,
	automationOptions,
	perEnergy,
	zoneNeeded,
	type AutomationOption
} from '#lib/jobAutomation.ts';
import { jobOutput, luxuryWhatIf, LUXURY_MONTHS } from '#lib/luxuries.ts';
import type { GroupFlows } from '#lib/produce.ts';
import { isCapital } from '#lib/colonyLogistics.ts';
import { jobGroup } from '#lib/tradeoffs.ts';
import { edictRows, facts, policyRows } from '#lib/government.ts';
import {
	decisionCost,
	decisionModifiers,
	decisionPossible,
	type PlanetFacts
} from '#lib/planetDecisions.ts';
import type { Colony, Resources, Snapshot } from '#lib/types.ts';
import { uncappedStability, wellbeingRules, type WellbeingRules } from '#lib/wellbeing.ts';
import {
	colonyFlows,
	designationCandidates,
	priced,
	swapModifiers,
	whatIf,
	type ColonyInput,
	type Price,
	type UpkeepInputs,
	type WhatIf
} from '#lib/whatIf.ts';
import { edictPrices } from '#lib/whatIf.ts';
import type { Recommendation } from '#lib/recommendations.ts';
import { colonyFee, feeInputs } from './logistics.ts';
import { getExplanations, getGameData } from './app.ts';
import { display, setting } from './settings.ts';
import type { branch } from './branch.ts';
import { groupFlows, upkeepInputs } from './produce.ts';

import { valuesOf } from './unitCosts.ts';
import { valueOf } from '#lib/value.ts';

const LUXURY_DECISION = 'decision_planet_luxuries_boost';

type Branch = NonNullable<ReturnType<typeof branch>>;

/** A gestalt empire: no happiness, its amenities move stability. */
export const isGestalt = (s: Pick<Snapshot, 'government'>) =>
	(s.government ?? []).some((k) => k === 'auth_machine_intelligence' || k === 'auth_hive_mind');

/** The wellbeing rules from the data DB's defines and static modifiers. */
export const rulesNow = () =>
	wellbeingRules(
		getGameData().defines,
		(key, mod) => getExplanations()[`modifier:${key}`]?.modifiers.find((m) => m.key === mod)?.value
	);

/** One colony as the what-ifs' wellbeing path needs it. */
export function colonyInput(
	b: Branch,
	c: Colony,
	gestalt: boolean,
	r: WellbeingRules
): ColonyInput {
	return {
		colony: c,
		jobOutput: jobOutput(b.jobs[c.planetId] ?? []),
		uncapped: uncappedStability(
			c.stabilityAdd,
			c.stabilityMult,
			c.approval ?? c.happiness,
			gestalt,
			r
		)
	};
}

export type WhatIfInputs = {
	flows: GroupFlows;
	upkeep: UpkeepInputs;
	colonies: ColonyInput[];
	gestalt: boolean;
	rules: WellbeingRules;
	values: Resources; // trade per unit (`whatIfValues()`)
	save: Snapshot; // the save the flows are from
};

/** What every tab values a resource at, in trade: the produce tab's weights, else what a unit costs us, else its market base price. */
export const whatIfValues = (b: Branch): Resources => ({
	...valuesOf(b.snaps),
	...setting('produceView').weights
});

/** What every empire-wide what-if reads: the latest save's flows and the colonies at the tip. */
export function whatIfInputs(b: Branch): WhatIfInputs | null {
	const save = b.snaps.findLast((s) => s.kind === 'save' && s.budget !== null);
	if (!save) return null;
	const gestalt = isGestalt(b.latest.government ? b.latest : save);
	const rules = rulesNow();
	return {
		flows: groupFlows(save),
		upkeep: upkeepInputs(save),
		colonies: b.latest.colonies.map((c) => colonyInput(b, c, gestalt, rules)),
		gestalt,
		rules,
		values: whatIfValues(b),
		save
	};
}

/**
 * `whatIf()` on the inputs, priced (`price`, or none) and valued in trade; null where there are
 * neither modifiers nor a price.
 */
export function whatIfOf(
	mods: Record<string, number> | undefined,
	i: WhatIfInputs,
	price: Price | null = null,
	u: UpkeepInputs = i.upkeep
): WhatIf | null {
	const has = mods && Object.keys(mods).length;
	if (!has && !price) return null;
	return priced(whatIf(mods ?? {}, i.flows, i.colonies, i.gestalt, i.rules, u), price, i.values);
}

export type DesignationWhatIf = {
	key: string;
	name: string;
	what: WhatIf;
	fee: number; // change of the colony's deficit fee a month (≈, from the output change alone)
};

export type DecisionWhatIf = {
	key: string;
	name: string;
	possible: boolean | null; // null: the save cannot tell
	cost: Resources | null;
	months: number | null; // how long its modifier runs; null: for good
	what: WhatIf;
};

/**
 * One colony's what-ifs: every designation of its family (`designationCandidates()`, ≈) and every
 * planet decision that is not ruled out and changes a modifier — on its own job output and chain.
 * Distribute Luxury Goods keeps its own panel.
 */
export function colonyWhatIfs(b: Branch, colony: Colony) {
	const data = getGameData();
	const explain = getExplanations();
	const save =
		b.snaps.findLast((x) => x.council !== null) ?? b.snaps.findLast((x) => x.kind === 'save');
	if (!save) return null;
	const gestalt = isGestalt(b.latest.government ? b.latest : save);
	const rules = rulesNow();
	const rows = b.jobs[colony.planetId] ?? [];
	const flows = colonyFlows(rows);
	const input = [colonyInput(b, colony, gestalt, rules)];
	const upkeep = colonyUpkeep(rows, colony);
	const values = whatIfValues(b);
	const run = (mods: Record<string, number>, price: Price | null = null) =>
		priced(whatIf(mods, flows, input, gestalt, rules, upkeep), price, values);
	const fee = feeInputs(b);
	const { fee: feeNow } = colonyFee(colony, fee);
	const feeAfter = (w: WhatIf) =>
		colonyFee(
			{
				...colony,
				produces: Object.fromEntries(
					[...new Set([...Object.keys(colony.produces), ...Object.keys(w.monthly)])].map((k) => [
						k,
						(colony.produces[k] ?? 0) + (w.monthly[k] ?? 0)
					])
				)
			},
			fee
		).fee.total - feeNow.total;

	const allDesignations = Object.keys(explain)
		.filter((k) => k.startsWith('designation:'))
		.map((k) => k.slice('designation:'.length));
	const designations: DesignationWhatIf[] = designationCandidates(
		colony.designation,
		allDesignations,
		gestalt
	).map((key) => {
		const what = run(
			swapModifiers(data.designationModifiers[colony.designation], data.designationModifiers[key])
		);
		return { key, name: explain[`designation:${key}`]?.title ?? key, what, fee: feeAfter(what) };
	});
	// what the current designation's own modifiers bring: lost with any change
	const currentMods = data.designationModifiers[colony.designation];
	const losingWhat =
		currentMods && Object.keys(currentMods).length
			? run(swapModifiers(currentMods, undefined))
			: null;
	const losing: DesignationWhatIf | null = losingWhat
		? {
				key: colony.designation,
				name: explain[`designation:${colony.designation}`]?.title ?? colony.designation,
				what: losingWhat,
				fee: feeAfter(losingWhat)
			}
		: null;

	const f = facts(save, data.scriptedTriggers, {
		shipKinds: data.shipKinds,
		electionTypes: data.electionTypes,
		archetypes: data.speciesArchetypes
	});
	const planet: PlanetFacts = {
		modifiers: colony.planet?.modifiers.map((m) => m.key) ?? [],
		designation: colony.designation,
		planetClass: colony.planetClass,
		pops: colony.pops,
		capital: isCapital(colony),
		crime: colony.crime ?? null,
		flags: colony.flags ?? null
	};
	const modifiersOf = (key: string) =>
		Object.fromEntries(
			(explain[`modifier:${key}`]?.modifiers ?? []).flatMap((m) =>
				typeof m.value === 'number' ? [[m.key, m.value]] : []
			)
		);
	const decisions: DecisionWhatIf[] = data.planetDecisions
		.filter((d) => d.key !== LUXURY_DECISION)
		.flatMap((d) => {
			const possible = decisionPossible(d, planet, f);
			if (possible === false) return [];
			const mods = decisionModifiers(d, planet, modifiersOf);
			if (!Object.keys(mods).length) return [];
			const days = d.adds[0]?.days ?? -1;
			return [
				{
					key: d.key,
					name: d.name,
					possible,
					cost: decisionCost(d, planet, f),
					months: days > 0 ? Math.round(days / 30) : null,
					what: run(mods, { cost: decisionCost(d, planet, f) ?? {}, upkeep: {}, measured: false })
				}
			];
		});
	return { designations, losing, decisions };
}

/** A colony's upkeep inputs from its job rows: their inputs (negative flows), workforce, strata. */
export function colonyUpkeep(
	rows: { type: string; filled: number; flows?: Resources }[],
	colony: Pick<Colony, 'strata'>
): UpkeepInputs {
	const flows: Record<string, Resources> = { jobs: {} };
	const workforce: Record<string, number> = {};
	for (const r of rows) {
		const used = Object.fromEntries(
			Object.entries(r.flows ?? {}).flatMap(([k, v]) => (v < 0 ? [[k, -v]] : []))
		);
		const g = jobGroup(r.type);
		flows[g] ??= {};
		for (const [k, v] of Object.entries(used)) {
			flows.jobs[k] = (flows.jobs[k] ?? 0) + v;
			flows[g][k] = (flows[g][k] ?? 0) + v;
		}
		workforce[g] = (workforce[g] ?? 0) + r.filled;
	}
	const strata = Object.fromEntries(colony.strata.map((s) => [s.category, s.size]));
	return { flows, workforce, strata };
}

export type AutomationWhatIf = AutomationOption & {
	queued: boolean; // in the colony's build queue already
	techNames: Record<string, string>; // the missing techs' names
	zoneFirst: string[] | null; // names of the districts that need a zone first (#lib/jobAutomation.ts zoneNeeded)
};

export type ColonyAutomation = {
	barred: 'tankbound' | 'wilderness' | null; // why the empire builds none
	options: AutomationWhatIf[];
};

/**
 * One colony's district automation what-ifs (#lib/jobAutomation.ts): the next automation building
 * of each line its jobs allow, on its job rows (measured output) and every building it has.
 */
export function colonyAutomation(b: Branch, colony: Colony): ColonyAutomation {
	const data = getGameData();
	const who = b.latest.government ? b.latest : (b.snaps.findLast((s) => s.government) ?? b.latest);
	const barred = automationBarred(who.government, who.origin);
	if (barred) return { barred, options: [] };
	const researched = b.snaps.findLast((s) => s.progress)?.progress?.researched ?? [];
	const queued = colony.buildQueue.filter((q) => q.kind === 'building').map((q) => q.name);
	const options = automationOptions(
		(b.jobs[colony.planetId] ?? []).map((j) => {
			const own = data.jobResources[j.type]?.produces;
			return own ? { ...j, produces: Object.keys(own) } : j;
		}),
		colony.districtList.flatMap((d) => d.zones.flatMap((z) => z.buildings)),
		researched,
		data.costs.building,
		data.jobAutomation
	).map((o) => ({
		...o,
		queued: queued.includes(o.key),
		zoneFirst:
			zoneNeeded(
				o.steps.map((s) => s.job),
				colony.districtList,
				data.districtJobs
			)?.map((d) => data.names[d] ?? d) ?? null,
		techNames: Object.fromEntries((o.missing ?? []).map((t) => [t, data.techs[t]?.name ?? t]))
	}));
	return { barred: null, options };
}

export type AutomationRank = { planetId: number; colony: string; option: AutomationWhatIf };

/**
 * Where an automation building takes over or adds the most workforce per energy a month, over
 * every colony — those the empire can build now (techs researched or unknown), not queued.
 */
export function automationRanking(b: Branch, top = 10): AutomationRank[] {
	return b.latest.colonies
		.flatMap((c) =>
			colonyAutomation(b, c)
				.options.filter((o) => !o.queued && !o.missing?.length)
				.map((option) => ({ planetId: c.planetId, colony: c.name, option }))
		)
		.sort((x, y) => perEnergy(y.option) - perEnergy(x.option))
		.slice(0, top);
}

/** A source's numeric modifiers from its explanation (`tradition:<key>`, `perk:<key>`, …). */
export const explainedModifiers = (id: string): Record<string, number> =>
	Object.fromEntries(
		(getExplanations()[id]?.modifiers ?? []).flatMap((m) =>
			typeof m.value === 'number' ? [[m.key, m.value]] : []
		)
	);

/**
 * What taking each source would do now (`<kind>:<key>` ids, their explanations' modifiers),
 * keyed by id; null where the what-ifs are off or the branch has no save with a budget.
 */
export function sourceWhatIfs(b: Branch, ids: string[]): Record<string, WhatIf> | null {
	if (!display().whatIfs) return null;
	const i = whatIfInputs(b);
	if (!i) return null;
	return Object.fromEntries(
		ids.flatMap((id) => {
			const w = whatIfOf(explainedModifiers(id), i);
			return w ? [[id, w]] : [];
		})
	);
}

/** The actionable government and colony choices, using the same estimates as their detail pages. */
export function recommendationOptions(b: Branch): Recommendation[] | null {
	if (!display().whatIfs) return null;
	const inputs = whatIfInputs(b);
	if (!inputs) return null;
	const data = getGameData();
	const save = inputs.save;
	const f = facts(save, data.scriptedTriggers, {
		shipKinds: data.shipKinds,
		electionTypes: data.electionTypes,
		archetypes: data.speciesArchetypes,
		slavery: data.speciesRights.flatMap((k) =>
			k.options.filter((o) => o.isSlavery).map((o) => o.key)
		)
	});
	const out: Recommendation[] = [];
	const edicts = edictRows(data.edicts, save, f).filter(
		(e) => e.active || (e.unlocked && e.possible === true)
	);
	const prices = edictPrices(edicts, save.budget?.find((x) => x.source === 'edicts')?.expenses);
	for (const e of edicts) {
		const mods = data.edictModifiers[e.key];
		const what = whatIfOf(
			e.active ? Object.fromEntries(Object.entries(mods ?? {}).map(([k, v]) => [k, -v])) : mods,
			inputs,
			prices[e.key]
		);
		if (what)
			out.push({
				kind: 'edict',
				label: `${e.active ? 'Disable' : 'Enable'} ${e.name}`,
				target: null,
				planetId: null,
				possible: e.possible,
				what
			});
	}
	const policies = policyRows(data.policies, save.policies ?? {}, f);
	for (const p of policies)
		for (const o of p.options.filter((o) => !o.selected && o.valid !== false)) {
			const what = whatIfOf(
				swapModifiers(
					p.selected ? data.policyModifiers[p.selected] : undefined,
					data.policyModifiers[o.key]
				),
				inputs
			);
			if (what)
				out.push({
					kind: 'policy',
					label: `Set ${p.name} to ${o.name}`,
					target: null,
					planetId: null,
					possible: o.valid,
					what
				});
		}
	for (const colony of b.latest.colonies) {
		const whatIfs = colonyWhatIfs(b, colony);
		if (!whatIfs) continue;
		for (const d of whatIfs.designations)
			out.push({
				kind: 'designation',
				label: `Change designation to ${d.name}`,
				target: colony.name,
				planetId: colony.planetId,
				possible: true,
				what: d.what
			});
		for (const d of whatIfs.decisions)
			out.push({
				kind: 'decision',
				label: d.name,
				target: colony.name,
				planetId: colony.planetId,
				possible: d.possible,
				what: d.what
			});
		const luxury = luxuryWhatIf(
			colony,
			jobOutput(b.jobs[colony.planetId] ?? []),
			uncappedStability(
				colony.stabilityAdd,
				colony.stabilityMult,
				colony.approval ?? colony.happiness,
				inputs.gestalt,
				inputs.rules
			),
			inputs.gestalt,
			inputs.rules
		);
		if (luxury) {
			const cost = { consumer_goods: luxury.cost };
			const costTrade = valueOf(cost, inputs.values);
			const gross = valueOf(luxury.monthly, inputs.values);
			out.push({
				kind: 'decision',
				label: 'Distribute Luxury Goods',
				target: colony.name,
				planetId: colony.planetId,
				possible: true,
				what: {
					monthly: luxury.monthly,
					upkeep: {},
					stability: luxury.stability,
					modelled: ['planet_amenities_mult'],
					unmodelled: [],
					price: { cost, upkeep: {}, measured: false },
					gained: gross,
					net: gross - costTrade / LUXURY_MONTHS,
					netLabel: 'trade/mo incl. 10-year cost'
				}
			});
		}
	}
	return out;
}

/** A species' pops per stratum, ≈: each colony's strata × the species' share of its pops. */
export function speciesStrata(colonies: Colony[], species: string): Record<string, number> {
	const out: Record<string, number> = {};
	for (const c of colonies) {
		const share = c.pops > 0 ? (c.speciesPops[species] ?? 0) / c.pops : 0;
		if (share > 0)
			for (const s of c.strata) out[s.category] = (out[s.category] ?? 0) + s.size * share;
	}
	return out;
}

/**
 * Switching a species' Living Standards to each other option it may take: the two options'
 * modifiers swapped, the per-pop upkeep on that species' strata (`speciesStrata()`), keyed
 * `right:<option>`; the happiness per stratum is not counted.
 */
export function livingStandardWhatIfs(
	b: Branch,
	species: string,
	selected: string | null,
	options: { key: string; selected: boolean; allowed: boolean | null }[]
): Record<string, WhatIf> {
	if (!display().whatIfs) return {};
	const i = whatIfInputs(b);
	if (!i) return {};
	const u = { ...i.upkeep, strata: speciesStrata(b.latest.colonies, species) };
	const now = selected ? explainedModifiers(`right:${selected}`) : {};
	return Object.fromEntries(
		options
			.filter((o) => !o.selected && o.allowed !== false)
			.flatMap((o) => {
				const w = whatIfOf(swapModifiers(now, explainedModifiers(`right:${o.key}`)), i, null, u);
				return w ? [[`right:${o.key}`, w]] : [];
			})
	);
}
