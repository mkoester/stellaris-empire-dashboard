import { regular } from './ethicsTab.ts';
import { evaluate, type Facts, type Trigger } from './triggers.ts';
import type { Snapshot } from './types.ts';

// Everything that draws pops to an ethic, for the ethics tab's last panel: the ethic's own rules
// (common/ethics/00_ethics.txt — empire-wide `country_attraction` factors and the reasons the
// game's tooltip names, `pop_attraction_tag`) and every modifier that raises an ethic's attraction
// (`pop_ethic_<x>_attraction_mult`), the governing ethics' (`pop_government_ethic_attraction`) or
// the speed pops shift (`pop_ethics_shift_speed_mult`) — from the data DB's modifier tables.
// Whether each applies to us is read from the latest save, three-valued (null: cannot tell); what
// the player can change marked by how. Pure.

/** Whose attraction a source moves: an ethic's key, the governing ethics, or the shift speed. */
export type Target = string | 'government' | 'shift';

export type SourceKind =
	| 'tradition'
	| 'perk'
	| 'edict'
	| 'agenda'
	| 'policy'
	| 'civic'
	| 'origin'
	| 'building'
	| 'designation'
	| 'council'
	| 'leader'
	| 'static'
	| 'deposit'
	| 'relic'
	| 'other';

/** A modifier source as the data DB holds it. */
export type AttractionSource = {
	target: Target;
	kind: SourceKind;
	key: string; // the owner's key; an agenda's after-launch modifier ends in `#finish`
	value: number; // +0.25 = +25 %
	scope: string | null; // a leader trait's: councilor, planet, sector; a building's: planet
};

/** An ethic's own rule (data DB `ethic_attraction`). */
export type AttractionRule = {
	kind: 'tag' | 'country';
	description: string | null;
	factor: number | null; // 'country': × this
	factorText: string | null; // 'country': a script value the save cannot answer
	trigger: Trigger | null;
};

/**
 * The data DB's modifier rows (one per table; `tradition_modifier` holds traditions, perks,
 * edicts, agendas — `#finish` after launch —, policy options and origins alike, told apart by
 * `owners`) → the sources that move an attraction.
 */
export function attractionSources(
	rows: { tbl: string; owner: string; modifier: string; value: number; scope: string | null }[],
	owners: Record<'tradition' | 'perk' | 'edict' | 'agenda' | 'policy' | 'origin', string[]>
): AttractionSource[] {
	const sets = Object.entries(owners).map(([k, keys]) => [k, new Set(keys)] as const);
	const kindOf = (tbl: string, owner: string): SourceKind => {
		if (tbl !== 'tradition_modifier') return tbl as SourceKind;
		const base = owner.split('#')[0];
		return (sets.find(([, keys]) => keys.has(base))?.[0] as SourceKind | undefined) ?? 'other';
	};
	return rows.flatMap((r) => {
		const target = targetOf(r.modifier);
		return target
			? [{ target, kind: kindOf(r.tbl, r.owner), key: r.owner, value: r.value, scope: r.scope }]
			: [];
	});
}

/** A modifier key → whose attraction it moves; null for any other modifier. */
export function targetOf(modifier: string): Target | null {
	if (modifier === 'pop_government_ethic_attraction') return 'government';
	if (modifier === 'pop_ethics_shift_speed_mult') return 'shift';
	const m = /^pop_ethic_(\w+)_attraction_mult$/.exec(modifier);
	return m ? `ethic_${m[1]}` : null;
}

/**
 * How the player changes a source: `now` (an edict, a policy, a building, a designation, a leader,
 * an agenda, promoting or suppressing a faction), `slow` (adopted for good, or a reform), or `no`.
 */
export type Change = { how: 'now' | 'slow' | 'no'; label: string };

export function changeOf(s: Pick<AttractionSource, 'kind' | 'key' | 'scope'>): Change {
	switch (s.kind) {
		case 'edict':
			return { how: 'now', label: 'enact or cancel the edict' };
		case 'policy':
			return { how: 'now', label: 'change the policy' };
		case 'building':
			return { how: 'now', label: 'build or demolish' };
		case 'designation':
			return { how: 'now', label: 'change the designation (the capital: move it)' };
		case 'leader':
			return {
				how: 'now',
				label:
					s.scope === 'councilor' ? 'seat the leader on the council' : 'make the leader governor'
			};
		case 'agenda':
			return { how: 'now', label: 'launch the agenda' };
		case 'tradition':
		case 'perk':
			return { how: 'slow', label: 'adopt it (for good)' };
		case 'civic':
		case 'council':
			return { how: 'slow', label: 'reform the government' };
		case 'static':
			return /^(promoted|suppressed)_/.test(s.key)
				? { how: 'now', label: 'promote or suppress the faction' }
				: { how: 'no', label: 'an event or situation' };
		default:
			return { how: 'no', label: 'fixed' };
	}
}

