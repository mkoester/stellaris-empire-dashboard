import type { Explanation, LeaderInfo, Modifier } from './types.ts';

// What a leader holds and what that gives, for the leaders tab. A leader's traits act by scope (the
// game's trait documentation, `ltrait-<scope>:<trait>`): `councilor` on the council, `planet` and
// `sector` governing, `fleet` / `army` commanding, `modifier` wherever it is assigned, `self` on
// the leader itself. A council seat gives its modifiers per level of the councilor (#lib/government.ts
// councilSeats). Triggered trait modifiers are not extracted, so a role may give more. Pure.

/** A council seat as councilSeats gives it, with what it gives at the councilor level. */
export type HeldSeat = {
	leaderId: number | null;
	name: string;
	ruler: boolean;
	council: number | null; // the councilor level
	effects: { now: Modifier }[];
};

export type Bonus = { source: string; modifiers: Modifier[] };

/** One thing a leader holds: the rule, a seat, a colony, a fleet …; `level` the one it acts at there. */
export type Role = { kind: string; name: string | null; level: number | null; bonuses: Bonus[] };

/** The scopes a leader's traits act in, by where it is assigned (`LeaderInfo.assigned`). */
function assignedScopes(l: Pick<LeaderInfo, 'class' | 'assigned'>): {
	kind: string;
	scopes: string[];
} {
	const kind = l.assigned!.kind;
	if (kind === 'fleet')
		return l.class === 'scientist'
			? { kind: 'science ship', scopes: ['modifier'] }
			: { kind: 'fleet', scopes: ['fleet', 'modifier'] };
	if (kind === 'army') return { kind: 'army', scopes: ['army', 'modifier'] };
	return { kind, scopes: ['modifier'] };
}

/**
 * The roles a leader holds (it may hold several: a scientist on the council and leading a science
 * ship), each with its effective level — a councilor's with the country's councilor bonus, the
 * others the leader's level and own extra levels — and the bonuses it gives; and what its traits
 * do to the leader itself (`self`).
 */
export function leaderRoles(
	l: LeaderInfo,
	seat: HeldSeat | undefined,
	explain: Record<string, Explanation>
): { roles: Role[]; self: Bonus[] } {
	const own = l.level + (l.bonus ?? 0);
	const traits = (scopes: string[]): Bonus[] =>
		l.traits.flatMap((t) => {
			const modifiers = scopes.flatMap((sc) => explain[`ltrait-${sc}:${t}`]?.modifiers ?? []);
			return modifiers.length ? [{ source: explain[`ltrait:${t}`]?.title ?? t, modifiers }] : [];
		});
	const roles: Role[] = [];
	if (seat)
		roles.push({
			kind: seat.ruler ? 'ruler' : 'council',
			name: seat.name,
			level: seat.council,
			bonuses: [
				...(seat.effects.length
					? [{ source: seat.name, modifiers: seat.effects.map((e) => e.now) }]
					: []),
				...traits(['councilor'])
			]
		});
	if (l.governor)
		roles.push({
			kind: 'governor',
			name: l.governs ?? null,
			level: own,
			bonuses: traits(['planet', 'sector', 'modifier'])
		});
	if (l.assigned) {
		const { kind, scopes } = assignedScopes(l);
		roles.push({ kind, name: l.assigned.name, level: own, bonuses: traits(scopes) });
	}
	return { roles, self: traits(['self']) };
}

export const LEADER_CLASSES = ['official', 'commander', 'scientist'] as const;
