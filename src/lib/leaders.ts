import { describe, evaluate, type Facts, type Trigger } from './triggers.ts';
import type { Explanation, GameData, LeaderInfo, Modifier, Snapshot } from './types.ts';

const GESTALT = ['auth_hive_mind', 'auth_machine_intelligence'];

/**
 * A trait modifier's condition (THIS the leader) with what the leader and the save tell put in:
 * `is_ruler`, `is_councilor`, `leader_class`, and the paragon checks of the empire's kind
 * (`trait_is_gestalt_check` …, 4.5.3 common/scripted_triggers/03_scripted_triggers_paragon.txt:
 * `owner? = { is_gestalt = yes }`, which a save cannot answer as a scope). Others stay as they are.
 */
function forLeader(t: Trigger, l: LeaderInfo, f: Facts | null): Trigger {
	if (!('leaf' in t)) return { ...t, args: t.args.map((a) => forLeader(a, l, f)) };
	const is = (v: boolean | null) =>
		v === null ? t : { leaf: 'always', value: v === (t.value === 'yes') ? 'yes' : 'no' };
	const gov = f?.government ?? null;
	const has = (keys: string[]) => (gov ? gov.some((k) => keys.includes(k)) : null);
	switch (t.leaf) {
		case 'is_ruler':
			return is(l.ruler);
		case 'is_councilor':
			return is(l.council || l.ruler);
		case 'is_immortal':
			return is(l.immortal ?? null);
		case 'exists':
			// the leader's empire (`exists = owner`): ours
			return t.value === 'owner' ? { leaf: 'always', value: 'yes' } : t;
		case 'leader_class':
			return { leaf: 'always', value: l.class === t.value ? 'yes' : 'no' };
		case 'is_gestalt':
		case 'trait_is_gestalt_check':
			return is(has(GESTALT));
		case 'trait_is_machine_check':
			return is(has(['auth_machine_intelligence']));
		case 'trait_is_hive_check':
			return is(has(['auth_hive_mind']));
		case 'trait_is_nomad_check':
			return is(f?.nomadic ?? null);
		default:
			return t;
	}
}

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

// `wasted`: the role holds it but it does not apply (a governor away from its home), `note` why
export type Bonus = { source: string; modifiers: Modifier[]; wasted?: boolean; note?: string };

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
	scientist: ['council', 'governor', 'science ship'],
	commander: ['council', 'governor', 'fleet', 'army']
};

/**
 * What a class gives per skill level in each role: the static modifiers `skill_<class>_<role>`
 * (common/static_modifiers/00_static_modifiers.txt, 4.5.3; the game's class tooltip, "Per Level":
 * "Commanding Fleet Effect", "Planet Governor Effect" …). A governor's are the planet's, the
 * sector's (governing the sector capital) and its home planet's (governing it); a seat gives its
 * own instead (#lib/government.ts).
 */
export const CLASS_SKILL: Record<string, Record<string, [string, string][]>> = {
	official: {
		galcom: [['', 'delegate:galcom']],
		federation: [['', 'delegate:federation']],
		governor: [
			['planet', 'skill_official_planet_governor'],
			['sector', 'skill_official_sector_governor'],
			['home planet', 'skill_official_background_planet_governor']
		]
	},
	scientist: {
		governor: [
			['planet', 'skill_scientist_planet_governor'],
			['sector', 'skill_scientist_sector_governor'],
			['home planet', 'skill_scientist_background_planet_governor']
		],
		'science ship': [['', 'skill_scientist']]
	},
	commander: {
		governor: [
			['planet', 'skill_commander_planet_governor'],
			['sector', 'skill_commander_sector_governor'],
			['home planet', 'skill_commander_background_planet_governor']
		],
		fleet: [['', 'skill_commander_navy']],
		army: [['', 'skill_commander_army']]
	}
};

