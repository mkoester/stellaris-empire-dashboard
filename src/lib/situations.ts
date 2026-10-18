import { distances, graph } from './galaxyGraph.ts';
import { CATEGORICAL, OTHER } from './migration.ts';
import { gameYear } from './series.ts';
import type {
	CountryInfo,
	FirstContact,
	GalaxySystem,
	Relation,
	SituationInfo,
	GameData
} from './types.ts';

// The situations tab: first contacts (table and map), situations, anomalies, special projects and
// dig sites, from one save and the campaign's galaxy. Pure.

/** Whole months from `from` to `to` (game dates, 30-day months). */
export const monthsBetween = (from: string, to: string) =>
	Math.max(0, Math.floor((gameYear(to) - gameYear(from)) * 12 + 1e-9));

/** Jumps along hyperlanes from the nearest owned system (bypasses not counted). */
export function jumpsFromBorder(galaxy: GalaxySystem[]): Map<number, number> {
	const g = graph(
		galaxy.flatMap((s) => s.lanes.map((to): [number, number] => [s.id, to])),
		[]
	);
	return distances(
		g,
		galaxy.filter((s) => s.owned).map((s) => s.id)
	).jumps;
}

export type ContactRow = FirstContact & {
	system: string;
	months: number; // since discovery
	jumps: number | null; // from our border
	communications: boolean;
	stations: number; // visited systems whose station is theirs
	country: CountryInfo | null;
};

export function contactRows(
	contacts: FirstContact[],
	galaxy: GalaxySystem[],
	relations: Relation[],
	countries: CountryInfo[],
	date: string
): ContactRow[] {
	const byId = new Map(galaxy.map((s) => [s.id, s]));
	const jumps = jumpsFromBorder(galaxy);
	return contacts.map((c) => ({
		...c,
		system: byId.get(c.systemId)?.name ?? String(c.systemId),
		months: monthsBetween(c.date, date),
		jumps: jumps.get(c.systemId) ?? null,
		communications: relations.find((r) => r.countryId === c.countryId)?.communications ?? false,
		stations: galaxy.filter((s) => s.ownerId === c.countryId).length,
		country: countries.find((x) => x.id === c.countryId) ?? null
	}));
}

export type StationOwner = {
	countryId: number;
	name: string; // as we know them: the pre-communications name until we talk
	type: string | null;
	shipset: string | null;
	color: string;
	systems: number[];
	contact: number | null; // the first contact with them, if any
};

/** Other empires' stations in visited systems, by owner, each with a colour for the map. */
export function stationOwners(
	galaxy: GalaxySystem[],
	ownId: number | null,
	relations: Relation[],
	countries: CountryInfo[],
	contacts: FirstContact[]
): StationOwner[] {
	const owners = [
		...new Set(
			galaxy.flatMap((s) => (s.ownerId === null || s.ownerId === ownId ? [] : [s.ownerId]))
		)
	];
	return owners.map((id, i) => {
		const c = countries.find((x) => x.id === id);
		return {
			countryId: id,
			name: relations.find((r) => r.countryId === id)?.name ?? c?.name ?? String(id),
			type: c?.type ?? null,
			shipset: c?.shipset ?? null,
			color: CATEGORICAL[(i + 1) % CATEGORICAL.length] ?? OTHER,
			systems: galaxy.filter((s) => s.ownerId === id).map((s) => s.id),
			contact: contacts.find((f) => f.countryId === id)?.id ?? null
		};
	});
}

export type SituationRow = SituationInfo & {
	name: string;
	category: string | null;
	approachName: string | null;
};

export function situationRows(
	situations: SituationInfo[],
	types: GameData['situationTypes']
): SituationRow[] {
	return situations.map((s) => ({
		...s,
		name: types[s.type]?.name ?? s.type,
		category: types[s.type]?.category ?? null,
		approachName: s.approach ? (types[s.type]?.approaches[s.approach] ?? s.approach) : null
	}));
}

/**
 * What the empire has discovered: visited or own systems (the save's `terra_incognita.systems` is
 * the same list) and `also` (first contact sites, which the game shows), with lanes among them
 * only — the game hides hyperlanes outside its known space. `whole` keeps every system.
 */
export function discovered(
	galaxy: GalaxySystem[],
	whole: boolean,
	also: number[] = []
): GalaxySystem[] {
	if (whole) return galaxy;
	const known = new Set([...galaxy.filter((s) => s.visited || s.owned).map((s) => s.id), ...also]);
	return galaxy
		.filter((s) => known.has(s.id))
		.map((s) => ({ ...s, lanes: s.lanes.filter((to) => known.has(to)) }));
}
