import type { Slots } from './starbases.ts';
import { evaluate, type Facts, type Trigger } from './triggers.ts';

// The starbase planner (the user's ask 2026-11-09: "where in my empire, and border + x, would it
// make sense to build which modules and buildings — resources in the systems, max deposit output,
// effects on my colonies, e.g. push automatic migration on the colony with the highest pop
// growth"). Per starbase module and building (data DB `starbase_part`, `starbase_part_modifier`,
// extractor 2026-11-09) and per candidate system, what its modifiers would do there:
// - `station_gatherers|researchers[_<resource>]_produces_mult` × the orbital deposits' base
//   output in the system (mining and research stations);
// - `planet_resettlement_unemployed_mult` (the Transit Hub's +200 %, a `system_modifier`) on the
//   system's colonies: ranked by the pops they can push out — civilians (the 4.x unemployed) and
//   last month's growth;
// - `planet_stability_add` on the system's colonies, colonies below 50 counting fully;
// - `pop_government_ethic_attraction` by the system's pops.
// Everything else (station defences, trade, country modifiers, …) is listed, not ranked. Only a
// part's own conditions are checked: the empire's (techs, perks, civics — `owner = { … }`
// unwrapped by the extraction) through #lib/triggers.ts, the starbase's level, and what is
// already built; a condition the save cannot answer leaves the part "maybe". Pure.

export type StarbasePart = {
	key: string;
	kind: 'module' | 'building';
	name: string;
	category: string | null;
	potential: Trigger | null;
	possible: Trigger | null;
	modifiers: { scope: string; key: string; value: number; when: Trigger | null }[];
};

export type PlannerColony = {
	name: string;
	pops: number;
	civilians: number;
	growth: number; // pops gained last month (growth and assembly)
	stability: number;
};

export type PlannerSystem = {
	id: number;
	name: string;
	jumps: number; // beyond the border: 0 for our own
	station: { level: string; modules: string[]; buildings: string[] } | null; // ours
	colonies: PlannerColony[]; // ours
	// base output a month of its orbital deposits per station kind and resource, and how many of
	// those deposits a station of ours works already
	deposits: Record<'gatherers' | 'researchers', Record<string, number>>;
	deposited: { total: number; worked: number };
};

export type Suggestion = {
	part: string;
	systemId: number;
	score: number; // to rank one part's systems; units differ between parts
	reasons: string[];
	needs: string[]; // what has to happen first: an outpost, an upgrade, a free slot
	maybe: boolean; // a condition the save cannot answer
};

export const LEVELS = ['outpost', 'starport', 'starhold', 'starfortress', 'citadel'];
const levelIndex = (level: string) => LEVELS.indexOf(level.replace(/^starbase_/, ''));

const T: Trigger = { leaf: 'always', value: 'yes' };
const F: Trigger = { leaf: 'always', value: 'no' };
const constant = (v: boolean, value: string) => ((value === 'no' ? !v : v) ? T : F);

/**
 * A part's trigger with the starbase's own leaves answered for a regular starbase at `level`:
 * not an orbital ring, citadel of space, arkship or waystation; `exists = owner` true; the level
 * compared. Scopes such as `solar_system = { … }` stay unknown.
 */
export function atStarbase(t: Trigger | null, level: string): Trigger | null {
	if (t === null) return null;
	if (!('leaf' in t)) return { op: t.op, args: t.args.map((a) => atStarbase(a, level) ?? T) };
	if (t.leaf === 'is_normal_starbase') return constant(true, t.value);
	if (/orbital_ring|space_citadel|arkship|waystation/.test(t.leaf)) return constant(false, t.value);
	if (t.leaf === 'exists' && t.value === 'owner') return T;
	if (t.leaf === 'has_starbase_size') {
		const have = levelIndex(level);
		const want = levelIndex(t.value);
		if (have < 0 || want < 0) return t;
		const ok =
			t.cmp === '>=' || t.cmp === undefined
				? have >= want
				: t.cmp === '>'
					? have > want
					: t.cmp === '<'
						? have < want
						: t.cmp === '<='
							? have <= want
							: have === want;
		return ok ? T : F;
	}
	return t;
}

/** Whether the empire can have the part on a regular starbase at all (`potential`). */
export const partAvailable = (p: StarbasePart, f: Facts): boolean | null =>
	evaluate(atStarbase(p.potential, 'citadel'), f);

/** The lowest level whose `possible` is not false, or null if none is. */
function neededLevel(
	p: StarbasePart,
	f: Facts,
	from: string
): { level: string; maybe: boolean } | null {
	for (const level of LEVELS.slice(Math.max(0, levelIndex(from)))) {
		const ok = evaluate(atStarbase(p.possible, level), f);
		if (ok !== false) return { level, maybe: ok === null };
	}
	return null;
}

