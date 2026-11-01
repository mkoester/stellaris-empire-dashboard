import { nomadic } from '#lib/planner/kinds.ts';
import { allMet, embarkRequirements, settleRequirements } from '#lib/settle.ts';
import type { Snapshot } from '#lib/types.ts';
import { getDb, getGameData } from './app.ts';
import { history } from './db.ts';

/** Names for the requirements' details: origins, civics, perks, situations. */
export function settleNames(): Record<string, string> {
	const data = getGameData();
	return {
		...data.identityNames,
		...data.perks,
		...Object.fromEntries(Object.entries(data.situationTypes).map(([k, v]) => [k, v.name]))
	};
}

/**
 * Settling down for a nomad, embarking for a settled empire: what the empire still needs, from
 * the branch's latest full save (`nomadic()`: running the nomad economy situation).
 */
export function settleState(snaps: Snapshot[]) {
	const s = snaps.findLast((x) => x.kind === 'save');
	if (!s) return null;
	const trees = getGameData().traditionTrees;
	const names = settleNames();
	return nomadic(s)
		? { mode: 'settle' as const, requirements: settleRequirements(s, trees, names) }
		: { mode: 'embark' as const, requirements: embarkRequirements(s, trees, names) };
}

let memo: { tip: number; blocked: string | null } | null = null;

/**
 * For the tab bar: what keeps a nomad at `tip` from settling — the expansion tab is dimmed then,
 * still usable —, null when it can (or might: unknown counts as met) or the empire is settled.
 * Kept per tip: the layout asks on every page.
 */
export function settleBlocked(tip: number | null): string | null {
	if (tip === null) return null;
	if (memo?.tip === tip) return memo.blocked;
	const st = settleState(history(getDb(), tip));
	const blocked =
		st?.mode === 'settle' && allMet(st.requirements) === false
			? st.requirements
					.filter((r) => r.met === false)
					.map((r) => r.label)
					.join(', ')
			: null;
	memo = { tip, blocked };
	return blocked;
}
