// The display switches of ⚙, grouped as a browser's settings are, each marked as a spoiler (what
// the game hides) or a cheat (what it never tells a player) where it is one. Hiding spoilers or
// cheats also turns them off — `effectiveDisplay()` — while their stored values stay, so showing
// them again brings each back as it was. A multiplayer or Ironman game turns the cheats off whatever is
// stored, and the spoilers marked `intel` too — they reveal other empires or space not explored.
import type { Display } from './profiles.ts';

export type SwitchKey = Exclude<
	keyof Display,
	'colonyRowLine' | 'expansionRowLine' | 'slaveMarket' | 'showSpoilers' | 'showCheats'
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
	'Situations',
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
		key: 'historyAll',
		group: 'Tabs',
		kind: 'cheat',
		label: 'History: every empire’s systems, colonies and wars, whatever you know of them',
		note: 'the tab shows your own history, that of empires you talk to, and what you saw yourself'
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
		label: 'Show where explored wormholes lead (both ends visited)'
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
		group: 'Situations',
		kind: 'spoiler',
		label: 'Show what an anomaly can lead to'
	},
	{
		key: 'projectSpoilers',
		group: 'Situations',
		kind: 'spoiler',
		label: 'Show what a special project leads to'
	},
	{
		key: 'hiddenTimers',
		group: 'Situations',
		kind: 'spoiler',
		label: 'Upcoming: show the timers of events in progress (when an event chain continues)',
		tags: 'events'
	},
	{
		key: 'diplomacyAll',
		group: 'Diplomacy and trade',
		kind: 'cheat',
		label: 'Diplomacy: every empire and every relation between them, whatever our intel shows',
		note: 'the game shows what your intel on each empire reveals'
	},
	{
		key: 'pactIntel',
		group: 'Diplomacy and trade',
		kind: 'spoiler',
		intel: true,
		label:
			'Pacts: what your intel shows of each partner — its techs per area, its trade at high intel',
		note: 'the game shows them on the empire’s intel screen, not what a pact comes to',
		tags: 'research agreement commercial pact intel'
	},
	{
		key: 'pactAll',
		group: 'Diplomacy and trade',
		kind: 'cheat',
		label:
			'Pacts: which techs each research partner has, what each commercial pact brings, and which tech to pick',
		note: 'no intel level lists another empire’s techs',
		tags: 'research agreement commercial pact tech hints'
	},
	{
		key: 'tradeIntel',
		group: 'Diplomacy and trade',
		kind: 'cheat',
		label: 'Trade: other empires’ stockpiles and income, and what they would trade at what rate',
		note: 'the game shows neither; estimated until calibrated (docs/trade-calibration.md)'
	},
	{
		key: 'whatIfs',
		group: 'What-ifs',
		kind: 'spoiler',
		label:
			'What-ifs: ≈ what an edict, a policy, a designation or a planet decision would do if taken now',
		note: 'the game shows a choice’s modifiers, not what they come to; Distribute Luxury Goods’ estimate is one of them',
		tags: 'estimate edicts policies designation decisions luxury goods'
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
