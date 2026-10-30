import { RESERVES } from './nomad.ts';
import type { Resources } from './types.ts';

// Resources in groups as the game's top bar orders them. Anything not listed (rarer strategic
// resources, mod resources) falls into the last group.

export const GROUPS: { name: string; keys: string[] }[] = [
	{ name: 'basic', keys: ['energy', 'minerals', 'food', 'trade'] },
	{ name: 'advanced', keys: ['consumer_goods', 'alloys', 'unity', 'influence'] },
	{ name: 'research', keys: ['physics_research', 'society_research', 'engineering_research'] },
	{ name: 'strategic', keys: ['volatile_motes', 'exotic_gases', 'rare_crystals'] },
	{ name: 'rare', keys: [] }
];

const ORDER = GROUPS.flatMap((g) => g.keys);

export const groupOf = (key: string) =>
	GROUPS.find((g) => g.keys.includes(key))?.name ?? GROUPS[GROUPS.length - 1].name;

/** Sort key: position in the top bar, unknown ones last and alphabetically. */
export const byTopBar = (a: string, b: string) => {
	const ia = ORDER.indexOf(a);
	const ib = ORDER.indexOf(b);
	return (ia < 0 ? ORDER.length : ia) - (ib < 0 ? ORDER.length : ib) || a.localeCompare(b);
};

/** Flows split by group, empty groups left out. */
export function splitByGroup(flows: Resources): { name: string; flows: Resources }[] {
	return GROUPS.map((g) => ({
		name: g.name,
		flows: Object.fromEntries(Object.entries(flows).filter(([k]) => groupOf(k) === g.name))
	})).filter((g) => Object.keys(g.flows).length > 0);
}

// The Resources strip's order: basic and advanced first, unity and influence last, the rest
// (strategic, rare, mod resources) alphabetically between. Research has its own chart.
const STRIP_FIRST = ['energy', 'minerals', 'food', 'consumer_goods', 'alloys', 'trade'];
const STRIP_LAST = ['unity', 'influence'];
const RESEARCH = ['physics_research', 'society_research', 'engineering_research'];

/**
 * `keys` plus the always-shown ones, in the Resources strip's order, research left out. A nomad's
 * Operational Reserves take energy's and minerals' place, as in the game's top bar.
 */
export function stripOrder(keys: string[]): string[] {
	const first = keys.includes(RESERVES)
		? [RESERVES, ...STRIP_FIRST.filter((k) => k !== 'energy' && k !== 'minerals')]
		: STRIP_FIRST;
	const skip = new Set([...STRIP_FIRST, RESERVES, ...STRIP_LAST, ...RESEARCH]);
	return [...first, ...[...new Set(keys)].filter((k) => !skip.has(k)).sort(), ...STRIP_LAST];
}