const STATION = /^station_(gatherers|researchers)(?:_(\w+?))?_produces_mult$/;
const fmt = (n: number) => (Math.abs(n) >= 10 ? n.toFixed(0) : n.toFixed(1));
const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)} %`;
const pretty = (k: string) => k.replace(/_/g, ' ');

/** Whether a part has a modifier the planner ranks. */
export const ranked = (p: StarbasePart): boolean =>
	p.modifiers.some(
		(m) =>
			STATION.test(m.key) ||
			(m.scope === 'system' &&
				[
					'planet_resettlement_unemployed_mult',
					'planet_stability_add',
					'pop_government_ethic_attraction'
				].includes(m.key))
	);

/** What one part would do in one system: a score and the reasons, or null for nothing. */
export function partInSystem(
	p: StarbasePart,
	s: PlannerSystem,
	f: Facts,
	slots: Slots
): Suggestion | null {
	const built = s.station ? [...s.station.modules, ...s.station.buildings] : [];
	if (built.includes(p.key)) return null;
	const from = s.station?.level ?? 'outpost';
	const need = neededLevel(p, f, from);
	if (!need) return null;
	let maybe = need.maybe;
	let score = 0;
	const reasons: string[] = [];
	for (const m of p.modifiers) {
		const on = evaluate(atStarbase(m.when, need.level), f);
		if (on === false) continue;
		if (on === null) maybe = true;
		const st = STATION.exec(m.key);
		if (st) {
			const kind = st[1] as 'gatherers' | 'researchers';
			const out = Object.entries(s.deposits[kind]).filter(([r]) => !st[2] || r === st[2]);
			const base = out.reduce((t, [, v]) => t + v, 0);
			if (base <= 0) continue;
			score += m.value * base;
			reasons.push(
				`${pct(m.value)} of ${out.map(([r, v]) => `${fmt(v)} ${pretty(r)}`).join(', ')} a month from orbital deposits = +${fmt(m.value * base)}` +
					(s.deposited.worked < s.deposited.total
						? ` (stations on ${s.deposited.worked} of ${s.deposited.total} deposits)`
						: '')
			);
			continue;
		}
		if (m.scope !== 'system' || !s.colonies.length) continue;
		const pops = s.colonies.reduce((t, c) => t + c.pops, 0);
		if (m.key === 'planet_resettlement_unemployed_mult') {
			const civilians = s.colonies.reduce((t, c) => t + c.civilians, 0);
			const growth = s.colonies.reduce((t, c) => t + Math.max(0, c.growth), 0);
			const push = civilians + growth;
			if (push <= 0) continue;
			score += Math.sign(m.value) * push;
			const top = [...s.colonies].sort((a, b) => b.growth - a.growth)[0];
			reasons.push(
				`${pct(m.value)} automatic resettlement on ${s.colonies.length} ${s.colonies.length === 1 ? 'colony' : 'colonies'}: ${fmt(civilians)} civilians, +${fmt(growth)} pops last month` +
					(top.growth > 0 ? ` (most: ${top.name} +${fmt(top.growth)})` : '')
			);
		} else if (m.key === 'planet_stability_add') {
			const low = s.colonies.filter((c) => c.stability < 50).length;
			score += m.value * (low + 0.25 * (s.colonies.length - low));
			reasons.push(
				`+${fmt(m.value)} stability on ${s.colonies.length} ${s.colonies.length === 1 ? 'colony' : 'colonies'}` +
					(low ? ` (${low} below 50)` : '')
			);
		} else if (m.key === 'pop_government_ethic_attraction') {
			score += m.value * pops;
			reasons.push(`${pct(m.value)} governing ethics attraction for ${fmt(pops)} pops`);
		}
	}
	if (score <= 0) return null;

	const needs: string[] = [];
	if (!s.station) needs.push('an outpost');
	if (levelIndex(need.level) > levelIndex(from)) needs.push(`upgrade to ${need.level}`);
	const level = LEVELS[Math.max(levelIndex(from), levelIndex(need.level))];
	const room = slots[level];
	const usedSlots = s.station
		? p.kind === 'module'
			? s.station.modules.length
			: s.station.buildings.length
		: 0;
	const have = room ? (p.kind === 'module' ? room.modules : room.buildings) : null;
	if (have !== null && usedSlots >= have) needs.push(`a free ${p.kind} slot`);
	return { part: p.key, systemId: s.id, score, reasons, needs, maybe };
}

export type PartPlan = {
	part: StarbasePart;
	available: boolean | null; // the empire's own conditions: true, unknown, or (not listed) false
	best: Suggestion[]; // its systems, best first
};

/** Every part the empire can have, with its candidate systems ranked; unranked parts last. */
export function planStarbases(
	parts: Record<string, StarbasePart>,
	systems: PlannerSystem[],
	f: Facts,
	slots: Slots
): PartPlan[] {
	return Object.values(parts)
		.map((part) => ({ part, available: partAvailable(part, f) }))
		.filter((x) => x.available !== false)
		.map(({ part, available }) => ({
			part,
			available,
			best: ranked(part)
				? systems
						.map((s) => partInSystem(part, s, f, slots))
						.filter((x): x is Suggestion => x !== null)
						.sort((a, b) => b.score - a.score || a.needs.length - b.needs.length)
				: []
		}))
		.sort(
			(a, b) =>
				Number(b.best.length > 0) - Number(a.best.length > 0) ||
				a.part.name.localeCompare(b.part.name)
		);
}
