import { colonyActiveBuildings } from './buildings.ts';
import { regular } from './ethicsTab.ts';
import { evaluate, type Facts, type Trigger } from './triggers.ts';
import type { GameData, Snapshot } from './types.ts';

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
	after?: number; // an agenda's: its modifier for years after launch (`#finish`), beside `value` while preparing
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
	const all: AttractionSource[] = rows.flatMap((r) => {
		const target = targetOf(r.modifier);
		return target
			? [{ target, kind: kindOf(r.tbl, r.owner), key: r.owner, value: r.value, scope: r.scope }]
			: [];
	});
	// an agenda's two modifiers, while preparing and after launch, as one source
	const finish = (s: AttractionSource) => s.kind === 'agenda' && s.key.endsWith('#finish');
	return all
		.filter((s) => !finish(s))
		.map((s) => {
			const after = all.find(
				(x) => finish(x) && x.target === s.target && x.key === `${s.key}#finish`
			);
			return after && s.kind === 'agenda' ? { ...s, after: after.value } : s;
		})
		.concat(
			// an after-launch modifier without one while preparing stays on its own
			all.filter(
				(x) =>
					finish(x) &&
					!all.some((s) => !finish(s) && s.target === x.target && `${s.key}#finish` === x.key)
			)
		);
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
		// every working one: a building's planet modifier applies per building — checked
		// 2026-10-30, a second Temple took a pop group's spiritualist attraction from 5.225 × 1.30
		// to × 1.35; a disabled one does nothing (#lib/buildings.ts)
		buildings: count(s.colonies.flatMap((c) => colonyActiveBuildings(c.districtList))),
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
			if (finish) return h.modifiers.includes(key);
			return h.agenda === key || (s.after !== undefined && h.modifiers.includes(key));
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

/**
 * How a source is had: whether this empire can have it at all (`forUs`, its potential — false
 * hides it, as the nomads' twin of an agenda), whether it can be taken now (`available`), and what
 * it needs, named. null where the data DB or the save cannot tell.
 */
export type Unlock = { forUs: boolean | null; available: boolean | null; needs: Need[] };
/** One thing a source needs: its text and, where it has one, its popup (`civic:`, `tech:`, …). */
export type Need = { text: string; ref?: string; any?: boolean }; // any: one of the `any` ones suffices

export type UnlockData = Pick<
	GameData,
	| 'edicts'
	| 'agendas'
	| 'policies'
	| 'councilPositions'
	| 'traditionTrees'
	| 'techs'
	| 'buildingUnlocks'
>;

// Progress a potential may ask for: it makes a source unavailable yet, not "never for us".
const PROGRESS: Record<string, string> = {
	has_technology: 'tech',
	has_tradition: 'tradition',
	has_ascension_perk: 'perk'
};

/** A trigger with its progress leaves taken as met: what is left is who the empire is. */
function identityOnly(t: Trigger | null): Trigger | null {
	if (t === null) return null;
	if ('leaf' in t) return PROGRESS[t.leaf] ? { leaf: 'always', value: 'yes' } : t;
	return { ...t, args: t.args.map((a) => identityOnly(a) ?? { leaf: 'always', value: 'yes' }) };
}

/** The progress leaves a trigger asks for outright (not under a `not`), as [kind, key]. */
function progressOf(t: Trigger | null): [string, string][] {
	if (t === null) return [];
	if ('leaf' in t) return PROGRESS[t.leaf] ? [[PROGRESS[t.leaf], t.value]] : [];
	return t.op === 'and' ? t.args.flatMap(progressOf) : [];
}

