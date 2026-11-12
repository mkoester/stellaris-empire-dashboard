import { error } from '@sveltejs/kit';
import { DIFFICULTY_RANK, difficultyLabel, techCostFactor } from '#lib/events.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { setupGroups } from '#lib/galaxySetup.ts';
import type { Explanation, Modifier } from '#lib/types.ts';

// The settings the galaxy was created with, from the branch's latest save that holds them, each
// marked where it differs from the setup screen's default for this galaxy size; and what every
// difficulty does (4.5.4 `common/static_modifiers/00_static_modifiers.txt`: `difficulty_<d>` on
// the AI's regular empires — not on players' subjects —, `difficulty_<d>_player` on us at Civilian
// and Cadet, `difficulty_<d>_npc` on non-playable countries; research and tradition costs rise per
// tier with `technology_difficulty_scale`, `techCostFactor()`).
export type DifficultyEffects = {
	key: string;
	label: string;
	rank: number;
	player: Modifier[];
	ai: Modifier[];
	npc: Modifier[];
	costPerTier: number | null; // research and traditions, a share per tier at this game's scaling
};

export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const s = snaps.findLast((x) => x.kind === 'save' && x.galaxySetup);
	const data = getGameData();
	const ex = getExplanations();
	const scale =
		typeof s?.galaxySetup?.technology_difficulty_scale === 'string'
			? s.galaxySetup.technology_difficulty_scale
			: null;
	const mods = (k: string) => ex[`modifier:${k}`]?.modifiers ?? [];
	const difficulties: DifficultyEffects[] = Object.entries(DIFFICULTY_RANK).map(([key, rank]) => ({
		key,
		label: difficultyLabel(key),
		rank,
		player: mods(`difficulty_${key}_player`),
		ai: mods(`difficulty_${key}`),
		npc: mods(`difficulty_${key}_npc`),
		costPerTier: scale
			? techCostFactor(
					1,
					{
						technology: 1,
						traditions: 1,
						difficulty: key,
						techDifficultyScale: scale
					},
					data.defines.TECH_COST_DIFFICULTY_SCALE_MULT
				) - 1
			: null
	}));
	const current = difficulties.find((d) => d.key === s?.galaxySetup?.difficulty) ?? null;
	return {
		...rest,
		seenAt: s?.date ?? null,
		groups: s?.galaxySetup
			? setupGroups(s.galaxySetup, data.precursors, {
					scenarios: data.setupScenarios,
					defines: data.defines
				})
			: [],
		difficulties,
		difficultyCard: current ? difficultyCard(current) : null
	};
}

/** The current difficulty as a popup: what we get, then what the AI's empires get. */
function difficultyCard(d: DifficultyEffects): Explanation {
	const npc = d.npc.map(
		(m) => `${m.label ?? m.key} ${m.value > 0 ? '+' : ''}${Math.round(m.value * 100)} %`
	);
	return {
		title: d.label,
		description: d.player.length ? 'What our empire gets:' : 'No bonus for our empire.',
		modifiers: d.player,
		text: npc.length ? `Non-playable countries: ${npc.join(', ')}.` : null,
		...(d.ai.length ? { after: { label: 'the AI’s regular empires', modifiers: d.ai } } : {}),
		facts: [
			d.costPerTier !== null
				? `research and traditions cost +${Math.round(d.costPerTier * 1000) / 10} % per tier`
				: '',
			d.ai.length
				? 'its Difficulty Modifier Mult applies only with the Difficulty Adjusted AI Modifiers setting'
				: ''
		].filter(Boolean)
	};
}
