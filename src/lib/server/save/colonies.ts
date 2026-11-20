import type {
	Colony,
	ColonyDistrict,
	ColonyJob,
	Construction,
	KnownSystem,
	MigrationColony,
	QueueItem,
	Sector,
	Stratum
} from '#lib/types.ts';
import type { RawSave } from '../save.ts';
import { planetState, timedFlags } from './country.ts';
import { capitalSystem, shipSystemId } from './fleets.ts';
import { leaderSkill } from './leaders.ts';
import { displayName, first, items, list, num, numOrNull, type Raw, resources } from './values.ts';

// Save → Snapshot: colonies — sectors, pops and migration, districts, jobs and construction
// (../save.ts; paths in docs/save-format.md).

/** The empire's sectors (`country.sectors.owned` → `sectors.<id>`), colonies counted per system. */
/** The country's sector names by system id (`sectors.<id>.systems`). */
export function sectorBySystem(raw: Pick<RawSave, 'country' | 'sectors'>): Map<number, string> {
	return new Map(
		list(raw.country?.sectors?.owned).flatMap((id) => {
			const s = raw.sectors[String(id)] ?? {};
			return list(s.systems).map((sys) => [sys, displayName(s.name)] as const);
		})
	);
}

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

/**
 * Each colony's place: its planet (`planets.planet.<id>.colony`), or for a nomad's arkship the ship
 * that carries it (`colony.<id>.carrier = { type=ship reference }`; the ship holds `colony`,
 * `planet_class="pc_ark"`, `planet_size`, `build_queue` and its name, 2026-10-30) under the id
 * −1 − ship id, so ship 0 stays the −1 stored before.
 */
export function colonyPlaces(
	raw: Pick<RawSave, 'planets' | 'colonies' | 'ships'>
): Map<number, [number, Raw]> {
	const places = new Map<number, [number, Raw]>();
	for (const [id, planet] of Object.entries(raw.planets)) {
		if (planet && typeof planet === 'object' && planet.colony !== undefined) {
			places.set(Number(planet.colony), [Number(id), planet]);
		}
	}
	for (const [id, c] of Object.entries(raw.colonies)) {
		const ship = c?.carrier?.type === 'ship' ? raw.ships?.[String(c.carrier.reference)] : undefined;
		if (ship && typeof ship === 'object' && !places.has(Number(id))) {
			places.set(Number(id), [-1 - Number(c.carrier.reference), ship]);
		}
	}
	return places;
}

