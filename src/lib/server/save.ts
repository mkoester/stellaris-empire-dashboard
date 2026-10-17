import { Jomini } from 'jomini';
import type {
	BudgetSource,
	KnownSystem,
	MigrationColony,
	Route,
	CivilianShip,
	ShipOrder,
	ColonyDistrict,
	MegaShipyard,
	Station,
	Colony,
	ExpansionPlanet,
	Fleet,
	Sector,
	SpeciesInfo,
	ColonyJob,
	TimedModifier,
	PlanetState,
	Market,
	MarketOrder,
	ShipCount,
	Stratum,
	Progress,
	QueueItem,
	Resources,
	DealSide,
	TradeDeal,
	War,
	Snapshot
} from '#lib/types.ts';
import { MARKET_RESOURCES } from '#lib/market.ts';
import { addGameDays, START_YEAR } from '#lib/series.ts';
import { readZipEntry } from './zip.ts';

// Save → Snapshot. `querySave` is the only part touching jomini; everything after it is pure and
// takes plain objects, so it is unit-tested against hand-written fixtures.
// Paths into the gamestate are documented in AGENTS.md ("Save format facts").

// jomini returns untyped JS values; this is the subset of the gamestate we read.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export type RawSave = {
	date: string;
	tick: number;
	randomCount: number;
	countryId: number;
	country: Raw;
	colonies: Record<string, Raw>;
	planets: Record<string, Raw>;
	construction: Raw;
	deposits: Record<string, Raw>;
	starbases: Record<string, Raw>; // starbase_mgr.starbases
	districtsDb: Record<string, Raw>; // top-level districts, zones and buildings (4.x)
	zones: Record<string, Raw>;
	buildings: Record<string, Raw>;
	megastructures: Record<string, Raw>;
	countryNames: Record<string, string>; // owners of colonised planets
	empireName: string;
	endGameStart: number | null; // galaxy.end_game_start: years after the 2200.01.01 start
	galaxy: Raw; // galaxy setup: cost sliders `technology`, `traditions`
	leaders: Record<string, Raw>;
	monthlyTrades: Raw; // market.monthly_trades: every country's standing orders
	market: Raw; // market: price fluctuations, galactic and internal
	popJobs: Record<string, Raw>; // top-level pop_jobs, referenced from colony.pop_jobs
	popGroups: Record<string, Raw>; // top-level pop_groups, referenced from colony.pop_groups
	fleets: Record<string, Raw>;
	ships: Record<string, Raw>;
	shipDesigns: Record<string, Raw>;
	automationResources: Raw; // top-level automation_resources.<country>: disallowed resources
	systems: Record<string, Raw>; // galactic_object: names, planets, hyperlanes
	sectors: Record<string, Raw>;
	speciesDb: Record<string, Raw>;
	wars: Record<string, Raw>; // top-level war (UNVERIFIED shape: empty in every save seen)
	tradeDeals: Record<string, Raw>; // top-level trade_deal (UNVERIFIED shape, likewise)
};

let parser: Promise<Jomini> | undefined;

export async function readSave(zip: Uint8Array): Promise<RawSave> {
	const jomini = await (parser ??= Jomini.initialize());
	const opts = { typeNarrowing: 'unquoted' as const };
	const meta = jomini.parseText(readZipEntry(zip, 'meta'), opts);
	return jomini.parseText(readZipEntry(zip, 'gamestate'), opts, (q) => {
		const countryId = Number(first(q.at('/player'))?.country ?? 0);
		const colonies = q.at('/colony') ?? {};
		const planets = q.at('/planets/planet') ?? {};
		const wars = q.at('/war') ?? {};
		const tradeDeals = q.at('/trade_deal') ?? {};
		// names of every empire owning a colony (migration involves foreign colonies too) and of
		// those at war or trading with anyone
		const owners = new Set([
			...Object.values(planets as Record<string, Raw>)
				.filter(
					(p) => p && typeof p === 'object' && p.colony !== undefined && p.owner !== undefined
				)
				.map((p) => Number(p.owner)),
			...countryIds(wars),
			...countryIds(tradeDeals)
		]);
		const countryNames = Object.fromEntries(
			[...owners].map((id) => [id, displayName(q.at(`/country/${id}/name`))])
		);
		return {
			date: String(q.at('/date')),
			tick: Number(q.at('/tick') ?? 0),
			randomCount: Number(q.at('/random_count') ?? 0),
			countryId,
			country: q.at(`/country/${countryId}`),
			colonies,
			planets,
			countryNames,
			construction: q.at('/construction'),
			deposits: q.at('/deposit') ?? {},
			empireName: String(meta.name ?? ''),
			endGameStart: numOrNull(q.at('/galaxy/end_game_start')),
			leaders: q.at('/leaders') ?? {},
			monthlyTrades: q.at('/market/monthly_trades'),
			market: {
				fluctuations: q.at('/market/fluctuations'),
				galactic_market_resources: q.at('/market/galactic_market_resources'),
				internal_market_fluctuations: q.at('/market/internal_market_fluctuations')
			},
			popJobs: q.at('/pop_jobs') ?? {},
			popGroups: q.at('/pop_groups') ?? {},
			fleets: q.at('/fleet') ?? {},
			ships: q.at('/ships') ?? {},
			shipDesigns: q.at('/ship_design') ?? {},
			automationResources: q.at(`/automation_resources/${countryId}`),
			systems: q.at('/galactic_object') ?? {},
			sectors: q.at('/sectors') ?? {},
			speciesDb: q.at('/species_db') ?? {},
			wars,
			tradeDeals,
			starbases: q.at('/starbase_mgr/starbases') ?? {},
			districtsDb: q.at('/districts') ?? {},
			zones: q.at('/zones') ?? {},
			buildings: q.at('/buildings') ?? {},
			megastructures: q.at('/megastructures') ?? {},
			galaxy: { technology: q.at('/galaxy/technology'), traditions: q.at('/galaxy/traditions') }
		};
	});
}

