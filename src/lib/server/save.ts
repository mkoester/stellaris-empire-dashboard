import { bypassList, historyReading } from './world.ts';
import { readZipEntry } from './zip.ts';
import { bypassLinks, distances, graph, type Graph } from '#lib/galaxyGraph.ts';
import { readSetup } from '#lib/galaxySetup.ts';
import { START_YEAR } from '#lib/series.ts';
import type { EntryEvent } from '#lib/systemEvents.ts';
import type {
	AiIntel,
	CountryInfo,
	ExpansionPlanet,
	GameData,
	HabitatSite,
	Snapshot,
	TraderEnclave
} from '#lib/types.ts';
import { Jomini } from 'jomini';
import {
	colonyPlaces,
	construction,
	knownSystems,
	migration,
	playerColonies,
	sectors
} from './save/colonies.ts';
import {
	agendaCooldowns,
	budgetSources,
	cooldowns,
	countryModifiers,
	edictTimes,
	empireFocus,
	envoys,
	ethics,
	factions,
	intelOf,
	market,
	marketOrders,
	nomadCountries,
	planetBudget,
	planetState,
	playerCount,
	progress,
	RESEARCH_AREAS,
	shroud,
	storageMax,
	systemEntries,
	techKept,
	techQueued,
	timedFlags,
	traderEnclaveKind,
	TRADING_TYPES,
	wanderlust,
	world
} from './save/country.ts';
import {
	combats,
	contracts,
	externalBuildings,
	galacticCommunity,
	subjects,
	tradeDeals,
	wars
} from './save/diplomacy.ts';
import {
	arkships,
	capitalSystem,
	civilianShips,
	megaShipyards,
	militaryFleets,
	orbitalStations,
	ownSystems,
	shipCounts,
	shipDesigns,
	stations
} from './save/fleets.ts';
import {
	council,
	idleLeaders,
	leaderList,
	leaderPool,
	leaderRoster,
	ownLeaders,
	ruler
} from './save/leaders.ts';
import { slaveMarket, speciesByEmpire, speciesInfo, speciesRights } from './save/species.ts';
import {
	addResources,
	countBy,
	countryIds,
	displayName,
	first,
	isYes,
	items,
	list,
	num,
	numOrNull,
	type Raw,
	resources,
	strOrNull,
	sumSources,
	withNames
} from './save/values.ts';

// Save → Snapshot. `readSave` is the only part touching jomini; everything after it is pure and
// takes plain objects, so it is unit-tested against hand-written fixtures.
// Paths into the gamestate are documented in docs/save-format.md.
// Here: reading the file, the snapshot as a whole, and the galaxy and expansion readings. The other
// parts of the reading are in `save/`, by what they read; importers take them from here.
export * from './save/values.ts';
export * from './save/leaders.ts';
export * from './save/country.ts';
export * from './save/fleets.ts';
export * from './save/species.ts';
export * from './save/diplomacy.ts';
export * from './save/colonies.ts';

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
	players: number; // the top-level `player` block's entries, `playerCount()`
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
	galaxy: Raw; // the galaxy setup block: cost sliders `technology`, `traditions`, `difficulty`, every other setting
	leaders: Record<string, Raw>;
	monthlyTrades: Raw; // market.monthly_trades: every country's standing orders
	market: Raw; // market: price fluctuations, galactic and internal
	popJobs: Record<string, Raw>; // top-level pop_jobs, referenced from colony.pop_jobs
	popGroups: Record<string, Raw>; // top-level pop_groups, referenced from colony.pop_groups
	slaveMarket: Raw; // slave_market_manager.slaves_on_market
	missions: Record<string, Raw>; // top-level missions: contracts and situation-log missions
	contractIds: Raw; // top-level contracts: { available in_progress }
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

/**
 * The save file as plain objects. Countries are named while the file is read, so the prescripted
 * names are needed here already — the same `data` `toSnapshot` is handed.
 */
export async function readSave(zip: Uint8Array, data: ReadingData): Promise<RawSave> {
	const jomini = await (parser ??= Jomini.initialize());
	return withNames(data.prescriptedNames, () => query(jomini, zip));
}