export function playerColonies(raw: RawSave): Colony[] {
	const planetOfColony = colonyPlaces(raw);
	const sectorOf = sectorBySystem(raw);
	return list(raw.country?.controlled_colonies).map((colonyId) => {
		const c = raw.colonies[String(colonyId)] ?? {};
		const [planetId, planet] = planetOfColony.get(colonyId) ?? [-1, undefined];
		return {
			planetId,
			name: planet ? displayName(planet.name) : `colony ${colonyId}`,
			designation: String(c.final_designation ?? ''),
			sector: sectorOf.get(Number(planet?.coordinate?.origin)) ?? null,
			// still being settled: `colonizing_species`; done at COLONY_POPS_REQUIRED (100) pops
			colonizing: c.colonizing_species !== undefined,
			growth: colonyGrowth(c.last_month_growth_data),
			pops: num(c.num_sapient_pops),
			employed: num(c.employable_pops) - num(c.civilian),
			civilians: num(c.civilian),
			stability: num(c.stability),
			freeHousing: num(c.free_housing),
			housing: numOrNull(c.total_housing),
			housingUsed: numOrNull(c.housing_usage),
			freeAmenities: num(c.free_amenities),
			// what the colony has and needs (the game's amenities tooltip), and its crime
			amenities: numOrNull(c.amenities),
			amenitiesUsage: numOrNull(c.amenities_usage),
			crime: numOrNull(c.crime),
			// companion mod 0.8.0: the flat stability and its multiplier the game caps at 100 —
			// stored on the colony's carrier (the arkship's ship block, 2205.10.01; a planet's
			// assumed), the colony's own variables read too
			stabilityAdd: numOrNull((c.variables ?? planet?.variables)?.sdash_stab_add),
			stabilityMult: numOrNull((c.variables ?? planet?.variables)?.sdash_stab_mult),
			ascensionTier: num(c.ascension_tier),
			governorSkill: leaderSkill(raw.leaders[String(c.governor)]),
			...colonyDistricts(raw, list(c.districts)),
			planetClass: String(planet?.planet_class ?? ''),
			planetSize: num(planet?.planet_size),
			deposits: list(planet?.deposits)
				.map((d) => raw.deposits[String(d)]?.type)
				.filter((d) => typeof d === 'string'),
			planet: planet ? planetState(raw, planet) : null,
			timedFlags: timedFlags(planet?.flags, raw.date),
			flags: Object.keys(planet?.flags ?? {}),
			buildQueue:
				planet?.build_queue !== undefined ? buildQueue(raw, Number(planet.build_queue)) : [],
			buildSlots:
				num(raw.construction?.queue_mgr?.queues?.[String(planet?.build_queue)]?.simultaneous) || 1,
			...colonyJobs(raw.popJobs, list(c.pop_jobs), raw.popGroups),
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
	> &
		Partial<Pick<RawSave, 'ships' | 'fleets'>>
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
			owner: own ? raw.empireName : (raw.countryNames[String(p.owner)] ?? 'unknown empire'),
			own,
			system: displayName(sys?.name),
			x: num(sys?.coordinate?.x),
			y: num(sys?.coordinate?.y),
			immigration,
			emigration
		});
	}
	// our arkships' colonies (READER 41): their carrier is a ship, placed where it is (a colony
	// names no owner, so other empires' arkships are left out)
	for (const colonyId of list(raw.country?.controlled_colonies)) {
		const carrier = raw.colonies[String(colonyId)]?.carrier;
		if (carrier?.type !== 'ship') continue;
		const g = colonyGrowth(raw.colonies[String(colonyId)]?.last_month_growth_data);
		const sys = raw.systems[String(shipSystemId(raw, carrier.reference))];
		out.push({
			colonyId: Number(colonyId),
			planetId: -1 - Number(carrier.reference),
			name: displayName(raw.ships?.[String(carrier.reference)]?.name),
			ownerId: raw.countryId,
			owner: raw.empireName,
			own: true,
			system: displayName(sys?.name),
			x: num(sys?.coordinate?.x),
			y: num(sys?.coordinate?.y),
			immigration: g?.by.immigration ?? 0,
			emigration: 0 - (g?.by.emigration ?? 0)
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
	raw: Pick<RawSave, 'country' | 'systems' | 'planets'> &
		Partial<Pick<RawSave, 'colonies' | 'ships' | 'fleets'>>,
	own: Set<number>
): KnownSystem[] {
	const capital = capitalSystem(raw);
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
 * Empires with a migration treaty: relations (`country.relations_manager.relation`) with
 * `migration_access=yes` (4.5.2, seen 2026-10-19).
 */
export function migrationPartners(country: Raw): Set<number> {
	return new Set(
		items(country?.relations_manager?.relation)
			.filter((r) => r?.migration_access === true || r?.migration_access === 'yes')
			.map((r) => Number(r.country))
	);
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
					.map((z) => {
						const built = list(z.buildings)
							.map((b) => raw.buildings[String(b)])
							.filter((b) => typeof b?.type === 'string');
						// switched off by the player: `buildings.<id>.disabled=yes` (#lib/buildings.ts)
						const off = built
							.filter((b) => b.disabled === true || b.disabled === 'yes')
							.map((b) => b.type as string);
						return {
							type: String(z.type),
							buildings: built.map((b) => b.type as string),
							...(off.length ? { disabled: off } : {})
						};
					})
			}
		];
	});
	return { districts: districtList.reduce((n, d) => n + d.built, 0), districtList };
}

/**
 * `pop_groups.<id> = { key = { species category } size happiness }`, summed per stratum. The save
 * leaves `happiness` out at 100 %: every group of ours at 2201.01.01, where the game showed Earth
 * at 100 % happiness and approval; the AIs' stored values never reach 1.
 */
