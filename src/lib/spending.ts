import { pretty } from './format.ts';
import type { LogEvent, Resources, Snapshot, SpendLogKind } from './types.ts';

// One-off spending the budget does not book, named — pure. Two sources:
// - save diffs between consecutive snapshots that both have the field: construction items we pay
//   for (cost exact), edicts newly active (cost from the data DB, before multipliers), constructor
//   build orders (station cost from the data DB, where known), leaders hired (cost unknown);
// - the companion mod's spending events (0.3.0), exactly dated but naming only the kind and place.
// A mod event dates the save-diff item it matches (same kind and place, at most a save apart);
// the others stand alone, without a cost.

/** A named one-off payment; `cost` null when the game does not say (only the event is known). */
export type Spend = { date: string; label: string; cost: Resources | null; approx: boolean };

export type SpendData = {
	names: Record<string, string>; // district, building, zone … keys → names
	edicts: Record<string, { name: string; cost: Record<string, Resources> }>;
	shipCosts: Record<string, Resources>; // ship size → cost (station builds); empty when unknown
};

const nameOf = (data: SpendData, key: string) => data.names[key] ?? pretty(key);

/** Pairs of consecutive snapshots that both have `field`. */
function pairs<T>(history: Snapshot[], field: (s: Snapshot) => T | null) {
	const known = history.filter((s) => field(s) !== null);
	return known.slice(1).map((s, i) => ({ before: field(known[i])!, after: field(s)!, s }));
}

type Diffed = Spend & { match?: { kind: SpendLogKind; where: string | null } };

function diffed(history: Snapshot[], data: SpendData): Diffed[] {
	const construction = pairs(history, (s) => s.construction).flatMap(({ before, after, s }) => {
		const seen = new Set(before.map((c) => c.id));
		return after
			.filter((c) => !seen.has(c.id))
			.map((c) => ({
				date: s.date,
				label: `${c.design ?? nameOf(data, c.name)}${c.where ? ` (${c.where})` : ''}`,
				cost: c.cost,
				approx: false,
				...(c.kind === 'district' || c.kind === 'building'
					? { match: { kind: `${c.kind}-queued` as SpendLogKind, where: c.where } }
					: {})
			}));
	});
	const edicts = pairs(history, (s) => s.edicts).flatMap(({ before, after, s }) =>
		after
			.filter((k) => !before.includes(k))
			.map((k) => ({
				date: s.date,
				label: `edict: ${data.edicts[k]?.name ?? pretty(k)}`,
				cost: data.edicts[k]?.cost.cost ?? null,
				approx: true, // before the empire's multipliers
				match: { kind: 'edict' as const, where: null }
			}))
	);
	// A station is paid when its order starts, not when queued (2207.04.02: three queued at
	// Barnard's Star, 100 minerals gone), so only current orders count.
	const orders = (ships: NonNullable<Snapshot['civilianShips']>) =>
		ships.flatMap(({ fleetId, order: o }) =>
			o?.kind === 'build_orbital_station' && o.size
				? [{ id: `${fleetId}:${o.orderId}`, size: o.size, target: o.target }]
				: []
		);
	const stations = pairs(history, (s) => s.civilianShips).flatMap(({ before, after, s }) => {
		const seen = new Set(orders(before).map((o) => o.id));
		return orders(after)
			.filter((o) => !seen.has(o.id))
			.map((o) => ({
				date: s.date,
				label: `${pretty(o.size)}${o.target ? ` (${o.target})` : ''}`,
				cost: data.shipCosts[o.size] ?? null,
				approx: true // before cost modifiers
			}));
	});
	const leaders = pairs(history, (s) => s.leaderRoster).flatMap(({ before, after, s }) => {
		const seen = new Set(before.map((l) => l.id));
		return after
			.filter((l) => !seen.has(l.id))
			.map((l) => ({
				date: s.date,
				label: `${l.class} hired: ${l.name}`,
				cost: null,
				approx: false,
				match: { kind: 'leader-hired' as const, where: l.name }
			}));
	});
	return [...construction, ...edicts, ...stations, ...leaders];
}

const LOG_LABELS: Record<SpendLogKind, string> = {
	'district-queued': 'district queued',
	'district-unqueued': 'district cancelled (refund)',
	'building-queued': 'building queued',
	'building-unqueued': 'building cancelled (refund)',
	edict: 'edict activated',
	decision: 'decision enacted',
	'leader-hired': 'leader hired',
	'colonization-started': 'colonization started',
	'megastructure-started': 'megastructure started'
};

const isSpend = (e: LogEvent): e is LogEvent & { kind: SpendLogKind } => e.kind in LOG_LABELS;

/** All named one-off spending along `history`, oldest first. */
export function namedSpending(history: Snapshot[], data: SpendData): Spend[] {
	const fromSaves = diffed(history, data);
	const taken = new Set<Diffed>();
	const logged = history
		.flatMap((s) => s.logEvents ?? [])
		.filter(isSpend)
		.flatMap((e): Spend[] => {
			const where = e.fields[0] ?? null;
			// the save showing the item is the first one after the event (a save that day may predate it)
			const same = fromSaves.find(
				(d) =>
					!taken.has(d) &&
					d.match?.kind === e.kind &&
					(d.match.where === null || d.match.where === where) &&
					d.date >= e.date &&
					!history.some((s) => s.kind === 'save' && s.date > e.date && s.date < d.date)
			);
			if (same) {
				taken.add(same);
				return [{ ...same, date: e.date }];
			}
			return [
				{
					date: e.date,
					label: `${LOG_LABELS[e.kind]}${where ? ` (${where})` : ''}`,
					cost: null,
					approx: false
				}
			];
		});
	return [...fromSaves.filter((d) => !taken.has(d)), ...logged]
		.map(({ date, label, cost, approx }) => ({ date, label, cost, approx }))
		.sort((a, b) => a.date.localeCompare(b.date));
}