// The delegates' effects per level: the engine's, in the files only as tooltip text
// (`skill_official_delegate_tt`, localisation/english/modifiers_1_l_english.yml, 4.5.3).
const DELEGATE: Record<string, Modifier[]> = {
	'delegate:galcom': [
		{ key: 'diplo_weight_mult', value: 0.1, label: 'Diplomatic Weight', positiveIsGood: true }
	],
	'delegate:federation': [
		{
			key: 'federation_cohesion_add',
			value: 1,
			label: 'Monthly Federation Cohesion',
			positiveIsGood: true
		}
	]
};

/** A class's effects per skill level from one `CLASS_SKILL` source. */
export const skillModifiers = (key: string, explain: Record<string, Explanation>): Modifier[] =>
	DELEGATE[key] ?? explain[`modifier:${key}`]?.modifiers ?? [];

const capitalised = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
	councilBonus = 0,
	facts: Facts | null = null
): { roles: Role[]; self: Bonus[]; homeBonuses: Bonus[] } {
	const own = l.level + (l.bonus ?? 0);
	// the class's effects in a role, at a level; a governor's home-planet one only governing its home
	const skill = (kind: string, level: number | null, active: boolean): Bonus[] =>
		(CLASS_SKILL[l.class]?.[kind] ?? []).flatMap(([where, key]): Bonus[] => {
			const per = skillModifiers(key, explain);
			if (!per.length) return [];
			const at = level ?? 1;
			const bonus = {
				source: `${capitalised(l.class)} × ${at}${where ? `: ${where}` : ''}`,
				modifiers: per.map((m) => ({ ...m, value: m.value * at }))
			};
			if (where !== 'home planet') return [bonus];
			const home = l.home ?? 'its home';
			if (!active) return [{ ...bonus, note: `governing its home, ${home}` }];
			return l.governsHome === false
				? [
						{
							...bonus,
							wasted: true,
							note: `wasted: governs ${l.governs ?? 'a colony'}, not its home ${home}`
						}
					]
				: [bonus];
		});
	// a trait's modifiers in these scopes whose condition holds — or the save cannot tell (noted)
	const traits = (scopes: string[]): Bonus[] =>
		l.traits.flatMap((t) => {
			const open: string[] = [];
			const modifiers = scopes
				.flatMap((sc) => explain[`ltrait-${sc}:${t}`]?.modifiers ?? [])
				.filter((m) => {
					if (!m.when) return true;
					const holds = evaluate(forLeader(m.when, l, facts), facts ?? ({} as Facts));
					if (holds === null) open.push(describe(m.when));
					return holds !== false;
				})
				.map(({ when: _, ...m }) => m);
			if (!modifiers.length) return [];
			const source = explain[`ltrait:${t}`]?.title ?? t;
			const note = [...new Set(open)].join('; ');
			return [note ? { source, modifiers, note: `may apply, if ${note}` } : { source, modifiers }];
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
					? [
							{
								source: `${seat.name} × ${seat.council ?? '?'}`,
								modifiers: seat.effects.map((e) => e.now)
							}
						]
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
			bonuses: [...skill('governor', own, true), ...traits(ROLE_SCOPES.governor)]
		});
	if (l.assigned) {
		const kind = assignedKind(l);
		held.push({
			kind,
			name: l.assigned.name,
			level: own,
			active: true,
			bonuses: [...skill(kind, own, true), ...traits(ROLE_SCOPES[kind] ?? ['modifier'])]
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
			bonuses: [...skill(kind, own, false), ...traits(ROLE_SCOPES[kind])]
		}));
	const order = (r: Role) => {
		const i = (CLASS_ROLES[l.class] ?? []).indexOf(r.kind === 'ruler' ? 'council' : r.kind);
		return i < 0 ? -1 : i;
	};
	return {
		roles: [...held, ...could].sort((a, b) => order(a) - order(b)),
		self: traits(['self']),
		homeBonuses: traits(['background_planet']) // on its home colony, whatever it does
	};
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