export function toSnapshot(raw: RawSave, campaign: string): Snapshot {
	const budget = raw.country?.budget?.current_month ?? {};
	return {
		kind: 'save',
		campaign,
		date: raw.date,
		fingerprint: `${raw.tick}:${raw.randomCount}`,
		countryId: raw.countryId,
		empireName: raw.empireName,
		pops: num(raw.country?.num_sapient_pops),
		stockpile: resources(raw.country?.modules?.standard_economy_module?.resources),
		// The market's automatic monthly trades are booked apart (trade_*); the game's top bar
		// includes them.
		income: addResources(sumSources(budget.income), sumSources(budget.trade_income)),
		expenses: addResources(sumSources(budget.expenses), sumSources(budget.trade_expenses)),
		balance: addResources(sumSources(budget.balance), sumSources(budget.trade_balance)),
		colonies: playerColonies(raw),
		endGameYear: raw.endGameStart === null ? null : START_YEAR + raw.endGameStart,
		empireSize: numOrNull(raw.country?.empire_size),
		starbases:
			typeof raw.country?.starbase_capacity === 'number'
				? { used: num(raw.country.starbase_capacity_used), capacity: raw.country.starbase_capacity }
				: null,
		navalUsed: numOrNull(raw.country?.used_naval_capacity),
		envoys: envoys(ownLeaders(raw)),
		leaders: countBy(ownLeaders(raw).map((l) => String(l.class))),
		ships: shipCounts(raw),
		defaultAutomation: items(raw.country?.default_planet_automation_settings).map(String),
		// Read as disallowed: empty at 2200.04 with every resource allowed, all of them listed at
		// 2200.05 after the player unticked all (in-game screenshot).
		automationBlocked: items(raw.automationResources).map(String),
		planetBudget: planetBudget(budget),
		score: {
			rank: num(raw.country?.victory_rank),
			score: num(raw.country?.victory_score),
			economy: num(raw.country?.economy_power),
			tech: num(raw.country?.tech_power),
			military: num(raw.country?.military_power)
		},
		fleets: militaryFleets(raw),
		idleLeaders: idleLeaders(raw),
		traditions: items(raw.country?.traditions).map(String),
		ascensionPerks: items(raw.country?.ascension_perks).map(String),
		civilianShips: civilianShips(raw, ownSystems(raw)),
		edicts: items(raw.country?.edicts)
			.map((e) => e?.edict)
			.filter((e) => typeof e === 'string'),
		countryModifiers: countryModifiers(raw),
		species: speciesInfo(raw),
		sectors: sectors(raw),
		expansion: expansion(raw),
		stations: stations(raw),
		migration: migration(raw),
		knownSystems: knownSystems(raw, ownSystems(raw)),
		megaShipyards: megaShipyards(raw),
		marketOrders: marketOrders(raw.monthlyTrades, raw.countryId),
		market: market(raw),
		progress: progress(raw),
		leaderRoster: leaderRoster(raw),
		ruler: ruler(raw),
		agendasDone: items(raw.country?.government?.council_agenda_cooldowns)
			.map((c) => c?.council_agenda)
			.filter((k) => typeof k === 'string'),
		policies: Object.fromEntries(
			items(raw.country?.active_policies)
				.filter((p) => typeof p?.policy === 'string')
				.map((p) => [p.policy, String(p.selected)])
		),
		government: [
			...items(raw.country?.government?.civics),
			...items(raw.country?.ethos?.ethics),
			raw.country?.government?.authority
		].filter((k) => typeof k === 'string'),
		wars: wars(raw),
		warLostDate:
			typeof raw.country?.last_date_war_lost === 'string' ? raw.country.last_date_war_lost : null,
		tradeDeals: tradeDeals(raw)
	};
}

/**
 * `country.timed_modifier = { items = { { modifier="celebrate_diversity" days=3535 } … } }` —
 * `days` left, −1 for a permanent one.
 */
export function countryModifiers(raw: Pick<RawSave, 'country' | 'date'>): TimedModifier[] {
	return timedModifiers(raw.country?.timed_modifier, raw.date);
}

/** A `timed_modifier` block (country or planet) with end dates. */
function timedModifiers(block: Raw, date: string): TimedModifier[] {
	return items(block?.items)
		.filter((m) => typeof m?.modifier === 'string')
		.map((m) => ({
			key: m.modifier,
			until: typeof m.days === 'number' && m.days > 0 ? addGameDays(date, m.days) : null
		}));
}

/**
 * A planet's deposits (`planet.deposits` → `deposit.<id> = { type swap_type }`; a blocker's
 * `swap_type` is the feature it hides — Earth: the Great Pacific Garbage Patch hides the Pacific
 * Algae Tracts) and its `timed_modifier` (features like `tidal_locked` are permanent ones).
 */
export function planetState(raw: Pick<RawSave, 'deposits' | 'date'>, planet: Raw): PlanetState {
	return {
		deposits: list(planet?.deposits)
			.map((d) => raw.deposits[String(d)])
			.filter((d) => typeof d?.type === 'string')
			.map((d) => ({ key: d.type, swap: typeof d.swap_type === 'string' ? d.swap_type : null })),
		modifiers: timedModifiers(planet?.timed_modifier, raw.date)
	};
}

