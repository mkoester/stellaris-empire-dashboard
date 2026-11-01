import { evaluate, type Facts } from './triggers.ts';
import type { Held } from './wellbeingLevers.ts';
import type { Explanation, Modifier } from './types.ts';

// Where the leaders' properties come from besides their own traits (the user's ask 2026-10-31:
// "traditions, perks, etc — e.g. experience gain"): every source the popups explain that the
// empire holds (`empireHeld()`: traditions, perks, edicts, policies, civics, ethics, authority,
// origin, council seats, species rights, techs, species traits, timed modifiers) with a modifier
// on leaders — experience, skill, lifespan, limits and pool, upkeep and cost, councilors, envoys.
// A triggered modifier (a tradition's or perk's `potential`) is weighed against the save
// (`#lib/triggers.ts`): left out where false, `holds: null` where the save cannot tell — shown
// with "?" and kept out of the total. Pure.

// in this order on the tab: what the user asked for first
const GROUPS: [string, RegExp][] = [
	['experience', /exp_gain$/],
	['skill', /skill|initial_traits|trait_selection/],
	['lifespan', /lifespan/],
	['limits and pool', /_cap_add$|pool/],
	['upkeep and cost', /upkeep|cost/],
	['council', /councilor/],
	['envoys', /^envoy/]
];

/** Whether a modifier acts on leaders (the 4.5.3 data DB's keys: `leaderSources.test.ts`). */
export const isLeaderModifier = (key: string) =>
	/leader|councilor|^envoys?_|^country_(official|scientist|commander)_cap_add$/.test(key);

/** The group a leader modifier is shown in. */
export const leaderGroup = (key: string) => GROUPS.find(([, re]) => re.test(key))?.[0] ?? 'other';

export type LeaderSource = { ref: string; value: number; count: number; holds: boolean | null };
export type LeaderModifierRow = {
	group: string;
	mod: Modifier; // its value the sum over the sources that hold
	sources: LeaderSource[];
};

/** Per leader modifier, the held sources giving it and their sum; in `GROUPS` order. */
export function leaderSources(
	explanations: Record<string, Explanation>,
	held: Held['empire'],
	facts: Facts | null = null
): LeaderModifierRow[] {
	const rows = new Map<string, LeaderModifierRow>();
	for (const [ref, e] of Object.entries(explanations)) {
		const i = ref.indexOf(':');
		const count = held[ref.slice(0, i)]?.get(ref.slice(i + 1));
		if (!count) continue;
		for (const m of e.modifiers) {
			if (!isLeaderModifier(m.key)) continue;
			const holds = m.when ? (facts ? evaluate(m.when, facts) : null) : true;
			if (holds === false) continue;
			const { when: _, ...plain } = m;
			const row = rows.get(m.key) ?? {
				group: leaderGroup(m.key),
				mod: { ...plain, value: 0 },
				sources: []
			};
			if (holds) row.mod.value += m.value * count;
			row.sources.push({ ref, value: m.value, count, holds });
			rows.set(m.key, row);
		}
	}
	const order = (g: string) => {
		const n = GROUPS.findIndex(([name]) => name === g);
		return n < 0 ? GROUPS.length : n;
	};
	return [...rows.values()].sort(
		(a, b) => order(a.group) - order(b.group) || a.mod.key.localeCompare(b.mod.key)
	);
}
