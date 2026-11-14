// Our own icons for districts, zones and buildings — no game art (workspace AGENTS.md, licence).
// Each is a list of SVG path `d`s on a 24×24 grid, stroked in `currentColor` (Icon.svelte), so
// they follow light and dark mode. Mods add districts and buildings: a key resolves by its words
// first, then by the building's category (data DB `building.category`), then to a plain hexagon.
// Pure.

const circle = (cx: number, cy: number, r: number) =>
	`M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const ICONS = {
	generic: ['M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z'],
	city: ['M3 21h18', 'M5 21V10h4v11', 'M9 21V5h6v16', 'M15 21v-8h4v8', 'M11.5 8h1', 'M11.5 12h1'],
	industry: ['M3 21V12l5 3v-3l5 3v-3l5 3V5h3v16z', 'M7 18h2', 'M12 18h2'],
	foundry: [
		'M3 20l2-5h14l2 5z',
		'M7 15l1.5-4h7l1.5 4',
		'M12 3v4',
		'M8.5 4.5l1.5 2',
		'M15.5 4.5l-1.5 2'
	],
	energy: ['M13 2L4 14h7l-1 8 9-12h-7z'],
	mining: ['M3 9.5c5-5 13-5 18 0', 'M12 5.8L7 21'],
	food: [
		'M12 21V7',
		'M12 12c-3 0-5-2-5-5 3 0 5 2 5 5z',
		'M12 12c3 0 5-2 5-5-3 0-5 2-5 5z',
		'M12 17c-3 0-5-2-5-5 3 0 5 2 5 5z',
		'M12 17c3 0 5-2 5-5-3 0-5 2-5 5z'
	],
	research: ['M9 3h6', 'M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3', 'M7.5 15h9'],
	physics: [
		'M3 12a9 3.5 0 1 0 18 0a9 3.5 0 1 0-18 0',
		'M7.5 4.21a9 3.5 60 1 0 9 15.58a9 3.5 60 1 0-9-15.58',
		'M16.5 4.21a9 3.5 -60 1 0-9 15.58a9 3.5 -60 1 0 9-15.58',
		circle(12, 12, 1)
	],
	society: [
		'M7 3c0 5 10 4 10 9s-10 4-10 9',
		'M17 3c0 5-10 4-10 9s10 4 10 9',
		'M8.5 6.5h7',
		'M8.5 17.5h7'
	],
	engineering: [
		'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z'
	],
	trade: [
		'M5 7a7 3 0 1 0 14 0a7 3 0 1 0-14 0',
		'M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7',
		'M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5'
	],
	unity: ['M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z'],
	government: [
		'M3 21h18',
		'M5 21v-8h14v8',
		'M4 13h16',
		'M6 13a6 6 0 0 1 12 0',
		'M12 4v3',
		'M9 16.5v4.5',
		'M15 16.5v4.5'
	],
	army: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M12 8v8', 'M8.5 11.5h7'],
	prison: ['M4 4h16v16H4z', 'M9 4v16', 'M15 4v16'],
	crystal: ['M6 3h12l3 6-9 12L3 9z', 'M3 9h18', 'M9 3l3 18', 'M15 3l-3 18'],
	gas: ['M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A4 4 0 1 1 17 18z'],
	motes: [circle(7, 8, 2), circle(16, 6, 1.5), circle(15, 15, 2.5), circle(6, 17, 1.5)],
	assembly: [circle(10, 7, 3.5), 'M3.5 20a6.5 6.5 0 0 1 13 0', 'M19.5 9v6', 'M16.5 12h6'],
	resort: [
		circle(12, 12, 4),
		'M12 2v2.5',
		'M12 19.5V22',
		'M2 12h2.5',
		'M19.5 12H22',
		'M4.9 4.9l1.8 1.8',
		'M17.3 17.3l1.8 1.8',
		'M4.9 19.1l1.8-1.8',
		'M17.3 6.7l1.8-1.8'
	],
	amenity: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z']
} satisfies Record<string, string[]>;

export type IconName = keyof typeof ICONS;

// First match wins: strategic resources and the district's family before its specialisation
// (`district_mining_physics` is a mining district), research's branches before research.
const BY_WORD: [IconName, string[]][] = [
	['crystal', ['crystal', 'crystals']],
	['gas', ['gases']],
	['motes', ['motes']],
	[
		'government',
		['capital', 'palace', 'administrative', 'bureaucratic', 'government', 'goverment', 'embassy']
	],
	[
		'army',
		[
			'fortress',
			'stronghold',
			'military',
			'garrison',
			'battlement',
			'battlements',
			'shield',
			'encampment'
		]
	],
	['prison', ['prison']],
	['energy', ['generator', 'energy', 'geothermal', 'reactor']],
	['mining', ['mining', 'minerals', 'miner']],
	[
		'food',
		['farming', 'farm', 'food', 'hydroponics', 'agrarian', 'orchard', 'photosynthesis', 'anglers']
	],
	['foundry', ['foundry', 'forge', 'furnace']],
	['industry', ['factory', 'industrial', 'industry', 'refinery', 'chemical', 'fabricator']],
	['engineering', ['engineering']],
	['physics', ['physics']],
	['society', ['society', 'biolab', 'genomic']],
	[
		'research',
		[
			'research',
			'lab',
			'science',
			'institute',
			'supercomputer',
			'observatory',
			'archive',
			'polytechnic',
			'archaeostudies'
		]
	],
	['trade', ['trade', 'commercial', 'market', 'emporium', 'concession']],
	['unity', ['unity', 'temple', 'spiritualist', 'spiritual', 'sanctum', 'monument', 'trophy']],
	['assembly', ['assembly', 'spawning', 'clone', 'replication', 'offspring', 'vats']],
	['resort', ['resort', 'leisure', 'zoo', 'museum', 'hunting']],
	[
		'amenity',
		['theatres', 'theater', 'entertainment', 'clinic', 'medical', 'luxury', 'paradise', 'clubs']
	],
	[
		'city',
		['city', 'urban', 'housing', 'hive', 'nexus', 'dwellings', 'residence', 'warren', 'huts']
	]
];

const BY_CATEGORY: Record<string, IconName> = {
	research: 'research',
	manufacturing: 'industry',
	resource: 'mining',
	amenity: 'amenity',
	amenities: 'amenity',
	unity: 'unity',
	government: 'government',
	army: 'army',
	trade: 'trade',
	pop_assembly: 'assembly'
};

/** The icon for a district, zone or building key; `category` is a building's, if known. */
export function iconFor(key: string, category?: string | null): IconName {
	const words = new Set(key.toLowerCase().split('_'));
	for (const [icon, ws] of BY_WORD) if (ws.some((w) => words.has(w))) return icon;
	return (category && BY_CATEGORY[category]) || 'generic';
}
