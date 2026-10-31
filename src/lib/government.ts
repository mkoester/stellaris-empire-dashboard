import { addGameDays } from './series.ts';
import { evaluate, type Facts } from './triggers.ts';
import type { CouncilSeat, Explanation, Faction, GameData, Modifier, Snapshot } from './types.ts';

// The government tab (council, agendas, policies, edicts, factions): the data DB's rules read
// against one save. What the save cannot answer stays unknown (null), see #lib/triggers.ts.

/** What a snapshot tells the trigger evaluator; `scripted`: the data DB's scripted triggers. */
export function facts(
	s: Snapshot,
	scripted: Facts['scripted'] = {},
	data: {
		electionTypes?: Record<string, string>;
		slavery?: string[];
		archetypes?: Record<string, string>; // species class → archetype (data DB species_class)
	} = {}
): Facts {
	const electionTypes = data.electionTypes ?? {};
	const authority = (s.government ?? []).find((k) => k.startsWith('auth_'));
	const archetype =
		s.founderClass && data.archetypes ? (data.archetypes[s.founderClass] ?? null) : null;
	const gestalt = authority === 'auth_hive_mind' || authority === 'auth_machine_intelligence';
	return {
		countryType: s.countryType,
		government: s.government ?? [],
		origin: s.origin,
		governmentType: s.governmentType,
		dlcs: s.dlcs,
		policyFlags: s.policyFlags ?? [],
		countryFlags: s.countryFlags ?? [],
		traditions: s.traditions ?? [],
		perks: s.ascensionPerks ?? [],
		techs: s.progress?.researched ?? [],
		atWar: s.wars === null ? null : s.wars.length > 0,
		situations: s.situations === null ? null : s.situations.length,
		nomadic:
			s.situations === null ? null : s.situations.some((x) => x.type === 'situation_nomad_economy'),
		individualMachine: archetype === null ? null : archetype === 'MACHINE' && !gestalt,
		usesFood: s.expenses ? (s.expenses.food ?? 0) > 0 || null : null,
		scripted,
		leaderTraits: s.leaderList?.flatMap((l) => l.traits),
		edicts: s.edicts,
		electionType: authority ? (electionTypes[authority] ?? null) : null,
		...attractionFacts(s, data.slavery ?? []),
		factions: s.factions?.map((x) => x.type) ?? null,
		// our own entry of the diplomacy reading: its federation and overlord
		...(() => {
			const us = s.diplomacy?.find((c) => c.id === s.countryId);
			return us ? { federation: us.federation !== null, subject: us.overlord !== null } : {};
		})()
	};
}

/** What the ethic attraction reasons look into: leaders' ethics, our species, worked jobs. */
function attractionFacts(s: Snapshot, slavery: string[]): Partial<Facts> {
	const leaders = s.leaderList;
	// leaders read before READER 26 carry no ethic: unknown, not none
	const read = leaders !== null && leaders.every((l) => l.ethic !== undefined);
	const ethics = (keep: (l: NonNullable<typeof leaders>[number]) => boolean) =>
		read ? leaders!.filter(keep).flatMap((l) => (l.ethic ? [l.ethic] : [])) : null;
	return {
		councilEthics: ethics((l) => l.council || l.ruler),
		governorEthics: ethics((l) => l.governor === true),
		livingStandards:
			s.speciesRights === null
				? null
				: Object.values(s.speciesRights).flatMap((r) =>
						r.living_standard ? [r.living_standard] : []
					),
		speciesTraits: s.species === null ? null : s.species.flatMap((x) => x.traits),
		roboticSpecies:
			s.species === null ? null : s.species.some((x) => x.cls === 'ROBOT' || x.cls === 'MACHINE'),
		jobs: s.colonies.flatMap((c) => c.jobs.filter((j) => j.filled > 0).map((j) => j.type)),
		...citizenshipFacts(s, slavery)
	};
}

