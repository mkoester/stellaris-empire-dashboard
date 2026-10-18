import { error } from '@sveltejs/kit';
import { focusView, type Reward } from '#lib/focus.ts';
import { facts } from '#lib/government.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { describe } from '#lib/triggers.ts';
import type { Explanation } from '#lib/types.ts';

// The empire focus: the cards to do, and per category the next reward (a research option).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const s = snaps.findLast((x) => x.focus !== null);
	const view = s?.focus ? focusView(s.focus, data.focus, facts(s)) : null;
	const name = (t: string) => data.techs[t]?.name ?? t;
	const rewards = view?.rewards.flatMap((r) => [r.now, r.next]).filter((x) => x !== null) ?? [];
	const techs = rewards.flatMap((r) => r.options.map((o) => o.tech));
	return {
		...rest,
		seenAt: s?.date ?? null,
		view,
		techNames: Object.fromEntries(techs.map((t) => [t, name(t)])),
		explain: {
			...pick(
				getExplanations(),
				techs.map((t) => `tech:${t}`)
			),
			...Object.fromEntries(rewards.map((r) => [`focusreward:${r.key}`, explainReward(r, name)]))
		}
	};
}

/** What a reward does, in words: the game's add_research_option, and its if/else. */
function explainReward(r: Reward, name: (t: string) => string): Explanation {
	const lines = [
		'Adds a permanent research option: the tech stays among your research choices until you research it (add_research_option). It is not researched for you and comes with no progress.'
	];
	if (r.options.length > 1) {
		lines.push(
			'Which tech it is depends on your empire, not on a choice (an if/else in the reward):',
			...r.options.map(
				(o) =>
					`• ${name(o.tech)}: if ${describe(o.when)}${o.ours === true ? ' — yours' : o.ours === null ? ' — cannot tell from the save' : ''}`
			)
		);
	}
	return {
		title: `Reward at ${r.cost ?? '?'} progress`,
		description: null,
		modifiers: [],
		text: lines.join('\n'),
		facts: []
	};
}
