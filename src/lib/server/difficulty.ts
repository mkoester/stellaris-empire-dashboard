import { DIFFICULTY_RANK, difficultyLabel, techCostFactor } from '#lib/events.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import type { Explanation, Modifier } from '#lib/types.ts';

// What every difficulty does (4.5.4 `common/static_modifiers/00_static_modifiers.txt`):
// `difficulty_<d>` on the AI's regular empires — not on players' subjects —,
// `difficulty_<d>_player` on us at Civilian and Cadet, `difficulty_<d>_npc` on non-playable
// countries; tech costs rise per tier with `technology_difficulty_scale` (`techCostFactor()` — how
// traditions scale is not known). The galaxy tab lists them, the header's difficulty and the galaxy
// tab's difficulty row show the current one as a popup.
export type DifficultyEffects = {
	key: string;
	label: string;
	rank: number;
	player: Modifier[];
	ai: Modifier[];
	npc: Modifier[];
	costPerTier: number | null; // a tech's cost, a share per tier at this game's scaling
};

/** Every difficulty's effects, the tech cost at `scale` (a `technology_difficulty_scale`). */
export function difficulties(scale: string | null): DifficultyEffects[] {
	const ex = getExplanations();
	const data = getGameData();
	const mods = (k: string) => ex[`modifier:${k}`]?.modifiers ?? [];
	return Object.entries(DIFFICULTY_RANK).map(([key, rank]) => ({
		key,
		label: difficultyLabel(key),
		rank,
		player: mods(`difficulty_${key}_player`),
		ai: mods(`difficulty_${key}`),
		npc: mods(`difficulty_${key}_npc`),
		costPerTier: scale
			? techCostFactor(
					1,
					{ technology: 1, traditions: 1, difficulty: key, techDifficultyScale: scale },
					data.defines.TECH_COST_DIFFICULTY_SCALE_MULT
				) - 1
			: null
	}));
}

/** The current difficulty as a popup: what we get, then what the AI's empires get. */
export function difficultyCard(d: DifficultyEffects): Explanation {
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
				? `techs cost +${Math.round(d.costPerTier * 1000) / 10} % per tier (tier 3: ×${Math.round((1 + 3 * d.costPerTier) * 100) / 100})`
				: '',
			d.ai.length
				? 'its Difficulty Modifier Mult applies only with the Difficulty Adjusted AI Modifiers setting'
				: ''
		].filter(Boolean)
	};
}