export function strata(popGroups: Record<string, Raw>, ids: number[]) {
	const by = new Map<string, { size: number; known: number; weighted: number }>();
	// habitability (0–1) of the species on this planet, per pop group: overall and per species
	const hab = { size: 0, weighted: 0 };
	const power = { total: 0, weighted: 0 };
	const bySpecies = new Map<string, { size: number; weighted: number }>();
	const speciesPops: Record<string, number> = {};
	for (const id of ids) {
		const g = popGroups[String(id)];
		if (!g || typeof g !== 'object' || !(num(g.size) > 0)) continue;
		if (g.key?.species !== undefined) {
			const sp = String(g.key.species);
			speciesPops[sp] = (speciesPops[sp] ?? 0) + num(g.size);
		}
		if (typeof g.habitability === 'number') {
			hab.size += num(g.size);
			hab.weighted += num(g.size) * g.habitability;
			const sp = String(g.key?.species);
			const s = bySpecies.get(sp) ?? { size: 0, weighted: 0 };
			bySpecies.set(sp, {
				size: s.size + num(g.size),
				weighted: s.weighted + num(g.size) * g.habitability
			});
		}
		const cat = String(g.key?.category ?? 'unknown');
		const s = by.get(cat) ?? { size: 0, known: 0, weighted: 0 };
		const happiness = typeof g.happiness === 'number' ? g.happiness : 1;
		// the Pop Approval Rating weighs happiness by political power (`pop_groups.<id>.power`)
		power.total += num(g.power);
		power.weighted += num(g.power) * happiness;
		by.set(cat, {
			size: s.size + num(g.size),
			known: s.known + num(g.size),
			weighted: s.weighted + num(g.size) * happiness
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
		approval: power.total > 0 ? power.weighted / power.total : null,
		happiness: known > 0 ? [...by.values()].reduce((n, s) => n + s.weighted, 0) / known : null,
		habitability: hab.size > 0 ? hab.weighted / hab.size : null,
		speciesHabitability: Object.fromEntries(
			[...bySpecies].map(([sp, s]) => [sp, s.weighted / s.size])
		),
		speciesPops
	};
}

/**
 * `pop_jobs.<id> = { type workforce max_workforce automated_workforce pop_groups = { { pop_group amount } } }`.
 * `max_workforce` -1 means unlimited (civilian); jobs nobody works and that have no positions are
 * the placeholders every colony carries (servant, purge, …) and are left out.
 */
export function colonyJobs(
	popJobs: Record<string, Raw>,
	ids: number[],
	popGroups: Record<string, Raw> = {}
) {
	const jobs: ColonyJob[] = ids.flatMap((id) => {
		const j = popJobs[String(id)];
		if (!j || typeof j !== 'object') return [];
		const pops = items(j.pop_groups).reduce((sum: number, g: Raw) => sum + num(g?.amount), 0);
		const max = num(j.max_workforce);
		if (pops === 0 && max <= 0) return [];
		const filled = Math.max(num(j.workforce), 0);
		// job efficiency's extra workforce (READER 46): Servants 2196 + 330.55 (Planetforgers 2214.02)
		const bonus = filled > 0 ? num(j.bonus_workforce) : 0;
		// the part of `workforce` no pop works (READER 54): automation buildings, Tankbound, …
		const automated = Math.max(num(j.automated_workforce), 0);
		// who works it, by species id (READER 46): species traits act on their own pops' jobs
		const species: Record<string, number> = {};
		for (const g of items(j.pop_groups)) {
			const sp = popGroups[String(g?.pop_group)]?.key?.species;
			if (sp !== undefined) species[String(sp)] = (species[String(sp)] ?? 0) + num(g?.amount);
		}
		return [
			{
				type: String(j.type),
				pops,
				filled,
				positions: max > 0 ? max : null,
				...(bonus > 0 && { bonus }),
				...(automated > 0 && { automated }),
				...(Object.keys(species).length && { species })
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
		const it = item && itemOf(raw, item);
		return it
			? [
					{
						kind: it.kind,
						name: it.name,
						...(it.design ? { design: it.design } : {}),
						progress: num(item.progress),
						needed: num(item.progress_needed)
					}
				]
			: [];
	});
}

/** What a construction item builds: its `buildable_<kind> = { … }` block, named. */
function itemOf(
	raw: Pick<RawSave, 'deposits'> & Partial<Pick<RawSave, 'shipDesigns'>>,
	item: Raw
): { kind: string; name: string; design?: string; what: Raw } | null {
	const key = Object.keys(item).find((k) => k.startsWith('buildable_'));
	if (!key) return null;
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
	return { kind, name, ...(design ? { design: displayName(design.name) } : {}), what };
}

/**
 * Every construction item the country pays for (`paying_country`; the queues' owners differ —
 * a sector's queue, a starbase's), with its cost — paid when queued, refunded when cancelled —
 * and where: the planet, else the starbase's system. A `buildable_*.planet` is a **colony** id
 * (2207.04.02: `planet=0` is Earth's colony 0, Earth being planet 3); `orbitable` names planets
 * and starbases.
 */
export function construction(
	raw: Pick<RawSave, 'countryId' | 'construction' | 'deposits' | 'planets' | 'systems'> &
		Partial<Pick<RawSave, 'shipDesigns'>>
): Construction[] {
	const systemOf = (starbase: Raw) =>
		Object.entries(raw.systems).find(([, s]) => list(s?.starbases).includes(Number(starbase)));
	const ofColony = (colony: Raw) =>
		Object.values(raw.planets).find((p) => p?.colony !== undefined && p.colony === Number(colony));
	return Object.entries<Raw>(raw.construction?.item_mgr?.items ?? {}).flatMap(([id, item]) => {
		if (item?.paying_country !== raw.countryId) return [];
		const it = itemOf(raw, item);
		if (!it) return [];
		const planet =
			it.what.planet !== undefined
				? ofColony(it.what.planet)
				: raw.planets[String(it.what.orbitable?.planet)];
		const starbase = it.what.starbase ?? it.what.orbitable?.starbase;
		const where =
			planet !== undefined
				? displayName(planet.name) || null
				: starbase !== undefined
					? displayName(systemOf(starbase)?.[1]?.name) || null
					: null;
		const starbaseSystem = starbase !== undefined ? systemOf(starbase)?.[0] : undefined;
		const systemId =
			planet !== undefined
				? numOrNull(planet.coordinate?.origin)
				: starbaseSystem !== undefined
					? Number(starbaseSystem)
					: null;
		return [
			{
				id: Number(id),
				kind: it.kind,
				name: it.name,
				...(it.design ? { design: it.design } : {}),
				where,
				systemId,
				cost: resources(item.resources)
			}
		];
	});
}
