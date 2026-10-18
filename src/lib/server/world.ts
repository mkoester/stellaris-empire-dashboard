import type {
	AnomalyInfo,
	Body,
	CountryInfo,
	DigSite,
	FirstContact,
	GalaxySystem,
	ProjectInfo,
	Relation,
	SituationInfo,
	StationSighting
} from '#lib/types.ts';
import {
	displayName,
	items,
	leaderName,
	list,
	num,
	numOrNull,
	strOrNull,
	type RawSave
} from './save.ts';

// What the empire knows of the galaxy and of the others: systems, the empires it met, first
// contacts, situations, anomalies, special projects, dig sites. Pure, from the gamestate parts in
// RawSave. Paths are in AGENTS.md ("Save format facts").

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

const NONE = 4294967295; // the save's "no id"
const idOrNull = (v: Raw) => (typeof v === 'number' && v !== NONE ? v : null);

/** Stars among the planet classes (4.5.2 common/planet_classes: `star = yes`). */
export const isStarClass = (c: string) =>
	/_star$/.test(c) || c === 'pc_black_hole' || c === 'pc_pulsar';

/**
 * Who owns a system's station: starbases name no owner, their station ship's fleet is in its
 * owner's `fleets_manager.owned_fleets` (`RawSave.fleetOwner`).
 */
export function stationOwner(
	raw: Pick<RawSave, 'starbases' | 'ships' | 'fleetOwner'>,
	system: Raw
): number | null {
	for (const sb of list(system?.starbases)) {
		const ship = raw.ships[String(raw.starbases[String(sb)]?.station)];
		const owner = raw.fleetOwner[String(ship?.fleet)];
		if (owner !== undefined) return owner;
	}
	return null;
}

function body(raw: Pick<RawSave, 'planets' | 'deposits' | 'countryId'>, id: number): Body | null {
	const p = raw.planets[String(id)];
	if (!p || typeof p !== 'object') return null;
	const cls = String(p.planet_class ?? '');
	return {
		id,
		name: displayName(p.name),
		class: cls,
		size: num(p.planet_size),
		star: isStarClass(cls),
		moonOf: idOrNull(p.moon_of),
		ownerId: idOrNull(p.owner),
		colonized: p.colony !== undefined,
		deposits: list(p.deposits)
			.map((d) => raw.deposits[String(d)]?.type)
			.filter((t): t is string => typeof t === 'string' && t !== 'none'),
		anomaly:
			typeof p.anomaly === 'string' && list(p.surveyed_by).includes(raw.countryId)
				? p.anomaly
				: null,
		dist: Math.hypot(num(p.coordinate?.x), num(p.coordinate?.y))
	};
}

/** Every system; owner, bodies and megastructures where visited or owned. */
export function galaxy(
	raw: Pick<
		RawSave,
		| 'country'
		| 'countryId'
		| 'systems'
		| 'planets'
		| 'deposits'
		| 'starbases'
		| 'ships'
		| 'fleetOwner'
		| 'megastructures'
		| 'bypasses'
	>,
	own: Set<number>
): GalaxySystem[] {
	const visited = new Set([...list(raw.country?.visited_objects), ...own]);
	const megas = new Map<number, string[]>();
	for (const m of Object.values(raw.megastructures)) {
		const at = numOrNull(m?.coordinate?.origin);
		if (at !== null && typeof m?.type === 'string')
			megas.set(at, [...(megas.get(at) ?? []), m.type]);
	}
	return Object.entries(raw.systems).flatMap(([key, s]) => {
		if (!s || typeof s !== 'object') return [];
		const id = Number(key);
		const seen = visited.has(id);
		return [
			{
				id,
				name: displayName(s.name),
				x: num(s.coordinate?.x),
				y: num(s.coordinate?.y),
				star: String(s.star_class ?? ''),
				// a lane can be listed twice (2207.03.10: Iblyria → 236), which a keyed list cannot take
				lanes: [...new Set(items(s.hyperlane).map((l) => Number(l?.to)))].filter((to) => to > id),
				visited: seen,
				owned: own.has(id),
				ownerId: seen ? stationOwner(raw, s) : null,
				bodies: seen
					? list(s.planet)
							.map((p) => body(raw, p))
							.filter((b) => b !== null)
					: null,
				megastructures: seen ? (megas.get(id) ?? []) : [],
				bypasses: seen
					? list(s.bypasses)
							.map((b) => raw.bypasses[String(b)]?.type)
							.filter((t): t is string => typeof t === 'string')
					: []
			}
		];
	});
}

/**
 * Other empires' stations in the systems our fleets are in at the moment of the save (each fleet's
 * `movement_manager.coordinate.origin`), with the owner's shipset — what we saw being there.
 * Monthly autosaves catch only the fleets present at that moment.
 */
export function stationsSeen(
	raw: Pick<
		RawSave,
		| 'country'
		| 'countryId'
		| 'countries'
		| 'fleets'
		| 'systems'
		| 'starbases'
		| 'ships'
		| 'fleetOwner'
	>,
	own: Set<number>
): StationSighting[] {
	const here = new Set<number>();
	for (const o of items(raw.country?.fleets_manager?.owned_fleets)) {
		const at = idOrNull(raw.fleets[String(o?.fleet)]?.movement_manager?.coordinate?.origin);
		if (at !== null && !own.has(at)) here.add(at);
	}
	return [...here]
		.sort((a, b) => a - b)
		.flatMap((systemId) => {
			const ownerId = stationOwner(raw, raw.systems[String(systemId)]);
			return ownerId === null || ownerId === raw.countryId
				? []
				: [{ systemId, ownerId, shipset: raw.countries[String(ownerId)]?.shipset ?? null }];
		});
}

