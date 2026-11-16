import type {
	Arkship,
	CivilianShip,
	Fleet,
	MegaShipyard,
	OrbitalStation,
	Route,
	ShipCount,
	ShipDesign,
	ShipOrder,
	Station
} from '#lib/types.ts';
import { hops, NOT_ROCKY, type RawSave } from '../save.ts';
import { buildQueue } from './colonies.ts';
import { leaderName } from './leaders.ts';
import { displayName, first, items, list, num, type Raw } from './values.ts';

// Save → Snapshot: ships, fleets, stations and ship designs (../save.ts; paths in
// docs/save-format.md).

/**
 * Civilian fleets (`country.fleets_manager.owned_fleets`: science, construction, colony ships)
 * with `current_order = { <kind>_order = { … progress } }`, the queued `order = { … }` and, while
 * travelling, the route (see route()). Order targets: `planet`, `deposit_holder`
 * (type 0 = planet) or `orbitable.planet`. Progress units differ by kind and are interpreted in
 * #lib/ships.ts.
 */
export function civilianShips(
	raw: Pick<
		RawSave,
		'country' | 'fleets' | 'ships' | 'shipDesigns' | 'planets' | 'leaders' | 'date' | 'systems'
	>,
	ownSystems: Set<number> = new Set()
): CivilianShip[] {
	const planetName = (id: Raw) =>
		id === undefined ? null : displayName(raw.planets[String(id)]?.name) || null;
	const order = ([key, o]: [string, Raw]): ShipOrder => {
		const design = raw.shipDesigns[String(o?.ship_design?.design)];
		const planet =
			o?.planet ??
			(num(o?.deposit_holder?.type) === 0 ? o?.deposit_holder?.id : undefined) ??
			o?.orbitable?.planet;
		const system = raw.systems[String(raw.planets[String(planet)]?.coordinate?.origin)];
		return {
			kind: key.replace(/_order$/, ''),
			target: planetName(planet),
			...(system ? { system: displayName(system.name) } : {}),
			progress: typeof o?.progress === 'number' ? o.progress : null,
			orderId: typeof o?.order_id === 'number' ? o.order_id : null,
			...(design ? { size: String(first(design.growth_stages)?.ship_size ?? '') } : {}),
			...(key === 'research_anomaly_order' &&
			typeof raw.planets[String(o?.planet)]?.anomaly === 'string'
				? { anomaly: String(raw.planets[String(o.planet)].anomaly) }
				: {})
		};
	};
	const scientistOn = new Map<number, { name: string; level: number }>();
	for (const id of list(raw.country?.owned_leaders)) {
		const l = raw.leaders[String(id)];
		if (l?.location?.type === 'ship')
			scientistOn.set(num(l.location.id), { name: leaderName(l.name), level: num(l.level) });
	}
	return items(raw.country?.fleets_manager?.owned_fleets).flatMap((o) => {
		const f = raw.fleets[String(o?.fleet)];
		const cls = String(f?.ship_class ?? '');
		if (!f || cls === 'shipclass_military' || /starbase|station/.test(cls)) return [];
		// Automation is an order wrapping the actual task: `automate_fleet_order = { sub_order = {…}
		// settings_survey = yes construct_mining_stations = yes … }`.
		const top = Object.entries(f.current_order ?? {})[0] as [string, Raw] | undefined;
		const auto = top?.[0] === 'automate_fleet_order' ? top[1] : null;
		const scientist = list(f.ships)
			.map((s) => scientistOn.get(s))
			.find(Boolean);
		const current = auto
			? (Object.entries(auto.sub_order ?? {})[0] as [string, Raw] | undefined)
			: top;
		const design =
			raw.shipDesigns[
				String(raw.ships[String(first(list(f.ships)))]?.ship_design_implementation?.design)
			];
		const size = first(design?.growth_stages)?.ship_size;
		const queued = Object.entries(f.order ?? {}).flatMap(([k, v]) =>
			items(v).map((x) => [k, x] as [string, Raw])
		);
		return [
			{
				fleetId: Number(o.fleet),
				name: displayName(f.name),
				kind: cls.replace(/^shipclass_/, ''),
				...(typeof size === 'string' ? { size } : {}),
				stance: typeof f.fleet_stance === 'string' ? f.fleet_stance : null,
				automation: auto
					? Object.entries(auto)
							.filter(([k, v]) => v === true && /^(settings_|construct_|do_)/.test(k))
							.map(([k]) => k.replace(/^(settings_|construct_|do_)/, '').replaceAll('_', ' '))
					: null,
				leader: scientist?.name ?? null,
				leaderLevel: scientist?.level ?? null,
				order: current ? order(current) : null,
				queue: queued.map(order),
				route: route(raw, f),
				parked: current ? null : parked(raw, f, ownSystems)
			}
		];
	});
}

