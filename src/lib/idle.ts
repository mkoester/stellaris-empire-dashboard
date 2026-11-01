import type { Upcoming } from './events.ts';
import { LEADER_CLASSES, leaderLimits } from './leaders.ts';
import { idleState, shipLabel } from './ships.ts';
import type { GameData, Snapshot } from './types.ts';

// What sits idle — the user's ask 2026-10-31: "prevent anything being idle unless I decide it
// should be idle right now". Each idle thing is a row that stays until it is busy again or the
// player dismisses it (✕). Dismissing hides this idle spell only: the id ends with the date of the
// first save of the spell (walked back along the branch's saves), so the same thing idling again
// later is a new row. Pure.

const FIELDS = ['physics', 'society', 'engineering'] as const;

type Idle = Pick<Upcoming, 'what' | 'sub' | 'detail' | 'tint' | 'ref' | 'planetId'> & {
	fleetId?: number;
};

type IdleSave = Pick<
	Snapshot,
	| 'date'
	| 'progress'
	| 'colonies'
	| 'stations'
	| 'idleLeaders'
	| 'council'
	| 'leaders'
	| 'traditions'
	| 'ascensionPerks'
	| 'edicts'
	| 'policies'
	| 'government'
	| 'origin'
	| 'countryModifiers'
	| 'civilianShips'
>;

/** Everything idle in one save, by id (`<scope>:idle:<what>`). */
export function idleIn(s: IdleSave, leaderCap?: GameData['leaderCap']): Map<string, Idle> {
	const out = new Map<string, Idle>();
	const p = s.progress;
	if (p) {
		for (const f of FIELDS)
			if (!p.research.some((r) => r.area === f))
				out.set(`country:idle:research:${f}`, {
					what: `No ${f} research`,
					sub: 'research',
					detail: `${f} · nothing being researched`,
					tint: `${f}_research`
				});
		if (!p.agenda)
			out.set('country:idle:agenda', {
				what: 'No council agenda in preparation',
				sub: 'agenda',
				detail: 'council',
				tint: 'agenda'
			});
	}
	for (const c of s.colonies)
		if (!c.colonizing && c.buildQueue.length === 0)
			out.set(`planet:${c.planetId}:idle:build`, {
				what: `Nothing being built on ${c.name}`,
				sub: 'construction',
				detail: c.name,
				tint: 'construction',
				planetId: c.planetId
			});
	for (const st of s.stations ?? [])
		if (st.shipyard && st.shipyard.queue.length === 0)
			out.set(`country:idle:shipyard:${st.id}`, {
				what: `Shipyard ${st.arkship ? 'of the arkship' : `at ${st.system}`} idle`,
				sub: 'shipyard',
				detail: st.system || (st.arkship ? 'arkship' : 'starbase'),
				tint: 'ship'
			});
	for (const l of s.idleLeaders ?? [])
		out.set(`country:idle:leader:${l.id}`, {
			what: `${l.name} without a post`,
			sub: 'leader',
			detail: l.class,
			tint: 'election'
		});
	for (const seat of s.council ?? [])
		if (seat.leaderId === null)
			out.set(`country:idle:council:${seat.type}`, {
				what: `Council seat empty`,
				sub: 'council',
				detail: seat.type.replace(/^councilor_/, '').replaceAll('_', ' '),
				tint: 'election'
			});
	if (leaderCap && s.leaders) {
		const limits = leaderLimits(s as Snapshot, leaderCap);
		for (const cls of LEADER_CLASSES) {
			const free = limits[cls] - (s.leaders[cls] ?? 0);
			if (free > 0)
				out.set(`country:idle:leaders:${cls}`, {
					what: `${free} ${cls} slot${free === 1 ? '' : 's'} free`,
					sub: 'leader',
					detail: `${s.leaders[cls] ?? 0} / ${limits[cls]} ${cls}s (≈ limit)`,
					tint: 'election'
				});
		}
	}
	for (const ship of s.civilianShips ?? [])
		if (!ship.order && !ship.automation && idleState(ship).act)
			out.set(`country:idle:ship:${ship.fleetId}`, {
				what: idleState(ship).text,
				sub: shipLabel(ship),
				detail: ship.name,
				tint: 'ship',
				fleetId: ship.fleetId
			});
	return out;
}

/**
 * The idle rows of the latest save, each since the first save of its idle spell, without those
 * dismissed. Idle civilian ships already have their row (`upcoming()`): for them `ships` maps the
 * fleet to its dismiss id, or null when dismissed.
 */
export function idles(
	saves: IdleSave[],
	leaderCap?: GameData['leaderCap'],
	dismissed: ReadonlySet<string> = new Set()
): { rows: Upcoming[]; ships: Map<number, string | null> } {
	const latest = saves.at(-1);
	const rows: Upcoming[] = [];
	const ships = new Map<number, string | null>();
	if (!latest) return { rows, ships };
	const each = saves.map((s) => idleIn(s, leaderCap));
	for (const [id, v] of each.at(-1)!) {
		let first = saves.length - 1;
		while (first > 0 && each[first - 1].has(id)) first--;
		const since = saves[first].date;
		const dismiss = `${id}:${since}`;
		if (v.fleetId !== undefined) {
			ships.set(v.fleetId, dismissed.has(dismiss) ? null : dismiss);
			continue;
		}
		if (dismissed.has(dismiss)) continue;
		rows.push({
			date: since,
			months: 0,
			kind: 'idle',
			what: v.what,
			sub: v.sub,
			detail: `${v.detail} · since ${since}`,
			tint: v.tint,
			ref: v.ref,
			planetId: v.planetId,
			exact: true,
			act: true,
			dismiss
		});
	}
	return { rows, ships };
}

/** The upcoming rows with idle ships made dismissable, and those dismissed left out. */
export const withIdleShips = (rows: Upcoming[], ships: Map<number, string | null>): Upcoming[] =>
	rows.flatMap((e) => {
		if (e.kind !== 'ship' || e.fleetId === undefined || !ships.has(e.fleetId)) return [e];
		const id = ships.get(e.fleetId);
		return id ? [{ ...e, dismiss: id }] : [];
	});
