import { bypassLinks, distances, graph, type Graph } from '#lib/galaxyGraph.ts';
import { Jomini } from 'jomini';
import type {
	BudgetSource,
	Construction,
	KnownSystem,
	MigrationColony,
	OrbitalStation,
	AiIntel,
	TraderEnclave,
	QueuedTech,
	Route,
	CivilianShip,
	CouncilSeat,
	CountryInfo,
	ShipOrder,
	ColonyDistrict,
	MegaShipyard,
	Station,
	Colony,
	ExpansionPlanet,
	HabitatSite,
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
	WarSides,
	Subject,
	Faction,
	Combat,
	Shroud,
	GalacticCommunity,
	ResolutionVote,
	Snapshot
} from '#lib/types.ts';
import { MARKET_RESOURCES } from '#lib/market.ts';
import { addGameDays, START_YEAR } from '#lib/series.ts';
import { readZipEntry } from './zip.ts';
import {
	anomalies,
	bypassList,
	claims,
	digSites,
	diplomacy,
	stationsSeen,
	firstContacts,
	galaxy as galaxySystems,
	knownCountries,
	ourIntel,
	relations,
	situations,
	specialProjects
} from './world.ts';

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
	bypasses: Record<string, Raw>; // wormholes, gateways, L-Gates, … (#lib/galaxyGraph.ts)
	naturalWormholes: Record<string, Raw>;
	globalFlags: Record<string, Raw>; // top-level `flags`
	countryNames: Record<string, string>; // owners of colonised planets
	empireName: string;
	meta: { version: string | null; dlcs: string[]; mods: string[] }; // the save's `meta` file
	councilPositions: Record<string, Raw>; // council_positions.council_positions: every empire's seats
	countries: Record<string, Omit<CountryInfo, 'id'>>; // every country, in brief
	countryBlocks: Record<string, Raw>; // top-level country: every country's block
	federations: Record<string, Raw>; // top-level federation
	fleetOwner: Record<string, number>; // fleet → country, from each `fleets_manager.owned_fleets`
	firstContacts: Record<string, Raw>; // first_contacts.contacts
	situations: Record<string, Raw>; // situations.situations
	archSites: Record<string, Raw>; // archaeological_sites.sites
	focusCards: Record<string, Raw>; // top-level focus_cards
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
	wars: Record<string, Raw>; // top-level war (`0=none` once over)
	tradeDeals: Record<string, Raw>; // top-level trade_deal
	agreements: Record<string, Raw>; // agreements.agreements: every subject agreement
	loyalty: Record<string, number>; // country → its `loyalty` as a subject
	rivalsOfUs: number[]; // countries whose relation to us has `is_rival=yes`
	galcom: Raw; // top-level galactic_community
	resolutions: Record<string, Raw>; // top-level resolution: proposed and voted on
	popFactions: Record<string, Raw>; // top-level pop_factions: every empire's factions
	patronRelations: Record<string, Raw>; // top-level patron_relations: every empire's patrons
	aiIntel: AiIntel[]; // empires we have communications with: their view of us and their economy
	traderEnclaves: TraderEnclave[]; // trader enclaves we have communications with
};

let parser: Promise<Jomini> | undefined;

export async function readSave(zip: Uint8Array): Promise<RawSave> {
	const jomini = await (parser ??= Jomini.initialize());
	const opts = { typeNarrowing: 'unquoted' as const };
	const meta = jomini.parseText(readZipEntry(zip, 'meta'), opts);
	return jomini.parseText(readZipEntry(zip, 'gamestate'), opts, (q) => {
		const countryId = Number(first(q.at('/player'))?.country ?? 0);
		const allCountries: Record<string, Raw> = q.at('/country') ?? {};
		const fleetOwner: Record<string, number> = {};
		const loyalty: Record<string, number> = {};
		const rivalsOfUs: number[] = [];
		const countries: RawSave['countries'] = {};
		const aiIntel: AiIntel[] = [];
		const traderEnclaves: TraderEnclave[] = [];
		const nomads = nomadCountries(q.at('/situations/situations') ?? {});
		for (const [id, c] of Object.entries(allCountries)) {
			if (!c || typeof c !== 'object') continue;
			if (typeof c.loyalty === 'number') loyalty[id] = c.loyalty;
			const toUs = items(c.relations_manager?.relation).find((r) => r?.country === countryId);
			// empires that trade: regular and fallen ones, not pre-FTL civilisations, monsters or the
			// game's event countries (all of which can have communications with us)
			if (
				Number(id) !== countryId &&
				TRADING_TYPES.includes(String(c.type)) &&
				(toUs?.communications === true || toUs?.communications === 'yes')
			)
				aiIntel.push(intelOf(Number(id), c, toUs, countryId, nomads.has(Number(id))));
			const enclave = traderEnclaveKind(c);
			if (enclave !== null && (toUs?.communications === true || toUs?.communications === 'yes'))
				traderEnclaves.push({ countryId: Number(id), name: displayName(c.name), kind: enclave });
			if (toUs?.is_rival === true || toUs?.is_rival === 'yes') rivalsOfUs.push(Number(id));
			for (const o of items(c.fleets_manager?.owned_fleets))
				if (typeof o?.fleet === 'number') fleetOwner[String(o.fleet)] = Number(id);
			countries[id] = {
				name: displayName(c.name),
				type: String(c.type ?? ''),
				shipset: strOrNull(c.graphical_culture),
				flagColor:
					items(c.flag?.colors)
						.map(String)
						.find((x) => x !== 'null') ?? null,
				ethics: items(c.ethos?.ethics).map(String),
				authority: strOrNull(c.government?.authority),
				civics: items(c.government?.civics).map(String),
				governmentType: strOrNull(c.government?.type),
				origin: strOrNull(c.government?.origin)
			};
		}
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
			country: allCountries[String(countryId)],
			countryBlocks: allCountries,
			federations: q.at('/federation') ?? {},
			colonies,
			planets,
			countryNames,
			construction: q.at('/construction'),
			deposits: q.at('/deposit') ?? {},
			empireName: String(meta.name ?? ''),
			meta: {
				version: strOrNull(meta.version),
				dlcs: items(meta.required_dlcs).map(String),
				mods: items(meta.mods).map(String)
			},
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
			agreements: q.at('/agreements/agreements') ?? {},
			loyalty,
			rivalsOfUs,
			galcom: q.at('/galactic_community'),
			resolutions: q.at('/resolution') ?? {},
			popFactions: q.at('/pop_factions') ?? {},
			patronRelations: q.at('/patron_relations') ?? {},
			aiIntel,
			traderEnclaves,
			starbases: q.at('/starbase_mgr/starbases') ?? {},
			districtsDb: q.at('/districts') ?? {},
			zones: q.at('/zones') ?? {},
			buildings: q.at('/buildings') ?? {},
			megastructures: q.at('/megastructures') ?? {},
			bypasses: q.at('/bypasses') ?? {},
			naturalWormholes: q.at('/natural_wormholes') ?? {},
			globalFlags: q.at('/flags') ?? {},
			galaxy: { technology: q.at('/galaxy/technology'), traditions: q.at('/galaxy/traditions') },
			councilPositions: q.at('/council_positions/council_positions') ?? {},
			countries,
			fleetOwner,
			firstContacts: q.at('/first_contacts/contacts') ?? {},
			situations: q.at('/situations/situations') ?? {},
			archSites: q.at('/archaeological_sites/sites') ?? {},
			focusCards: q.at('/focus_cards') ?? {}
		};
	});
}