/**
 * Citizenship and slavery among our organic species (egalitarian's reasons): another one than a
 * pop's own, every one on full citizenship, one enslaved (`slavery`: the citizenships that are).
 */
function citizenshipFacts(s: Snapshot, slavery: string[]): Partial<Facts> {
	if (s.species === null || s.speciesRights === null) return {};
	const rights = s.speciesRights;
	const organic = s.species.filter((x) => x.cls !== 'ROBOT' && x.cls !== 'MACHINE');
	const citizenship = (id: string) => rights[id]?.citizenship;
	return {
		otherOrganicSpecies: organic.length > 1,
		allOrganicFullCitizenship: organic.every((x) => citizenship(x.id) === 'citizenship_full'),
		enslavedOrganicSpecies: organic.some((x) => slavery.includes(citizenship(x.id) ?? ''))
	};
}

/** Unlocked: no tradition or perk needed, or one of them taken. */
const unlocked = (by: string[], f: Facts) =>
	by.length === 0 || by.some((k) => f.traditions.includes(k) || f.perks.includes(k));

export type PolicyRow = {
	key: string;
	name: string;
	category: string | null;
	selected: string | null;
	// options this empire can have (potential not false), each with whether it may pick it now
	options: { key: string; name: string; selected: boolean; valid: boolean | null }[];
};

export function policyRows(
	policies: GameData['policies'],
	selected: Record<string, string>,
	f: Facts,
	all = false // also the policies the empire does not have, and every option
): PolicyRow[] {
	return (
		policies
			.map((p) => ({
				key: p.key,
				name: p.name,
				category: p.category,
				selected: selected[p.key] ?? null,
				options: p.options
					.filter((o) => all || selected[p.key] === o.key || evaluate(o.potential, f) !== false)
					.map((o) => ({
						key: o.key,
						name: o.name,
						selected: selected[p.key] === o.key,
						valid: evaluate(o.valid, f)
					}))
			}))
			// the save lists exactly the policies the empire has (2207.03.10: 26 entries, the game's list)
			.filter((p) => all || p.selected !== null)
	);
}

export type AgendaStatus = 'current' | 'cooldown' | 'open' | 'maybe' | 'not-allowed' | 'locked';
export type AgendaRow = {
	key: string;
	name: string;
	cost: number | null;
	status: AgendaStatus;
	// a launched one: when, until when its after-launch modifier lasts, when it can be picked again
	launch: { launched: string | null; effectUntil: string | null; availableAgain: string } | null;
};

/** A cooldown's dates: `until` back by the agenda's cooldown is its launch. */
export function launchDates(
	until: string,
	a: GameData['agendas'][string] | undefined
): NonNullable<AgendaRow['launch']> {
	const launched = a?.cooldownDays ? addGameDays(until, -a.cooldownDays) : null;
	return {
		launched,
		effectUntil: launched && a?.finishDays ? addGameDays(launched, a.finishDays) : null,
		availableAgain: until
	};
}

/**
 * The council agendas this empire can have (`potential` not false): the one being prepared, those
 * on cooldown, open ones, those whose `allow` the save cannot answer (maybe), those not allowed
 * now, and those still locked behind a tradition or perk.
 */
export function agendaRows(agendas: GameData['agendas'], s: Snapshot, f: Facts): AgendaRow[] {
	const current = s.progress?.agenda?.key;
	const cooldown = new Map((s.agendaCooldowns ?? []).map((c) => [c.key, c.until]));
	return Object.entries(agendas)
		.filter(([key, a]) => key === current || evaluate(a.potential ?? null, f) !== false)
		.map(([key, a]) => {
			const allow = evaluate(a.allow ?? null, f);
			const until = cooldown.get(key);
			return {
				key,
				name: a.name,
				cost: a.cost,
				launch: until ? launchDates(until, a) : null,
				status:
					key === current
						? 'current'
						: (s.agendasDone ?? []).includes(key)
							? 'cooldown'
							: !unlocked(a.unlockedBy, f)
								? 'locked'
								: allow === false
									? 'not-allowed'
									: allow === null
										? 'maybe'
										: 'open'
			};
		});
}