/** `market.monthly_trades = { { trade_data = { trade_type=market_buy|market_sell resource country } amount } }` */
export function marketOrders(trades: Raw, countryId: number): MarketOrder[] {
	return (Array.isArray(trades) ? trades : [])
		.filter((t) => Number(t?.trade_data?.country) === countryId)
		.map((t) => ({
			kind: t.trade_data.trade_type === 'market_buy' ? ('buy' as const) : ('sell' as const),
			resource: String(t.trade_data.resource),
			amount: num(t.amount)
		}));
}

/**
 * The market the country trades on. Access to the galactic market is the country flag
 * `has_market_access` (set and removed together with `enable_galactic_market`, events
 * `on_action_events_2.txt` / `galactic_community_events.txt`). Its prices are
 * `market.fluctuations`, one per resource in the order of `common/strategic_resources`, traded
 * where `galactic_market_resources` is not 0 (both UNVERIFIED — no save with a galactic market
 * seen; the shape is stellaris-dashboard's parser's). The internal market's are
 * `market.internal_market_fluctuations = { country=<id> resources={ energy=-15.9 … } … }`, listing
 * only resources whose price has moved — the basic five always trade, at 0 when not listed.
 */
export function market(raw: Pick<RawSave, 'market' | 'country' | 'countryId'>): Market {
	if (raw.country?.flags?.has_market_access !== undefined) {
		const open = items(raw.market?.galactic_market_resources);
		const fluctuations = items(raw.market?.fluctuations);
		return {
			galactic: true,
			fluctuations: Object.fromEntries(
				MARKET_RESOURCES.flatMap((r, i) =>
					typeof fluctuations[i] === 'number' && num(open[i]) !== 0 ? [[r, fluctuations[i]]] : []
				)
			)
		};
	}
	const internal = raw.market?.internal_market_fluctuations;
	const at = items(internal?.country).findIndex((c) => Number(c) === raw.countryId);
	const own = at < 0 ? {} : items(internal.resources)[at];
	return {
		galactic: false,
		fluctuations: {
			...Object.fromEntries(ALWAYS_TRADED.map((r) => [r, 0])),
			...Object.fromEntries(
				Object.entries<Raw>(
					own && typeof own === 'object' && !Array.isArray(own) ? own : {}
				).filter(([, v]) => typeof v === 'number')
			)
		}
	};
}

const ALWAYS_TRADED = ['energy', 'minerals', 'food', 'consumer_goods', 'alloys'];

/**
 * The country's leaders: `country.owned_leaders`. Filtering `leaders` by `country` would also
 * count the recruitment pool (19 instead of 7 at 2200.05).
 */
function ownLeaders(raw: Pick<RawSave, 'country' | 'leaders'>): Raw[] {
	return list(raw.country?.owned_leaders)
		.map((id) => raw.leaders[String(id)])
		.filter((l) => l && typeof l === 'object');
}

/**
 * Hired leaders without a post: no `location` (ship, planet, envoy assignment) and no
 * `council_location`. The ruler sits in neither and is left out; so are envoys (see envoys()).
 */
export function idleLeaders(raw: Pick<RawSave, 'country' | 'leaders'>) {
	return list(raw.country?.owned_leaders).flatMap((id) => {
		const l = raw.leaders[String(id)];
		if (!l || typeof l !== 'object' || l.class === 'envoy' || id === num(raw.country?.ruler))
			return [];
		if (l.location !== undefined || l.council_location !== undefined) return [];
		return [{ id, class: String(l.class), name: leaderName(l.name) }];
	});
}

/** Every hired leader (`country.owned_leaders` → `leaders.<id>`), envoys and the ruler included. */
export function leaderRoster(raw: Pick<RawSave, 'country' | 'leaders'>) {
	return list(raw.country?.owned_leaders).flatMap((id) => {
		const l = raw.leaders[String(id)];
		if (!l || typeof l !== 'object') return [];
		return [{ id, class: String(l.class), name: leaderName(l.name) }];
	});
}

export function ruler(raw: Pick<RawSave, 'country' | 'leaders'>) {
	const id = num(raw.country?.ruler);
	const l = raw.leaders[String(id)];
	return l && typeof l === 'object' ? { id, name: leaderName(l.name) } : null;
}

/** `name = { full_names = { key=… } }` (or a list of parts) → "Mncedisi Iweala". */
function leaderName(name: Raw): string {
	const full = name?.full_names ?? name;
	const parts = Array.isArray(full) ? full : [full];
	return parts
		.map((p) => displayName(p))
		.filter(Boolean)
		.join(' ');
}

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
		const queued = Object.entries(f.order ?? {}).flatMap(([k, v]) =>
			items(v).map((x) => [k, x] as [string, Raw])
		);
		return [
			{
				fleetId: Number(o.fleet),
				name: displayName(f.name),
				kind: cls.replace(/^shipclass_/, ''),
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
	const mine = new Set(stations(raw).map((s) => s.id));
	const out = new Set<number>();
	for (const [id, sys] of Object.entries(raw.systems))
		if (list(sys?.starbases).some((sb) => mine.has(sb))) out.add(Number(id));
	return out;
}

export const countBy = (keys: string[]): Record<string, number> =>
	keys.reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {});

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

/**
 * The country's starbases, outposts included: those whose own `build_queue` it owns (the starbase
 * itself names no owner). `build_queue` holds modules and buildings, `shipyard_build_queue` ships —
 * present only with a shipyard module. The system comes from `galactic_object.<id>.starbases`.
 */
