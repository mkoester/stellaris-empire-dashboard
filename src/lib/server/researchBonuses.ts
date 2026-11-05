import { techCostFactor } from '#lib/events.ts';
import { councilorBonus, councilSeats, facts } from '#lib/government.ts';
import { leaderRoles } from '#lib/leaders.ts';
import {
	AREAS,
	pileSum,
	realGain,
	researchLines,
	scopeLabel,
	type Line,
	type Source
} from '#lib/researchBonuses.ts';
import { researchSpeed } from '#lib/researchSpeed.ts';

const RESEARCH_AGREEMENT_SPEED = 0.25; // RESEARCH_AGREEMENT_SPEED_MULT
import type { Explanation, GameData, Modifier, Snapshot } from '#lib/types.ts';
import { empireHeld } from '#lib/wellbeingLevers.ts';

// The tech tab's research bonuses (#lib/researchBonuses.ts): every source the empire holds that the
// popups explain, the council at its councilors' levels with their traits, by pile and area; the
// speed pile checked against the speed measured from the saves.

// Species traits and rights act on their pops' jobs only: left out, not to overstate. Policies are
// read by policy below.
const EMPIRE_WIDE = new Set([
	'tradition',
	'perk',
	'edict',
	'civic',
	'ethic',
	'authority',
	'origin',
	'tech',
	'modifier'
]);

/**
 * A policy option's modifiers. The data DB keys options by name alone, so an option shared by
 * several policies keeps the first policy's: General Studies (`research_policy_no_focus`) is in
 * the physics, society and engineering research policies, each +10 % to its own area, and the DB
 * holds the physics one — read it with the policy's own area (extraction bug, 2026-11-05).
 */
export function policyModifiers(policy: string, mods: Modifier[]): Modifier[] {
	const area = /^(physics|society|engineering)_research_policy$/.exec(policy)?.[1];
	return area
		? mods.map((m) => ({ ...m, key: m.key.replace(/(physics|society|engineering)/, area) }))
		: mods;
}

export function empireSources(
	s: Snapshot,
	data: GameData,
	explain: Record<string, Explanation>
): Source[] {
	const held = Object.entries(empireHeld(s))
		.filter(([prefix]) => EMPIRE_WIDE.has(prefix))
		.flatMap(([prefix, keys]) =>
			[...keys].flatMap(([key, count]) => {
				const e = explain[`${prefix}:${key}`];
				return e ? [{ ref: `${prefix}:${key}`, name: e.title, modifiers: e.modifiers, count }] : [];
			})
		);
	const policies = Object.entries(s.policies ?? {}).flatMap(([policy, option]) => {
		const e = explain[`policy:${option}`];
		return e
			? [
					{
						ref: `policy:${option}`,
						name: e.title,
						modifiers: policyModifiers(policy, e.modifiers)
					}
				]
			: [];
	});
	// the council as the leaders tab has it: each seat at its councilor's level, and the traits
	// that act there, their conditions weighed (the councilor subclass's +5 % research)
	const seats = councilSeats(s, data, explain);
	const f = facts(s, data.scriptedTriggers, { shipKinds: data.shipKinds });
	const bonus = councilorBonus(s, data.councilorSkill).reduce((n, b) => n + b.value, 0);
	const council = (s.leaderList ?? []).flatMap((l) => {
		const seat = seats.find((x) => x.leaderId === l.id);
		if (!seat) return [];
		return leaderRoles(l, seat, explain, bonus, f)
			.roles.filter((r) => r.active && (r.kind === 'council' || r.kind === 'ruler'))
			.flatMap((r) =>
				r.bonuses.map((b) => ({
					ref: `seat:${seat.key}`,
					name: `${b.source} (${l.name})${b.note ? ` — ${b.note}` : ''}`,
					modifiers: b.modifiers
				}))
			);
	});
	// situations at their stage (the Nomad Economy's thriving stage: +10 % research)
	const situations = (s.situations ?? []).flatMap((x) => {
		const mods = x.stage === null ? undefined : data.situationStageModifiers[x.type]?.[x.stage];
		if (!mods?.length) return [];
		const t = data.situationTypes[x.type];
		const stage = x.stage === null ? undefined : t?.stages[x.stage];
		return [
			{
				ref: `situation:${x.type}`,
				name: `${t?.name ?? x.type}${stage ? `: ${stage}` : ''}`,
				modifiers: mods
			}
		];
	});
	return [...held, ...policies, ...council, ...situations];
}

