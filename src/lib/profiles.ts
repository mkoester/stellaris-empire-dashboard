import { DEFAULT_VIEW, parseView, type ColonyView } from './colonyTable.ts';
import { DEFAULT_CONTACT_VIEW, parseContactView, type ContactView } from './contacts.ts';
import { DEFAULT_DIPLOMACY_VIEW, parseDiplomacyView, type DiplomacyView } from './diplomacy.ts';
import { DEFAULT_MIGRATION_VIEW, parseMigrationView, type MigrationView } from './migration.ts';
import { DEFAULT_EXPANSION_VIEW, parseExpansionView, type ExpansionView } from './expansion.ts';
import { anyOn } from './displaySwitches.ts';
import { DEFAULT_MAP_FILTER, parseMapFilter, type MapFilter } from './mapLayers.ts';
import { parseMapFit, parseMapWidth, type MapFit, type MapWidth } from './mapView.ts';
import { DEFAULT_MEGA_VIEW, parseMegaView, type MegaView } from './megastructures.ts';
import { DEFAULT_CONTRACT_VIEW, parseContractView, type ContractView } from './contracts.ts';
import { DEFAULT_STARBASE_VIEW, parseStarbaseView, type StarbaseView } from './starbases.ts';
import { DEFAULT_SYSTEM_VIEW, parseSystemView, type SystemView } from './systems.ts';
import { DEFAULT_PRODUCE_VIEW, parseProduceView, type ProduceView } from './produce.ts';
import { DEFAULT_POP_WINDOW, parsePopWindow, type PopWindow } from './popWindow.ts';
import { DEFAULT_INCOME_WINDOW, parseIncomeWindow } from './planner/eta.ts';
import { DEFAULT_QUADRANT_VIEW, parseQuadrantView, type QuadrantView } from './quadrants.ts';
import { parseChartEvents, parseTabs, type ChartEvents, type CustomTab } from './settings.ts';

// Profiles: named sets of viewer settings — one per playstyle or play-through. Everything but the
// theme (that is about the screen) belongs to a profile. The server keeps them (`setting` rows
// `profiles`, `profile:<id>`, `activeProfile`, `campaignProfiles`); a campaign remembers the
// profile last picked while playing it. Exported as a JSON file, imported as a new profile.