function query(jomini: Jomini, zip: Uint8Array): RawSave {
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
		const us = allCountries[String(countryId)];
		const ourTechs = items(us?.tech_status?.technology).map(String);
		const ourRelation = (id: number) =>
			items(us?.relations_manager?.relation).find((r) => r?.country === id);
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
				aiIntel.push(
					intelOf(
						Number(id),
						c,
						toUs,
						countryId,
						nomads.has(Number(id)),
						isYes(ourRelation(Number(id))?.research_agreement) ? ourTechs : null
					)
				);
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
			slaveMarket: q.at('/slave_market_manager/slaves_on_market'),
			missions: q.at('/missions') ?? {},
			contractIds: q.at('/contracts'),
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
			players: playerCount(q.at('/player')),
			// the whole setup block: the cost sliders here, every setting for the galaxy tab
			galaxy: q.at('/galaxy') ?? {},
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
export const READER = '62'; // 62: FirstContact-MeaningfulLabels' contact names ("Voidworms (fauna)"); 61: the home system's bodies count as surveyed (surveyed_deposit_holders); 60: waystations' stockpile and fill, a waystation no longer owns its system (nor makes it ours); 59: every planet flag (carrier flags for planet decisions); 58: dig sites' chapter; 57: prescripted empires' names where countries are named while the file is read (they followed the save read before); 56: the save's player count (multiplayer only from two players); 55: subjects' renegotiation dates, stance and numbers; 54: jobs' automated workforce; 53: ship designs (saved and unofficial), fleets' designs; 52: Nomads contracts; 51: pops per species per colony, every species' rights (not the founder's alone); 50: the Slave Market and the slave trade bans; 49: the progress of techs switched away from; 48: no multiplayer from an Ironman save's account name; 47: our species in every empire we talk to; 46: jobs' efficiency workforce and species; 45: research partners' tech gaps, commercial pact trade, species by empire; 44: multiplayer; 43: branch offices and holdings, the history reading; 42: the galaxy setup; 41: our arkships, the capital's system by its colony; 40: our shipset; 39: no shipyard without a shipyard queue, arkships placed by their ship; 38: civilian ships' size, fleets' and arkships' system id; 37: systems' entry events; 36: the mod's colony stability; 35: the founder species' class (34: leaders' home colony; 33: leaders' experience; 32: difficulty-adjusted tech costs, leaders' assignments and the pool's details; 31: Wanderlust; 30: the leader pool; 29: ascension tier and governor skill per colony; 28: amenities, crime, approval; 27: disabled buildings; 26: leaders' ethic and governors; 25: situation stages and their ends; 24: our pops' ethics; 23: capital, rights and insult cooldowns; 22: fleet ids, roll cycles; 21: timed flags, reform and focus cooldowns)

/**
 * What reading a save takes from the game data: the prescripted empires' names (data DB
 * `prescripted_name`: rulers, species, empires — a save names them by loc key,
 * `PRESCRIPTED_ruler_name_humans1` → "Dolores Muwanga") and the popups a first entry into a system
 * fires (`system_entry_event`). Each campaign is read with its own mods' data.
 */
export type ReadingData = Pick<GameData, 'prescriptedNames' | 'entryEvents'>;

/** Reading without game data: prescripted names stay keys, no entry events. */
export const NO_READING_DATA: ReadingData = { prescriptedNames: {}, entryEvents: [] };

export function toSnapshot(raw: RawSave, campaign: string, data: ReadingData): Snapshot {
	return withNames(data.prescriptedNames, () => snapshot(raw, campaign, data.entryEvents));
}

function snapshot(raw: RawSave, campaign: string, entryEvents: EntryEvent[]): Snapshot {
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
		navalMax: numOrNull(raw.country?.variables?.sdash_nc), // companion mod 0.6.0
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
		designs: shipDesigns(raw),
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
		countryTimedFlags: timedFlags(raw.country?.flags, raw.date),
		cooldowns: cooldowns(raw),
		species: speciesInfo(raw),
		speciesByEmpire: speciesByEmpire(raw),
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
		arkships: arkships(raw),
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
		ethics: ethics(raw.country, colonyPlaces(raw)),
		combats: combats(raw),
		shroud: shroud(raw),
		warLostDate:
			typeof raw.country?.last_date_war_lost === 'string' ? raw.country.last_date_war_lost : null,
		tradeDeals: tradeDeals(raw),
		contracts: contracts(raw),
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
		techKept: techKept(raw.country),
		// per field (physics, society, engineering), in that order
		techStored: Object.fromEntries(
			items(raw.country?.tech_status?.stored_techpoints).map((v, i) => [RESEARCH_AREAS[i], num(v)])
		),
		// options that stay until researched (focus rewards' `add_research_option`), repeated keys
		techPermanent: items(raw.country?.tech_status?.always_available_tech).map(String),
		leaderList: leaderList(raw),
		leaderPool: leaderPool(raw),
		wanderlust: wanderlust(raw),
		entryEvents: systemEntries(raw, entryEvents),
		founderClass: strOrNull(raw.speciesDb[String(raw.country?.founder_species_ref)]?.class),
		shipset: strOrNull(raw.country?.graphical_culture),
		galaxySetup: readSetup(raw.galaxy),
		...externalBuildings(raw),
		history: historyReading(raw),
		speciesRights: speciesRights(raw.country),
		slaveMarket: slaveMarket(raw),
		slaveTradeBans: {
			organic: 'organic_slave_trade_banned_flag' in (raw.globalFlags ?? {}),
			sentient: 'sentient_slave_trade_banned_flag' in (raw.globalFlags ?? {})
		},
		timelineId: numOrNull(raw.country?.variables?.sdash_tl),
		previousTimelineId: numOrNull(raw.country?.variables?.sdash_tl_prev),
		logEvents: null,
		ticks: null,
		players: raw.players,
		multiplayer: raw.players > 1
	};
}

/** Not planets one could settle: stars, gas giants, asteroids and the like. */
export const NOT_ROCKY =
	/star$|^pc_(gas_giant|asteroid|ice_asteroid|rare_crystal_asteroid|black_hole|pulsar|neutron_star|shattered|ringworld)/;

/**
 * Surveyed planets (`country.surveyed_deposit_holders`, type 0 = planet) that are rocky and owned
 * by nobody, with jumps from the capital's system over `galactic_object.<id>.hyperlane`.
 * Habitability is left out: which of them the game lists depends on species and terraforming.
 */
export type GalaxyRaw = Pick<
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

type ReachRaw = Pick<RawSave, 'countryId' | 'country' | 'planets' | 'systems'> &
	Partial<GalaxyRaw> &
	Partial<Pick<RawSave, 'colonies' | 'ships' | 'fleets'>>;

/**
 * Jumps to every system from the capital, the nearest own shipyard and the nearest own system,
 * over hyperlanes and usable bypasses. Own systems: those whose planets (stars included) the
 * country controls.
 */
function reach(raw: ReachRaw, shipyards: number[]) {
	const g = galaxy(raw);
	const capital = capitalSystem(raw);
	return {
		fromCapital: distances(g, capital === null ? [] : [capital]),
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
