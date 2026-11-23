import { fmt } from './format.ts';
import { gameYear } from './series.ts';
import type { Arkship, LogEvent, MigrationColony, Snapshot } from './types.ts';

// Migration between colonies — the empire's own and foreign ones (via migration treaties) — and
// resettlement among our own. The save has per-colony totals only, no source→destination pairs.
// Pairs are exact when there is one sender or one receiver; otherwise each sender's pops are split
// over the receivers in proportion to what they took in, and flagged as estimated. The companion
// mod (0.16.0) logs each resettlement's pair: a month with such lines has exact resettle flows.

export type FlowKind = 'migration' | 'resettle';
export type Flow = {
	from: MigrationColony;
	to: MigrationColony;
	pops: number;
	estimated: boolean;
	kind: FlowKind;
};

/** Senders' outflow split over receivers by their share of the inflow. */
function pairUp(
	senders: [MigrationColony, number][],
	receivers: [MigrationColony, number][],
	kind: FlowKind
): Flow[] {
	const arriving = receivers.reduce((n, [, v]) => n + v, 0);
	if (!senders.length || !arriving) return [];
	const estimated = senders.length > 1 && receivers.length > 1;
	return senders.flatMap(([from, out]) =>
		receivers
			.filter(([to]) => to.colonyId !== from.colonyId)
			.map(([to, v]) => ({
				from,
				to,
				pops: Math.round(((out * v) / arriving) * 10) / 10,
				estimated,
				kind
			}))
	);
}

/** Automatic migration: emigrants to immigrants. */
export function flows(rows: MigrationColony[]): Flow[] {
	return pairUp(
		rows.filter((r) => r.emigration > 0).map((r) => [r, r.emigration]),
		rows.filter((r) => r.immigration > 0).map((r) => [r, r.immigration]),
		'migration'
	);
}

/** A resettlement the mod logged: colony names, pops, species. */
export type Move = { from: string; to: string; pops: number; species: string };

/**
 * Resettlement among our colonies: from the mod's lines of the month when there are any (exact;
 * a colony named in a line but not among the rows is left out), else from the save's signed
 * totals (`resettled`: negative where pops left).
 */
export function resettleFlows(rows: MigrationColony[], moves: Move[] | null = null): Flow[] {
	const own = rows.filter((r) => r.own);
	if (moves?.length) {
		const byName = new Map(own.map((r) => [r.name, r]));
		const pairs = new Map<string, Flow>();
		for (const m of moves) {
			const [from, to] = [byName.get(m.from), byName.get(m.to)];
			if (!from || !to || from === to) continue;
			const k = `${from.colonyId}>${to.colonyId}`;
			const f = pairs.get(k) ?? { from, to, pops: 0, estimated: false, kind: 'resettle' as const };
			pairs.set(k, { ...f, pops: f.pops + m.pops });
		}
		return [...pairs.values()];
	}
	return pairUp(
		own.filter((r) => (r.resettled ?? 0) < 0).map((r) => [r, -(r.resettled ?? 0)]),
		own.filter((r) => (r.resettled ?? 0) > 0).map((r) => [r, r.resettled ?? 0]),
		'resettle'
	);
}

/** "YYYY.MM" of the month before a date's: what a save's last-month figures cover. */
export function monthBefore(date: string): string {
	const [y, m] = date.split('.').map(Number);
	const n = y * 12 + (m - 1) - 1;
	return `${Math.floor(n / 12)}.${String((n % 12) + 1).padStart(2, '0')}`;
}

/** The mod's resettlement lines along the branch, each once, by the month they fell in. */
export function movesByMonth(history: Pick<Snapshot, 'logEvents'>[]): Map<string, Move[]> {
	const seen = new Set<string>();
	const out = new Map<string, Move[]>();
	for (const e of history.flatMap((s) => s.logEvents ?? []))
		if (e.kind === 'resettled') {
			const key = [e.date, ...e.fields].join('|');
			if (seen.has(key)) continue;
			seen.add(key);
			const [from, to, pops, species] = (e as LogEvent).fields;
			const month = e.date.slice(0, 7);
			out.set(month, [...(out.get(month) ?? []), { from, to, pops: Number(pops) || 0, species }]);
		}
	return out;
}