/**
 * A research agreement's +25 % on each tech in progress that a partner has: added to the other
 * speed bonuses, as the game's tooltip lists it ("Baanthurian Research Agreement: +25.00%",
 * throwaway Theian Preservers 2200.07: +51 % = 26 + 25, progress ×1.510). Once per tech, however
 * many partners have it (seen in game: two partners, still ×1.51). From `AiIntel.techsWeLack`: the game shows the bonus.
 */
export function agreementLines(s: Snapshot): Line[] {
	const partners = (s.relations ?? []).filter((r) => r.agreements.includes('research_agreement'));
	return (s.progress?.research ?? []).flatMap((r) => {
		const by = partners.filter((p) =>
			s.aiIntel?.find((a) => a.countryId === p.countryId)?.techsWeLack?.includes(r.tech)
		);
		return by.length
			? [
					{
						ref: `pact:${by[0].countryId}`,
						name: `Research agreement (${by.map((p) => p.name).join(', ')})`,
						pile: 'speed' as const,
						scope: { kind: 'tech' as const, tech: r.tech },
						value: RESEARCH_AGREEMENT_SPEED
					}
				]
			: [];
	});
}

export function researchBonuses(
	snaps: Snapshot[],
	data: GameData,
	explain: Record<string, Explanation>
) {
	const s = snaps.findLast((x) => x.progress !== null);
	if (!s) return null;
	const lines: Line[] = [...researchLines(empireSources(s, data, explain)), ...agreementLines(s)];
	const speed = researchSpeed(snaps);
	const settings = s.progress!.costSettings;
	const sizeBase = data.defines.EMPIRE_SIZE_BASE ?? 100;
	const sizePenalty = data.defines.EMPIRE_SIZE_TECH_COST_PENALTY ?? 0.002;
	const show = (l: Line) => ({
		ref: l.ref,
		name: l.name,
		value: l.value,
		scope: scopeLabel(l.scope)
	});
	return AREAS.map((area) => {
		// the fields (categories) of the area's techs: a field's bonus is listed under its area
		const fields = new Set(
			Object.values(data.techs)
				.filter((t) => t.area === area)
				.map((t) => t.category)
		);
		const inArea = (l: Line) => {
			const sc = l.scope;
			if (sc.kind === 'category') return fields.has(sc.category);
			if (sc.kind === 'area' || sc.kind === 'jobs') return sc.area === area;
			if (sc.kind === 'tech') return data.techs[sc.tech]?.area === area;
			return true; // all research, rare techs
		};
		const of = (pile: Line['pile']) => lines.filter((l) => l.pile === pile && inArea(l));
		const current = s.progress!.research.find((r) => r.area === area) ?? null;
		const tech = current ? { key: current.tech, ...data.techs[current.tech] } : undefined;
		const measured = speed[area] ?? null;
		const measuredTech = measured?.tech
			? { key: measured.tech, ...data.techs[measured.tech] }
			: undefined;
		const speedSum = pileSum(lines, 'speed', area, tech);
		const outputSum = pileSum(lines, 'output', area);
		const costSum = pileSum(lines, 'cost', area);
		return {
			area,
			output: {
				booked: s.income?.[`${area}_research`] ?? 0,
				sum: outputSum,
				lines: of('output').map(show),
				worth10: realGain(0.1, outputSum)
			},
			speed: {
				tech: current
					? {
							key: current.tech,
							name: tech?.name ?? current.tech,
							category: tech?.category ?? null,
							rare: tech?.rare ?? false
						}
					: null,
				sum: speedSum,
				lines: of('speed').map((l) => ({
					...show(l),
					applies: !!tech && pileSum([l], 'speed', area, tech) !== 0
				})),
				worth10: realGain(0.1, speedSum),
				agreement: realGain(0.25, speedSum),
				measured: measured && {
					...measured,
					name: measured.tech ? (measuredTech?.name ?? measured.tech) : 'stored research',
					// what the lines predict for the tech measured
					predicted: 1 + pileSum(lines, 'speed', area, measuredTech)
				}
			},
			cost: {
				sum: costSum,
				lines: of('cost').map(show),
				difficulty: techCostFactor(tech?.tier ?? 1, settings) - 1,
				tier: tech?.tier ?? 1,
				slider: settings.technology,
				size: s.empireSize ?? null,
				sizePenalty: Math.max(0, (s.empireSize ?? 0) - sizeBase) * sizePenalty
			}
		};
	});
}
