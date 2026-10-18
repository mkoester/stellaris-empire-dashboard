import { evaluate, type Facts, type Trigger } from './triggers.ts';
import type { EmpireFocus, GameData } from './types.ts';

// The empire focus tab: the active cards (tasks) and, per category, the reward being worked
// towards and the one after it. Pure.

export type FocusCardRow = GameData['focus']['cards'][string] & { key: string; done: boolean };

/** A reward's research option, and whether it is the one this empire gets (null: cannot tell). */
export type RewardOption = { tech: string; when: Trigger | null; ours: boolean | null };
export type Reward = { key: string; cost: number | null; options: RewardOption[] };
export type FocusRewardRow = {
	category: string;
	name: string; // the category's
	priority: boolean; // the category picked
	progress: number;
	now: Reward | null; // the reward being worked towards
	next: Reward | null; // the one after it
};

/** `development_rewards_2` → `development_rewards_3`. */
const nextKey = (key: string) => key.replace(/_(\d+)$/, (_, n) => `_${Number(n) + 1}`);

const reward = (key: string, data: GameData['focus'], f: Facts): Reward | null => {
	const r = data.rewards[key];
	return r
		? {
				key,
				cost: r.cost,
				options: r.options.map((o) => ({ ...o, ours: evaluate(o.when, f) }))
			}
		: null;
};

export function focusView(focus: EmpireFocus, data: GameData['focus'], f: Facts) {
	const unknown = { category: null, tier: null, hint: null, requirement: null, gives: [] };
	const cards: FocusCardRow[] = focus.cards.map((c) => ({
		...(data.cards[c.key] ?? { ...unknown, name: c.key }),
		key: c.key,
		done: c.done
	}));
	const rewards: FocusRewardRow[] = focus.rewards.map((r) => ({
		category: r.category,
		name: data.categories[r.category] ?? r.category,
		priority: focus.priority === r.category,
		progress: r.progress,
		now: reward(r.current, data, f),
		next: reward(nextKey(r.current), data, f)
	}));
	return { priority: focus.priority, cards, rewards };
}