export function stations(
	raw: Pick<
		RawSave,
		'countryId' | 'construction' | 'deposits' | 'shipDesigns' | 'starbases' | 'systems'
	>
): Station[] {
	const systemOf = new Map<number, string>();
	for (const sys of Object.values(raw.systems))
		for (const sb of list(sys?.starbases)) systemOf.set(sb, displayName(sys.name));
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
		return [
			{
				id,
				system: systemOf.get(id) ?? '',
				level: String(sb.level ?? '').replace(/^starbase_level_/, ''),
				modules,
				buildings: Object.values(sb.buildings ?? {}).map(String),
				queue: sb.build_queue !== undefined ? buildQueue(raw, Number(sb.build_queue)) : [],
				slots: queueSlots(raw, sb.build_queue),
				shipyard:
					sb.shipyard_build_queue !== undefined &&
					(modules.includes('shipyard') || modules.some((m) => m.startsWith('arkship')))
						? {
								queue: buildQueue(raw, Number(sb.shipyard_build_queue)),
								slots: queueSlots(raw, sb.shipyard_build_queue)
							}
						: null,
				arkship:
					String(sb.level ?? '').includes('arkship') || String(sb.type ?? '').includes('arkship')
			}
		];
	});
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
		moving: f?.movement_manager?.state !== undefined && f.movement_manager.state !== 'move_idle',
		stops
	};
}

/** Military fleets with ship count, power (`fleet.military_power`) and route. */
export function militaryFleets(
	raw: Pick<RawSave, 'country' | 'fleets' | 'planets' | 'systems'>
): Fleet[] {
	return items(raw.country?.fleets_manager?.owned_fleets)
		.map((o) => raw.fleets[String(o?.fleet)])
		.filter((f) => f && typeof f === 'object' && f.ship_class === 'shipclass_military')
		.map((f) => ({
			name: displayName(f.name),
			ships: list(f.ships).length,
			power: num(f.military_power),
			route: route(raw, f)
		}));
}

/**
 * Species with pops on the empire's colonies (`pop_groups.key.species` → `species_db`), with
 * their traits. Names are localisation keys the save does not resolve.
 */
export function speciesInfo(
	raw: Pick<RawSave, 'country' | 'colonies' | 'popGroups' | 'speciesDb'>
): SpeciesInfo[] {
	const pops = new Map<string, number>();
	for (const colonyId of list(raw.country?.controlled_colonies))
		for (const g of list(raw.colonies[String(colonyId)]?.pop_groups)) {
			const group = raw.popGroups[String(g)];
			const sp = group?.key?.species;
			if (sp !== undefined) pops.set(String(sp), (pops.get(String(sp)) ?? 0) + num(group.size));
		}
	return [...pops].map(([id, n]) => {
		const s = raw.speciesDb[id] ?? {};
		return {
			id,
			name: speciesName(s.name),
			cls: String(s.class ?? ''),
			traits: items(s.traits?.trait).map(String),
			pops: n
		};
	});
}

/** `PRESCRIPTED_species_name_humans1` → `Humans`; other keys as displayName reads them. */
function speciesName(name: Raw): string {
	const key = String(name?.key ?? name ?? '');
	const m = /^PRESCRIPTED_species_name_([a-z_]+?)\d*$/i.exec(key);
	return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : displayName(name);
}

/** The empire's sectors (`country.sectors.owned` → `sectors.<id>`), colonies counted per system. */
export function sectors(raw: Pick<RawSave, 'country' | 'sectors' | 'systems'>): Sector[] {
	return list(raw.country?.sectors?.owned).map((id) => {
		const s = raw.sectors[String(id)] ?? {};
		const systems = list(s.systems);
		return {
			name: displayName(s.name),
			type: String(s.type ?? '').replace(/_sector$/, ''),
			systems: systems.length,
			colonies: systems.reduce((n, sys) => n + list(raw.systems[String(sys)]?.colonies).length, 0)
		};
	});
}

/** Not planets one could settle: stars, gas giants, asteroids and the like. */
const NOT_ROCKY =
	/star$|^pc_(gas_giant|asteroid|ice_asteroid|rare_crystal_asteroid|black_hole|pulsar|neutron_star|shattered|ringworld)/;

/**
 * Surveyed planets (`country.surveyed_deposit_holders`, type 0 = planet) that are rocky and owned
 * by nobody, with jumps from the capital's system over `galactic_object.<id>.hyperlane`.
 * Habitability is left out: which of them the game lists depends on species and terraforming.
 */
export function expansion(
	raw: Pick<RawSave, 'country' | 'planets' | 'systems' | 'deposits' | 'date'>
): ExpansionPlanet[] {
	const capitalSystem = raw.planets[String(raw.country?.capital)]?.coordinate?.origin;
	const jumps = hops(raw.systems, capitalSystem);
	return items(raw.country?.surveyed_deposit_holders)
		.filter((h) => num(h?.type) === 0)
		.map((h) => [Number(h.id), raw.planets[String(h.id)]] as const)
		.filter(([, p]) => p && typeof p === 'object' && p.owner === undefined)
		.filter(([, p]) => !NOT_ROCKY.test(String(p.planet_class)))
		.map(([planetId, p]) => {
			const sys = p.coordinate?.origin;
			return {
				planetId,
				name: displayName(p.name),
				planetClass: String(p.planet_class),
				size: num(p.planet_size),
				system: displayName(raw.systems[String(sys)]?.name),
				jumps: jumps.get(Number(sys)) ?? null,
				modifier: typeof p.planet_modifier === 'string' ? p.planet_modifier : null,
				// `terraforming_candidate` (Mars) or `toxic_terraforming_candidate` (toxic worlds: only
				// with the right perk, origin or civic), as a permanent timed modifier
				candidate:
					items(p.timed_modifier?.items)
						.map((m) => String(m?.modifier))
						.find((m) => m.endsWith('terraforming_candidate')) ?? null,
				planet: planetState(raw, p)
			};
		})
		.sort((a, b) => (a.jumps ?? 1e9) - (b.jumps ?? 1e9) || b.size - a.size);
}