export type EdictRow = {
	key: string;
	name: string;
	category: string | null;
	length: number | null;
	cost: GameData['edicts'][string]['cost'];
	active: { start: string | null; end: string | null } | null;
	possible: boolean | null; // its potential: null when the save cannot tell
	unlocked: boolean; // a tradition or perk it needs taken, and its prerequisite techs researched
	needs: string[]; // what is missing: prerequisite techs not researched
};

/**
 * Edicts this empire can have (potential not false): the active ones and the rest. The game's
 * list shows those whose potential holds and that are unlocked (2207.03.10: five, the three
 * active and two campaigns); the others are the page's "show locked".
 */
export function edictRows(edicts: GameData['edicts'], s: Snapshot, f: Facts): EdictRow[] {
	const active = new Map((s.edictTimes ?? []).map((e) => [e.key, e]));
	return Object.entries(edicts)
		.map(([key, e]) => ({ key, e, possible: active.has(key) ? true : evaluate(e.potential, f) }))
		.filter((r) => r.possible !== false)
		.map(({ key, e, possible }) => {
			const needs = (e.prerequisites ?? []).filter((t) => !f.techs.includes(t));
			return {
				key,
				name: e.name,
				category: e.category,
				length: e.length,
				cost: e.cost,
				active: active.get(key) ?? null,
				possible,
				unlocked: unlocked(e.unlockedBy, f) && needs.length === 0,
				needs
			};
		});
}

export type DemandRow = GameData['factionTypes'][number]['demands'][number] & {
	applies: boolean | null; // its potential
	met: boolean | null; // its trigger
};
export type FactionRow = Omit<GameData['factionTypes'][number], 'demands'> & {
	ours: boolean; // its guiding ethic is one of ours (fanatic or not)
	demands: DemandRow[];
	formed?: Faction; // ours, as the save shows it
};

/** Faction types, those of our ethics first, each demand with whether it applies and is met. */
export function factionRows(types: GameData['factionTypes'], f: Facts): FactionRow[] {
	const ethics = f.government
		.filter((k) => k.startsWith('ethic_'))
		.map((k) => k.replace('ethic_fanatic_', 'ethic_'));
	const rows = types.map((t) => ({
		...t,
		ours: t.ethic !== null && ethics.includes(t.ethic),
		demands: t.demands
			.map((d) => ({ ...d, applies: evaluate(d.potential, f), met: evaluate(d.trigger, f) }))
			.filter((d) => d.applies !== false)
	}));
	return [...rows.filter((r) => r.ours), ...rows.filter((r) => !r.ours)];
}

export type SeatRow = {
	key: string;
	name: string;
	leaderId: number | null;
	leader: string | null;
	level: number | null; // the leader's level
	bonus: number; // the leader's own extra levels (bonus_skill_level)
	traits: string[];
	ruler: boolean;
};

/**
 * The council as the game shows it: the ruler's seat (by authority, `councilor_ruler_<kind>`; not
 * in the save's seat list) and the seats held, each with its leader, level and traits.
 */
export function seatRows(
	council: CouncilSeat[],
	ruler: Snapshot['ruler'],
	authority: string | undefined,
	positions: GameData['councilPositions']
): SeatRow[] {
	const rulerKey = authority ? `councilor_ruler_${authority.replace(/^auth_/, '')}` : '';
	return [
		...(positions[rulerKey]
			? [
					{
						key: rulerKey,
						name: positions[rulerKey].name,
						leaderId: ruler?.id ?? null,
						leader: ruler?.name ?? null,
						level: ruler?.level ?? null,
						bonus: ruler?.bonus ?? 0,
						traits: ruler?.traits ?? [],
						ruler: true
					}
				]
			: []),
		...council.map((c) => ({
			key: c.type,
			name: positions[c.type]?.name ?? c.type,
			leaderId: c.leaderId,
			leader: c.leaderName,
			level: c.leaderLevel,
			bonus: c.leaderBonus ?? 0,
			traits: c.leaderTraits ?? [],
			ruler: false
		}))
	];
}

