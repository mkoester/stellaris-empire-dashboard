import { pretty } from './format.ts';
import type { SeenStation } from './territories.ts';
import { shipsetName } from './territories.ts';
import type {
	AnomalyInfo,
	DigSite,
	FirstContact,
	GalaxySystem,
	ProjectInfo,
	Snapshot,
	Wanderlust
} from './types.ts';
import { entryTitles, type SystemEntry } from './systemEvents.ts';
import { counted, wanderlustName } from './wanderlust.ts';

// What the map tab draws on top of the galaxy — what the empire has discovered — each layer a
// filter the viewer can switch off. The profile stores the hidden ones, so a layer added later
// shows by default.

export const MAP_LAYERS = [
	'borders',
	'contacts',
	'stations',
	'anomalies',
	'digSites',
	'projects',
	'wormholes',
	'gateways',
	'megastructures',
	'ruins',
	'wanderlust',
	'systemEvents'
] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

export const LAYER_INFO: Record<MapLayer, { label: string; symbol: string; color: string }> = {
	borders: { label: 'empire borders', symbol: '▢', color: '#8a8984' },
	// the game's first contact map icon, sampled from a screenshot (2207.03.10, Rimmock and Mizar):
	// a #6478c8 symbol on a #284088 hexagon
	contacts: { label: 'first contacts', symbol: '✉', color: '#6478c8' },
	stations: { label: 'stations seen', symbol: '⬢', color: '#7a5cc4' },
	anomalies: { label: 'anomalies', symbol: '?', color: '#2f8fe0' },
	digSites: { label: 'dig sites', symbol: '⛏', color: '#b07a2a' },
	projects: { label: 'special projects', symbol: '★', color: '#1baf7a' },
	wormholes: { label: 'wormholes', symbol: '◎', color: '#c64fb5' },
	gateways: { label: 'gateways, L-gates', symbol: '◈', color: '#3bb2c2' },
	megastructures: { label: 'megastructures', symbol: '✦', color: '#d9a521' },
	ruins: { label: 'abandoned structures', symbol: '✧', color: '#8c6d1f' },
	wanderlust: { label: 'Wanderlust targets', symbol: '⚑', color: '#1baf7a' },
	// the events tab's colour for them (colors.ts `system-event`)
	systemEvents: { label: 'system entry events', symbol: '!', color: '#c64fb5' }
};

export type MapFilter = { hidden: MapLayer[] };
export const DEFAULT_MAP_FILTER: MapFilter = { hidden: [] };

export function parseMapFilter(v: unknown): MapFilter {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<MapFilter>;
	return {
		hidden: Array.isArray(o.hidden)
			? MAP_LAYERS.filter((l) => (o.hidden as unknown[]).includes(l))
			: []
	};
}

/**
 * One thing on the map: a layer, the system it is in, what it is; for what is worked on, whether it
 * is (`ongoing`, null: not something one works on, or unknown) and how far (`progress`, as far as
 * the save tells — anomalies and special projects carry none).
 */
export type MapMarker = {
	layer: MapLayer;
	systemId: number;
	label: string;
	detail: string;
	ongoing?: boolean | null;
	progress?: string | null;
	difficulty?: number | null; // first contacts, dig sites; anomalies their category's level
	seen?: Seen | null; // when the empire first saw it, as far as the history tells
};

/** A first sighting: a save's date; `by` — at the history's first reading, so then or earlier. */
export type Seen = { date: string; by: boolean };

/**
 * When the branch's saves first show each anomaly (by planet and category), dig site (by id) and
 * system we visited or own (`knownSystems`: a wormhole, gateway or megastructure there was seen
 * then) — each field from the first save that has it; what that save already shows is `by`.
 */
export function firstSeen(history: Snapshot[]) {
	const anomalies = new Map<string, Seen>();
	const digSites = new Map<number, Seen>();
	const systems = new Map<number, Seen>();
	const read = new Set<Map<never, Seen>>(); // the fields a save has shown so far
	const note = <K>(m: Map<K, Seen>, keys: K[] | null | undefined, date: string) => {
		if (!keys) return;
		const by = !read.has(m as Map<never, Seen>); // the first save showing the field
		read.add(m as Map<never, Seen>);
		for (const k of keys) if (!m.has(k)) m.set(k, { date, by });
	};
	for (const s of history) {
		note(anomalies, s.anomalies?.map(anomalyKey), s.date);
		note(
			digSites,
			s.digSites?.map((d) => d.id),
			s.date
		);
		note(
			systems,
			s.knownSystems?.map((k) => k.id),
			s.date
		);
	}
	return { anomalies, digSites, systems };
}
export type FirstSeen = ReturnType<typeof firstSeen>;

export const anomalyKey = (a: Pick<AnomalyInfo, 'planetId' | 'category'>) =>
	`${a.planetId}:${a.category}`;

const days = (d: number | null) => (d === null ? '' : `, ${Math.ceil(d)} days left`);

const isGate = (t: string) => /gateway|lgate/.test(t);
const isRuin = (t: string) => /ruined/.test(t);
const structure = (t: string) =>
	(/^lgate/.test(t) ? 'L-Gate' : pretty(t.replace(/_(permanently_)?ruined.*$/, ''))) +
	(/permanently_ruined/.test(t) ? ' (beyond repair)' : isRuin(t) ? ' (ruined)' : '');