/** Where an idle fleet waits (`movement_manager.orbit.orbitable.planet`, `coordinate.origin`). */
function parked(raw: Pick<RawSave, 'planets' | 'systems'>, f: Raw, own: Set<number>) {
	const system = Number(f?.movement_manager?.coordinate?.origin);
	const planetId = f?.movement_manager?.orbit?.orbitable?.planet;
	const planet = planetId === undefined ? undefined : raw.planets[String(planetId)];
	return {
		planet: planet ? displayName(planet.name) : null,
		// a planet nobody owns and one could settle: not a star, gas giant or asteroid
		planetFree:
			!!planet && planet.owner === undefined && !NOT_ROCKY.test(String(planet.planet_class)),
		system: displayName(raw.systems[String(system)]?.name),
		systemOwned: own.has(system)
	};
}

/** Systems with a starbase (outposts included) of the country's own. */
export function ownSystems(
	raw: Pick<
		RawSave,
		'countryId' | 'construction' | 'deposits' | 'shipDesigns' | 'starbases' | 'systems'
	>
): Set<number> {
	// a waystation claims no space (world.ts `isWaystation`)
	const mine = new Set(
		stations(raw)
			.filter((s) => !s.level.startsWith('waystation'))
			.map((s) => s.id)
	);
	const out = new Set<number>();
	for (const [id, sys] of Object.entries(raw.systems))
		if (list(sys?.starbases).some((sb) => mine.has(sb))) out.add(Number(id));
	return out;
}

/**
 * Mining, research and observation stations in our systems: the planets a station orbits
 * (`shipclass_orbital_station`, the station ship's id) with their deposits.
 */
export function orbitalStations(
	raw: Pick<RawSave, 'systems' | 'planets' | 'deposits'>,
	own: Set<number>
): OrbitalStation[] {
	return [...own].flatMap((systemId) =>
		list(raw.systems[String(systemId)]?.planet).flatMap((planetId) => {
			const p = raw.planets[String(planetId)];
			if (p?.shipclass_orbital_station === undefined) return [];
			return [
				{
					systemId,
					planetId: Number(planetId),
					deposits: list(p.deposits)
						.map((d) => raw.deposits[String(d)]?.type)
						.filter((t): t is string => typeof t === 'string' && t !== 'none')
				}
			];
		})
	);
}

/**
 * Ships of the country's fleets (`country.fleets_manager.owned_fleets`), by the design's size;
 * the fleet's `ship_class` tells military (`shipclass_military`), stations (starbases, mining and
 * research stations) and the rest, civilian.
 */