/**
 * Country-wide `councilor_skill_add` the save shows active: traditions taken, edicts, policy
 * options selected, civics, timed modifiers (e.g. Departmental Efficiency's after-effect).
 */
export function councilorBonus(
	s: Snapshot,
	skill: GameData['councilorSkill']
): { source: string; value: number }[] {
	const held = [
		...(s.traditions ?? []).map((k) => `tradition:${k}`),
		...(s.edicts ?? []).map((k) => `tradition:${k}`),
		...Object.values(s.policies ?? {}).map((k) => `tradition:${k}`),
		...(s.government ?? []).map((k) => `civic:${k}`),
		...(s.countryModifiers ?? []).map((m) => `modifier:${m.key}`)
	];
	return [...new Set(held)]
		.filter((k) => skill[k] !== undefined)
		.map((k) => ({ source: k.replace(/^[a-z]+:/, ''), value: skill[k] }));
}

/** A seat's modifiers at a leader's level: the files give them per level. */
export const atLevel = (mods: Modifier[], level: number | null): Modifier[] =>
	level === null ? mods : mods.map((m) => ({ ...m, value: m.value * level }));

/**
 * The council with what each seat gives: its modifiers per level and at the councilor level (the
 * leader's level, its own extra levels and the country's `councilor_skill_add`), and its leader's
 * traits while on the council (`ltrait-councilor:<trait>`, flat). For the government and leaders tabs.
 */
export function councilSeats(
	s: Snapshot,
	data: Pick<GameData, 'councilPositions' | 'councilorSkill'>,
	explain: Record<string, Explanation>
) {
	const bonusTotal = councilorBonus(s, data.councilorSkill).reduce((a, b) => a + b.value, 0);
	return seatRows(
		s.council ?? [],
		s.ruler,
		s.government?.find((k) => k.startsWith('auth_')),
		data.councilPositions
	).map((r) => {
		const council = r.level === null ? null : r.level + r.bonus + bonusTotal;
		const perLevel = explain[`seat:${r.key}`]?.modifiers ?? [];
		return {
			...r,
			council,
			classes: data.councilPositions[r.key]?.classes ?? [],
			// per level, and what that gives at the councilor level
			effects: perLevel.map((m, i) => ({ perLevel: m, now: atLevel(perLevel, council)[i] })),
			// the leader's traits while on the council (flat, not per level)
			traitEffects: r.traits.flatMap((t) =>
				explain[`ltrait-councilor:${t}`]
					? [
							{
								trait: t,
								name: explain[`ltrait:${t}`]?.title ?? t,
								modifiers: explain[`ltrait-councilor:${t}`].modifiers
							}
						]
					: []
			)
		};
	});
}

export type PossibleSeat = {
	key: string;
	name: string;
	civic: string | null;
	possible: boolean | null;
};

/**
 * Seats the empire could fill but does not: those a civic of ours opens, and the base ones whose
 * `possible` is not false. Ruler seats come with the authority (`possible = { always = no }`).
 */
export function possibleSeats(
	positions: GameData['councilPositions'],
	held: string[],
	f: Facts
): PossibleSeat[] {
	return (
		Object.entries(positions)
			.filter(
				([key, p]) => !held.includes(key) && (p.civic === null || f.government.includes(p.civic))
			)
			.map(([key, p]) => ({ key, name: p.name, civic: p.civic, possible: evaluate(p.possible, f) }))
			// only what is known to be open: an enclave's seat once one of its leaders is hired
			.filter((p) => p.possible === true)
	);
}