export function unlockOf(
	s: Pick<AttractionSource, 'kind' | 'key' | 'scope'>,
	g: UnlockData,
	f: Facts,
	name: (prefix: string, key: string) => string
): Unlock {
	const named = (prefix: string, key: string, text = `${prefix} ${name(prefix, key)}`): Need => ({
		text,
		ref: `${prefix}:${key}`
	});
	const techName = (t: string) => `tech ${g.techs[t]?.name ?? t}`;
	// whether this empire can have it at all, and the progress its potential asks for
	const potential = (t: Trigger | null) => ({
		forUs: evaluate(identityOnly(t), f),
		now: evaluate(t, f),
		needs: progressOf(t).map(([kind, key]) =>
			named(kind, key, kind === 'tech' ? techName(key) : undefined)
		)
	});
	const base = s.key.split('#')[0];
	const taken = (by: string[]) =>
		by.length === 0 || by.some((k) => f.traditions.includes(k) || f.perks.includes(k));
	// one of them suffices: the game unlocks it with any
	const unlockers = (by: string[]) =>
		by.map((k) => ({ ...named(k.startsWith('ap_') ? 'perk' : 'tradition', k), any: true }));
	const and = (...v: (boolean | null)[]) =>
		v.includes(false) ? false : v.includes(null) ? null : true;
	switch (s.kind) {
		case 'edict': {
			const e = g.edicts[base];
			if (!e) break;
			const p = potential(e.potential);
			const techs = e.prerequisites.filter((t) => !f.techs.includes(t));
			return {
				forUs: p.forUs,
				available: and(p.now, taken(e.unlockedBy), techs.length === 0),
				needs: [
					...unlockers(e.unlockedBy),
					...e.prerequisites.map((t) => named('tech', t, techName(t))),
					...p.needs
				]
			};
		}
		case 'agenda': {
			const a = g.agendas[base];
			if (!a) break;
			const p = potential(a.potential ?? null);
			return {
				forUs: p.forUs,
				available: and(p.now, taken(a.unlockedBy), evaluate(a.allow ?? null, f)),
				needs: [...unlockers(a.unlockedBy), ...p.needs]
			};
		}
		case 'policy': {
			const p = g.policies.find((x) => x.options.some((o) => o.key === base));
			const o = p?.options.find((x) => x.key === base);
			if (!p || !o) break;
			const pot = potential(o.potential);
			return {
				forUs: pot.forUs,
				available: and(pot.now, evaluate(o.valid, f)),
				needs: [named('policy', base, `the policy ${p.name}`), ...pot.needs]
			};
		}
		case 'building': {
			// the civics or origins that unlock it (data DB `building_unlock`); techs are not known
			const by = g.buildingUnlocks[base] ?? [];
			if (!by.length) return { forUs: null, available: null, needs: [{ text: 'build it' }] };
			return {
				forUs: null,
				available: by.some((k) => f.government.includes(k) || f.origin === k),
				needs: by.map((k) => ({
					...named(k.startsWith('origin_') ? 'origin' : 'civic', k),
					any: true
				}))
			};
		}
		case 'council': {
			const c = g.councilPositions[base];
			if (!c?.civic) break;
			return {
				forUs: null,
				available: f.government.includes(c.civic),
				needs: [named('civic', c.civic, `the civic ${name('civic', c.civic)} (its council seat)`)]
			};
		}
		case 'tradition': {
			const tree = Object.values(g.traditionTrees).find((t) =>
				t.traditions.some((x) => x.key === base)
			);
			return {
				forUs: null,
				available: null,
				needs: tree ? [{ text: `the ${tree.name} tree` }] : []
			};
		}
		case 'perk':
			return { forUs: null, available: null, needs: [{ text: 'an ascension perk slot' }] };
		case 'civic':
			return { forUs: null, available: null, needs: [{ text: 'the civic, by a reform' }] };
		case 'leader':
			return {
				forUs: null,
				available: f.leaderTraits?.includes(base) ?? null,
				needs: [
					named(
						'ltrait',
						base,
						`a leader with the trait ${s.scope === 'councilor' ? 'on the council' : 'as governor'}`
					)
				]
			};
		case 'static':
			if (/^(promoted|suppressed)_/.test(base))
				return {
					forUs: null,
					available: (f.factions?.length ?? 0) > 0 ? null : false,
					needs: [{ text: 'a faction of the ethic to promote or suppress' }]
				};
	}
	return { forUs: null, available: null, needs: [] };
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