// resettlement's own colour (the palette's slot 7): always among our own colonies
export const RESETTLE_COLOR = '#6250d6';
/** A flow's colour key — its sender's empire, or resettlement — and its colour. */
export const flowKey = (f: Flow) => (f.kind === 'resettle' ? 'resettle' : String(f.from.ownerId));
export const flowColor = (f: Flow, colors: Record<number, string>) =>
	f.kind === 'resettle' ? RESETTLE_COLOR : colors[f.from.ownerId];
/** The flows' colour keys, each once, with their colours (for arrowheads). */
export const flowPaints = (fs: Flow[], colors: Record<number, string>) => [
	...new Map(fs.map((f) => [flowKey(f), flowColor(f, colors)])).entries()
];
export const flowTitle = (f: Flow) =>
	`${f.from.name} → ${f.to.name}: ${fmt(f.pops)} pops/month${f.kind === 'resettle' ? ' resettled' : ''}${f.estimated ? ' (estimated)' : ''}`;

// Colours by owner: the categorical palette's first three slots validate for every pair, so the
// own empire takes slot 1 and up to two foreign empires slots 2–3; more fold into "other".
// (Reference palette of the dataviz skill, light mode.)
export const CATEGORICAL = [
	'#2a78d6',
	'#eb6834',
	'#1baf7a',
	'#eda100',
	'#e87ba4',
	'#008300',
	'#6250d6',
	'#e34948'
];
export const OTHER = '#8a8984';

export function ownerColors(rows: MigrationColony[]): Record<number, string> {
	const foreign = [...new Set(rows.filter((r) => !r.own).map((r) => r.ownerId))];
	return Object.fromEntries([
		...rows.filter((r) => r.own).map((r) => [r.ownerId, CATEGORICAL[0]]),
		...foreign.map((id, i) => [id, i < 2 ? CATEGORICAL[i + 1] : OTHER])
	]);
}

/**
 * One month's migration rows, for stepping through time; `moves` the mod's resettlement lines of
 * the month the rows cover (null: none logged — no mod, or no resettlement).
 */
export type Frame = { date: string; rows: MigrationColony[]; moves: Move[] | null };

/** Our colonies' resettlement last month by planet (signed), from their growth causes. */
const resettledBy = (s: Snapshot) =>
	new Map(s.colonies.map((c) => [c.planetId, c.growth?.by.resettle ?? 0]));

/**
 * The months with migration data, oldest first. Snapshots from before the migration field are
 * rebuilt from their colonies' growth; their positions come from the newest snapshot that has
 * the colony (a planet does not move).
 */
export function migrationFrames(history: Snapshot[]): Frame[] {
	const positions = new Map<number, MigrationColony>();
	for (const s of history) for (const r of s.migration ?? []) positions.set(r.planetId, r);
	const moves = movesByMonth(history);
	return history.flatMap((s) => {
		const resettled = resettledBy(s);
		const at = { date: s.date, moves: moves.get(monthBefore(s.date)) ?? null };
		if (s.migration)
			return [
				{
					...at,
					rows: s.migration.map((r) => ({
						...r,
						resettled: r.own ? (resettled.get(r.planetId) ?? 0) : 0
					}))
				}
			];
		const own = s.colonies.filter((c) => c.growth);
		if (!own.length) return [];
		return [
			{
				...at,
				rows: own.map((c) => {
					const at = positions.get(c.planetId);
					return {
						colonyId: at?.colonyId ?? -c.planetId,
						planetId: c.planetId,
						name: c.name,
						ownerId: at?.ownerId ?? -1,
						owner: s.empireName,
						own: true,
						system: at?.system ?? '',
						x: at?.x ?? 0,
						y: at?.y ?? 0,
						immigration: c.growth!.by.immigration ?? 0,
						emigration: 0 - (c.growth!.by.emigration ?? 0),
						resettled: c.growth!.by.resettle ?? 0
					};
				})
			}
		];
	});
}

export type ColonySeries = {
	key: string;
	name: string;
	owner: string;
	own: boolean;
	immigration: (number | null)[];
	emigration: (number | null)[];
};

