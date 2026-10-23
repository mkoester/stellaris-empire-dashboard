import { addGameDays } from './series.ts';
import { evaluate, type Facts, type Trigger } from './triggers.ts';
import type { GalacticCommunity, GameData } from './types.ts';

// What we could propose to the Galactic Community, and why not where we cannot: every resolution
// a category lists whose `potential` holds for us (the others the game does not offer us at all),
// read against the save (data DB `resolution.potential_json` / `allow_json`, 4.5.2
// `common/resolutions/*`). Pure.

/** After a vote in a category, the days until another of it may be proposed (4.5.2 defines). */
export const CATEGORY_VOTE_COOLDOWN = 2520;

export type ProposableStatus =
	| 'proposable'
	| 'in force'
	| 'proposed' // already on the floor or in the queue: "has already been proposed by …"
	| 'locked' // `allow` false: the tier below not in force, one of the chain active, …
	| 'cooldown' // the category's vote cooldown
	| 'not a member'
	| 'needs a target' // names an empire: which one may be named the save cannot tell
	| 'no target' // names an empire, and none can be named (no custodian to unseat, …)
	| 'unknown'; // a condition the save cannot answer

export type ProposableRow = {
	key: string;
	category: string;
	level: number | null;
	repeal: boolean;
	target: boolean;
	cost: number | null; // influence, with our resolutions_cost_mult
	status: ProposableStatus;
	until?: string; // cooldown: the first day it may be proposed again
	by?: string; // proposed: by whom
	needs?: string; // locked: the resolution of the tier below that must be in force
	why?: Trigger; // locked or unknown: the condition, for describe()
};

// the first resolution `allow` requires in force: the tier below in a chain
function tierBelow(t: Trigger | null): string | undefined {
	if (!t) return undefined;
	if ('leaf' in t) return t.leaf === 'is_active_resolution' ? t.value : undefined;
	if (t.op === 'not') return undefined;
	for (const a of t.args) {
		const found = tierBelow(a);
		if (found) return found;
	}
	return undefined;
}

// What a target condition says about the galaxy as a whole: the Galactic Community's state is the
// same whichever empire is named, every other leaf is unknown (other empires' flags, types and
// opinions are not in the snapshot).
const GALAXY_LEAVES = new Set([
	'is_part_of_galactic_council',
	'is_galactic_custodian',
	'has_galactic_custodian',
	'is_galactic_emperor',
	'has_galactic_emperor',
	'is_galactic_council_established'
]);
const galaxyOnly = (t: Trigger): Trigger =>
	'leaf' in t
		? GALAXY_LEAVES.has(t.leaf)
			? t
			: { leaf: 'unknown_in_target_scope', value: 'yes' }
		: { ...t, args: t.args.map(galaxyOnly) };

export function proposable(
	resolutions: GameData['resolutions'],
	g: GalacticCommunity,
	facts: Facts,
	date: string,
	costMult: number // summed resolutions_cost_mult, e.g. −0.25 with Gravitas
): ProposableRow[] {
	const inForce = g.passed.map((r) => r.type);
	const queued = [...(g.voting ? [g.voting] : []), ...g.proposed];
	const f: Facts = {
		...facts,
		activeResolutions: inForce,
		globalFlags: g.globalFlags,
		galcomFormed: true,
		galcomMember: g.member
	};
	return Object.entries(resolutions).flatMap(([key, r]): ProposableRow[] => {
		if (r.category === null) return [];
		const potential = evaluate(r.potential, f);
		if (potential === false) return [];
		const row = {
			key,
			category: r.category,
			level: r.level,
			repeal: r.repeal,
			target: r.target,
			cost: r.cost === null ? null : r.cost * (1 + costMult)
		};
		if (!r.repeal && inForce.includes(key)) return [{ ...row, status: 'in force' }];
		const proposed = queued.find((q) => q.type === key);
		if (proposed) return [{ ...row, status: 'proposed', by: proposed.proposer }];
		if (!g.member) return [{ ...row, status: 'not a member' }];
		const allow = evaluate(r.allow, f);
		if (allow === false)
			return [{ ...row, status: 'locked', needs: tierBelow(r.allow), why: r.allow ?? undefined }];
		const timer = g.categoryTimers[r.category];
		const until = timer ? addGameDays(timer, CATEGORY_VOTE_COOLDOWN) : null;
		if (until && until > date) return [{ ...row, status: 'cooldown', until }];
		if (r.target && r.validTarget) {
			const anyone = evaluate(galaxyOnly(r.validTarget), f);
			return [
				{ ...row, status: anyone === false ? 'no target' : 'needs a target', why: r.validTarget }
			];
		}
		if (potential === null || allow === null)
			return [
				{
					...row,
					status: 'unknown',
					why: (potential === null ? r.potential : r.allow) ?? undefined
				}
			];
		return [{ ...row, status: 'proposable' }];
	});
}
