import { distances, graph, type Graph } from './galaxyGraph.ts';
import type { Body, GalaxySystem, GameData } from './types.ts';

// Where to build kilo- and megastructures: every system ranked per structure, from the rules in
// 4.5.2 common/megastructures/* (file named per rule; re-check on game updates). Systems we have
// not visited have no known bodies, so a rule needing them gives "unknown" there, never a guess.

export const KINDS = [
	'arc_furnace',
	'dyson_swarm',
	'dyson_sphere',
	'ring_world',
	'matter_decompressor',
	'stellar_cannon',
	'quantum_catapult',
	'mega_shipyard',
	'sentry_array'
] as const;
export type Kind = (typeof KINDS)[number];

type Rule = {
	name: string;
	file: string;
	machineAge?: boolean; // needs The Machine Age (true) or its absence (false)
	stars?: string[]; // only around these star classes
	notStars?: string[];
	noBinary?: boolean;
	noColonizable?: boolean; // no colonizable planet in the system (`colonizable_planet`)
	lowerIsBetter?: boolean; // the score is a loss or a distance
	score: string; // what the score means
};

const COLLAPSED = ['sc_black_hole', 'sc_neutron_star', 'sc_pulsar'];
const PULSING = ['sc_neutron_star', 'sc_pulsar'];

export const MEGA_RULES: Record<Kind, Rule> = {
	arc_furnace: {
		name: 'Arc Furnace',
		file: '17_orbital_arc_furnace.txt',
		machineAge: true,
		score:
			"the game's own: bodies neither star nor colonizable without a research deposit (≤ 10 poor, ≥ 16 good)"
	},
	dyson_swarm: {
		name: 'Dyson Swarm',
		file: '18_dyson_swarm.txt',
		machineAge: true,
		notStars: COLLAPSED,
		noBinary: true,
		score: "the star's deposits (it needs one; the AI skips energy 1–2)"
	},
	dyson_sphere: {
		name: 'Dyson Sphere',
		file: '01_dyson_sphere.txt',
		machineAge: false,
		notStars: COLLAPSED,
		noBinary: true,
		lowerIsBetter: true,
		score: 'loss: colonizable planets frozen and planet deposits in the system'
	},
	ring_world: {
		name: 'Ring World',
		file: '00_ring_world.txt',
		notStars: ['sc_black_hole'],
		noBinary: true,
		noColonizable: true,
		lowerIsBetter: true,
		score: 'loss: every planet but the star is removed, with its deposits (their amounts summed)'
	},
	matter_decompressor: {
		name: 'Matter Decompressor',
		file: '06_matter_decompressor.txt',
		stars: ['sc_black_hole'],
		noColonizable: true,
		score: 'black holes only; the bodies around it are listed'
	},
	stellar_cannon: {
		name: 'Stellar Cannon',
		file: '31_dyson_gun.txt',
		stars: PULSING,
		noBinary: true,
		score: 'neutron stars and pulsars only: every fitting system is listed'
	},
	quantum_catapult: {
		name: 'Quantum Catapult',
		file: '13_quantum_catapult.txt',
		stars: PULSING,
		noBinary: true,
		lowerIsBetter: true,
		score: 'farthest system on the 2D map (galaxy units): lower reaches everything sooner'
	},
	mega_shipyard: {
		name: 'Mega Shipyard',
		file: '11_mega_shipyard.txt',
		notStars: COLLAPSED,
		noBinary: true,
		lowerIsBetter: true,
		score: "system size: the outermost body's distance from the star, the way out for new ships"
	},
	sentry_array: {
		name: 'Sentry Array',
		file: '02_spy_orb.txt',
		score:
			'systems not ours within 20 hyperlane jumps (stage 1’s sensor range; 40 and 60 for the next stages, the finished array sees the whole galaxy)'
	}
};

/** The tab's view, the profile's: structure, systems shown, fitting only, the system picked. */
export type MegaView = {
	kind: Kind;
	range: string; // 'mine' | '0'…'10' jumps beyond the border | 'all'
	fitting: boolean;
	selected: number | null;
};
export const DEFAULT_MEGA_VIEW: MegaView = {
	kind: 'arc_furnace',
	range: 'mine',
	fitting: true,
	selected: null
};
export const RANGES = ['mine', ...Array.from({ length: 11 }, (_, i) => String(i)), 'all'];