// The reader's version. Bump it whenever toSnapshot's output changes (with the new field's default
// in upgrade()): a save on disk is read again only when READER (or the data DB) changed since.
export const READER = '19'; // 19: species name templates ("Trans-Yorphid")

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
		storageMax: storageMax(raw.country?.variables),
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
		budget: budgetSources(budget),
		construction: construction(raw),
		orbitalStations: orbitalStations(raw, ownSystems(raw)),
		aiIntel: raw.aiIntel ?? [],
		traderEnclaves: raw.traderEnclaves ?? [],
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
		// toxic worlds can be terraformed with the Detox perk or the Toxic Knights' flag (4.5.2
		// common/terraform/02_special_terraform_links.txt; Climate Restoration needed as for Mars)
		canDetox:
			items(raw.country?.ascension_perks).includes('ap_detox') ||
			raw.country?.flags?.knights_detox !== undefined,
		civilianShips: civilianShips(raw, ownSystems(raw)),
		edicts: items(raw.country?.edicts)
			.map((e) => e?.edict)
			.filter((e) => typeof e === 'string'),
		countryModifiers: countryModifiers(raw),
		species: speciesInfo(raw),
		sectors: sectors(raw),
		expansion: expansion(raw, shipyardSystems(raw)),
		habitatSites: habitatSites(raw, shipyardSystems(raw)),
		// as if every planet were surveyed: kept with the galaxy, one row per campaign
		surveyedAll: {
			expansion: expansion(raw, shipyardSystems(raw), true),
			habitatSites: habitatSites(raw, shipyardSystems(raw), true)
		},
		habitats: {
			// 4.5.2 common/megastructures/habitats.txt (habitat_central_complex: potential)
			can:
				items(raw.country?.tech_status?.technology).includes('tech_habitat_1') ||
				items(raw.country?.government?.civics).some(
					(c) => c === 'civic_diadochi' || c === 'civic_great_khans_legacy'
				) ||
				raw.country?.flags?.democratic_khanate_flag !== undefined,
			// is_void_dweller_empire (scripted trigger): the perk or a void-dweller origin
			voidDweller:
				items(raw.country?.ascension_perks).includes('ap_voidborn') ||
				['origin_void_dwellers', 'origin_void_machines'].includes(
					String(raw.country?.government?.origin)
				)
		},
		stations: stations(raw),
		migration: migration(raw),
		knownSystems: knownSystems(raw, ownSystems(raw)),
		megaShipyards: megaShipyards(raw),
		marketOrders: marketOrders(raw.monthlyTrades, raw.countryId),
		market: market(raw),
		progress: progress(raw),
		leaderRoster: leaderRoster(raw),
		ruler: ruler(raw),
		agendaCooldowns: agendaCooldowns(raw.country?.government?.council_agenda_cooldowns),
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
		governmentType: strOrNull(raw.country?.government?.type),
		origin: strOrNull(raw.country?.government?.origin),
		wars: wars(raw),
		subjects: subjects(raw),
		galcom: galacticCommunity(raw),
		factions: factions(raw),
		combats: combats(raw),
		shroud: shroud(raw),
		warLostDate:
			typeof raw.country?.last_date_war_lost === 'string' ? raw.country.last_date_war_lost : null,
		tradeDeals: tradeDeals(raw),
		gameVersion: raw.meta.version,
		dlcs: raw.meta.dlcs,
		mods: raw.meta.mods,
		countryType: strOrNull(raw.country?.type),
		policyFlags: items(raw.country?.policy_flags).map(String),
		countryFlags: Object.keys(raw.country?.flags ?? {}),
		council: council(raw),
		councilSlots: numOrNull(raw.country?.government?.unlocked_civic_council_slots),
		edictTimes: edictTimes(raw.country?.edicts),
		...world(raw),
		focus: empireFocus(raw),
		techOptions: Object.fromEntries(
			Object.entries(raw.country?.tech_status?.alternatives ?? {}).map(([area, techs]) => [
				area,
				items(techs).map(String)
			])
		),
		techQueued: techQueued(raw.country),
		// per field (physics, society, engineering), in that order
		techStored: Object.fromEntries(
			items(raw.country?.tech_status?.stored_techpoints).map((v, i) => [RESEARCH_AREAS[i], num(v)])
		),
		// options that stay until researched (focus rewards' `add_research_option`), repeated keys
		techPermanent: items(raw.country?.tech_status?.always_available_tech).map(String),
		leaderList: leaderList(raw),
		speciesRights: speciesRights(raw.country),
		timelineId: numOrNull(raw.country?.variables?.sdash_tl),
		previousTimelineId: numOrNull(raw.country?.variables?.sdash_tl_prev),
		logEvents: null,
		ticks: null
	};
}