export function shipCounts(
	raw: Pick<RawSave, 'country' | 'fleets' | 'ships' | 'shipDesigns'>
): ShipCount[] {
	const counts = new Map<string, ShipCount>();
	for (const owned of items(raw.country?.fleets_manager?.owned_fleets)) {
		const fleet = raw.fleets[String(owned?.fleet)];
		if (!fleet || typeof fleet !== 'object') continue;
		const cls = String(fleet.ship_class ?? '');
		const group =
			cls === 'shipclass_military'
				? 'military'
				: /starbase|station/.test(cls)
					? 'station'
					: 'civilian';
		for (const shipId of list(fleet.ships)) {
			const design =
				raw.shipDesigns[String(raw.ships[String(shipId)]?.ship_design_implementation?.design)];
			const size = String(
				first(design?.growth_stages)?.ship_size ?? design?.ship_size ?? 'unknown'
			);
			const key = `${group}:${size}`;
			const c = counts.get(key) ?? { group, size, count: 0 };
			counts.set(key, { ...c, count: c.count + 1 });
		}
	}
	return [...counts.values()];
}

const queueSlots = (raw: Pick<RawSave, 'construction'>, queueId: Raw) =>
	num(raw.construction?.queue_mgr?.queues?.[String(queueId)]?.simultaneous) || 1;

/** Where a ship is: its own `coordinate.origin`, else its fleet's (`movement_manager`). */
export function shipSystemId(
	raw: Partial<Pick<RawSave, 'ships' | 'fleets'>>,
	shipId: unknown
): number | null {
	const ship = raw.ships?.[String(shipId)];
	const id =
		ship?.coordinate?.origin ??
		raw.fleets?.[String(ship?.fleet)]?.movement_manager?.coordinate?.origin;
	return id === undefined || id === null ? null : Number(id);
}

/**
 * The capital's system. `country.capital` is a colony id: its carrier is a planet (that planet's
 * system) or, for a nomad, the arkship (where the ship is). Before READER 41 it was read as a
 * planet id, which held only where colony and planet ids happened to match (UNE's colony 0 on
 * Sol's planet 0); Roaming Korinth's colony 0 rides ship 0, while planet 0 is its old home star.
 */
export function capitalSystem(
	raw: Pick<RawSave, 'country' | 'planets'> &
		Partial<Pick<RawSave, 'colonies' | 'ships' | 'fleets'>>
): number | null {
	const colonyId = raw.country?.capital;
	if (colonyId === undefined || colonyId === null) return null;
	const carrier = raw.colonies?.[String(colonyId)]?.carrier;
	if (carrier?.type === 'ship') return shipSystemId(raw, carrier.reference);
	const planet =
		carrier?.type === 'planet'
			? raw.planets[String(carrier.reference)]
			: Object.values(raw.planets).find(
					(p) => p && typeof p === 'object' && Number(p.colony) === Number(colonyId)
				);
	const origin = planet?.coordinate?.origin;
	return origin === undefined ? null : Number(origin);
}

/** Our arkships: the ships that carry a colony we control, where each is now. */
export function arkships(
	raw: Pick<RawSave, 'country' | 'colonies' | 'ships' | 'fleets' | 'shipDesigns'>
): Arkship[] {
	const capital = Number(raw.country?.capital);
	return list(raw.country?.controlled_colonies).flatMap((colonyId) => {
		const carrier = raw.colonies?.[String(colonyId)]?.carrier;
		if (carrier?.type !== 'ship') return [];
		const ship = raw.ships?.[String(carrier.reference)];
		if (!ship || typeof ship !== 'object') return [];
		const design = raw.shipDesigns?.[String(ship.ship_design_implementation?.design)];
		const size = String(first(design?.growth_stages)?.ship_size ?? design?.ship_size ?? '');
		return [
			{
				shipId: Number(carrier.reference),
				colonyId: Number(colonyId),
				name: displayName(ship.name),
				size,
				tier: Number(/_tier_(\d+)/.exec(size)?.[1] ?? 0),
				planetSize: num(ship.planet_size),
				systemId: shipSystemId(raw, carrier.reference),
				capital: Number(colonyId) === capital
			}
		];
	});
}

/**
 * The country's starbases, outposts included: those whose own `build_queue` it owns (the starbase
 * itself names no owner). `build_queue` holds modules and buildings, `shipyard_build_queue` ships —
 * present only with a shipyard module. The system comes from `galactic_object.<id>.starbases`.
 */
