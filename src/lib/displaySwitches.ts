// The display switches of ⚙, grouped as a browser's settings are, each marked as a spoiler (what
// the game hides) or a cheat (what it never tells a player) where it is one. Hiding spoilers or
// cheats also turns them off — `effectiveDisplay()` — while their stored values stay, so showing
// them again brings each back as it was. A multiplayer or Ironman game turns the cheats off whatever is
// stored, and the spoilers marked `intel` too — they reveal other empires or space not explored.
import type { Display } from './profiles.ts';

export type SwitchKey = Exclude<
	keyof Display,
	| 'colonyRowLine'
	| 'expansionRowLine'
	| 'slaveMarket'
	| 'mapFit'
	| 'mapWidth'
	| 'mapStars'
	| 'showSpoilers'
	| 'showCheats'
>;
export type SwitchKind = 'normal' | 'spoiler' | 'cheat';
export type Switch = {
	key: SwitchKey;
	label: string;
	note?: string;
	group: string;
	kind: SwitchKind;
	tags?: string; // more words the search finds it by
	// reveals other empires or space not explored: off where cheats are (multiplayer, Ironman)
	intel?: true;
};

export const SWITCH_GROUPS = [
	'Tabs',
	'Maps',
	'Expansion',
	'Government and ethics',
	'Frontier',
	'Diplomacy and trade',
	'What-ifs'
] as const;

