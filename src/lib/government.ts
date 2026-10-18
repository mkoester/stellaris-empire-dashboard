import { evaluate, type Facts } from './triggers.ts';
import type { CouncilSeat, GameData, Modifier, Snapshot } from './types.ts';

// The government tab (council, agendas, policies, edicts, factions): the data DB's rules read
// against one save. What the save cannot answer stays unknown (null), see #lib/triggers.ts.

/** What a snapshot tells the trigger evaluator. */
export function facts(s: Snapshot): Facts {
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
		atWar: s.wars === null ? null : s.wars.length > 0
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
	f: Facts
): PolicyRow[] {
	return policies
		.map((p) => ({
			key: p.key,
			name: p.name,
			category: p.category,
			selected: selected[p.key] ?? null,
			options: p.options
				.filter((o) => selected[p.key] === o.key || evaluate(o.potential, f) !== false)
				.map((o) => ({
					key: o.key,
					name: o.name,
					selected: selected[p.key] === o.key,
					valid: evaluate(o.valid, f)
				}))
		}))
		.filter((p) => p.selected !== null || p.options.length > 1);
}

export type AgendaStatus = 'current' | 'cooldown' | 'open' | 'locked';
export type AgendaRow = { key: string; name: string; cost: number | null; status: AgendaStatus };

/** Every council agenda: the one being prepared, those on cooldown, open and still locked. */
export function agendaRows(agendas: GameData['agendas'], s: Snapshot, f: Facts): AgendaRow[] {
	const current = s.progress?.agenda?.key;
	return Object.entries(agendas).map(([key, a]) => ({
		key,
		name: a.name,
		cost: a.cost,
		status:
			key === current
				? 'current'
				: (s.agendasDone ?? []).includes(key)
					? 'cooldown'
					: unlocked(a.unlockedBy, f)
						? 'open'
						: 'locked'
	}));
}

export type EdictRow = {
	key: string;
	name: string;
	category: string | null;
	length: number | null;
	cost: GameData['edicts'][string]['cost'];
	active: { start: string | null; end: string | null } | null;
	unlocked: boolean;
};

/** Edicts this empire can have (potential not false): the active ones and the rest. */
export function edictRows(edicts: GameData['edicts'], s: Snapshot, f: Facts): EdictRow[] {
	const active = new Map((s.edictTimes ?? []).map((e) => [e.key, e]));
	return Object.entries(edicts)
		.filter(([key, e]) => active.has(key) || evaluate(e.potential, f) !== false)
		.map(([key, e]) => ({
			key,
			name: e.name,
			category: e.category,
			length: e.length,
			cost: e.cost,
			active: active.get(key) ?? null,
			unlocked: unlocked(e.unlockedBy, f)
		}));
}

export type DemandRow = GameData['factionTypes'][number]['demands'][number] & {
	applies: boolean | null; // its potential
	met: boolean | null; // its trigger
};
export type FactionRow = Omit<GameData['factionTypes'][number], 'demands'> & {
	ours: boolean; // its guiding ethic is one of ours (fanatic or not)
	demands: DemandRow[];
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
	leader: string | null;
	level: number | null;
	ruler: boolean;
};

/**
 * The council as the game shows it: the ruler's seat (by authority, `councilor_ruler_<kind>`; not
 * in the save's seat list) and the seats held, each with its leader and level.
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
						leader: ruler?.name ?? null,
						level: ruler?.level ?? null,
						ruler: true
					}
				]
			: []),
		...council.map((c) => ({
			key: c.type,
			name: positions[c.type]?.name ?? c.type,
			leader: c.leaderName,
			level: c.leaderLevel,
			ruler: false
		}))
	];
}

/** A seat's modifiers at a leader's level: the files give them per level. */
export const atLevel = (mods: Modifier[], level: number | null): Modifier[] =>
	level === null ? mods : mods.map((m) => ({ ...m, value: m.value * level }));

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
	return Object.entries(positions)
		.filter(
			([key, p]) => !held.includes(key) && (p.civic === null || f.government.includes(p.civic))
		)
		.map(([key, p]) => ({ key, name: p.name, civic: p.civic, possible: evaluate(p.possible, f) }))
		.filter((p) => p.possible !== false);
}
