// Which tabs have nothing to show yet along a branch: their names are dimmed in the tab bar, the
// title saying why. Still links — the page explains itself.
import { PACT_TYPES } from './pacts.ts';
import type { Snapshot } from './types.ts';

type Fields = Pick<
	Snapshot,
	| 'migration'
	| 'tradeDeals'
	| 'galcom'
	| 'shroud'
	| 'relations'
	| 'subjects'
	| 'external'
	| 'branchSites'
	| 'situations'
	| 'firstContacts'
	| 'anomalies'
	| 'specialProjects'
	| 'digSites'
	| 'slaveMarket'
	| 'traditions'
>;

/**
 * Each check: the tab, why it is empty, whether one snapshot holds its data, and whether that
 * snapshot was read by a reader that knows the field at all (null: an older reader). A tab whose
 * field no snapshot knows is never dimmed — unknown is not empty.
 */
const CHECKS: {
	tab: string;
	why: string;
	known: (s: Fields) => boolean;
	has: (s: Fields) => boolean;
}[] = [
	{
		tab: 'traditions',
		why: 'no tradition tree adopted yet',
		known: (s) => s.traditions !== null && s.traditions !== undefined,
		has: (s) => (s.traditions ?? []).length > 0
	},
	{
		tab: 'slave market',
		why: 'nothing has been offered on the Slave Market yet',
		known: (s) => s.slaveMarket !== null && s.slaveMarket !== undefined,
		has: (s) => (s.slaveMarket ?? []).length > 0
	},
	{
		tab: 'migration',
		why: 'no pop has migrated into, out of or within your empire yet',
		known: (s) => s.migration !== null && s.migration !== undefined,
		has: (s) => (s.migration ?? []).some((r) => r.own && (r.immigration || r.emigration))
	},
	{
		tab: 'trade deals',
		why: 'no trade deal yet',
		known: (s) => s.tradeDeals !== null && s.tradeDeals !== undefined,
		has: (s) => (s.tradeDeals ?? []).length > 0
	},
	{
		tab: 'galcom',
		why: 'the Galactic Community has not formed yet',
		// null both before it forms and from an older reader: the relations field tells them apart
		known: (s) => s.relations !== null && s.relations !== undefined,
		has: (s) => !!s.galcom
	},
	{
		tab: 'shroud',
		why: 'the Shroud not breached yet: no patron met',
		known: (s) => s.relations !== null && s.relations !== undefined,
		// every empire has the module and an attunement from the start: data only once it has met a
		// patron (its first delve) — the tab shows no more than a point at (0, 0) before
		has: (s) => (s.shroud?.patrons ?? []).some((p) => p.contact !== 'none')
	},
	{
		tab: 'diplomacy',
		why: 'no contact with another empire yet',
		known: (s) => s.relations !== null && s.relations !== undefined,
		has: (s) => (s.relations ?? []).some((r) => r.contact)
	},
	{
		tab: 'pacts',
		why: 'no pact with another empire yet',
		known: (s) => s.relations !== null && s.relations !== undefined,
		has: (s) =>
			(s.relations ?? []).some((r) => PACT_TYPES.some((t) => r.agreements.includes(t.key)))
	},
	{
		tab: 'subjects',
		why: 'no subject agreement, branch office or holding yet',
		known: (s) => s.external !== null && s.external !== undefined,
		has: (s) => (s.subjects ?? []).length > 0 || (s.external ?? []).length > 0 || !!s.branchSites
	},
	{
		tab: 'situations',
		why: 'no situation, first contact, anomaly, special project or dig site yet',
		known: (s) => s.situations !== null && s.situations !== undefined,
		has: (s) =>
			[s.situations, s.firstContacts, s.anomalies, s.specialProjects, s.digSites].some(
				(l) => (l ?? []).length > 0
			)
	}
];

/** Tab name → why it has nothing to show yet, for the tabs that have not along `history`. */
export function emptyTabs(history: Fields[]): Record<string, string> {
	return Object.fromEntries(
		CHECKS.filter((c) => history.some(c.known) && !history.some(c.has)).map((c) => [c.tab, c.why])
	);
}