/** Hyperlane jumps from `start` to every reachable system (breadth-first). */
export function hops(systems: Record<string, Raw>, start: Raw): Map<number, number> {
	const out = new Map<number, number>();
	if (start === undefined) return out;
	let frontier = [Number(start)];
	out.set(Number(start), 0);
	for (let d = 1; frontier.length; d++) {
		const next: number[] = [];
		for (const s of frontier)
			for (const lane of items(systems[String(s)]?.hyperlane)) {
				const to = Number(lane?.to);
				if (!out.has(to)) {
					out.set(to, d);
					next.push(to);
				}
			}
		frontier = next;
	}
	return out;
}

/** The budget's per-source flows for pops and planets: jobs (`planet_<job>`), strata (`pop_category_*`), … */
export function planetBudget(month: Raw): BudgetSource[] {
	const sources = new Set(
		[...Object.keys(month?.income ?? {}), ...Object.keys(month?.expenses ?? {})].filter((k) =>
			/^(planet_|pop_)/.test(k)
		)
	);
	return [...sources].map((source) => ({
		source,
		income: resources(month.income?.[source]),
		expenses: resources(month.expenses?.[source])
	}));
}

/** The country's envoys; one is in use while it has a `location = { assignment=… }`. */
export function envoys(leaders: Raw[]) {
	const own = leaders.filter((l) => l?.class === 'envoy');
	return {
		used: own.filter((l) => l.location?.assignment !== undefined).length,
		total: own.length
	};
}

const RESEARCH_AREAS = ['physics', 'society', 'engineering'];

/**
 * country.tech_status.<area>_queue holds the tech being researched first; the council agenda
 * sits in country.government. `traditions` is a guess (none adopted in the saves seen so far).
 */
export function progress(raw: Pick<RawSave, 'country' | 'galaxy'>): Progress {
	const c = raw.country ?? {};
	const agenda = c.government?.council_agenda;
	return {
		research: RESEARCH_AREAS.flatMap((area) => {
			const current = first(c.tech_status?.[`${area}_queue`]);
			return current?.technology
				? [{ area, tech: String(current.technology), progress: num(current.progress) }]
				: [];
		}),
		researched: items(c.tech_status?.technology).filter((t) => typeof t === 'string'),
		agenda:
			typeof agenda === 'string' && agenda !== ''
				? { key: agenda, progress: num(c.government?.council_agenda_progress) }
				: null,
		traditionsTaken: Array.isArray(c.traditions) ? c.traditions.length : 0,
		nextElection: typeof c.next_election === 'string' ? c.next_election : null,
		costSettings: {
			technology: numOrNull(raw.galaxy?.technology) ?? 1,
			traditions: numOrNull(raw.galaxy?.traditions) ?? 1
		}
	};
}

function playerColonies(raw: RawSave): Colony[] {
	const planetOfColony = new Map<number, [number, Raw]>();
	for (const [id, planet] of Object.entries(raw.planets)) {
		if (planet && typeof planet === 'object' && planet.colony !== undefined) {
			planetOfColony.set(Number(planet.colony), [Number(id), planet]);
		}
	}
	return list(raw.country?.controlled_colonies).map((colonyId) => {
		const c = raw.colonies[String(colonyId)] ?? {};
		const [planetId, planet] = planetOfColony.get(colonyId) ?? [-1, undefined];
		return {
			planetId,
			name: planet ? displayName(planet.name) : `colony ${colonyId}`,
			designation: String(c.final_designation ?? ''),
			// still being settled: `colonizing_species`; done at COLONY_POPS_REQUIRED (100) pops
			colonizing: c.colonizing_species !== undefined,
			growth: colonyGrowth(c.last_month_growth_data),
			pops: num(c.num_sapient_pops),
			employed: num(c.employable_pops) - num(c.civilian),
			civilians: num(c.civilian),
			stability: num(c.stability),
			freeHousing: num(c.free_housing),
			freeAmenities: num(c.free_amenities),
			...colonyDistricts(raw, list(c.districts)),
			planetClass: String(planet?.planet_class ?? ''),
			planetSize: num(planet?.planet_size),
			deposits: list(planet?.deposits)
				.map((d) => raw.deposits[String(d)]?.type)
				.filter((d) => typeof d === 'string'),
			planet: planet ? planetState(raw, planet) : null,
			buildQueue:
				planet?.build_queue !== undefined ? buildQueue(raw, Number(planet.build_queue)) : [],
			buildSlots:
				num(raw.construction?.queue_mgr?.queues?.[String(planet?.build_queue)]?.simultaneous) || 1,
			...colonyJobs(raw.popJobs, list(c.pop_jobs)),
			...strata(raw.popGroups, list(c.pop_groups)),
			automation: {
				enabled: c.automation?.enabled === true || c.automation?.enabled === 'yes',
				settings: items(c.automation?.settings).map(String)
			},
			produces: resources(c.produces),
			upkeep: resources(c.upkeep)
		};
	});
}

/**
 * Last month's migration of every own colony, and of the colonies of empires the country has a
 * migration treaty with (only they exchange pops with it; other empires migrate among their own
 * colonies). The save holds per-colony totals (`colonyGrowth`), no source→destination pairs (see
 * #lib/migration.ts).
 */