export function parseMegaView(v: unknown): MegaView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<MegaView>;
	return {
		kind: KINDS.includes(o.kind as Kind) ? (o.kind as Kind) : DEFAULT_MEGA_VIEW.kind,
		range: RANGES.includes(o.range as string) ? (o.range as string) : DEFAULT_MEGA_VIEW.range,
		fitting: o.fitting !== false,
		selected: typeof o.selected === 'number' ? o.selected : null
	};
}

/** Catapult reach per stage (`catapult_range_base`, 13_quantum_catapult.txt). */
export const CATAPULT_RANGES = [300, 450, 750];
/**
 * Sentry Array sensor range per stage (`sensor_range`, 02_spy_orb.txt; the last stage has
 * `has_full_sensor_range`). Hyperlane jumps: ship sensors are 1–4 and starbases add 1, which in map
 * units (~20 between systems) would not leave their own system.
 */
export const SENTRY_RANGES = [20, 40, 60];

export type Candidate = {
	systemId: number;
	name: string;
	ownerId: number | null;
	owned: boolean;
	beyond: number | null; // jumps beyond our border (0 = inside)
	ok: boolean | null; // fits the rules; null: not visited, its bodies unknown
	why: string[]; // what rules it out, or what is unknown
	score: number | null;
	detail: string;
	existing: string[]; // megastructures already there (built or ruined)
	centre: number; // distance from the galaxy's centre
};

const binary = (star: string) => /^sc_(binary|trinary)/.test(star);
const isGate = (t: string) => /gateway|lgate/.test(t);
const amount = (deposit: string) => Number(/_(\d+)$/.exec(deposit)?.[1] ?? 1);

type Context = {
	galaxy: GalaxySystem[];
	beyond: Map<number, number>;
	planetClasses: GameData['planetClasses'];
	depositCategories: GameData['depositCategories'];
	lanes: Graph; // the hyperlanes among the systems given
};

/** `colonizable_planet` (4.5.2 scripted_triggers/00_scripted_triggers.txt), by planet class. */
const colonizable = (b: Body, c: Context) =>
	!b.star &&
	(c.planetClasses[b.class]?.colonizable === true ||
		['pc_city', 'pc_relic', 'pc_nuked', 'pc_hive', 'pc_machine', 'pc_habitat'].includes(b.class));

const research = (b: Body, c: Context) =>
	b.deposits.some((d) => c.depositCategories[d] === 'orbital_research_deposits');

function scoreOf(
	kind: Kind,
	s: GalaxySystem,
	c: Context
): { score: number | null; detail: string; why: string[] } {
	const bodies = s.bodies ?? [];
	const planets = bodies.filter((b) => !b.star);
	const far = () => Math.max(0, ...c.galaxy.map((o) => Math.hypot(o.x - s.x, o.y - s.y)));
	switch (kind) {
		case 'arc_furnace': {
			if (!bodies.some((b) => b.class === 'pc_molten'))
				return { score: null, detail: '', why: ['no molten planet'] };
			const n = planets.filter(
				(b) => !colonizable(b, c) && !research(b, c) && b.class !== 'pc_astral_scar'
			).length;
			return { score: n, detail: `${n} bodies`, why: [] };
		}
		case 'dyson_swarm': {
			const star = bodies.find((b) => b.star);
			const deps =
				star?.deposits.filter((d) =>
					/orbital_(mining|research)_deposits/.test(c.depositCategories[d] ?? '')
				) ?? [];
			if (!deps.length) return { score: null, detail: '', why: ['no deposit on the star'] };
			return { score: deps.reduce((a, d) => a + amount(d), 0), detail: deps.join(', '), why: [] };
		}
		case 'dyson_sphere': {
			if (bodies.some((b) => b.colonized))
				return { score: null, detail: '', why: ['a colony in the system'] };
			const frozen = planets.filter((b) => colonizable(b, c)).length;
			const deps = planets.reduce((a, b) => a + b.deposits.length, 0);
			return {
				score: frozen + deps,
				detail: `${frozen} colonizable frozen, ${deps} deposits`,
				why: []
			};
		}
		case 'ring_world': {
			if (!planets.length) return { score: null, detail: '', why: ['no planet besides the star'] };
			const lost = planets.reduce((a, b) => a + b.deposits.reduce((x, d) => x + amount(d), 0), 0);
			return { score: lost, detail: `${planets.length} bodies removed, deposits ${lost}`, why: [] };
		}
		case 'matter_decompressor':
			return { score: planets.length, detail: `${planets.length} bodies`, why: [] };
		case 'stellar_cannon':
			return { score: null, detail: '', why: [] };
		case 'quantum_catapult': {
			const d = far();
			const reach = CATAPULT_RANGES.map(
				(r) => c.galaxy.filter((o) => Math.hypot(o.x - s.x, o.y - s.y) <= r).length
			);
			return {
				score: Math.round(d),
				detail: `in reach per stage: ${reach.join(' / ')} of ${c.galaxy.length}`,
				why: []
			};
		}
		case 'mega_shipyard': {
			const size = Math.max(0, ...bodies.map((b) => b.dist));
			const exits = c.galaxy.filter((o) => o.lanes.includes(s.id)).length + s.lanes.length;
			return { score: Math.round(size), detail: `${exits} hyperlanes out`, why: [] };
		}
		case 'sentry_array': {
			if (!planets.some((b) => !colonizable(b, c) && !/asteroid/.test(b.class)))
				return { score: null, detail: '', why: ['no planet to build on'] };
			const { jumps } = distances(c.lanes, [s.id]);
			const notOurs = c.galaxy.filter((o) => !o.owned);
			const cover = SENTRY_RANGES.map(
				(r) => notOurs.filter((o) => (jumps.get(o.id) ?? Infinity) <= r).length
			);
			return {
				score: cover[0],
				detail: `not ours within ${SENTRY_RANGES.join(' / ')} jumps: ${cover.join(' / ')} of ${notOurs.length}`,
				why: []
			};
		}
	}
}