export const SWITCHES: Switch[] = [
	{
		key: 'tradeoffs',
		group: 'Tabs',
		kind: 'normal',
		label: 'Trade-offs tab: stations, districts or buildings first — payback and a simulation',
		note: 'exploratory: estimates from your budget, with knobs for upcoming techs and traditions'
	},
	{
		key: 'planOrder',
		group: 'Tabs',
		kind: 'normal',
		label: 'Planner: also time each goal in plan order',
		note: 'when it is paid for and built with the wanted goals above it paid first',
		tags: 'cost income estimate'
	},
	{
		key: 'historyMet',
		group: 'Tabs',
		kind: 'spoiler',
		intel: true,
		label: 'History: everything about the empires you met, beyond your intel on them',
		note: 'without it: their systems and colonies from intel 30, their wars from intel 20'
	},
	{
		key: 'historyAll',
		group: 'Tabs',
		// the game never tells anyone another empire's whole past (the user's ask 2026-11-17)
		kind: 'cheat',
		intel: true,
		label: 'History: every empire’s systems, colonies and wars, met or not, by its own name',
		note: 'the game never shows anyone that'
	},
	{
		key: 'unknownStars',
		group: 'Maps',
		kind: 'normal',
		label: 'Show the undiscovered systems too, without their hyperlanes',
		note: 'the game shows every star from the start'
	},
	{
		key: 'wormholeLinks',
		group: 'Maps',
		kind: 'normal',
		label: 'Show where explored wormholes lead (both ends visited)',
		note: 'only once Wormhole Stabilization is researched: exploring a wormhole needs it'
	},
	{
		key: 'wormholePairs',
		group: 'Maps',
		kind: 'spoiler',
		intel: true,
		label: 'Show every wormhole pair and its connection, explored or not'
	},
	{
		key: 'lgates',
		group: 'Maps',
		kind: 'spoiler',
		intel: true,
		label: 'Show every L-Gate, the L-Cluster and all their connections',
		note: 'until the gates open the L-Cluster does not exist yet: shown where it is predicted to spawn'
	},
	{
		key: 'wanderlustAll',
		group: 'Maps',
		kind: 'spoiler',
		label: 'Every Wanderlust target, not only the systems you have visited',
		note: 'the save flags them all; the game names none',
		tags: 'nomads'
	},
	{
		key: 'wholeGalaxy',
		group: 'Maps',
		kind: 'spoiler',
		intel: true,
		label: 'Every system with its name and hyperlanes (maps and megastructure sites)'
	},
	{
		key: 'contactStations',
		group: 'Maps',
		kind: 'spoiler',
		intel: true,
		label: 'Colour visited systems by their station’s owner, named, before communications',
		note: 'the save knows them before you have communications',
		tags: 'first contact borders'
	},
	{
		key: 'surveyAll',
		group: 'Expansion',
		kind: 'spoiler',
		intel: true,
		label:
			'Treat every system as fully surveyed: bodies, deposits, anomalies, expansion and habitat sites'
	},
	{
		key: 'habitatsAlways',
		group: 'Expansion',
		kind: 'cheat',
		label: 'Show habitat sites even before habitats can be built'
	},
	{
		key: 'showLocked',
		group: 'Government and ethics',
		kind: 'normal',
		label: 'Show locked agendas, edicts and policies too',
		note: 'the game lists only what you can pick'
	},
	{
		key: 'factionTypes',
		group: 'Government and ethics',
		kind: 'cheat',
		label: 'Faction types of your ethics, with their demands, before any has formed'
	},
	{
		key: 'allFactionTypes',
		group: 'Government and ethics',
		kind: 'cheat',
		label: 'Also the faction types of ethics you do not hold'
	},
	{
		key: 'anomalySpoilers',
		group: 'Frontier',
		kind: 'spoiler',
		label: 'Show what an anomaly can lead to'
	},
	{
		key: 'projectSpoilers',
		group: 'Frontier',
		kind: 'spoiler',
		label: 'Show what a special project leads to'
	},
	{
		key: 'digSiteSpoilers',
		group: 'Frontier',
		kind: 'spoiler',
		label: 'Show what a dig site’s chapters give'
	},
	{
		key: 'precursorsAll',
		group: 'Frontier',
		// the user's ask 2026-11-20; which precursors a galaxy has is the game's secret until found
		kind: 'cheat',
		intel: true,
		label:
			'Precursors: everything the save holds — which this galaxy has, their systems, every empire’s artifacts',
		note: 'the game reveals a precursor only once you find its first artifact'
	},
	{
		key: 'precursorBadges',
		group: 'Frontier',
		// the user's ask 2026-11-20: one badge, the precursor named beside it
		kind: 'spoiler',
		label:
			'Precursors: a badge on anomalies, projects and dig sites that lead to a precursor, and which',
		note: 'the game tells only once the event names it'
	},
	{
		key: 'hiddenTimers',
		group: 'Frontier',
		kind: 'spoiler',
		label: 'Upcoming: show the timers of events in progress (when an event chain continues)',
		tags: 'events'
	},
	{
		key: 'diplomacyAll',
		group: 'Diplomacy and trade',
		kind: 'spoiler',
		intel: true,
		label: 'Diplomacy: every empire and every relation between them, beyond what your intel shows',
		note: 'the game shows what your intel on each empire reveals; more intel reveals the rest'
	},
	{
		key: 'pactIntel',
		group: 'Diplomacy and trade',
		kind: 'spoiler',
		intel: true,
		label: 'Pacts: what your intel shows of each research partner — its techs per area',
		note: 'the game shows them on the empire’s intel screen, not what a pact comes to',
		tags: 'research agreement commercial pact intel'
	},
	{
		key: 'pactAdvice',
		group: 'Diplomacy and trade',
		kind: 'spoiler',
		intel: true,
		label:
			'Pacts: whom to offer a research agreement or commercial pact, ranked by what it brings, and who would accept',
		note: 'the game shows the acceptance only when you propose, and no intel level lists another empire’s techs',
		tags: 'research agreement commercial pact recommendation acceptance'
	},
	{
		key: 'subjectNumbers',
		group: 'Diplomacy and trade',
		// a spoiler since 2026-11-17 (the user's ask): another empire's numbers, off where cheats are
		kind: 'spoiler',
		intel: true,
		label:
			'Subjects: each subject’s military, economy and tech power, fleet, size and pops as numbers',
		note: 'the game compares them only as Inferior, Equivalent or Superior',
		tags: 'subject vassal overlord power'
	},
	{
		key: 'pactAll',
		group: 'Diplomacy and trade',
		kind: 'cheat',
		label: 'Pacts: which techs each research partner has, and which tech to pick',
		note: 'no intel level lists another empire’s techs',
		tags: 'research agreement commercial pact tech hints'
	},
	{
		key: 'contractSpoilers',
		group: 'Diplomacy and trade',
		kind: 'spoiler',
		intel: true,
		label:
			'Contracts: as a nomad the offers of empires you do not talk to, as a settled empire others’ contracts near your border',
		note: 'the range beyond the border is picked on the contracts tab',
		tags: 'nomad nomads contract arkship'
	},
	{
		key: 'contractsAll',
		group: 'Diplomacy and trade',
		kind: 'cheat',
		label: 'Contracts: every contract in the galaxy, offered or taken, whoever issued it',
		tags: 'nomad nomads contract arkship'
	},
	{
		key: 'highwayFriends',
		group: 'Diplomacy and trade',
		kind: 'spoiler',
		intel: true,
		label:
			'Ancient Highway (mod): what your friends know of the ring and how far they are with their gates',
		note: 'friends as the mod counts them: federation, overlord or subject, defensive pact, guarantee, the same side of a war',
		tags: 'highway ring portal gate mod friends'
	},
	{
		key: 'highwayAll',
		group: 'Diplomacy and trade',
		kind: 'cheat',
		label:
			'Ancient Highway (mod): what every other empire knows of the ring, every portal and gate, the whole ring on the maps',
		tags: 'highway ring portal gate mod'
	},
	{
		key: 'tradeIntel',
		group: 'Diplomacy and trade',
		// split from the stockpiles 2026-11-18 (the user's ask): the rates are a spoiler
		kind: 'spoiler',
		intel: true,
		label: 'Trade: what other empires would trade, at what rate, and what a gift buys them',
		note: 'the game shows it only as the acceptance of a deal you put together; estimated until calibrated (docs/trade-calibration.md)',
		tags: 'gift opinion price market'
	},
	{
		key: 'tradeStockpiles',
		group: 'Diplomacy and trade',
		kind: 'cheat',
		label: 'Trade: other empires’ stockpiles and income — what they spare, take and need',
		note: 'the game never shows them'
	},
	{
		key: 'specimenTrade',
		group: 'Diplomacy and trade',
		// the user's ask 2026-11-21: the trade screen lists them per empire, not side by side
		kind: 'spoiler',
		intel: true,
		label:
			'Trade: the specimens each empire you talk to would trade you, ≈ for how much, and which of yours they want most',
		note: 'the game lists them one empire at a time in its trade screen and shows no price before you propose',
		tags: 'specimen specimens grand archive exhibit'
	},
	{
		key: 'specimenTradeAll',
		group: 'Diplomacy and trade',
		kind: 'cheat',
		intel: true,
		label: 'Trade: every specimen, also those they would not trade now, and why',
		note: 'the game lists only what can be traded now',
		tags: 'specimen specimens grand archive'
	},
	{
		key: 'archiveOthers',
		group: 'Diplomacy and trade',
		kind: 'cheat',
		intel: true,
		label: 'Archive: another empire’s Grand Archive — its exhibitions and what they give',
		note: 'the game never shows another empire’s collection; unmet empires stay unnamed',
		tags: 'specimen specimens grand archive exhibit'
	},
	{
		key: 'ideologiesAll',
		group: 'Government and ethics',
		kind: 'cheat',
		intel: true,
		label:
			'Ideologies: every ideology in the galaxy — founder, custodian, adopters, tenets — and each adopter’s strength',
		note: 'the game lists only the ideologies you have intel on; unmet empires stay unnamed',
		tags: 'ideology tenets strength willpower'
	},
	{
		key: 'ambitionsRevealed',
		group: 'Government and ethics',
		kind: 'spoiler',
		intel: true,
		label: 'Ambitions: the ambitions of empires you talk to, once their personality gives it away',
		note: 'the game only shows the personality ("Crisis Aspirant", "Thermarchy", "Utopian Missionaries") on their diplomacy screen',
		tags: 'ambition crisis nemesis hyperthermia force of will personality'
	},
	{
		key: 'ambitionsAll',
		group: 'Government and ethics',
		kind: 'cheat',
		intel: true,
		label: 'Ambitions: every empire’s ambition from the day it takes the perk, with its level',
		note: 'the game never shows another empire’s ambition level; unmet empires stay unnamed',
		tags: 'ambition crisis nemesis hyperthermia force of will behemoth cosmogenesis defender'
	},
	{
		key: 'whatIfs',
		group: 'What-ifs',
		kind: 'spoiler',
		label:
			'What-ifs: ≈ what an edict, a policy, a designation, a planet decision, a Living Standard, a tradition, an ascension perk or a tech on offer would do if taken now, and its net in trade',
		note: 'the game shows a choice’s modifiers, not what they come to; Distribute Luxury Goods’ estimate is one of them',
		tags: 'estimate edicts policies designation decisions luxury goods living standards traditions perks techs upkeep trade value'
	}
];

