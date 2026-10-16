import { gameYear } from './series.ts';
import type { MigrationColony, Snapshot } from './types.ts';

// Migration between colonies — the empire's own and foreign ones (via migration treaties). The
// save has per-colony totals only, no source→destination pairs. Pairs are exact when there is one
// sender or one receiver; otherwise each sender's emigrants are split over the receivers in
// proportion to their immigration, and flagged as estimated.

export type Flow = { from: MigrationColony; to: MigrationColony; pops: number; estimated: boolean };

export function flows(rows: MigrationColony[]): Flow[] {
	const senders = rows.filter((r) => r.emigration > 0);
	const receivers = rows.filter((r) => r.immigration > 0);
	const arriving = receivers.reduce((n, r) => n + r.immigration, 0);
	if (!senders.length || !arriving) return [];
	const estimated = senders.length > 1 && receivers.length > 1;
	return senders.flatMap((from) =>
		receivers
			.filter((to) => to.colonyId !== from.colonyId)
			.map((to) => ({
				from,
				to,
				pops: Math.round(((from.emigration * to.immigration) / arriving) * 10) / 10,
				estimated
			}))
	);
}

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

/** One month's migration rows, for stepping through time. */
export type Frame = { date: string; rows: MigrationColony[] };

/**
 * The months with migration data, oldest first. Snapshots from before the migration field are
 * rebuilt from their colonies' growth; their positions come from the newest snapshot that has
 * the colony (a planet does not move).
 */
export function migrationFrames(history: Snapshot[]): Frame[] {
	const positions = new Map<number, MigrationColony>();
	for (const s of history) for (const r of s.migration ?? []) positions.set(r.planetId, r);
	return history.flatMap((s) => {
		if (s.migration) return [{ date: s.date, rows: s.migration }];
		const own = s.colonies.filter((c) => c.growth);
		if (!own.length) return [];
		return [
			{
				date: s.date,
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
						emigration: 0 - (c.growth!.by.emigration ?? 0)
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