/**
 * Per colony and snapshot: immigration and emigration (null where the snapshot has no data).
 * Snapshots from before the migration field fall back to the own colonies' `growth`.
 */
export function migrationHistory(history: Snapshot[]): { x: number[]; colonies: ColonySeries[] } {
	const rowsOf = (s: Snapshot): MigrationColony[] | null =>
		s.migration ??
		(s.colonies.some((c) => c.growth)
			? s.colonies.map((c) => ({
					colonyId: -1,
					planetId: c.planetId,
					name: c.name,
					ownerId: -1,
					owner: s.empireName,
					own: true,
					system: '',
					x: 0,
					y: 0,
					immigration: c.growth?.by.immigration ?? 0,
					emigration: 0 - (c.growth?.by.emigration ?? 0)
				}))
			: null);
	const perSnapshot = history.map(rowsOf);
	const byKey = new Map<string, ColonySeries>();
	perSnapshot.forEach((rows, i) => {
		for (const r of rows ?? []) {
			if (!r.immigration && !r.emigration) continue;
			const key = `${r.own ? 'own' : r.ownerId}:${r.planetId}`;
			if (!byKey.has(key))
				byKey.set(key, {
					key,
					name: r.name,
					owner: r.owner,
					own: r.own,
					immigration: history.map(() => null),
					emigration: history.map(() => null)
				});
			const c = byKey.get(key)!;
			c.immigration[i] = r.immigration;
			c.emigration[i] = r.emigration;
		}
	});
	// a snapshot with data but none for a colony means 0 there, not unknown
	for (const c of byKey.values())
		perSnapshot.forEach((rows, i) => {
			if (rows && c.immigration[i] === null) {
				c.immigration[i] = 0;
				c.emigration[i] = 0;
			}
		});
	return { x: history.map((s) => gameYear(s.date)), colonies: [...byKey.values()] };
}

/**
 * The migration map's view, per profile: the galaxy map or our arkships on a circle, and the
 * circle's order — clockwise from 12 o'clock: oldest first, the biggest first, or by name.
 */
export type ArkshipOrder = 'age' | 'size' | 'name';
export const ARKSHIP_ORDERS: ArkshipOrder[] = ['age', 'size', 'name'];
export type MigrationView = { layout: 'map' | 'circle'; order: ArkshipOrder };
export const DEFAULT_MIGRATION_VIEW: MigrationView = { layout: 'map', order: 'age' };
export function parseMigrationView(v: unknown): MigrationView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<MigrationView>;
	return {
		layout: o.layout === 'circle' ? 'circle' : 'map',
		order: ARKSHIP_ORDERS.includes(o.order as ArkshipOrder) ? (o.order as ArkshipOrder) : 'age'
	};
}

/**
 * When each arkship (by ship id) was first seen along the branch: the date of the first snapshot
 * listing it. The save's `construction_date` is no age — every arkship of a 2200 start reads
 * 2200.01.01, later ones too (Roaming Korinth 2207.02.01).
 */
export function arkshipFirstSeen(snaps: Pick<Snapshot, 'date' | 'arkships'>[]) {
	const seen: Record<number, string> = {};
	for (const s of snaps) for (const a of s.arkships ?? []) seen[a.shipId] ??= s.date;
	return seen;
}

/**
 * Our arkships in the circle's order: by age (first seen, then ship id — ids grow with each new
 * ship), by size (tier, then planet size, the biggest first) or by name.
 */
export function arkshipOrder(
	arks: Arkship[],
	order: ArkshipOrder,
	firstSeen: Record<number, string> = {}
): Arkship[] {
	const byName = (a: Arkship, b: Arkship) => a.name.localeCompare(b.name);
	const byAge = (a: Arkship, b: Arkship) =>
		(firstSeen[a.shipId] ?? '\uffff').localeCompare(firstSeen[b.shipId] ?? '\uffff') ||
		a.shipId - b.shipId;
	const cmp =
		order === 'name'
			? (a: Arkship, b: Arkship) => byName(a, b) || a.shipId - b.shipId
			: order === 'size'
				? (a: Arkship, b: Arkship) => b.tier - a.tier || b.planetSize - a.planetSize || byName(a, b)
				: byAge;
	return [...arks].sort(cmp);
}
