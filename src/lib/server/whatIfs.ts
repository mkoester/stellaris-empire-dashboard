import {
	automationBarred,
	automationOptions,
	perEnergy,
	type AutomationOption
} from '#lib/jobAutomation.ts';
import { jobOutput } from '#lib/luxuries.ts';
import type { GroupFlows } from '#lib/produce.ts';
import { isCapital } from '#lib/colonyLogistics.ts';
import { facts } from '#lib/government.ts';
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
	swapModifiers,
	whatIf,
	type ColonyInput,
	type WhatIf
} from '#lib/whatIf.ts';
import { colonyFee, feeInputs } from './logistics.ts';
import { getExplanations, getGameData } from './app.ts';
import type { branch } from './branch.ts';
import { groupFlows } from './produce.ts';

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
	colonies: ColonyInput[];
	gestalt: boolean;
	rules: WellbeingRules;
};

/** What every empire-wide what-if reads: the latest save's flows and the colonies at the tip. */
export function whatIfInputs(b: Branch): WhatIfInputs | null {
	const save = b.snaps.findLast((s) => s.kind === 'save' && s.budget !== null);
	if (!save) return null;
	const gestalt = isGestalt(b.latest.government ? b.latest : save);
	const rules = rulesNow();
	return {
		flows: groupFlows(save),
		colonies: b.latest.colonies.map((c) => colonyInput(b, c, gestalt, rules)),
		gestalt,
		rules
	};
}

/** `whatIf()` on the inputs, or null where there are no modifiers at all. */
export const whatIfOf = (
	mods: Record<string, number> | undefined,
	i: WhatIfInputs
): WhatIf | null =>
	mods && Object.keys(mods).length ? whatIf(mods, i.flows, i.colonies, i.gestalt, i.rules) : null;

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
	const run = (mods: Record<string, number>) => whatIf(mods, flows, input, gestalt, rules);
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
		capital: isCapital(colony)
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
					what: run(mods)
				}
			];
		});
	return { designations, decisions };
}

export type AutomationWhatIf = AutomationOption & {
	queued: boolean; // in the colony's build queue already
	techNames: Record<string, string>; // the missing techs' names
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
		b.jobs[colony.planetId] ?? [],
		colony.districtList.flatMap((d) => d.zones.flatMap((z) => z.buildings)),
		researched,
		data.costs.building,
		data.jobAutomation
	).map((o) => ({
		...o,
		queued: queued.includes(o.key),
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