/** Every marker of the discovered galaxy (`galaxy` holds only what the map may show). */
export function mapMarkers(p: {
	galaxy: GalaxySystem[];
	contacts: FirstContact[];
	anomalies: AnomalyInfo[];
	digSites: DigSite[];
	projects: (ProjectInfo & { name: string })[];
	anomalyNames: Record<string, string>;
	seen: SeenStation[];
	// the Wanderlust perk's progress, null without it; `all`: every target, not only the visited
	wanderlust?: { progress: Wanderlust; all: boolean } | null;
	// systems we entered whose flags fire an entry popup, with its text's start (#lib/systemEvents.ts)
	entries?: (SystemEntry & { detail: string; seen?: Seen | null })[];
	firstSeen?: FirstSeen; // from the branch's saves (firstSeen())
	anomalyLevels?: Record<string, number | null>; // category → level, the anomaly's difficulty
}): MapMarker[] {
	const visited = (id: number) => p.firstSeen?.systems.get(id) ?? null;
	const shown = new Set(p.galaxy.map((s) => s.id));
	const out: MapMarker[] = [
		...p.contacts
			.filter((c) => c.status === 'in_progress')
			.map((c) => ({
				layer: 'contacts' as const,
				systemId: c.systemId,
				label: c.name,
				detail: 'first contact',
				difficulty: c.difficulty,
				seen: { date: c.date, by: false }, // the save's own date of discovery
				ongoing: c.leaderId !== null, // an envoy on it
				progress: `${pretty(c.stage)}, ${c.clues} clues${days(c.daysLeft)}`
			})),
		...p.seen.map((s) => ({
			layer: 'stations' as const,
			systemId: s.systemId,
			label: `${shipsetName(s.shipset)} station`,
			detail: `seen ${s.first === s.last ? s.first : `${s.first} – ${s.last}`}`,
			seen: { date: s.first, by: false }
		})),
		...p.anomalies.map((a) => ({
			layer: 'anomalies' as const,
			systemId: a.systemId,
			label: p.anomalyNames[a.category] ?? pretty(a.category),
			detail: `anomaly at ${a.planet}`,
			difficulty: p.anomalyLevels?.[a.category] ?? null,
			seen: p.firstSeen?.anomalies.get(anomalyKey(a)) ?? null
		})),
		...p.digSites.flatMap((d) =>
			d.systemId === null
				? []
				: [
						{
							layer: 'digSites' as const,
							systemId: d.systemId,
							label: pretty(d.type),
							detail: 'dig site',
							difficulty: d.difficulty,
							seen: p.firstSeen?.digSites.get(d.id) ?? null,
							ongoing: d.excavating,
							progress: `${d.clues} clues${d.excavating ? days(d.daysLeft) : ''}`
						}
					]
		),
		...(p.entries ?? []).map((e) => ({
			layer: 'systemEvents' as const,
			systemId: e.systemId,
			label: entryTitles(e),
			detail: e.detail,
			seen: e.seen ?? null
		})),
		...p.projects.flatMap((s) =>
			s.systemId === null
				? []
				: [
						{
							layer: 'projects' as const,
							systemId: s.systemId,
							label: s.name,
							detail: 'special project'
						}
					]
		)
	];
	for (const s of p.galaxy) {
		for (const t of s.bypasses ?? [])
			if (/wormhole/.test(t))
				out.push({
					layer: 'wormholes',
					systemId: s.id,
					label: pretty(t),
					detail: 'bypass',
					seen: visited(s.id)
				});
		// a gateway or L-gate is a megastructure too (built or ruined); the bypass alone if not
		const gates = s.megastructures.filter(isGate);
		const listed = gates.length ? gates : (s.bypasses ?? []).filter(isGate);
		// an L-Gate shown by the lgates spoiler, in a system not visited
		for (const t of listed.length ? listed : s.lgate ? ['lgate_base'] : [])
			out.push({
				layer: 'gateways',
				systemId: s.id,
				label: structure(t),
				detail: 'bypass',
				seen: visited(s.id) // null for an L-Gate the spoiler shows
			});
		for (const t of s.megastructures.filter((x) => !isGate(x)))
			out.push({
				layer: isRuin(t) ? 'ruins' : 'megastructures',
				systemId: s.id,
				label: structure(t),
				detail: 'megastructure',
				seen: visited(s.id)
			});
	}
	// a Wanderlust target where we have been (we saw what it holds), or any with the spoiler
	const w = p.wanderlust;
	if (w)
		for (const s of p.galaxy)
			if (s.wanderlust?.length && (w.all || s.visited || s.owned)) {
				const when = counted(w.progress, s.id);
				out.push({
					layer: 'wanderlust',
					systemId: s.id,
					label: s.wanderlust.map(wanderlustName).join(', '),
					detail: 'Wanderlust: explore with an arkship',
					progress: when ? `counted ${when}` : 'not yet by an arkship'
				});
			}
	return out.filter((m) => shown.has(m.systemId));
}