export function migration(
	raw: Pick<
		RawSave,
		'country' | 'countryId' | 'colonies' | 'planets' | 'systems' | 'countryNames' | 'empireName'
	>
): MigrationColony[] {
	const partners = migrationPartners(raw.country);
	const out: MigrationColony[] = [];
	for (const [planetId, p] of Object.entries(raw.planets)) {
		if (!p || typeof p !== 'object' || p.colony === undefined || p.owner === undefined) continue;
		const g = colonyGrowth(raw.colonies[String(p.colony)]?.last_month_growth_data);
		const immigration = g?.by.immigration ?? 0;
		const emigration = 0 - (g?.by.emigration ?? 0); // stored negative; 0 - x avoids -0
		const own = Number(p.owner) === raw.countryId;
		if (!own && (!partners.has(Number(p.owner)) || (immigration === 0 && emigration === 0)))
			continue;
		const sys = raw.systems[String(p.coordinate?.origin)];
		out.push({
			colonyId: Number(p.colony),
			planetId: Number(planetId),
			name: displayName(p.name),
			ownerId: Number(p.owner),
			owner: own ? raw.empireName : (raw.countryNames[String(p.owner)] ?? `empire ${p.owner}`),
			own,
			system: displayName(sys?.name),
			x: num(sys?.coordinate?.x),
			y: num(sys?.coordinate?.y),
			immigration,
			emigration
		});
	}
	return out;
}

/**
 * Systems the country knows — visited by its ships (`country.visited_objects`) or its own — at
 * their map positions (`galactic_object.<id>.coordinate`), with the hyperlanes between them (each
 * listed once, on the lower id), and the capital's system marked.
 */
export function knownSystems(
	raw: Pick<RawSave, 'country' | 'systems' | 'planets'>,
	own: Set<number>
): KnownSystem[] {
	const capital = Number(raw.planets[String(raw.country?.capital)]?.coordinate?.origin);
	const known = new Set([...list(raw.country?.visited_objects), ...own]);
	return [...known].flatMap((id) => {
		const s = raw.systems[String(id)];
		if (!s || typeof s !== 'object') return [];
		return [
			{
				id,
				name: displayName(s.name),
				x: num(s.coordinate?.x),
				y: num(s.coordinate?.y),
				owned: own.has(id),
				capital: id === capital,
				lanes: items(s.hyperlane)
					.map((l) => Number(l?.to))
					.filter((to) => known.has(to) && to > id)
			}
		];
	});
}

/**
 * Empires with a migration treaty: relations (`country.relations_manager.relation`) that mention a
 * migration agreement in any form. UNVERIFIED — no treaty seen in a save yet (2207.03: none, not
 * even between AI empires); check the shape at the first one and tighten this.
 */
export function migrationPartners(country: Raw): Set<number> {
	return new Set(
		items(country?.relations_manager?.relation)
			.filter((r) => /migration/i.test(JSON.stringify(r ?? {})))
			.map((r) => Number(r.country))
	);
}

/**
 * Wars the country takes part in: `war.<id> = { name start_date attackers = { { country } }
 * defenders = { … } }`. UNVERIFIED — assumed from earlier versions; no war seen in a save yet.
 */
export function wars(raw: Pick<RawSave, 'wars' | 'countryId' | 'countryNames'>): War[] {
	const side = (v: Raw) => items(v).map((p) => Number(p?.country));
	return Object.entries(raw.wars).flatMap(([id, w]) => {
		if (!w || typeof w !== 'object') return [];
		const [attackers, defenders] = [side(w.attackers), side(w.defenders)];
		const enemies = attackers.includes(raw.countryId)
			? defenders
			: defenders.includes(raw.countryId)
				? attackers
				: null;
		if (!enemies) return [];
		return [
			{
				id,
				name: displayName(w.name) || `war ${id}`,
				start: typeof w.start_date === 'string' ? w.start_date : null,
				enemies: enemies.map((c) => raw.countryNames[String(c)] ?? `empire ${c}`)
			}
		];
	});
}

/**
 * Trade deals with the country on one side. UNVERIFIED — `trade_deal` was empty in every save seen
 * (ours to 2207, a 4.0.1 one at 2312). Known from stellaris-dashboard's parser: `trade_deal.<id> =
 * { first = { country … } second = { country sensor_link=yes … } date length }` (length in years).
 * Guessed: each side lists what it gives (loc `TRADE_DEAL_DESC`: "$FIRST$ will trade:
 * $FIRST_OFFER$"), resources under a key with "month" in it are monthly. A deal whose sides are not
 * found keeps everything in `gives.other`, and is logged.
 */
export function tradeDeals(
	raw: Pick<RawSave, 'tradeDeals' | 'countryId' | 'countryNames'>
): TradeDeal[] {
	return Object.entries(raw.tradeDeals).flatMap(([id, d]) => {
		const sides = countryIds(d);
		if (!sides.includes(raw.countryId)) return [];
		const others = sides.filter((c) => c !== raw.countryId);
		const own = [d?.first, d?.second].find((x) => Number(x?.country) === raw.countryId);
		const theirs = [d?.first, d?.second].find((x) => x && x !== own && x.country !== undefined);
		const understood = own !== undefined && theirs !== undefined;
		if (!understood) console.warn(`trade deal ${id} not understood, check its shape:`, d);
		return [
			{
				id,
				partner: others.map((c) => raw.countryNames[String(c)] ?? `empire ${c}`).join(', '),
				start: typeof d?.date === 'string' ? d.date : null,
				years: typeof d?.length === 'number' && d.length > 0 ? d.length : null,
				gives: dealSide(understood ? own : d),
				gets: dealSide(understood ? theirs : undefined),
				understood,
				raw: JSON.stringify(d).slice(0, 2000)
			}
		];
	});
}

const RESOURCE_KEYS = new Set(MARKET_RESOURCES);