export const ROW_LINES = { thin: 1, medium: 2, thick: 4 } as const; // px
export type RowLine = keyof typeof ROW_LINES;
// The slave market tab for an empire that does not allow slavery (one that does always sees it):
// only while a species we give full citizenship is for sale, always, or never.
export const SLAVE_MARKET_MODES = {
	mine: 'only when our citizens are for sale',
	all: 'always',
	hide: 'never'
} as const;
export type SlaveMarketMode = keyof typeof SLAVE_MARKET_MODES;
export type Display = {
	colonyRowLine: RowLine;
	expansionRowLine: RowLine;
	slaveMarket: SlaveMarketMode; // the slave market tab where slavery is not allowed
	mapFit: MapFit; // what a map shows when a page opens
	mapWidth: MapWidth; // a map's width until a browser's width button picks one
	showSpoilers: boolean; // ⚙ lists the spoiler switches; off, they are off (#lib/displaySwitches.ts)
	showCheats: boolean; // likewise the cheats
	habitatsAlways: boolean; // habitat sites before habitats can be built (cheat)
	anomalySpoilers: boolean; // frontier and map tabs: what an anomaly can turn into
	projectSpoilers: boolean; // frontier and map tabs: what a special project leads to
	digSiteSpoilers: boolean; // frontier and map tabs: what a dig site's chapters give
	contactStations: boolean; // first contact map: whose station each visited system has
	wholeGalaxy: boolean; // maps and megastructure sites: every system, not only the discovered
	unknownStars: boolean; // maps: the undiscovered systems too, without their hyperlanes
	wormholeLinks: boolean; // maps: where explored wormholes lead (on by default)
	wormholePairs: boolean; // maps: every wormhole pair, explored or not (spoiler)
	lgates: boolean; // maps: every L-Gate and, once spawned, the L-Cluster with its links (spoiler)
	surveyAll: boolean; // every system as if fully surveyed: bodies, deposits, anomalies (spoiler)
	wanderlustAll: boolean; // map: every Wanderlust target, not only the visited (spoiler)
	hiddenTimers: boolean; // upcoming: event timers no action names (spoiler)
	showLocked: boolean; // government: agendas, edicts and policies the game does not list
	factionTypes: boolean; // ethics tab: faction types of our ethics, before any has formed (cheating)
	allFactionTypes: boolean; // … and those of ethics we do not hold (cheating)
	tradeoffs: boolean; // the trade-offs tab: where to spend scarce resources (exploratory)
	planOrder: boolean; // planner: each goal's times with the goals above it paid first
	tradeIntel: boolean; // trade tab: what other empires would trade, at what rate, what a gift buys (spoiler)
	tradeStockpiles: boolean; // trade tab: other empires' stockpiles and income (cheat)
	diplomacyAll: boolean; // diplomacy tab: every empire and relation, beyond our intel (spoiler)
	historyMet: boolean; // history tab: everything about the empires we met, beyond our intel (spoiler)
	historyAll: boolean; // history tab: every empire's history, by its own name (cheat)
	precursorsAll: boolean; // frontier tab: everything the save holds on every precursor (cheat)
	pactIntel: boolean; // pacts tab: what intel shows of partners — tech counts, trade at economy intel 3 (spoiler)
	pactAdvice: boolean; // pacts tab: whom to offer a research agreement or commercial pact, ranked (spoiler)
	subjectNumbers: boolean; // subjects tab: a subject's power, fleet, size and pops as numbers (cheat)
	pactAll: boolean; // pacts tab: partners' techs and trade whatever our intel, tech hints (cheat)
	contractSpoilers: boolean; // contracts: offers from issuers we do not talk to (nomad), others' near our border (settled) (spoiler)
	contractsAll: boolean; // contracts: every contract in the galaxy (cheat)
	whatIfs: boolean; // ≈ what an edict, policy, designation or planet decision would do now (spoiler)
};
export const DEFAULT_DISPLAY: Display = {
	colonyRowLine: 'medium',
	expansionRowLine: 'medium',
	slaveMarket: 'mine',
	mapFit: 'explored',
	mapWidth: 'normal',
	showSpoilers: false,
	showCheats: false,
	habitatsAlways: false,
	anomalySpoilers: false,
	projectSpoilers: false,
	digSiteSpoilers: false,
	contactStations: false,
	wholeGalaxy: false,
	unknownStars: false,
	wormholeLinks: true,
	wormholePairs: false,
	lgates: false,
	surveyAll: false,
	wanderlustAll: false,
	hiddenTimers: false,
	showLocked: false,
	factionTypes: false,
	allFactionTypes: false,
	tradeoffs: false,
	planOrder: false,
	whatIfs: false,
	tradeIntel: false,
	tradeStockpiles: false,
	diplomacyAll: false,
	historyMet: false,
	historyAll: false,
	precursorsAll: false,
	pactIntel: false,
	pactAdvice: false,
	subjectNumbers: false,
	pactAll: false,
	contractSpoilers: false,
	contractsAll: false
};

export type ProfileSettings = {
	tabs: CustomTab[];
	chartEvents: ChartEvents;
	colonyView: ColonyView;
	expansionView: ExpansionView;
	contactView: ContactView;
	diplomacyView: DiplomacyView;
	migrationView: MigrationView;
	megastructureView: MegaView;
	contractView: ContractView;
	starbaseView: StarbaseView;
	systemView: SystemView;
	produceView: ProduceView;
	mapFilter: MapFilter;
	quadrants: QuadrantView; // every map's rings and sectors
	popWindow: PopWindow; // the months the Pops charts' mean takes in
	incomeWindow: number; // the months the planner's mean income takes in
	display: Display;
};
export type ProfileInfo = { id: string; name: string };