/** What the latest save tells about our sources. */
export type Holdings = {
	traditions: string[];
	perks: string[];
	edicts: string[];
	policies: string[]; // the options picked
	government: string[]; // civics, ethics, authority
	origin: string | null;
	agenda: string | null; // being prepared
	modifiers: string[]; // empire-wide and colonies' timed and static modifiers
	buildings: Record<string, number>; // built, on how many colonies
	designations: Record<string, number>;
	deposits: Record<string, number>;
	councilSeats: string[];
	councilTraits: string[]; // traits of the ruler and councilors
	leaderTraits: string[]; // traits of every leader
};

export function holdings(s: Snapshot): Holdings {
	const count = (keys: string[]) =>
		keys.reduce<Record<string, number>>((n, k) => ({ ...n, [k]: (n[k] ?? 0) + 1 }), {});
	const leaders = s.leaderList ?? [];
	return {
		traditions: s.traditions ?? [],
		perks: s.ascensionPerks ?? [],
		edicts: s.edicts ?? [],
		policies: Object.values(s.policies ?? {}),
		government: s.government ?? [],
		origin: s.origin,
		agenda: s.progress?.agenda?.key ?? null,
		modifiers: [
			...(s.countryModifiers ?? []).map((m) => m.key),
			...s.colonies.flatMap((c) => (c.planet?.modifiers ?? []).map((m) => m.key))
		],
		// once per colony, as a building's planet modifier counts once per planet
		buildings: count(
			s.colonies.flatMap((c) => [
				...new Set(c.districtList.flatMap((d) => d.zones.flatMap((z) => z.buildings)))
			])
		),
		designations: count(s.colonies.map((c) => c.designation)),
		deposits: count(s.colonies.flatMap((c) => [...new Set(c.deposits)])),
		councilSeats: (s.council ?? []).map((c) => c.type),
		councilTraits: leaders.filter((l) => l.council || l.ruler).flatMap((l) => l.traits),
		leaderTraits: leaders.flatMap((l) => l.traits)
	};
}

/**
 * Whether a source applies now: true, false, a number of colonies (planet-wide sources), or null
 * when the save cannot tell (relics, a governor's trait — whose planet is not read).
 */
export function applies(s: AttractionSource, h: Holdings): boolean | number | null {
	switch (s.kind) {
		case 'tradition':
			return h.traditions.includes(s.key);
		case 'perk':
			return h.perks.includes(s.key);
		case 'edict':
			return h.edicts.includes(s.key);
		case 'policy':
			return h.policies.includes(s.key);
		case 'civic':
			return h.government.includes(s.key);
		case 'origin':
			return h.origin === s.key;
		case 'council':
			return h.councilSeats.includes(s.key);
		case 'agenda': {
			// while preparing it, then its after-launch modifier as a timed one of the same key
			const [key, finish] = s.key.split('#');
			return finish ? h.modifiers.includes(key) : h.agenda === key;
		}
		case 'building':
			return h.buildings[s.key] ?? 0;
		case 'designation':
			return h.designations[s.key] ?? 0;
		case 'deposit':
			return h.deposits[s.key] ?? 0;
		case 'static':
			return h.modifiers.includes(s.key);
		case 'leader':
			if (!h.leaderTraits.includes(s.key)) return false;
			return s.scope === 'councilor' ? h.councilTraits.includes(s.key) : null;
		default:
			return null;
	}
}

export type RuleRow = AttractionRule & { applies: boolean | null };

/** An ethic's own rules, each evaluated against the empire (a pop-scope condition stays null). */
export function ruleRows(rules: AttractionRule[], f: Facts): RuleRow[] {
	return rules.map((r) => ({
		...r,
		applies: r.kind === 'country' && r.factorText !== null ? null : evaluate(r.trigger, f)
	}));
}

/**
 * The empire-wide factor of an ethic from its rules: the product of the factors known to apply,
 * and how many rules may apply but cannot be told (a script value, a condition the save cannot
 * answer). The save's `ethics_attraction` (the tab's "×") over `known` is what those add.
 */
export function countryFactor(rows: RuleRow[]): { known: number; open: number } {
	let known = 1;
	let open = 0;
	for (const r of rows) {
		if (r.kind !== 'country' || r.applies === false) continue;
		if (r.applies === null || r.factor === null) open++;
		else known *= r.factor;
	}
	return { known, open };
}

/** The sources grouped by target, governing ethics and shift speed last; ours first in each. */
export function groupTargets(order: string[], government: string[]): Target[] {
	const ours = new Set(government.filter((k) => k.startsWith('ethic_')).map(regular));
	const ethics = order.filter((k) => k === regular(k) && k !== 'ethic_gestalt_consciousness');
	return [
		...ethics.filter((k) => ours.has(k)),
		...ethics.filter((k) => !ours.has(k)),
		'government',
		'shift'
	];
}