export function stations(
	raw: Pick<
		RawSave,
		'countryId' | 'construction' | 'deposits' | 'shipDesigns' | 'starbases' | 'systems'
	> &
		Partial<Pick<RawSave, 'ships' | 'fleets'>>
): Station[] {
	const systemOf = new Map<number, { id: number; name: string }>();
	for (const [id, sys] of Object.entries(raw.systems))
		for (const sb of list(sys?.starbases))
			systemOf.set(sb, { id: Number(id), name: displayName(sys.name) });
	// A station no system lists — an arkship's: it travels — is where its station ship is: the
	// ship's own `coordinate.origin`, else its fleet's (an arkship is a fleet of its own,
	// `ship_class=shipclass_starbase`, `mobile=yes`; both agreed for all four arkships of Roaming
	// Korinth 2206.10.08).
	const shipSystem = (sb: Raw) => {
		const id = shipSystemId(raw, sb?.station);
		const sys = id === null ? undefined : raw.systems[String(id)];
		return sys ? { id, name: displayName(sys.name) } : undefined;
	};
	// A starbase is the country's when its own build queue is: the queue's `location.id` is the
	// starbase's station ship, not the starbase (both 0 for Sol, which hid it; outposts differ).
	const queues = raw.construction?.queue_mgr?.queues ?? {};
	const own = Object.keys(raw.starbases).filter((id) => {
		const sb = raw.starbases[id];
		return sb && typeof sb === 'object' && queues[String(sb.build_queue)]?.owner === raw.countryId;
	});
	return own.map(Number).flatMap((id) => {
		const sb = raw.starbases[String(id)];
		if (!sb || typeof sb !== 'object') return [];
		const modules = Object.values(sb.modules ?? {}).map(String);
		const where = systemOf.get(id) ?? shipSystem(sb);
		return [
			{
				id,
				system: where?.name ?? '',
				systemId: where?.id ?? null,
				level: String(sb.level ?? '').replace(/^starbase_level_/, ''),
				modules,
				buildings: Object.values(sb.buildings ?? {}).map(String),
				queue: sb.build_queue !== undefined ? buildQueue(raw, Number(sb.build_queue)) : [],
				slots: queueSlots(raw, sb.build_queue),
				shipyard:
					// 4294967295: none (the arkship of Roaming Korinth builds through its colony's queue)
					queues[String(sb.shipyard_build_queue)] !== undefined &&
					(modules.includes('shipyard') || modules.some((m) => m.startsWith('arkship')))
						? {
								queue: buildQueue(raw, Number(sb.shipyard_build_queue)),
								slots: queueSlots(raw, sb.shipyard_build_queue)
							}
						: null,
				arkship:
					String(sb.level ?? '').includes('arkship') || String(sb.type ?? '').includes('arkship'),
				...(String(sb.level ?? '').includes('waystation') && waystationState(raw, sb))
			}
		];
	});
}

/**
 * What a waystation holds until a logistic ship or arkship collects it: its station ship's
 * `resources` (`ships.<station>.resources`), and how full it is — `variables.waystation_collection_fill`,
 * 0…1, which the game sets monthly (4.5.4 events/nomads_events_1.txt nomads.9035: the station's
 * `used_stockpile_capacity_percentage`, or its whole wayline's when a Logistics Hub collects
 * there). `collecting`: a logistic ship is on its way (`flags.stockpile_being_collected_locally_by_logistic_ship`).
 */
function waystationState(
	raw: Partial<Pick<RawSave, 'ships'>>,
	sb: Raw
): Pick<Station, 'stockpile' | 'fill' | 'collecting'> {
	const res = raw.ships?.[String(sb.station)]?.resources ?? {};
	const fill = sb.variables?.waystation_collection_fill;
	return {
		stockpile: Object.fromEntries(
			Object.entries(res).flatMap(([k, v]) => (typeof v === 'number' && v > 0 ? [[k, v]] : []))
		),
		fill: typeof fill === 'number' ? fill : null,
		collecting: sb.flags?.stockpile_being_collected_locally_by_logistic_ship !== undefined
	};
}