export const DEFAULT_SETTINGS: ProfileSettings = {
	tabs: [],
	chartEvents: {},
	colonyView: DEFAULT_VIEW,
	expansionView: DEFAULT_EXPANSION_VIEW,
	contactView: DEFAULT_CONTACT_VIEW,
	diplomacyView: DEFAULT_DIPLOMACY_VIEW,
	migrationView: DEFAULT_MIGRATION_VIEW,
	megastructureView: DEFAULT_MEGA_VIEW,
	contractView: DEFAULT_CONTRACT_VIEW,
	starbaseView: DEFAULT_STARBASE_VIEW,
	systemView: DEFAULT_SYSTEM_VIEW,
	produceView: DEFAULT_PRODUCE_VIEW,
	quadrants: DEFAULT_QUADRANT_VIEW,
	popWindow: DEFAULT_POP_WINDOW,
	incomeWindow: DEFAULT_INCOME_WINDOW,
	mapFilter: DEFAULT_MAP_FILTER,
	display: DEFAULT_DISPLAY
};

export function parseDisplay(v: unknown): Display {
	const o = (v ?? {}) as Partial<Display>;
	const line = (k: 'colonyRowLine' | 'expansionRowLine') => {
		const l = o[k];
		return l && l in ROW_LINES ? l : DEFAULT_DISPLAY[k];
	};
	return {
		colonyRowLine: line('colonyRowLine'),
		expansionRowLine: line('expansionRowLine'),
		slaveMarket:
			o.slaveMarket && o.slaveMarket in SLAVE_MARKET_MODES
				? o.slaveMarket
				: DEFAULT_DISPLAY.slaveMarket,
		mapFit: parseMapFit(o.mapFit),
		mapWidth: parseMapWidth(o.mapWidth),
		// a profile from before the gates keeps what it had on
		showSpoilers: typeof o.showSpoilers === 'boolean' ? o.showSpoilers : anyOn(o, 'spoiler'),
		showCheats: typeof o.showCheats === 'boolean' ? o.showCheats : anyOn(o, 'cheat'),
		habitatsAlways: o.habitatsAlways === true,
		whatIfs: o.whatIfs === true,
		anomalySpoilers: o.anomalySpoilers === true,
		projectSpoilers: o.projectSpoilers === true,
		digSiteSpoilers: o.digSiteSpoilers === true,
		contactStations: o.contactStations === true,
		wholeGalaxy: o.wholeGalaxy === true,
		unknownStars: o.unknownStars === true,
		wormholeLinks: o.wormholeLinks !== false,
		wormholePairs: o.wormholePairs === true,
		lgates: o.lgates === true,
		surveyAll: o.surveyAll === true,
		wanderlustAll: o.wanderlustAll === true,
		hiddenTimers: o.hiddenTimers === true,
		showLocked: o.showLocked === true,
		factionTypes: o.factionTypes === true,
		allFactionTypes: o.allFactionTypes === true,
		tradeoffs: o.tradeoffs === true,
		planOrder: o.planOrder === true,
		tradeIntel: o.tradeIntel === true,
		// one switch until 2026-11-18: a profile that had it on keeps the stockpiles too
		tradeStockpiles:
			typeof o.tradeStockpiles === 'boolean' ? o.tradeStockpiles : o.tradeIntel === true,
		diplomacyAll: o.diplomacyAll === true,
		historyMet: o.historyMet === true,
		historyAll: o.historyAll === true,
		precursorsAll: o.precursorsAll === true,
		pactIntel: o.pactIntel === true,
		pactAdvice: o.pactAdvice === true,
		subjectNumbers: o.subjectNumbers === true,
		pactAll: o.pactAll === true,
		contractSpoilers: o.contractSpoilers === true,
		contractsAll: o.contractsAll === true
	};
}