/** One side's offer, read generically: resource amounts by key, `{ resource amount }` pairs too. */
export function dealSide(v: Raw): DealSide {
	const side: DealSide = { monthly: {}, once: {}, other: [] };
	const add = (path: string[], resource: string, amount: number) => {
		const into = path.some((p) => p.includes('month')) ? side.monthly : side.once;
		into[resource] = (into[resource] ?? 0) + amount;
	};
	const walk = (x: Raw, path: string[]) => {
		if (x && typeof x === 'object') {
			if (typeof x.resource === 'string' && typeof x.amount === 'number')
				return add(path, x.resource, x.amount);
			for (const [k, y] of Object.entries(x)) {
				if (k === 'country') continue;
				walk(y, Array.isArray(x) ? path : [...path, k]);
			}
			return;
		}
		const key = path.at(-1) ?? '';
		if (typeof x === 'number' && RESOURCE_KEYS.has(key)) add(path.slice(0, -1), key, x);
		else if (x !== 'no' && x !== undefined)
			side.other.push(x === 'yes' ? path.join(' ') : `${path.join(' ')} ${x}`);
	};
	walk(v, []);
	return side;
}

/**
 * `colony.last_month_growth_data = { growth_and_size = { growth } current_month_growth_details =
 * { key = { GROWTH_CAT_… } value = { … } } species = { … categories = { key value } } }`.
 * Detail values are amounts; emigration counts against the colony (Earth 2204.07: growth 3,
 * emigration 18 → −15), so it is stored negative.
 */
export function colonyGrowth(g: Raw) {
	if (!g || typeof g !== 'object' || g.growth_and_size === undefined) return null;
	const pairs = (o: Raw): [string, number][] => {
		const keys = items(o?.key);
		const values = items(o?.value);
		return keys
			.map((k, i) => [String(k), values[i]] as [string, Raw])
			.filter(([, v]) => v !== undefined) as [string, number][];
	};
	const by = Object.fromEntries(
		pairs(g.current_month_growth_details).map(([k, v]) => {
			const cause = k.replace(/^GROWTH_CAT_/, '').toLowerCase();
			return [cause, cause === 'emigration' ? -num(v) : num(v)];
		})
	);
	const byStratum: Record<string, number> = {};
	for (const sp of items(g.species))
		for (const [cat, v] of pairs(sp?.value?.categories))
			byStratum[cat] = (byStratum[cat] ?? 0) + num((v as Raw)?.growth);
	return { net: num(g.growth_and_size.growth), by, byStratum };
}

/**
 * `colony.districts` → `districts.<id> = { type level zones }`: `level` is how many of the type
 * are built (Earth 2201: city 3, generator 3, mining 2, farming 4 — as the planet view shows);
 * `zones.<id> = { type buildings }` (4294967295 = no zone), `buildings.<id> = { type position }`.
 * District caps and free slots are computed by the game and not in the save.
 */
export function colonyDistricts(
	raw: Pick<RawSave, 'districtsDb' | 'zones' | 'buildings'>,
	ids: number[]
): { districts: number; districtList: ColonyDistrict[] } {
	const districtList = ids.flatMap((id) => {
		const d = raw.districtsDb[String(id)];
		if (!d || typeof d !== 'object') return [];
		return [
			{
				type: String(d.type),
				built: num(d.level),
				zones: list(d.zones)
					.map((z) => raw.zones[String(z)])
					.filter((z) => z && typeof z === 'object')
					.map((z) => ({
						type: String(z.type),
						buildings: list(z.buildings)
							.map((b) => raw.buildings[String(b)]?.type)
							.filter((b) => typeof b === 'string')
					}))
			}
		];
	});
	return { districts: districtList.reduce((n, d) => n + d.built, 0), districtList };
}

/**
 * `pop_groups.<id> = { key = { species category } size happiness }`, summed per stratum. Groups
 * without `happiness` (the save omits it for some) count towards size but not the average.
 */
export function strata(popGroups: Record<string, Raw>, ids: number[]) {
	const by = new Map<string, { size: number; known: number; weighted: number }>();
	for (const id of ids) {
		const g = popGroups[String(id)];
		if (!g || typeof g !== 'object' || !(num(g.size) > 0)) continue;
		const cat = String(g.key?.category ?? 'unknown');
		const s = by.get(cat) ?? { size: 0, known: 0, weighted: 0 };
		const known = typeof g.happiness === 'number';
		by.set(cat, {
			size: s.size + num(g.size),
			known: s.known + (known ? num(g.size) : 0),
			weighted: s.weighted + (known ? num(g.size) * g.happiness : 0)
		});
	}
	const list: Stratum[] = [...by].map(([category, s]) => ({
		category,
		size: s.size,
		happiness: s.known > 0 ? s.weighted / s.known : null
	}));
	const known = [...by.values()].reduce((n, s) => n + s.known, 0);
	return {
		strata: list,
		happiness: known > 0 ? [...by.values()].reduce((n, s) => n + s.weighted, 0) / known : null
	};
}

/**
 * `pop_jobs.<id> = { type workforce max_workforce pop_groups = { { pop_group amount } } }`.
 * `max_workforce` -1 means unlimited (civilian); jobs nobody works and that have no positions are
 * the placeholders every colony carries (servant, purge, …) and are left out.
 */