/** `country.relations_manager.relation`, one per empire we know. */
export function relations(raw: Pick<RawSave, 'country' | 'countries'>): Relation[] {
	return items(raw.country?.relations_manager?.relation)
		.filter((r) => typeof r?.country === 'number')
		.map((r) => ({
			countryId: r.country,
			name: r.pre_communications_name
				? displayName(r.pre_communications_name)
				: (raw.countries[String(r.country)]?.name ?? String(r.country)),
			contact: r.contact === true || r.contact === 'yes',
			communications: r.communications === true || r.communications === 'yes',
			hostile: r.hostile === true || r.hostile === 'yes',
			opinion: numOrNull(r.relation_current),
			trust: num(r.trust),
			threat: num(r.threat),
			borderRange:
				typeof r.border_range === 'number' && r.border_range < 2147483647 ? r.border_range : null
		}));
}

/** Our first contacts: `first_contacts.contacts.<id>` with `owner` = us. */
export function firstContacts(
	raw: Pick<RawSave, 'countryId' | 'firstContacts' | 'leaders'>
): FirstContact[] {
	return Object.entries(raw.firstContacts).flatMap(([id, c]) => {
		if (!c || typeof c !== 'object' || c.owner !== raw.countryId) return [];
		const leaderId = idOrNull(c.leader);
		const l = leaderId === null ? undefined : raw.leaders[String(leaderId)];
		return [
			{
				id: Number(id),
				countryId: num(c.country),
				name: displayName(c.name),
				systemId: num(c.location),
				leaderId,
				leaderName: l && typeof l === 'object' ? leaderName(l.name) : null,
				date: String(c.date ?? ''),
				daysLeft: numOrNull(c.days_left),
				difficulty: num(c.difficulty),
				clues: num(c.clues),
				stage: String(c.stage ?? ''),
				status: String(c.status ?? '')
			}
		];
	});
}

/** The empires we know of: those we have relations with and the owners of visited stations. */
export function knownCountries(
	raw: Pick<RawSave, 'countries'>,
	ids: Iterable<number>
): CountryInfo[] {
	return [...new Set(ids)].flatMap((id) => {
		const c = raw.countries[String(id)];
		return c ? [{ id, ...c }] : [];
	});
}

/** `situations.situations.<id>` of our country. */
export function situations(raw: Pick<RawSave, 'countryId' | 'situations'>): SituationInfo[] {
	return Object.entries(raw.situations).flatMap(([id, s]) =>
		s && typeof s === 'object' && s.country === raw.countryId
			? [
					{
						id: Number(id),
						type: String(s.type),
						progress: num(s.progress),
						monthly: numOrNull(s.last_month_progress),
						approach: strOrNull(s.approach),
						stage: strOrNull(s.stage)
					}
				]
			: []
	);
}

const systemOf = (raw: Pick<RawSave, 'planets'>, planetId: number | null) =>
	planetId === null ? null : numOrNull(raw.planets[String(planetId)]?.coordinate?.origin);

/** Anomalies found and not yet researched: `country.events.anomalies` (planet ids). */
export function anomalies(raw: Pick<RawSave, 'country' | 'planets'>): AnomalyInfo[] {
	return list(raw.country?.events?.anomalies).flatMap((planetId) => {
		const p = raw.planets[String(planetId)];
		return typeof p?.anomaly === 'string'
			? [
					{
						planetId,
						planet: displayName(p.name),
						systemId: systemOf(raw, planetId) ?? -1,
						category: p.anomaly
					}
				]
			: [];
	});
}

/**
 * Special projects on offer: `country.events.special_project = { id special_project carrier =
 * { type=planet reference } coordinate = { type=2 id } }`. The save holds no progress.
 */
export function specialProjects(raw: Pick<RawSave, 'country' | 'planets'>): ProjectInfo[] {
	return items(raw.country?.events?.special_project)
		.filter((p) => typeof p?.special_project === 'string')
		.map((p) => {
			const planetId =
				p.carrier?.type === 'planet'
					? idOrNull(p.carrier.reference)
					: p.coordinate?.type === 2
						? idOrNull(p.coordinate.id)
						: null;
			return { id: num(p.id), key: p.special_project, planetId, systemId: systemOf(raw, planetId) };
		});
}

/** Archaeological sites (`archaeological_sites.sites`) in systems we visited. */
export function digSites(
	raw: Pick<RawSave, 'archSites' | 'planets'>,
	visited: Set<number>
): DigSite[] {
	return Object.entries(raw.archSites).flatMap(([id, s]) => {
		if (!s || typeof s !== 'object') return [];
		const planetId = num(s.location?.id);
		const systemId = systemOf(raw, planetId);
		if (systemId === null || !visited.has(systemId)) return [];
		return [
			{
				id: Number(id),
				type: String(s.type),
				planetId,
				systemId,
				clues: num(s.clues),
				difficulty: num(s.difficulty),
				daysLeft: numOrNull(s.days_left),
				excavating: idOrNull(s.excavator_fleet) !== null
			}
		];
	});
}