/**
 * How each setting is read from stored or sent JSON: its value in the current shape, or null when
 * it is malformed beyond repair (only the tabs and the chart events can be).
 */
export const SETTING_PARSERS: {
	[K in keyof ProfileSettings]: (v: unknown) => ProfileSettings[K] | null;
} = {
	tabs: parseTabs,
	chartEvents: parseChartEvents,
	colonyView: parseView,
	expansionView: parseExpansionView,
	contactView: parseContactView,
	diplomacyView: parseDiplomacyView,
	migrationView: parseMigrationView,
	megastructureView: parseMegaView,
	contractView: parseContractView,
	starbaseView: parseStarbaseView,
	systemView: parseSystemView,
	produceView: parseProduceView,
	mapFilter: parseMapFilter,
	quadrants: parseQuadrantView,
	popWindow: parsePopWindow,
	incomeWindow: parseIncomeWindow,
	display: parseDisplay
};
const SETTING_KEYS = Object.keys(SETTING_PARSERS) as (keyof ProfileSettings)[];

/**
 * The settings `v` names, each in the current shape and those it does not name left out;
 * `{ malformed }` names the first that cannot be read.
 */
export function parsePatch(v: unknown): Partial<ProfileSettings> | { malformed: string } {
	const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
	const patch: Partial<Record<keyof ProfileSettings, unknown>> = {};
	for (const key of SETTING_KEYS) {
		if (o[key] === undefined) continue;
		const parsed = SETTING_PARSERS[key](o[key]);
		if (parsed === null) return { malformed: key };
		patch[key] = parsed;
	}
	return patch as Partial<ProfileSettings>;
}

/** A stored or imported profile in the current shape; broken parts fall back to the defaults. */
export function parseSettings(v: unknown): ProfileSettings {
	const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
	return Object.fromEntries(
		SETTING_KEYS.map((key) => [key, SETTING_PARSERS[key](o[key]) ?? DEFAULT_SETTINGS[key]])
	) as ProfileSettings;
}

/** A stored map of strings (campaign → profile); entries of another type dropped. */
export function parseStringMap(v: unknown): Record<string, string> {
	if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
	return Object.fromEntries(
		Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string')
	);
}

/** A stored list of strings; anything else in it dropped, [] when it is no list. */
export const parseStrings = (v: unknown): string[] =>
	Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** The known profiles, if `v` is a well-formed list. */
export function parseProfiles(v: unknown): ProfileInfo[] | null {
	if (!Array.isArray(v)) return null;
	const out = v.filter(
		(p): p is ProfileInfo => typeof p?.id === 'string' && typeof p?.name === 'string'
	);
	return out.length ? out : null;
}

/** The profile in use: the campaign's own, else the last picked, else the first. */
export function activeId(
	profiles: ProfileInfo[],
	active: unknown,
	byCampaign: Record<string, string>,
	campaign: string | null
): string {
	const known = (id: unknown): id is string => profiles.some((p) => p.id === id);
	const own = campaign === null ? undefined : byCampaign[campaign];
	return known(own) ? own : known(active) ? active : profiles[0].id;
}

/** "Wide", or "Wide (2)" … when the name is taken. */
export function uniqueName(name: string, taken: string[]): string {
	const base = name.trim().slice(0, 40) || 'profile';
	if (!taken.includes(base)) return base;
	for (let n = 2; ; n++) if (!taken.includes(`${base} (${n})`)) return `${base} (${n})`;
}

const FORMAT = 'stellaris-dashboard-profile';

export const exportFile = (name: string, settings: ProfileSettings) => ({
	format: FORMAT,
	version: 1,
	name,
	settings
});

/** An exported profile's name and settings; null when `v` is no such file. */
export function importFile(v: unknown): { name: string; settings: ProfileSettings } | null {
	const o = v as { format?: unknown; name?: unknown; settings?: unknown } | null;
	if (o?.format !== FORMAT || typeof o.name !== 'string') return null;
	return { name: o.name, settings: parseSettings(o.settings) };
}
