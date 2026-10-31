import type { Explanation, GameData, LeaderInfo, Modifier, Snapshot } from './types.ts';

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

/**
 * A role: the rule, a seat, a colony, a fleet …; `level` the one the leader acts at there;
 * `active` whether it holds it (else what it would do there).
 */
export type Role = {
	kind: string;
	name: string | null;
	level: number | null;
	active: boolean;
	bonuses: Bonus[];
};

// Where each role's traits act (`ltrait-<scope>:<trait>`), and the roles each class can hold, in
// the order the tab lists them — common/leader_classes: officials govern and may be the federation's
// or the Galactic Community's delegate (`can_be_assigned_to_…`).
const ROLE_SCOPES: Record<string, string[]> = {
	council: ['councilor'],
	ruler: ['councilor'],
	governor: ['planet', 'sector', 'modifier'],
	'science ship': ['modifier'],
	fleet: ['fleet', 'modifier'],
	army: ['army', 'modifier'],
	galcom: ['galcom'],
	federation: ['federation']
};
const CLASS_ROLES: Record<string, string[]> = {
	official: ['council', 'governor', 'galcom', 'federation'],
	scientist: ['council', 'science ship'],
	commander: ['council', 'fleet', 'army']
};

/** A role's kind by where the leader is assigned (`LeaderInfo.assigned`): a ship's fleet … */
const assignedKind = (l: Pick<LeaderInfo, 'class' | 'assigned'>) => {
	const kind = l.assigned!.kind;
	return kind === 'fleet' && l.class === 'scientist' ? 'science ship' : kind;
};

/**
 * Every role a leader holds (it may hold several: a scientist on the council and leading a science
 * ship) and every other its class can (`active` false: what it would do there), each with its level
 * there — a councilor's with the country's councilor bonus (`councilBonus`), the others the leader's
 * level and own extra levels — and what it gives: a held seat's modifiers at that level, and the
 * traits'; and what its traits do to the leader itself (`self`).
 */
export function leaderRoles(
	l: LeaderInfo,
	seat: HeldSeat | undefined,
	explain: Record<string, Explanation>,
	councilBonus = 0
): { roles: Role[]; self: Bonus[] } {
	const own = l.level + (l.bonus ?? 0);
	const traits = (scopes: string[]): Bonus[] =>
		l.traits.flatMap((t) => {
			const modifiers = scopes.flatMap((sc) => explain[`ltrait-${sc}:${t}`]?.modifiers ?? []);
			return modifiers.length ? [{ source: explain[`ltrait:${t}`]?.title ?? t, modifiers }] : [];
		});
	const held: Role[] = [];
	if (seat)
		held.push({
			kind: seat.ruler ? 'ruler' : 'council',
			name: seat.name,
			level: seat.council,
			active: true,
			bonuses: [
				...(seat.effects.length
					? [{ source: seat.name, modifiers: seat.effects.map((e) => e.now) }]
					: []),
				...traits(ROLE_SCOPES.council)
			]
		});
	if (l.governor)
		held.push({
			kind: 'governor',
			name: l.governs ?? null,
			level: own,
			active: true,
			bonuses: traits(ROLE_SCOPES.governor)
		});
	if (l.assigned) {
		const kind = assignedKind(l);
		held.push({
			kind,
			name: l.assigned.name,
			level: own,
			active: true,
			bonuses: traits(ROLE_SCOPES[kind] ?? ['modifier'])
		});
	}
	// the ruler holds the council's first seat
	const holds = (kind: string) =>
		held.some((r) => r.kind === kind || (kind === 'council' && r.kind === 'ruler'));
	const could: Role[] = (CLASS_ROLES[l.class] ?? [])
		.filter((kind) => !holds(kind))
		.map((kind) => ({
			kind,
			name: null,
			level: kind === 'council' ? own + councilBonus : own,
			active: false,
			bonuses: traits(ROLE_SCOPES[kind])
		}));
	const order = (r: Role) => {
		const i = (CLASS_ROLES[l.class] ?? []).indexOf(r.kind === 'ruler' ? 'council' : r.kind);
		return i < 0 ? -1 : i;
	};
	return { roles: [...held, ...could].sort((a, b) => order(a) - order(b)), self: traits(['self']) };
}

const BASE_LEADER_CAP = 3; // `@base_leader_cap`, common/leader_classes/00_base_classes.txt (4.5.3)

/**
 * Each class's leader limit — a soft one: more cost more upkeep — the base 3 plus the
 * `country_<class>_cap_add` (and `country_leader_cap_add`, every class) of what the save shows held:
 * traditions, perks, edicts, policies, civics, the origin, technologies, timed and static modifiers.
 */
export function leaderLimits(s: Snapshot, cap: GameData['leaderCap']): Record<string, number> {
	const held = [
		...[...(s.traditions ?? []), ...(s.ascensionPerks ?? []), ...(s.edicts ?? [])].map(
			(k) => `tradition:${k}`
		),
		...Object.values(s.policies ?? {}).map((k) => `tradition:${k}`),
		...(s.government ?? []).map((k) => `civic:${k}`),
		...(s.origin ? [`origin:${s.origin}`] : []),
		...(s.progress?.researched ?? []).map((k) => `tech:${k}`),
		...(s.countryModifiers ?? []).map((m) => `modifier:${m.key}`)
	];
	const add = (cls: string) =>
		[...new Set(held)].reduce((n, k) => n + (cap[k]?.[cls] ?? 0) + (cap[k]?.leader ?? 0), 0);
	return Object.fromEntries(LEADER_CLASSES.map((c) => [c, BASE_LEADER_CAP + add(c)]));
}

// the classes in the order the leaders tab lists them, and a level's ties
export const LEADER_CLASSES = ['official', 'scientist', 'commander'] as const;

/** The leaders tab's order: the ruler first, then by level (highest first), ties by class, name. */
export function leaderOrder(
	a: { ruler?: boolean; level?: number; class: string; name?: string },
	b: { ruler?: boolean; level?: number; class: string; name?: string }
): number {
	const rank = (c: string) => {
		const i = (LEADER_CLASSES as readonly string[]).indexOf(c);
		return i < 0 ? LEADER_CLASSES.length : i;
	};
	return (
		Number(b.ruler ?? false) - Number(a.ruler ?? false) ||
		(b.level ?? 0) - (a.level ?? 0) ||
		rank(a.class) - rank(b.class) ||
		(a.name ?? '').localeCompare(b.name ?? '')
	);
}