/** Every system for one structure: fitting the rules or not, scored where it fits. */
export function candidates(
	kind: Kind,
	galaxy: GalaxySystem[],
	beyond: Map<number, number>,
	data: Pick<GameData, 'planetClasses' | 'depositCategories'>
): Candidate[] {
	const rule = MEGA_RULES[kind];
	const lanes = graph(
		galaxy.flatMap((s) => s.lanes.map((to): [number, number] => [s.id, to])),
		[]
	);
	const c: Context = { galaxy, beyond, ...data, lanes };
	const cx = galaxy.reduce((a, s) => a + s.x, 0) / Math.max(1, galaxy.length);
	const cy = galaxy.reduce((a, s) => a + s.y, 0) / Math.max(1, galaxy.length);
	return galaxy.map((s) => {
		const why: string[] = [];
		if (rule.stars && !rule.stars.includes(s.star))
			why.push(
				`not a ${rule.stars.map((x) => x.replace(/^sc_/, '').replace('_', ' ')).join(' or ')}`
			);
		if (rule.notStars?.includes(s.star))
			why.push(`no ${s.star.replace(/^sc_/, '').replace('_', ' ')}`);
		if (rule.noBinary && binary(s.star)) why.push('binary or trinary star');
		const existing = s.megastructures;
		if (existing.some((t) => !isGate(t)))
			why.push(`megastructure here: ${existing.filter((t) => !isGate(t)).join(', ')}`);
		const base = {
			systemId: s.id,
			name: s.name,
			ownerId: s.ownerId,
			owned: s.owned,
			beyond: beyond.get(s.id) ?? null,
			existing,
			centre: Math.round(Math.hypot(s.x - cx, s.y - cy))
		};
		// star rules hold for every system; body rules only where we know the bodies
		const starOnly = kind === 'stellar_cannon' || kind === 'quantum_catapult';
		if (why.length) return { ...base, ok: false, why, score: null, detail: '' };
		if (!starOnly && s.bodies === null)
			return { ...base, ok: null, why: ['not visited: bodies unknown'], score: null, detail: '' };
		if (rule.noColonizable && (s.bodies ?? []).some((b) => colonizable(b, c)))
			return {
				...base,
				ok: false,
				why: ['a colonizable planet in the system'],
				score: null,
				detail: ''
			};
		const r = scoreOf(kind, s, c);
		return { ...base, ok: r.why.length === 0, why: r.why, score: r.score, detail: r.detail };
	});
}

/** A sequential fill for the map: the fitting systems by score, best darkest. */
export function scoreFill(rows: Candidate[], lowerIsBetter: boolean): Record<number, string> {
	const RAMP = ['#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'];
	const ok = rows.filter((r) => r.ok && r.score !== null);
	if (!ok.length) return {};
	const scores = ok.map((r) => r.score!);
	const [lo, hi] = [Math.min(...scores), Math.max(...scores)];
	return Object.fromEntries(
		ok.map((r) => {
			const t = (r.score! - lo) / (hi - lo || 1);
			const good = hi === lo ? 1 : lowerIsBetter ? 1 - t : t;
			return [r.systemId, RAMP[Math.min(RAMP.length - 1, Math.floor(good * RAMP.length))]];
		})
	);
}