/** Whether a switch is barred where cheats are (multiplayer, Ironman): the cheats and `intel`. */
export const barred = (s: Switch) => s.kind === 'cheat' || s.intel === true;

/**
 * The switches as the tabs read them: spoilers off while spoilers are hidden, cheats likewise, and
 * in a game without cheats (`noCheats`: multiplayer, Ironman) the cheats and `intel` spoilers always.
 */
export function effectiveDisplay(d: Display, noCheats = false): Display {
	const out = { ...d, showCheats: d.showCheats && !noCheats };
	for (const s of SWITCHES)
		if (
			(s.kind === 'spoiler' && !out.showSpoilers) ||
			(s.kind === 'cheat' && !out.showCheats) ||
			(noCheats && barred(s))
		)
			out[s.key] = false;
	return out;
}

/** Whether a switch is listed: its kind shown, not barred, and every word of `query` in its text. */
export function listed(
	s: Switch,
	d: Pick<Display, 'showSpoilers' | 'showCheats'>,
	query: string,
	noCheats = false
) {
	if (noCheats && barred(s)) return false;
	if (s.kind === 'spoiler' && !d.showSpoilers) return false;
	if (s.kind === 'cheat' && !d.showCheats) return false;
	const text = [s.label, s.note, s.group, s.tags, s.key, s.kind === 'normal' ? '' : s.kind]
		.join(' ')
		.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((w) => text.includes(w));
}

/** Whether a stored display has any switch of `kind` on (a profile from before the gates). */
export const anyOn = (d: Partial<Display>, kind: SwitchKind) =>
	SWITCHES.some((s) => s.kind === kind && d[s.key] === true);
