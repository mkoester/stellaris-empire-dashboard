import { distances, graph } from './galaxyGraph.ts';
import { CATEGORICAL, OTHER } from './migration.ts';
import type { CountryInfo, GalaxySystem, Relation, StationSighting } from './types.ts';

// Whose territory each system is, as far as the viewer may know it: our own systems; those of
// empires we have communications with (their flag colour, as the game's map); with the
// contactStations spoiler, every visited station's owner. Stations we saw ourselves but whose
// owner we do not know are *guessed*: equal shipsets close together are taken for one empire, with
// a colour of our own and a dashed border. Other visited stations stay "unknown", grey.

export type Territory = {
	key: string;
	label: string;
	color: string;
	guess: boolean; // dashed: our guess from the shipsets seen
	systems: number[];
};

/** A station seen over the branch: the latest sighting per system, and when we first saw it. */
export type SeenStation = StationSighting & { first: string; last: string };

export function mergeSightings(
	snaps: { date: string; stationsSeen: StationSighting[] | null }[]
): SeenStation[] {
	const bySystem = new Map<number, SeenStation>();
	for (const s of snaps)
		for (const x of s.stationsSeen ?? []) {
			const prev = bySystem.get(x.systemId);
			bySystem.set(x.systemId, { ...x, first: prev?.first ?? s.date, last: s.date });
		}
	return [...bySystem.values()].sort((a, b) => a.systemId - b.systemId);
}

/** The stations seen, for a table: no owner id, only the territory (known, guessed) they fall in. */
export function seenRows(seen: SeenStation[], ts: Territory[], name: (id: number) => string) {
	return seen.map((s) => ({
		systemId: s.systemId,
		system: name(s.systemId),
		shipset: shipsetName(s.shipset),
		first: s.first,
		last: s.last,
		territory: ts.find((t) => t.systems.includes(s.systemId))?.label ?? 'unknown owner'
	}));
}
export type SeenRow = ReturnType<typeof seenRows>[number];

/** "avian_01" → "Avian". */
export const shipsetName = (s: string | null) =>
	s
		? s
				.replace(/_\d+$/, '')
				.replace(/_/g, ' ')
				.replace(/^./, (c) => c.toUpperCase())
		: 'unknown';

/** Sightings of one shipset within this many jumps of each other count as one empire. */
export const GUESS_JUMPS = 3;

/** Groups the systems of each shipset into clusters linked by at most GUESS_JUMPS jumps. */
export function guessGroups(
	seen: { systemId: number; shipset: string | null }[],
	galaxy: Pick<GalaxySystem, 'id' | 'lanes'>[]
): { shipset: string | null; systems: number[] }[] {
	const g = graph(
		galaxy.flatMap((s) => s.lanes.map((to): [number, number] => [s.id, to])),
		[]
	);
	const out: { shipset: string | null; systems: number[] }[] = [];
	for (const shipset of [...new Set(seen.map((s) => s.shipset))]) {
		const left = new Set(seen.filter((s) => s.shipset === shipset).map((s) => s.systemId));
		while (left.size) {
			const start = Math.min(...left);
			const group = [start];
			left.delete(start);
			for (let i = 0; i < group.length; i++) {
				const { jumps } = distances(g, [group[i]]);
				for (const id of [...left])
					if ((jumps.get(id) ?? Infinity) <= GUESS_JUMPS) {
						group.push(id);
						left.delete(id);
					}
			}
			out.push({ shipset, systems: group.sort((a, b) => a - b) });
		}
	}
	return out;
}

export function territories(p: {
	galaxy: GalaxySystem[]; // the systems the map may show owners of (discovered ones)
	ownId: number | null;
	ownName: string;
	countries: CountryInfo[];
	relations: Relation[];
	seen: SeenStation[];
	flagColors: Record<string, string>;
	spoiler: boolean; // contactStations: name every visited station's owner
}): Territory[] {
	const country = (id: number) => p.countries.find((c) => c.id === id);
	const colorOf = (id: number) => p.flagColors[country(id)?.flagColor ?? ''] ?? OTHER;
	const talking = new Set(p.relations.filter((r) => r.communications).map((r) => r.countryId));
	const known = (id: number) => id === p.ownId || p.spoiler || talking.has(id);
	const name = (id: number) =>
		p.relations.find((r) => r.countryId === id)?.name ?? country(id)?.name ?? String(id);

	const byOwner = new Map<number, number[]>();
	const unknown: number[] = [];
	for (const s of p.galaxy) {
		const owner = s.owned ? p.ownId : s.ownerId;
		if (owner === null) continue;
		if (known(owner)) byOwner.set(owner, [...(byOwner.get(owner) ?? []), s.id]);
		else unknown.push(s.id);
	}
	const out: Territory[] = [...byOwner].map(([id, systems]) => ({
		key: `country:${id}`,
		label: id === p.ownId ? p.ownName : name(id),
		color: colorOf(id),
		guess: false,
		systems
	}));

	// what we saw of the unknown ones: guessed by shipset; the rest of them stays plain unknown
	const shown = new Set(p.galaxy.map((s) => s.id));
	const seen = p.seen.filter((s) => shown.has(s.systemId) && !known(s.ownerId));
	const groups = guessGroups(seen, p.galaxy);
	groups.forEach((g, i) =>
		out.push({
			key: `guess:${g.shipset}:${g.systems[0]}`,
			label: `unknown empire (guess: ${shipsetName(g.shipset)} shipset)`,
			color: CATEGORICAL[(i + 3) % CATEGORICAL.length],
			guess: true,
			systems: g.systems
		})
	);
	const guessed = new Set(groups.flatMap((g) => g.systems));
	const rest = unknown.filter((id) => !guessed.has(id));
	if (rest.length)
		out.push({ key: 'unknown', label: 'unknown owner', color: OTHER, guess: true, systems: rest });
	return out;
}