export function colonyJobs(popJobs: Record<string, Raw>, ids: number[]) {
	const jobs: ColonyJob[] = ids.flatMap((id) => {
		const j = popJobs[String(id)];
		if (!j || typeof j !== 'object') return [];
		const pops = items(j.pop_groups).reduce((sum: number, g: Raw) => sum + num(g?.amount), 0);
		const max = num(j.max_workforce);
		if (pops === 0 && max <= 0) return [];
		return [
			{
				type: String(j.type),
				pops,
				filled: Math.max(num(j.workforce), 0),
				positions: max > 0 ? max : null
			}
		];
	});
	const openJobs = jobs.reduce(
		(sum, j) => sum + (j.positions === null ? 0 : Math.max(j.positions - j.filled, 0)),
		0
	);
	return { jobs, openJobs };
}

/**
 * Items of one construction queue, in its order (`queues.<id>.items`). Each item names what it
 * builds in a single `buildable_<kind> = { … }` block.
 */
export function buildQueue(
	raw: Pick<RawSave, 'construction' | 'deposits'> & Partial<Pick<RawSave, 'shipDesigns'>>,
	queueId: number
): QueueItem[] {
	const queue = raw.construction?.queue_mgr?.queues?.[String(queueId)];
	const items = raw.construction?.item_mgr?.items ?? {};
	return list(queue?.items).flatMap((id) => {
		const item = items[String(id)];
		const key = item && Object.keys(item).find((k) => k.startsWith('buildable_'));
		if (!key) return [];
		const kind = key.slice('buildable_'.length);
		const what = item[key] ?? {};
		// Ships (and colony ships) name no type, only a design: shown by its size and name.
		const design = raw.shipDesigns?.[String(what.ship_design_implementation?.design)];
		const name =
			kind === 'clear_deposit_blocker'
				? String(raw.deposits[String(what.deposit)]?.type ?? 'blocker')
				: design
					? String(first(design.growth_stages)?.ship_size ?? kind)
					: String(Object.values(what).find((v) => typeof v === 'string') ?? kind);
		return [
			{
				kind,
				name,
				...(design ? { design: displayName(design.name) } : {}),
				progress: num(item.progress),
				needed: num(item.progress_needed)
			}
		];
	});
}

/** Sums `{ <source>: { <resource>: n } }` into `{ <resource>: n }`. */
export function sumSources(bySource: Raw): Resources {
	const out: Resources = {};
	for (const res of Object.values(bySource ?? {})) {
		for (const [k, v] of Object.entries(resources(res))) out[k] = (out[k] ?? 0) + v;
	}
	return out;
}

export function addResources(a: Resources, b: Resources): Resources {
	const out = { ...a };
	for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
	return out;
}

/** Readable approximation of a localisation key: `SPEC_Dar-Hesh_planet` → `Dar-Hesh`. */
export function displayName(name: Raw): string {
	const key = String(name?.key ?? name ?? '');
	// `%SEQ%` with fmt (e.g. HUMAN1_FLEET) and num: "1st Fleet".
	if (key === '%SEQ%' && Array.isArray(name?.variables)) {
		const v = (k: string) => name.variables.find((x: Raw) => x.key === k)?.value?.key;
		const n = Number(v('num'));
		const kind =
			String(v('fmt') ?? '')
				.split('_')
				.pop() ?? '';
		return `${ordinal(n)} ${kind.charAt(0)}${kind.slice(1).toLowerCase()}`;
	}
	// New colonies: `NEW_COLONY_NAME_<n>` = "$NAME$ Prime" … "$NAME$ Decimus" (localisation, 4.5.2).
	const colony = /^NEW_COLONY_NAME_(\d+)$/.exec(key);
	if (colony && Array.isArray(name?.variables)) {
		const base = name.variables.map((v: Raw) => displayName(v.value)).join(' ');
		return `${base} ${COLONY_SUFFIX[Number(colony[1]) - 1] ?? colony[1]}`;
	}
	// Templates with variables — `%ADJECTIVE%`, `PLANET_NAME_FORMAT` (PARENT + NUMERAL: "Barnards
	// Star I"), `PREFIX_NAME_FORMAT` (ship: "UNS Jordan"), `STAR_NAME_1_OF_1` — read as their parts.
	if (Array.isArray(name?.variables)) {
		return name.variables
			.filter((v: Raw) => v?.key !== 'PREFIX') // the ship prefix ("UNS") is localisation only
			.map((v: Raw) => displayName(v.value))
			.filter(Boolean)
			.join(' ');
	}
	return key
		.replace(/^(SPEC|NAME|PRESCRIPTED)_/, '')
		.replace(/^[A-Z0-9]+_(SHIP|CHR)_/, '') // name lists: HUMAN1_SHIP_Byzantium, HUMAN1_CHR_Gabriela
		.replace(/_(planet|system|star)$/, '')
		.replaceAll('_', ' ');
}

function resources(obj: Raw): Resources {
	const out: Resources = {};
	for (const [k, v] of Object.entries(obj ?? {})) if (typeof v === 'number') out[k] = v;
	return out;
}

const COLONY_SUFFIX = [
	'Prime',
	'Secundus',
	'Tertius',
	'Quartus',
	'Quintus',
	'Sextus',
	'Septimus',
	'Octantus',
	'Novantus',
	'Decimus'
];
const ordinal = (n: number) =>
	`${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
const num = (v: Raw) => (typeof v === 'number' ? v : 0);
const numOrNull = (v: Raw) => (typeof v === 'number' ? v : null);
/** Every `country=<id>` anywhere below `v` (wars and trade deals name their sides this way). */
export function countryIds(v: Raw): number[] {
	if (!v || typeof v !== 'object') return [];
	return Object.entries(v).flatMap(([k, x]) =>
		k === 'country' && typeof x !== 'object' ? [Number(x)] : countryIds(x)
	);
}

const items = (v: Raw): Raw[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const list = (v: Raw): number[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]).map(Number);
const first = (v: Raw) => (Array.isArray(v) ? v[0] : v);
