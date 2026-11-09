import type { ShipDesign } from './types.ts';

// A ship design's base stats, as the ship designer adds them up before empire modifiers: the
// size's hull and speed, every section's and component's `modifier` block, the reactor's power
// against what the parts draw, the parts' cost and upkeep, and each weapon's stats (data DB
// `ship_size`, `section_template`, `component_template`, extractor 2026-11-09). Techs,
// traditions and other empire-wide multipliers are not applied — the save does not list them per
// ship. Pure.

type Resources = Record<string, Record<string, number>>; // kind (cost, upkeep) → resource → amount

export type SizeData = {
	name: string | null;
	hitpoints: number;
	speed: number;
	modifiers: Record<string, number>;
	resources: Resources;
};
export type SectionData = { modifiers: Record<string, number>; resources: Resources };
export type ComponentData = {
	name: string | null;
	kind: string; // utility, weapon, strike_craft
	size: string | null;
	power: number;
	modifiers: Record<string, number>;
	weapon: Record<string, number> | null; // the weapon CSV's row: min_damage, cooldown, range, …
	resources: Resources;
};
export type ShipParts = {
	sizes: Record<string, SizeData>;
	sections: Record<string, SectionData>;
	components: Record<string, ComponentData>;
};
export const NO_SHIP_PARTS: ShipParts = { sizes: {}, sections: {}, components: {} };

export type WeaponLine = {
	key: string;
	name: string;
	count: number;
	minDamage: number;
	maxDamage: number;
	cooldown: number;
	range: number;
	accuracy: number;
	tracking: number;
	perCooldown: number; // count × mean damage ÷ cooldown: comparable between designs, unit the file's
};

export type DesignStats = {
	missing: string[]; // parts the data DB does not know: the stats leave them out
	hull: number;
	armor: number;
	shield: number;
	evasion: number;
	speed: number;
	powerUsed: number;
	powerMax: number;
	cost: Record<string, number>;
	upkeep: Record<string, number>;
	weapons: WeaponLine[];
	damagePerCooldown: number;
	other: Record<string, number>; // every other summed modifier (sensor range, …)
};

// the modifiers the stats above consume; the rest is listed as is
const USED = new Set([
	'ship_hitpoints_add',
	'ship_hitpoints_mult',
	'ship_armor_add',
	'ship_armor_mult',
	'ship_shield_add',
	'ship_shield_mult',
	'ship_evasion_add',
	'ship_evasion_mult',
	'ship_speed_mult',
	'ship_reactor_power_mult'
]);

const addInto = (into: Record<string, number>, from: Record<string, number> = {}) => {
	for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
};

/** Every component of a design: those in its sections' slots, then the required ones. */
export const designComponents = (d: ShipDesign): string[] => [
	...d.sections.flatMap((s) => s.components.map((c) => c.template)),
	...d.required
];

export function designStats(d: ShipDesign, parts: ShipParts): DesignStats {
	const missing: string[] = [];
	const mods: Record<string, number> = {};
	const cost: Record<string, number> = {};
	const upkeep: Record<string, number> = {};
	const pay = (r: Resources) => {
		addInto(cost, r.cost);
		addInto(upkeep, r.upkeep);
	};

	const size = parts.sizes[d.size];
	if (size) {
		addInto(mods, size.modifiers);
		pay(size.resources);
	} else missing.push(d.size);
	for (const s of d.sections) {
		const sec = parts.sections[s.template];
		if (!sec) {
			missing.push(s.template);
			continue;
		}
		addInto(mods, sec.modifiers);
		pay(sec.resources);
	}

	let powerUsed = 0;
	let powerMax = 0;
	const weapons = new Map<string, WeaponLine>();
	for (const key of designComponents(d)) {
		const c = parts.components[key];
		if (!c) {
			missing.push(key);
			continue;
		}
		addInto(mods, c.modifiers);
		pay(c.resources);
		if (c.power > 0) powerMax += c.power;
		else powerUsed -= c.power;
		const w = c.weapon;
		if (w && (w.max_damage ?? 0) > 0) {
			const line = weapons.get(key) ?? {
				key,
				name: c.name ?? key,
				count: 0,
				minDamage: w.min_damage ?? 0,
				maxDamage: w.max_damage ?? 0,
				cooldown: w.cooldown ?? 0,
				range: w.range ?? 0,
				accuracy: w.accuracy ?? 0,
				tracking: w.tracking ?? 0,
				perCooldown: 0
			};
			line.count += 1;
			line.perCooldown = line.cooldown
				? (line.count * (line.minDamage + line.maxDamage)) / 2 / line.cooldown
				: 0;
			weapons.set(key, line);
		}
	}

	const m = (k: string) => mods[k] ?? 0;
	const lines = [...weapons.values()];
	return {
		missing,
		hull: ((size?.hitpoints ?? 0) + m('ship_hitpoints_add')) * (1 + m('ship_hitpoints_mult')),
		armor: m('ship_armor_add') * (1 + m('ship_armor_mult')),
		shield: m('ship_shield_add') * (1 + m('ship_shield_mult')),
		evasion: m('ship_evasion_add') * (1 + m('ship_evasion_mult')),
		speed: (size?.speed ?? 0) * (1 + m('ship_speed_mult')),
		powerUsed,
		powerMax: powerMax * (1 + m('ship_reactor_power_mult')), // a Reactor Booster's +20 %
		cost,
		upkeep,
		weapons: lines,
		damagePerCooldown: lines.reduce((t, w) => t + w.perCooldown, 0),
		other: Object.fromEntries(Object.entries(mods).filter(([k]) => !USED.has(k)))
	};
}

/** A design's name as the game shows it: a bare suffix ("III", or none) after its size's name. */
export const designLabel = (d: Pick<ShipDesign, 'name' | 'size'>, sizeName: string): string =>
	d.name && !/^[IVXLC]+$/.test(d.name) ? d.name : `${sizeName} ${d.name}`.trim();

export type DesignStatus = 'saved' | 'unofficial' | 'unused';
/** saved and in use, saved but no ship built to it, or in use but no longer saved. */
export const designStatus = (d: Pick<ShipDesign, 'saved' | 'ships'>): DesignStatus =>
	!d.saved ? 'unofficial' : d.ships ? 'saved' : 'unused';