const RIGHT_KINDS = [
	'citizenship',
	'subspecies_integration',
	'living_standard',
	'military_service',
	'colonization_control',
	'population_control',
	'migration_control',
	'slavery',
	'purge'
];

/**
 * Each species' rights: `country.modules.standard_species_rights_module.primary = { species_index
 * citizenship living_standard … }`, one block per species (the module's `default` is for new ones).
 */
export function speciesRights(country: Raw): Record<string, Record<string, string>> {
	const m = country?.modules?.standard_species_rights_module;
	return Object.fromEntries(
		items(m?.primary)
			.filter((p) => typeof p?.species_index === 'number')
			.map((p) => [
				String(p.species_index),
				Object.fromEntries(
					RIGHT_KINDS.filter((k) => typeof p[k] === 'string').map((k) => [k, p[k]])
				)
			])
	);
}

/**
 * `country.focus = { active = { <card ids> } priority = { current } reward = { rewards = { {
 * category current progress } } } }`; a card is `focus_cards.<id> = { type status }`, status 1
 * read as done (2207.03.10: 1 on Hire a Commander, Adopt a Tradition; 0 on Declare a Rival).
 */
export function empireFocus(raw: Pick<RawSave, 'country' | 'focusCards'>) {
	const f = raw.country?.focus;
	if (!f || typeof f !== 'object') return null;
	return {
		priority: strOrNull(f.priority?.current),
		cards: list(f.active).flatMap((id) => {
			const c = raw.focusCards[String(id)];
			return typeof c?.type === 'string' ? [{ key: c.type, done: c.status === 1 }] : [];
		}),
		rewards: items(f.reward?.rewards)
			.filter((r) => typeof r?.category === 'string')
			.map((r) => ({
				category: r.category,
				current: String(r.current ?? ''),
				progress: num(r.progress)
			}))
	};
}

/** Every hired leader (`country.owned_leaders`), with its traits and whether it sits on the council. */
export function leaderList(
	raw: Pick<RawSave, 'country' | 'leaders' | 'speciesDb' | 'councilPositions'>
) {
	const seated = new Set(
		list(raw.country?.government?.council_positions).map((id) =>
			numOrNull(raw.councilPositions[String(id)]?.leader)
		)
	);
	const rulerId = numOrNull(raw.country?.ruler);
	return list(raw.country?.owned_leaders).flatMap((id) => {
		const l = raw.leaders[String(id)];
		if (!l || typeof l !== 'object') return [];
		const sp = raw.speciesDb[String(l.species)];
		return [
			{
				id,
				name: leaderName(l.name),
				class: String(l.class),
				level: num(l.level),
				age: numOrNull(l.age),
				traits: items(l.traits).map(String),
				job: strOrNull(l.job),
				species: sp ? displayName(sp.name) : null,
				council: seated.has(id),
				ruler: id === rulerId
			}
		];
	});
}

/** The galaxy and the others, as the empire knows them (server/world.ts). */
function world(raw: RawSave) {
	const own = ownSystems(raw);
	const gal = galaxySystems(raw, own);
	const rel = relations(raw);
	const contacts = firstContacts(raw);
	const visited = new Set(gal.filter((s) => s.visited).map((s) => s.id));
	return {
		galaxy: gal,
		relations: rel,
		intel: ourIntel(raw),
		diplomacy: diplomacy(raw),
		allWars: allWars(raw),
		claims: claims(raw, own),
		firstContacts: contacts,
		countries: knownCountries(raw, [
			...rel.map((r) => r.countryId),
			...contacts.map((c) => c.countryId),
			...gal.flatMap((s) => (s.ownerId === null ? [] : [s.ownerId]))
		]),
		situations: situations(raw),
		anomalies: anomalies(raw),
		specialProjects: specialProjects(raw),
		digSites: digSites(raw, visited),
		stationsSeen: stationsSeen(raw, own)
	};
}

/**
 * The council's seats, in the order `country.government.council_positions` lists them, from the
 * top-level `council_positions` (2207.03.10: defense, research, state; the ruler is apart).
 */
export function council(
	raw: Pick<RawSave, 'country' | 'councilPositions' | 'leaders'>
): CouncilSeat[] {
	return list(raw.country?.government?.council_positions).flatMap((id) => {
		const p = raw.councilPositions[String(id)];
		if (!p || typeof p !== 'object') return [];
		const leaderId = numOrNull(p.leader);
		const l = leaderId === null ? undefined : raw.leaders[String(leaderId)];
		return [
			{
				type: String(p.type),
				leaderId: l && typeof l === 'object' ? leaderId : null,
				leaderName: l && typeof l === 'object' ? leaderName(l.name) : null,
				leaderLevel: l && typeof l === 'object' ? numOrNull(l.level) : null,
				leaderBonus: l && typeof l === 'object' ? num(l.bonus_skill_level) : 0,
				leaderTraits: l && typeof l === 'object' ? items(l.traits).map(String) : []
			}
		];
	});
}

