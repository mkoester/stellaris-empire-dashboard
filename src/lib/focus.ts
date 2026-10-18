import type { EmpireFocus, GameData } from './types.ts';

// The empire focus tab: the active cards (tasks) and, per category, the reward being worked
// towards and the one after it. Pure.

export type FocusCardRow = GameData['focus']['cards'][string] & { key: string; done: boolean };
export type FocusRewardRow = {
	category: string;
	name: string; // the category's
	priority: boolean; // the category picked
	progress: number;
	cost: number | null;
	techs: string[]; // research options the reward offers (every branch of its effect)
	next: { cost: number | null; techs: string[] } | null; // the reward after it
};

/** `development_rewards_2` → `development_rewards_3`. */
const nextKey = (key: string) => key.replace(/_(\d+)$/, (_, n) => `_${Number(n) + 1}`);

export function focusView(f: EmpireFocus, data: GameData['focus']) {
	const unknown = { category: null, tier: null, hint: null, requirement: null };
	const cards: FocusCardRow[] = f.cards.map((c) => ({
		...(data.cards[c.key] ?? { ...unknown, name: c.key }),
		key: c.key,
		done: c.done
	}));
	const rewards: FocusRewardRow[] = f.rewards.map((r) => {
		const now = data.rewards[r.current];
		const after = data.rewards[nextKey(r.current)];
		return {
			category: r.category,
			name: data.categories[r.category] ?? r.category,
			priority: f.priority === r.category,
			progress: r.progress,
			cost: now?.cost ?? null,
			techs: now?.techs ?? [],
			next: after ? { cost: after.cost, techs: after.techs } : null
		};
	});
	return { priority: f.priority, cards, rewards };
}