/**
 * The country's Mega Shipyards (`megastructures.<id> = { type owner … }`). Not yet seen in a save:
 * its ship queue is taken to be a `ships` queue located at the megastructure (any location type
 * but planet and starbase) — unverified, `queue: null` when none is found.
 */
export function megaShipyards(
	raw: Pick<
		RawSave,
		'countryId' | 'construction' | 'deposits' | 'shipDesigns' | 'megastructures' | 'systems'
	>
): MegaShipyard[] {
	const queues = Object.entries(raw.construction?.queue_mgr?.queues ?? {});
	return Object.entries(raw.megastructures)
		.filter(([, m]) => m && typeof m === 'object' && m.owner === raw.countryId)
		.filter(([, m]) => String(m.type).startsWith('mega_shipyard'))
		.map(([id, m]) => {
			const q = queues.find(
				([, x]: [string, Raw]) =>
					x?.type === 'ships' &&
					Number(x.location?.id) === Number(id) &&
					![0, 2].includes(num(x.location?.type))
			);
			return {
				id: Number(id),
				type: String(m.type),
				system: displayName(raw.systems[String(m.coordinate?.origin)]?.name),
				queue: q ? buildQueue(raw, Number(q[0])) : null,
				slots: q ? queueSlots(raw, q[0]) : 1
			};
		});
}

/**
 * A fleet's route: its system (`movement_manager.coordinate.origin`) and the systems of its order
 * targets — current order, then the queue — with jumps counted along the hyperlanes.
 * `movement_manager.path.date` is no arrival date (a fleet in flight had one two years past).
 */
export function route(raw: Pick<RawSave, 'planets' | 'systems' | 'country'>, f: Raw): Route {
	// systems the country's ships have been to (`country.visited_objects`); the rest is unexplored
	const visited = new Set(list(raw.country?.visited_objects));
	const here = f?.movement_manager?.coordinate?.origin;
	const systemOf = (o: Raw) => {
		const planet =
			o?.planet ??
			o?.orbitable?.planet ??
			(num(o?.deposit_holder?.type) === 0 ? o?.deposit_holder?.id : undefined);
		return planet === undefined ? undefined : raw.planets[String(planet)]?.coordinate?.origin;
	};
	// an automated fleet's task sits in the automation order's sub_order
	const unwrap = (o: Raw) => (o?.sub_order ? Object.values(o.sub_order)[0] : o);
	const orders = [
		...Object.values(f?.current_order ?? {}).map(unwrap),
		...Object.values(f?.order ?? {}).flatMap((v) => items(v))
	];
	const systems = orders
		.map(systemOf)
		.filter((s) => s !== undefined)
		.filter((s, i, all) => i === 0 || s !== all[i - 1]);
	let from = here;
	let total: number | null = 0;
	const stops = systems.map((sys) => {
		const leg = hops(raw.systems, from).get(Number(sys));
		total = total === null || leg === undefined ? null : total + leg;
		from = sys;
		return {
			system: displayName(raw.systems[String(sys)]?.name),
			jumps: total,
			unexplored: !visited.has(Number(sys))
		};
	});
	return {
		at: displayName(raw.systems[String(here)]?.name),
		...(here !== undefined && raw.systems[String(here)] ? { systemId: Number(here) } : {}),
		moving: f?.movement_manager?.state !== undefined && f.movement_manager.state !== 'move_idle',
		stops
	};
}