/** `country.edicts = { { edict date start_date perpetual } }`; a perpetual one's `date` is junk. */
export function edictTimes(edicts: Raw) {
	return items(edicts)
		.filter((e) => typeof e?.edict === 'string')
		.map((e) => ({
			key: String(e.edict),
			start: strOrNull(e.start_date),
			end: e.perpetual === true || e.perpetual === 'yes' ? null : strOrNull(e.date)
		}));
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
 * where `galactic_market_resources` is not 0 (confirmed on Yorphia, founded 2201.05.01: 26
 * entries, 4.5.2's order; all 0 through 2203.10.01 with no galactic trade made). The internal market's are
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
	if (!l || typeof l !== 'object') return null;
	return {
		id,
		name: leaderName(l.name),
		...(typeof l.level === 'number'
			? { level: l.level, bonus: num(l.bonus_skill_level), traits: items(l.traits).map(String) }
			: {})
	};
}

/** `name = { full_names = { key=… } }` (or a list of parts) → "Mncedisi Iweala". */
export function leaderName(name: Raw): string {
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

const TRADING_TYPES = ['default', 'fallen_empire', 'awakened_fallen_empire'];

/**
 * Nomadic empires: those running the `situation_nomad_economy` (their operational reserves).
 * `is_nomadic` is the engine's, and the origin does not tell: 2212.06.01 had five of these
 * situations but one nomad origin.
 */
export function nomadCountries(situations: Record<string, Raw>): Set<number> {
	return new Set(
		Object.values(situations)
			.filter((s) => s?.type === 'situation_nomad_economy' && typeof s.country === 'number')
			.map((s) => Number(s.country))
	);
}

/**
 * A trader enclave's kind — 1 XuraCorp, 2 Riggans, 3 Muutagan — from the flag its system
 * initializer sets (`trader_enclave_country_<n>`, 4.5.2 leviathans_system_initializers.txt); null
 * for any other country.
 */
export function traderEnclaveKind(c: Raw): 1 | 2 | 3 | null {
	if (c?.type !== 'enclave') return null;
	const flags = c.flags ?? {};
	for (const k of [1, 2, 3] as const) if (`trader_enclave_country_${k}` in flags) return k;
	return null;
}

/**
 * Another empire's view of us — what the diplomacy screen shows: personality, attitude towards us
 * (`ai.attitude`, the entry for our country), their opinion of us and its modifiers (their
 * relation to us: `relation_current`, `modifier = { modifier value }`) — and what it hides: their
 * stockpile and monthly net (the budget's balance, the market's included).
 */
export function intelOf(id: number, c: Raw, toUs: Raw, us: number, nomadic = false): AiIntel {
	const budget = c.budget?.current_month ?? {};
	return {
		countryId: id,
		nomadic,
		personality: strOrNull(c.personality),
		attitude: strOrNull(items(c.ai?.attitude).find((a) => a?.country === us)?.attitude),
		opinion: numOrNull(toUs?.relation_current),
		trust: num(toUs?.trust),
		opinionModifiers: items(toUs?.modifier)
			.filter((m) => typeof m?.modifier === 'string')
			.map((m) => ({ key: String(m.modifier), value: num(m.value) })),
		stockpile: resources(c.modules?.standard_economy_module?.resources),
		net: addResources(sumSources(budget.balance), sumSources(budget.trade_balance)),
		income: addResources(sumSources(budget.income), sumSources(budget.trade_income)),
		...(storageMax(c.variables) && { max: storageMax(c.variables)! })
	};
}

/** Companion mod 0.5.0's storage maximums (`sdash_m_<res>`) by resource; null: none exported. */
export function storageMax(variables: Raw): Resources | null {
	const max = Object.fromEntries(
		Object.entries(variables ?? {})
			.filter(([k, v]) => k.startsWith('sdash_m_') && typeof v === 'number' && v > 0)
			.map(([k, v]) => [k.slice('sdash_m_'.length), v as number])
	);
	return Object.keys(max).length ? max : null;
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
	const systemOf = new Map<number, { id: number; name: string }>();
	for (const [id, sys] of Object.entries(raw.systems))
		for (const sb of list(sys?.starbases))
			systemOf.set(sb, { id: Number(id), name: displayName(sys.name) });
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
				system: systemOf.get(id)?.name ?? '',
				systemId: systemOf.get(id)?.id ?? null,
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

/**
 * A species' name as displayName reads it — the data DB's prescripted names first
 * (`PRESCRIPTED_species_name_zrobots` → "Yorphid") —, else a prescripted key's suffix
 * (`PRESCRIPTED_species_name_humans1` → `Humans`).
 */
export function speciesName(name: Raw): string {
	const key = String(name?.key ?? name ?? '');
	const m = /^PRESCRIPTED_species_name_([a-z_]+?)\d*$/i.exec(key);
	return m && !prescripted[key] ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : displayName(name);
}

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

/** Not planets one could settle: stars, gas giants, asteroids and the like. */
const NOT_ROCKY =
	/star$|^pc_(gas_giant|asteroid|ice_asteroid|rare_crystal_asteroid|black_hole|pulsar|neutron_star|shattered|ringworld)/;

/**
 * Surveyed planets (`country.surveyed_deposit_holders`, type 0 = planet) that are rocky and owned
 * by nobody, with jumps from the capital's system over `galactic_object.<id>.hyperlane`.
 * Habitability is left out: which of them the game lists depends on species and terraforming.
 */
type GalaxyRaw = Pick<
	RawSave,
	'country' | 'systems' | 'bypasses' | 'naturalWormholes' | 'megastructures' | 'globalFlags'
>;

/** The galaxy the country moves in: hyperlanes plus the bypasses it can use. */
export function galaxy(raw: Partial<GalaxyRaw> & Pick<GalaxyRaw, 'country' | 'systems'>): Graph {
	const lanes = Object.entries(raw.systems).flatMap(([id, s]) =>
		items(s?.hyperlane).map((l) => [Number(id), Number(l?.to)] as [number, number])
	);
	const bypasses = bypassList(raw);
	const starFlagged = (flag: string) =>
		Object.entries(raw.systems)
			.filter(([, s]) => s?.flags?.[flag] !== undefined)
			.map(([id]) => Number(id));
	return graph(
		lanes,
		bypassLinks({
			bypasses,
			researched: items(raw.country?.tech_status?.technology).map(String),
			visited: list(raw.country?.visited_objects),
			globalFlags: Object.keys(raw.globalFlags ?? {}),
			lgateSystems: starFlagged('lgate'),
			lclusterSystems: starFlagged('lcluster1')
		})
	);
}

/**
 * Surveyed rocky planets nobody owns and no other empire controls, nearest first: jumps from the
 * capital and from the nearest own system (`beyond`, 0 inside the borders), both over hyperlanes
 * and usable bypasses. Own systems: those whose planets (stars included) the country controls.
 */
/** Systems with one of the country's shipyards (a starbase shipyard module, an arkship's). */
export function shipyardSystems(raw: Parameters<typeof stations>[0]): number[] {
	const yards = new Set(
		stations(raw)
			.filter((s) => s.shipyard)
			.map((s) => s.id)
	);
	return Object.entries(raw.systems)
		.filter(([, sys]) => list(sys?.starbases).some((sb) => yards.has(sb)))
		.map(([id]) => Number(id));
}

type ReachRaw = Pick<RawSave, 'countryId' | 'country' | 'planets' | 'systems'> & Partial<GalaxyRaw>;

/**
 * Jumps to every system from the capital, the nearest own shipyard and the nearest own system,
 * over hyperlanes and usable bypasses. Own systems: those whose planets (stars included) the
 * country controls.
 */
function reach(raw: ReachRaw, shipyards: number[]) {
	const g = galaxy(raw);
	const capitalSystem = raw.planets[String(raw.country?.capital)]?.coordinate?.origin;
	return {
		fromCapital: distances(g, capitalSystem === undefined ? [] : [Number(capitalSystem)]),
		fromShipyard: distances(g, shipyards),
		fromBorder: distances(
			g,
			Object.values(raw.planets)
				.filter((p) => controlledBy(p, raw.countryId))
				.map((p) => Number(p.coordinate?.origin))
		)
	};
}
const controlledBy = (p: Raw, country: number) =>
	p?.controller !== undefined && Number(p.controller) === country;

// bodies that are no natural celestial object (habitats, ring worlds, arks, astral scars …)
const ARTIFICIAL = /habitat|ringworld|^pc_ark|astral_scar|cosmogenesis|_seam$/;

/**
 * Systems a habitat could go to: surveyed (one planet at least), with no habitat or ring world
 * yet, and not another empire's. Per system its jumps, its natural bodies — major ones (stars and
 * planets) and minor ones (moons, asteroids), which set the habitat's district limit — and the
 * deposits on its surveyed bodies, whose `habitat_modifier` caps its districts
 * (#lib/habitats.ts). Building needs the system inside the borders: `beyond` 0.
 */
export function habitatSites(
	raw: ReachRaw & Pick<RawSave, 'deposits'>,
	shipyards: number[] = [],
	all = false // every system as if surveyed (the surveyAll spoiler)
) {
	const { fromCapital, fromShipyard, fromBorder } = reach(raw, shipyards);
	const bySystem = new Map<number, Raw[]>();
	for (const p of Object.values(raw.planets))
		if (p && typeof p === 'object' && p.coordinate?.origin !== undefined)
			bySystem.set(Number(p.coordinate.origin), [
				...(bySystem.get(Number(p.coordinate.origin)) ?? []),
				p
			]);
	const surveyed = (p: Raw) => all || list(p.surveyed_by).includes(raw.countryId);
	return [...bySystem]
		.filter(
			([sys, ps]) =>
				fromBorder.jumps.has(sys) &&
				ps.some(surveyed) &&
				!ps.some((p) => /^pc_(habitat|ringworld)/.test(String(p.planet_class))) &&
				!ps.some((p) => p.controller !== undefined && !controlledBy(p, raw.countryId))
		)
		.map(([sys, ps]): HabitatSite => {
			const natural = ps.filter((p) => !ARTIFICIAL.test(String(p.planet_class)));
			// asteroids of every kind (pc_ice_asteroid: Makemake, Haumea …) are minor bodies
			const major = natural.filter(
				(p) => p.moon_of === undefined && !/asteroid/.test(String(p.planet_class))
			).length;
			return {
				systemId: sys,
				system: displayName(raw.systems[String(sys)]?.name),
				jumps: fromCapital.jumps.get(sys) ?? null,
				shipyard: fromShipyard.jumps.get(sys) ?? null,
				beyond: fromBorder.jumps.get(sys) ?? null,
				via: fromBorder.via(sys),
				major,
				minor: natural.length - major,
				deposits: ps
					.filter(surveyed)
					.flatMap((p) => list(p.deposits).map((d) => raw.deposits[String(d)]?.type))
					.filter((t): t is string => typeof t === 'string')
			};
		})
		.sort((a, b) => (a.beyond ?? 1e9) - (b.beyond ?? 1e9) || a.system.localeCompare(b.system));
}

export function expansion(
	raw: ReachRaw & Pick<RawSave, 'deposits' | 'date'>,
	shipyards: number[] = [],
	all = false // every planet as if surveyed (the surveyAll spoiler)
): ExpansionPlanet[] {
	const { fromCapital, fromShipyard, fromBorder } = reach(raw, shipyards);
	const controlled = (p: Raw) => controlledBy(p, raw.countryId);
	const ids = all
		? Object.keys(raw.planets).map(Number)
		: items(raw.country?.surveyed_deposit_holders)
				.filter((h) => num(h?.type) === 0)
				.map((h) => Number(h.id));
	return ids
		.map((id) => [id, raw.planets[String(id)]] as const)
		.filter(([, p]) => p && typeof p === 'object' && p.owner === undefined)
		.filter(([, p]) => p.controller === undefined || controlled(p))
		.filter(([, p]) => !NOT_ROCKY.test(String(p.planet_class)))
		.map(([planetId, p]) => {
			const sys = p.coordinate?.origin;
			return {
				planetId,
				name: displayName(p.name),
				planetClass: String(p.planet_class),
				size: num(p.planet_size),
				system: displayName(raw.systems[String(sys)]?.name),
				jumps: fromCapital.jumps.get(Number(sys)) ?? null,
				beyond: fromBorder.jumps.get(Number(sys)) ?? null,
				shipyard: fromShipyard.jumps.get(Number(sys)) ?? null,
				via: fromBorder.via(Number(sys)),
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
export const planetBudget = (month: Raw): BudgetSource[] =>
	budgetSources(month).filter((s) => /^(planet_|pop_)/.test(s.source));

/**
 * Every source of the month's budget with its income and expenses; the market's, booked apart
 * (`trade_income|trade_expenses`), as `market:<source>`.
 */
export function budgetSources(month: Raw): BudgetSource[] {
	const of = (income: Raw, expenses: Raw, prefix: string) =>
		[...new Set([...Object.keys(income ?? {}), ...Object.keys(expenses ?? {})])].map((source) => ({
			source: prefix + source,
			income: resources(income?.[source]),
			expenses: resources(expenses?.[source])
		}));
	return [
		...of(month?.income, month?.expenses, ''),
		...of(month?.trade_income, month?.trade_expenses, 'market:')
	];
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
 * Every tech in the research queues with its progress (research points) and the date it was
 * started: the first per field is being researched, the others wait with what they have. A tech
 * left out of the queue keeps no progress in the save.
 */
export function techQueued(country: Raw): QueuedTech[] {
	return RESEARCH_AREAS.flatMap((area) =>
		items(country?.tech_status?.[`${area}_queue`]).flatMap((q) =>
			q?.technology
				? [
						{
							area,
							tech: String(q.technology),
							progress: num(q.progress),
							since: typeof q.date === 'string' ? q.date : null
						}
					]
				: []
		)
	);
}

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
 * Wars the country takes part in: `war.<id> = { name start_date attackers = { { country call_type }
 * } defenders battles = { { attackers = { <ids> } defenders attacker_victory attacker_losses
 * defender_losses system date type } } attacker_war_goal = { type } defender_war_goal
 * attacker_war_exhaustion defender_war_exhaustion }` (4.5.2, first seen 2026-10-19). A war that
 * ended leaves `<id>=none`.
 */
export function wars(raw: Pick<RawSave, 'wars' | 'countryId' | 'countryNames' | 'systems'>): War[] {
	const side = (v: Raw) => items(v).map((p) => Number(p?.country));
	const named = (ids: number[]) => ids.map((c) => raw.countryNames[String(c)] ?? `empire ${c}`);
	return Object.entries(raw.wars).flatMap(([id, w]) => {
		if (!w || typeof w !== 'object') return [];
		const [attackers, defenders] = [side(w.attackers), side(w.defenders)];
		if (!attackers.includes(raw.countryId) && !defenders.includes(raw.countryId)) return [];
		const attacker = attackers.includes(raw.countryId);
		const [ours, theirs] = attacker ? [attackers, defenders] : [defenders, attackers];
		const [own, enemy] = attacker ? ['attacker', 'defender'] : ['defender', 'attacker'];
		return [
			{
				id,
				name: displayName(w.name) || `war ${id}`,
				start: strOrNull(w.start_date),
				enemies: named(theirs),
				allies: named(ours.filter((c) => c !== raw.countryId)),
				attacker,
				goal: strOrNull(w[`${own}_war_goal`]?.type),
				enemyGoal: strOrNull(w[`${enemy}_war_goal`]?.type),
				exhaustion: numOrNull(w[`${own}_war_exhaustion`]),
				enemyExhaustion: numOrNull(w[`${enemy}_war_exhaustion`]),
				battles: items(w.battles).map((b) => {
					// A battle's side lists name each other: in our first war we attacked their civilian
					// ships and won every battle (the user, 2026-10-19), and the save had `defenders =
					// { us } attacker_victory=yes defender_losses=4` — 4 of theirs. The losses and the
					// victory follow the roles, not the lists.
					const weAttacked = items(b?.defenders).some((c) => ours.includes(Number(c)));
					const attackerWon = b?.attacker_victory === true || b?.attacker_victory === 'yes';
					return {
						date: String(b?.date ?? ''),
						system: displayName(raw.systems[String(b?.system)]?.name),
						type: String(b?.type ?? ''),
						won: weAttacked === attackerWon,
						lost: Number((weAttacked ? b?.attacker_losses : b?.defender_losses) ?? 0),
						killed: Number((weAttacked ? b?.defender_losses : b?.attacker_losses) ?? 0)
					};
				})
			}
		];
	});
}

/** Every war being fought, by its sides (the diplomacy tab). */
export function allWars(raw: Pick<RawSave, 'wars'>): WarSides[] {
	const side = (v: Raw) => items(v).map((p) => Number(p?.country));
	return Object.entries(raw.wars).flatMap(([id, w]) =>
		w && typeof w === 'object'
			? [
					{
						id,
						name: displayName(w.name) || `war ${id}`,
						start: strOrNull(w.start_date),
						attackers: side(w.attackers),
						defenders: side(w.defenders)
					}
				]
			: []
	);
}

/**
 * The Galactic Community, or null before it forms: `galactic_community = { members = { <ids> }
 * proposed = { <resolution ids> } voting = <resolution id> passed = { <ids in force> } last
 * category_timers community_formed }` (passed: first seen 2212.03, The Readied Shield), the resolutions
 * `resolution.<id> = { type country supporters = { <ids> } opponents }` (4.5.2, first seen
 * 2026-10-19: one being voted on, seven proposed).
 */
export function galacticCommunity(
	raw: Pick<
		RawSave,
		'galcom' | 'resolutions' | 'countryId' | 'countries' | 'date' | 'countryBlocks' | 'globalFlags'
	>
): GalacticCommunity | null {
	const g = raw.galcom;
	if (!g || typeof g !== 'object' || g.members === undefined) return null;
	const ids = (v: Raw) => items(v).map(Number);
	const name = (id: number) => raw.countries[String(id)]?.name ?? `empire ${id}`;
	const vote = (id: number): ResolutionVote | null => {
		const r = raw.resolutions[String(id)];
		if (!r || typeof r !== 'object') return null;
		const [support, oppose] = [ids(r.supporters), ids(r.opponents)];
		return {
			id,
			type: String(r.type ?? ''),
			proposer: name(Number(r.country)),
			support: support.map(name),
			oppose: oppose.map(name),
			ours: support.includes(raw.countryId)
				? 'for'
				: oppose.includes(raw.countryId)
					? 'against'
					: null
		};
	};
	const members = ids(g.members);
	return {
		formed: strOrNull(g.community_formed),
		members: members.map(name),
		member: members.includes(raw.countryId),
		categoryTimers: Object.fromEntries(
			Object.entries(g.category_timers ?? {}).flatMap(([k, v]) =>
				typeof v === 'string' ? [[k, v]] : []
			)
		),
		globalFlags: Object.keys(raw.globalFlags ?? {}),
		weights: Object.fromEntries(
			members.map((id) => {
				const c = raw.countryBlocks[String(id)];
				const exact = numOrNull(c?.variables?.sdash_dw);
				return [
					name(id),
					exact === null
						? { value: estimatedWeight(c), exact: false }
						: { value: exact, exact: true }
				];
			})
		),
		voting: typeof g.voting === 'number' ? vote(g.voting) : null,
		proposed: ids(g.proposed).flatMap((id) => vote(id) ?? []),
		passed: ids(g.passed).flatMap((id) => vote(id) ?? []),
		// `days` counts up while a resolution is on the floor, to RESOLUTION_VOTE_TIMER; `cooldown`
		// counts the recess down (2213.12–2214.01: days 1411 on 12.01, passed 12.30, cooldown 719)
		voteEnds:
			typeof g.voting === 'number' && typeof g.days === 'number'
				? addGameDays(raw.date, VOTE_DAYS - g.days)
				: null,
		nextVote:
			typeof g.cooldown === 'number' && g.cooldown > 0 ? addGameDays(raw.date, g.cooldown) : null
	};
}

/**
 * A country's diplomatic weight, roughly: the defines' terms (4.5.2 `00_defines.txt`
 * `DIPLOMACY_WEIGHT_*`: naval power × 0.025 + economy power × 0.15 + technology × 0.1) scaled by
 * `WEIGHT_SCALE`, which stands in for what the save cannot give — the pops' share and every
 * `diplomatic_weight` modifier. Checked 2214.01.01 against the game's Galactic Community screen
 * (screenshots 2026_10_23_1–4, all 13 members): game ÷ defines' terms 1.0–3.3, median 2.6; a
 * linear fit with pops did no better (off by up to 227 of 138–643). Only companion mod 0.4.0's
 * exported value is exact.
 */
const WEIGHT_SCALE = 2.6;
export function estimatedWeight(c: Raw): number {
	return (
		WEIGHT_SCALE *
		(num(c?.military_power) * 0.025 + num(c?.economy_power) * 0.15 + num(c?.tech_power) * 0.1)
	);
}

/** Days a resolution stays on the senate floor (RESOLUTION_VOTE_TIMER, 4.5.2). */
const VOTE_DAYS = 1440;

/**
 * Our fleets' last combats: `fleet.<id>.fleet_stats.combat_stats = { fleet = { country_name
 * fleet_name ship_size_count = { <per size> } ship_size_count_lost … } date enemy = { { …the same…
 * } } damage_outgoing damage_incoming }`. Every fleet has the block, `date="0.01.01"` until it
 * fights, and the game clears it again later (2205.10.14's was in the 11.01 save, gone by 12.01):
 * monthly saves catch only some combats, and the losses as of the save.
 */
export function combats(raw: Pick<RawSave, 'country' | 'fleets'>): Combat[] {
	const sum = (v: Raw) => items(v).reduce((n: number, x) => n + Number(x || 0), 0);
	return items(raw.country?.fleets_manager?.owned_fleets).flatMap((o) => {
		const c = raw.fleets[String(o?.fleet)]?.fleet_stats?.combat_stats;
		if (!c || typeof c.date !== 'string' || c.date.startsWith('0.')) return [];
		const enemies = items(c.enemy);
		const names = (k: string) => [...new Set(enemies.map((e) => String(e?.[k] ?? '?')))].join(', ');
		return [
			{
				fleetId: Number(o.fleet),
				fleet: String(c.fleet?.fleet_name ?? `fleet ${o.fleet}`),
				date: c.date,
				enemy: names('country_name'),
				enemyFleets: names('fleet_name'),
				ships: sum(c.fleet?.ship_size_count),
				lost: sum(c.fleet?.ship_size_count_lost),
				enemyShips: enemies.reduce((n, e) => n + sum(e?.ship_size_count), 0),
				enemyLost: enemies.reduce((n, e) => n + sum(e?.ship_size_count_lost), 0)
			}
		];
	});
}

/** Our standing in the Shroud (see `Shroud`), or null before we can access it. */
export function shroud(
	raw: Pick<RawSave, 'country' | 'patronRelations' | 'countryId'>
): Shroud | null {
	const m = raw.country?.modules?.standard_shroud_module;
	if (!m || typeof m !== 'object') return null;
	const point = (v: Raw) => ({ x: num(v?.x), y: num(v?.y) });
	return {
		attunement: point(m.attunement),
		monthStart: point(m.month_start_attunement),
		lastDelve: strOrNull(m.last_delve_date),
		preferred: strOrNull(raw.country?.is_preferred_patron),
		patrons: Object.values(raw.patronRelations)
			.filter((p) => p && typeof p === 'object' && p.owner === raw.countryId)
			.map((p) => ({
				patron: String(p.patron ?? ''),
				...point(p.position),
				contact: String(p.contact ?? 'none'),
				calling:
					p.calling && typeof p.calling === 'object'
						? {
								key: String(p.calling.patron_objective ?? ''),
								tier: num(p.calling.tier),
								start: strOrNull(p.calling.calling_start_date),
								completed: p.calling.completed === true || p.calling.completed === 'yes'
							}
						: null,
				deeds: items(p.deeds)
					.map((d) => d?.patron_objective)
					.filter((d) => typeof d === 'string')
			}))
	};
}

/** Our factions (see `Faction`), by support. */
export function factions(raw: Pick<RawSave, 'popFactions' | 'countryId'>): Faction[] {
	return Object.values(raw.popFactions)
		.filter((f) => f && typeof f === 'object' && f.country === raw.countryId)
		.map((f) => ({
			type: String(f.type ?? ''),
			name: displayName(f.name),
			support: num(f.support_percent),
			approval: num(f.faction_approval),
			pops: numOrNull(f.last_month_pops),
			change: numOrNull(f.pops_change)
		}))
		.sort((a, b) => b.support - a.support);
}

/** Our active subject agreements, as overlord or as subject (see `Subject`). */
export function subjects(
	raw: Pick<RawSave, 'agreements' | 'countryId' | 'countries' | 'loyalty'>
): Subject[] {
	const pairs = (v: Raw) => items(v).filter((x) => typeof x?.key === 'string');
	return Object.values(raw.agreements).flatMap((a) => {
		if (!a || typeof a !== 'object' || a.active_status !== 'active') return [];
		const [owner, target] = [Number(a.owner), Number(a.target)];
		if (owner !== raw.countryId && target !== raw.countryId) return [];
		const other = owner === raw.countryId ? target : owner;
		const t = a.term_data ?? {};
		return [
			{
				countryId: other,
				name: raw.countries[String(other)]?.name ?? `empire ${other}`,
				weAreOverlord: owner === raw.countryId,
				preset: String(t.agreement_preset ?? ''),
				since: strOrNull(a.date_added),
				terms: Object.fromEntries(pairs(t.discrete_terms).map((x) => [x.key, String(x.value)])),
				subsidies: Object.fromEntries(
					pairs(t.resource_terms).map((x) => [x.key, Number(x.value) || 0])
				),
				specialistLevel: Number(a.subject_specialization?.level ?? 0),
				specialistExperience: Number(a.subject_specialization?.experience ?? 0),
				loyalty: raw.loyalty[String(target)] ?? null
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
				if (k === 'country' || k === 'recipient') continue;
				walk(y, Array.isArray(x) ? path : [...path, k]);
			}
			return;
		}
		const key = path.at(-1) ?? '';
		if (typeof x === 'number' && RESOURCE_KEYS.has(key)) add(path.slice(0, -1), key, x);
		else if (x !== 'no' && x !== false && x !== undefined)
			side.other.push(x === 'yes' || x === true ? path.join(' ') : `${path.join(' ')} ${x}`);
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
	// habitability (0–1) of the species on this planet, per pop group: overall and per species
	const hab = { size: 0, weighted: 0 };
	const bySpecies = new Map<string, { size: number; weighted: number }>();
	for (const id of ids) {
		const g = popGroups[String(id)];
		if (!g || typeof g !== 'object' || !(num(g.size) > 0)) continue;
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
		happiness: known > 0 ? [...by.values()].reduce((n, s) => n + s.weighted, 0) / known : null,
		habitability: hab.size > 0 ? hab.weighted / hab.size : null,
		speciesHabitability: Object.fromEntries(
			[...bySpecies].map(([sp, s]) => [sp, s.weighted / s.size])
		)
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
// Names of the prescripted empires (data DB `prescripted_name`: rulers, species, empires), set at
// start; a save names them by loc key (`PRESCRIPTED_ruler_name_humans1` → "Dolores Muwanga").
let prescripted: Record<string, string> = {};
export const setPrescriptedNames = (names: Record<string, string>) => {
	prescripted = names;
};

export function displayName(name: Raw): string {
	const key = String(name?.key ?? name ?? '');
	if (prescripted[key]) return prescripted[key];
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
	// War names: `war_vs_adjectives` / `war_vs_names` = "$1$ - $2$ $3$" (4.5.2 localisation).
	if (/^war_vs_/.test(key) && Array.isArray(name?.variables)) {
		const part = (k: string) => displayName(name.variables.find((x: Raw) => x?.key === k)?.value);
		return `${part('1')} - ${part('2')} ${part('3')}`;
	}
	// Inline templates: `$affix$$base$` (a modified species: base "Yorphid", affix "Trans-" →
	// "Trans-Yorphid"), `$base$ $affix$` — each `$k$` filled by the variable keyed k.
	if (/\$\w+\$/.test(key) && Array.isArray(name?.variables)) {
		return key.replace(/\$(\w+)\$/g, (_, k: string) =>
			displayName(name.variables.find((x: Raw) => x?.key === k)?.value)
		);
	}
	// Name parts with a part inside — faction names, `{<names_1> {<names_2>}}` (4.5.2
	// common/random_names/00_pop_faction_names.txt): the outer part's own words come first.
	// `Council` + `of_Scientific_Betterment` → "Council of Scientific Betterment". Name-part keys
	// mirror their text; placeholders (`%ADJ%`) and formats (`PLANET_NAME_FORMAT`) are not parts.
	if (Array.isArray(name?.variables) && !key.startsWith('%') && key !== key.toUpperCase()) {
		const inner = name.variables.map((v: Raw) => displayName(v.value)).filter(Boolean);
		return [displayName({ key }), ...inner].join(' ');
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
export const num = (v: Raw) => (typeof v === 'number' ? v : 0);
export const numOrNull = (v: Raw) => (typeof v === 'number' ? v : null);
export const strOrNull = (v: Raw) => (typeof v === 'string' ? v : null);
/** Every `country=<id>` anywhere below `v` (wars and trade deals name their sides this way). */
export function countryIds(v: Raw): number[] {
	if (!v || typeof v !== 'object') return [];
	return Object.entries(v).flatMap(([k, x]) =>
		k === 'country' && typeof x !== 'object' ? [Number(x)] : countryIds(x)
	);
}

export const items = (v: Raw): Raw[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
export const list = (v: Raw): number[] =>
	(Array.isArray(v) ? v : v === undefined ? [] : [v]).map(Number);
export const first = (v: Raw) => (Array.isArray(v) ? v[0] : v);

/**
 * `country.government.council_agenda_cooldowns = { council_agenda start_date }`: `start_date` is
 * when the agenda can be picked again, not its launch — 2207.03.10, other empires: Infinite
 * Opportunities until 2231/2232, 30 years (COUNCIL_AGENDA_COOLDOWN) after their first agenda.
 */
export function agendaCooldowns(v: Raw): { key: string; until: string }[] {
	return items(v)
		.filter((c) => typeof c?.council_agenda === 'string' && typeof c?.start_date === 'string')
		.map((c) => ({ key: c.council_agenda, until: c.start_date }));
}
