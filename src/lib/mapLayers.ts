import { pretty } from './format.ts';
import type { SeenStation } from './territories.ts';
import { shipsetName } from './territories.ts';
import type { AnomalyInfo, DigSite, FirstContact, GalaxySystem, ProjectInfo } from './types.ts';

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
	'ruins'
] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

export const LAYER_INFO: Record<MapLayer, { label: string; symbol: string; color: string }> = {
	borders: { label: 'empire borders', symbol: '▢', color: '#8a8984' },
	contacts: { label: 'first contacts', symbol: '✉', color: '#e34948' },
	stations: { label: 'stations seen', symbol: '⬢', color: '#7a5cc4' },
	anomalies: { label: 'anomalies', symbol: '?', color: '#2f8fe0' },
	digSites: { label: 'dig sites', symbol: '⛏', color: '#b07a2a' },
	projects: { label: 'special projects', symbol: '★', color: '#1baf7a' },
	wormholes: { label: 'wormholes', symbol: '◎', color: '#c64fb5' },
	gateways: { label: 'gateways, L-gates', symbol: '◈', color: '#3bb2c2' },
	megastructures: { label: 'megastructures', symbol: '✦', color: '#d9a521' },
	ruins: { label: 'abandoned structures', symbol: '✧', color: '#8c6d1f' }
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

/** One thing on the map: a layer, the system it is in, what it is. */
export type MapMarker = { layer: MapLayer; systemId: number; label: string; detail: string };

const isGate = (t: string) => /gateway|lgate/.test(t);
const isRuin = (t: string) => /ruined/.test(t);
const structure = (t: string) =>
	pretty(t.replace(/_(permanently_)?ruined.*$/, '')) +
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
}): MapMarker[] {
	const shown = new Set(p.galaxy.map((s) => s.id));
	const out: MapMarker[] = [
		...p.contacts
			.filter((c) => c.status === 'in_progress')
			.map((c) => ({
				layer: 'contacts' as const,
				systemId: c.systemId,
				label: c.name,
				detail: `first contact, difficulty ${c.difficulty}, ${c.clues} clues`
			})),
		...p.seen.map((s) => ({
			layer: 'stations' as const,
			systemId: s.systemId,
			label: `${shipsetName(s.shipset)} station`,
			detail: `seen ${s.first === s.last ? s.first : `${s.first} – ${s.last}`}`
		})),
		...p.anomalies.map((a) => ({
			layer: 'anomalies' as const,
			systemId: a.systemId,
			label: p.anomalyNames[a.category] ?? pretty(a.category),
			detail: `anomaly at ${a.planet}`
		})),
		...p.digSites.flatMap((d) =>
			d.systemId === null
				? []
				: [
						{
							layer: 'digSites' as const,
							systemId: d.systemId,
							label: pretty(d.type),
							detail: `dig site, ${d.clues} clues${d.excavating ? ', excavating' : ''}`
						}
					]
		),
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
				out.push({ layer: 'wormholes', systemId: s.id, label: pretty(t), detail: 'bypass' });
		// a gateway or L-gate is a megastructure too (built or ruined); the bypass alone if not
		const gates = s.megastructures.filter(isGate);
		for (const t of gates.length ? gates : (s.bypasses ?? []).filter(isGate))
			out.push({ layer: 'gateways', systemId: s.id, label: structure(t), detail: 'bypass' });
		for (const t of s.megastructures.filter((x) => !isGate(x)))
			out.push({
				layer: isRuin(t) ? 'ruins' : 'megastructures',
				systemId: s.id,
				label: structure(t),
				detail: 'megastructure'
			});
	}
	return out.filter((m) => shown.has(m.systemId));
}
