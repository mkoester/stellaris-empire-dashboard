import { facts, councilorBonus } from '#lib/government.ts';
import { leaderRoles } from '#lib/leaders.ts';
import { categoryChain, jobOutput, type OutputSource } from '#lib/outputBonuses.ts';
import type { Colony, Explanation, GameData, Snapshot } from '#lib/types.ts';
import { heldOf } from '#lib/wellbeingLevers.ts';
import { empireSources } from './researchBonuses.ts';

// Each colony's job output per resource as the bonuses explain it (#lib/outputBonuses.ts), against
// what the save books for the colony (`Colony.produces`): the empire's sources (`empireSources`),
// the colony's own — buildings, designation, deposits, planet modifiers (`heldOf`) and its
// governor — and the traits of the species working each job.

const LOCAL = ['building', 'designation', 'deposit', 'modifier'];

function colonySources(
	s: Snapshot,
	c: Colony,
	data: GameData,
	explain: Record<string, Explanation>,
	governors: Map<string, OutputSource[]>
): OutputSource[] {
	const local = heldOf(s, c).local;
	const held = LOCAL.flatMap((prefix) =>
		[...(local[prefix] ?? new Map<string, number>())].flatMap(([key, count]) => {
			const e = explain[`${prefix}:${key}`];
			return e ? [{ ref: `${prefix}:${key}`, name: e.title, modifiers: e.modifiers, count }] : [];
		})
	);
	return [...held, ...(governors.get(c.name) ?? [])];
}

/** The species' traits, each a source for that species' share of a job. */
function speciesSources(s: Snapshot, explain: Record<string, Explanation>): OutputSource[] {
	return (s.species ?? []).flatMap((sp) =>
		sp.traits.flatMap((t) => {
			const e = explain[`trait:${t}`];
			return e
				? [
						{
							ref: `trait:${t}`,
							name: `${e.title} (${sp.name})`,
							modifiers: e.modifiers,
							species: sp.id
						}
					]
				: [];
		})
	);
}

export function outputModel(s: Snapshot, data: GameData, explain: Record<string, Explanation>) {
	// the player's difficulty bonus (cadet +50 % to every job), a static modifier the engine applies
	const difficulty = s.progress?.costSettings.difficulty;
	const diff = difficulty ? explain[`modifier:difficulty_${difficulty}_player`] : undefined;
	const empire = [
		...empireSources(s, data, explain),
		...(diff
			? [
					{
						ref: `modifier:difficulty_${difficulty}_player`,
						name: diff.title,
						modifiers: diff.modifiers
					}
				]
			: [])
	];
	const traits = speciesSources(s, explain);
	const f = facts(s, data.scriptedTriggers, { shipKinds: data.shipKinds });
	const bonus = councilorBonus(s, data.councilorSkill).reduce((n, b) => n + b.value, 0);
	// each governor's planet effects, by the colony it governs
	const governors = new Map<string, OutputSource[]>();
	for (const l of s.leaderList ?? []) {
		if (!l.governs) continue;
		const roles = leaderRoles(l, undefined, explain, bonus, f).roles;
		const gov = roles.find((r) => r.kind === 'governor' && r.active);
		if (gov)
			governors.set(
				l.governs,
				gov.bonuses
					.filter((b) => !b.wasted)
					.map((b) => ({
						ref: `leader:${l.id}`,
						name: `${b.source} (${l.name})`,
						modifiers: b.modifiers
					}))
			);
	}
	return s.colonies.map((c) => {
		const sources = [...empire, ...colonySources(s, c, data, explain, governors), ...traits];
		const byResource: Record<string, ReturnType<typeof jobOutput>[]> = {};
		for (const j of c.jobs) {
			const base = data.jobResources[j.type]?.produces ?? {};
			const category = data.jobs[j.type]?.budgetSource;
			if (!category) continue;
			const chain = categoryChain(category, data.categoryParents);
			for (const [res, amount] of Object.entries(base))
				(byResource[res] ??= []).push({
					...jobOutput(j, res, amount, chain, sources),
					job: j.type
				} as never);
		}
		return {
			colony: c.name,
			planetId: c.planetId,
			stability: c.stability,
			designation: c.designation,
			resources: Object.entries(byResource).map(([res, jobs]) => {
				// the workforce's output before multipliers, and the multiplier the colony actually got
				const base = jobs.reduce((t, j) => t + (j.workforce / 100) * (j.base + j.add), 0);
				const counted = base
					? jobs.reduce((t, j) => t + (j.workforce / 100) * (j.base + j.add) * j.mult, 0) / base
					: 0;
				const booked = c.produces[res] ?? 0;
				const measured = base ? booked / base - 1 : null;
				return {
					resource: res,
					booked,
					base,
					counted,
					measured,
					// what the files do not explain: stability, happiness, … (engine) and any other output
					rest: measured === null ? null : measured - counted,
					predicted: jobs.reduce((t, j) => t + j.output, 0),
					jobs
				};
			})
		};
	});
}