/** Military fleets with ship count, power (`fleet.military_power`) and route. */
export function militaryFleets(
	raw: Pick<RawSave, 'country' | 'fleets' | 'planets' | 'systems'> & Partial<Pick<RawSave, 'ships'>>
): Fleet[] {
	return items(raw.country?.fleets_manager?.owned_fleets)
		.map((o) => ({ id: Number(o?.fleet), f: raw.fleets[String(o?.fleet)] }))
		.filter(({ f }) => f && typeof f === 'object' && f.ship_class === 'shipclass_military')
		.map(({ id, f }) => ({
			fleetId: id,
			name: displayName(f.name),
			ships: list(f.ships).length,
			power: num(f.military_power),
			route: route(raw, f),
			designs: tally(
				list(f.ships)
					.map((s) => shipDesignId(raw, s))
					.filter((d) => d >= 0)
			).map(([designId, count]) => ({
				designId,
				count
			}))
		}));
}

const NONE = 4294967295;
/** The design a ship is built to (`ship_design_implementation.design`), -1 when unknown. */
const shipDesignId = (raw: Partial<Pick<RawSave, 'ships'>>, shipId: number): number => {
	const d = raw.ships?.[String(shipId)]?.ship_design_implementation?.design;
	return d === undefined ? -1 : Number(d);
};
/** [value, count] in first-seen order. */
const tally = (xs: number[]): [number, number][] => {
	const m = new Map<number, number>();
	for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
	return [...m];
};

/**
 * Our ship designs (READER 53): the saved ones (`country.ship_design_collection.ship_design`, ids
 * into the global `ship_design`) and those our ships use though no longer saved — unofficial
 * (UNE 6 2208.01.01: design 35, an auto-generated "Cheetah" gunship, on three corvettes whose
 * `upgrade` names the saved Cheetah 2451). Ships of station fleets (starbases, mining and
 * research stations: `ship_class` starbase/station) do not count — their designs live outside the
 * collection (`starbase_outpost`, `starbase_starport`). `upgradeTo` is the most common `upgrade`
 * of its ships (4294967295 = none) — a reading of one save, not yet checked in game.
 */
export function shipDesigns(
	raw: Pick<RawSave, 'country' | 'fleets' | 'ships' | 'shipDesigns'>
): ShipDesign[] {
	const saved = list(raw.country?.ship_design_collection?.ship_design);
	const used = new Map<number, number[]>(); // design → our ship ids
	for (const owned of items(raw.country?.fleets_manager?.owned_fleets)) {
		const fleet = raw.fleets[String(owned?.fleet)];
		if (!fleet || typeof fleet !== 'object') continue;
		if (/starbase|station/.test(String(fleet.ship_class ?? ''))) continue;
		for (const shipId of list(fleet.ships)) {
			const d = shipDesignId(raw, shipId);
			if (d >= 0) used.set(d, [...(used.get(d) ?? []), shipId]);
		}
	}
	const ids = [...new Set([...saved, ...used.keys()])];
	return ids.flatMap((id) => {
		const d = raw.shipDesigns[String(id)];
		if (!d || typeof d !== 'object') return [];
		const stage = first(d.growth_stages) ?? {};
		const ships = used.get(id) ?? [];
		const upgrades = tally(
			ships
				.map((s) => Number(raw.ships[String(s)]?.ship_design_implementation?.upgrade ?? NONE))
				.filter((u) => u !== NONE && u !== id)
		).sort((a, b) => b[1] - a[1]);
		return [
			{
				id,
				name: displayName(d.name),
				size: String(stage.ship_size ?? d.ship_size ?? 'unknown'),
				role: d.role === undefined ? null : String(d.role),
				sections: items(stage.section).map((sec: Raw) => ({
					template: String(sec?.template ?? ''),
					slot: String(sec?.slot ?? ''),
					components: items(sec?.component).map((c: Raw) => ({
						slot: String(c?.slot ?? ''),
						template: String(c?.template ?? '')
					}))
				})),
				required: items(stage.required_component).map(String),
				saved: saved.includes(id),
				autoGen: d.auto_gen_design === true || d.auto_gen_design === 'yes',
				ships: ships.length,
				upgradeTo: upgrades[0]?.[0] ?? null
			}
		];
	});
}
