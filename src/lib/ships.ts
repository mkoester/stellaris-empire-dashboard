import { pretty } from './format.ts';
import type { CivilianShip, Route, ShipOrder, Snapshot } from './types.ts';

// What civilian ships are doing and when they are done. The save stores an order's progress, not
// its total; the totals, checked against completed orders over five game years (UNE 3, 2202–2207):
// - survey_planet counts to 30 (BASE_SURVEY_TIME, days; bonuses speed the progress) — never
//   above 29.7 before completion;
// - build_orbital_station counts to 100 for outposts, mining and research stations alike — last
//   seen 73–99, never above;
// - research_anomaly counts to the SCIENCE_SHIP_ANOMALY_RESEARCH_DAYS entry for the scientist's
//   level against the anomaly's (anomaly_category level): level 2 on a level-3 anomaly → 180, last
//   seen 176.4 a month before completion.
// The rate is measured between the two latest saves for the same order, so speed bonuses count.

// Ship sizes by their in-game names (localisation, 4.5.3: main_1_l_english.yml `science`,
// `constructor`, `colonizer`, stations; nomads_1_l_english.yml:2023/2043 the nomads' two). A
// Logistic Ship shares `shipclass_constructor` with the Construction Ship, so only its design's
// size tells them apart.
const SIZE_NAMES: Record<string, string> = {
	science: 'Science Ship',
	constructor: 'Construction Ship',
	colonizer: 'Colony Ship',
	nomads_constructor: 'Logistic Ship',
	nomads_engineer_vessel: 'Logistics Vessel',
	mining_station: 'Mining Station',
	research_station: 'Research Station',
	starbase_outpost: 'Outpost'
};
// a fleet's class (`shipclass_` stripped), for ships read before their size was
const CLASS_NAMES: Record<string, string> = {
	science_ship: 'Science Ship',
	constructor: 'Construction Ship',
	colonizer: 'Colony Ship'
};

/** A ship's name as the game shows its size; else its class's, else the key made readable. */
export function shipName(size: string | null | undefined, kind?: string): string {
	if (size && SIZE_NAMES[size]) return SIZE_NAMES[size];
	if (kind && CLASS_NAMES[kind]) return CLASS_NAMES[kind];
	return pretty(size || kind || 'ship');
}

/** A civilian ship's kind as the game names it. */
export const shipLabel = (s: Pick<CivilianShip, 'size' | 'kind'>) => shipName(s.size, s.kind);

const SURVEY_DAYS = 30;
const BUILD_TOTAL = 100;
// SCIENCE_SHIP_ANOMALY_RESEARCH_DAYS (common/defines, 4.5.2): 9 levels above the anomaly … 9 below
const ANOMALY_DAYS = [
	20, 24, 30, 35, 45, 55, 65, 80, 100, 120, 180, 300, 540, 720, 1080, 1440, 2160, 2880, 5760
];

/** What an order counts up to; `levels` are anomaly category levels from the game data. */
export function orderTotal(
	o: ShipOrder,
	ship: Pick<CivilianShip, 'leaderLevel'>,
	levels: Record<string, number | null>
): number | null {
	if (o.kind === 'survey_planet') return SURVEY_DAYS;
	if (o.kind === 'build_orbital_station') return BUILD_TOTAL;
	if (o.kind === 'research_anomaly') {
		const anomaly = o.anomaly ? levels[o.anomaly] : null;
		if (anomaly == null || ship.leaderLevel === null) return null;
		const i = 9 + anomaly - ship.leaderLevel; // equal levels sit in the middle
		return ANOMALY_DAYS[Math.min(Math.max(i, 0), ANOMALY_DAYS.length - 1)];
	}
	return null;
}

export function orderLabel(o: ShipOrder): string {
	const what =
		o.kind === 'research_anomaly'
			? 'anomaly'
			: o.kind === 'survey_planet'
				? 'survey'
				: o.kind === 'build_orbital_station'
					? `build ${pretty(o.size ?? 'station')}`
					: o.kind === 'orbit_planet'
						? 'travel to'
						: pretty(o.kind);
	// the system only where the target's name does not already say it (asteroids: "GR- QW1")
	const where = o.system && !o.target?.startsWith(o.system) ? ` in ${o.system}` : '';
	return o.target ? `${what} ${o.target}${where}` : what;
}

/** Progress per month for the ship's current order, from the save before (same order id). */
export function orderRate(ship: CivilianShip, previous: Snapshot | null, monthsElapsed: number) {
	const before = previous?.civilianShips?.find((s) => s.fleetId === ship.fleetId)?.order;
	const now = ship.order;
	if (!now || now.progress === null || !before || before.orderId !== now.orderId) return null;
	if (before.progress === null || monthsElapsed <= 0) return null;
	return (now.progress - before.progress) / monthsElapsed;
}

/** Months until the current order is done: total − progress at the rate (travel: unknown). */
export function monthsLeft(
	ship: CivilianShip,
	rate: number | null,
	levels: Record<string, number | null>
) {
	const o = ship.order;
	if (!o) return 0;
	const total = orderTotal(o, ship, levels);
	if (total === null || o.progress === null || !(rate && rate > 0)) return null;
	return Math.max(total - o.progress, 0) / rate;
}

/**
 * What an idle ship means. A colony ship either waits at its target on purpose (the system is not
 * the country's yet), can colonize now (the system became the country's), or sits about with
 * nothing to do. `act`: the player has to step in — the game does not say so.
 */
export function idleState(ship: CivilianShip): { text: string; act: boolean } {
	const p = ship.parked;
	const kind = shipLabel(ship);
	// automation picks its next task itself
	if (ship.automation) return { text: `${kind} automated, between tasks`, act: false };
	if (!p) return { text: `${kind} idle`, act: true };
	if (ship.kind === 'colonizer' && p.planet && p.planetFree)
		return p.systemOwned
			? { text: `colonize ${p.planet} — ${p.system} is yours now`, act: true }
			: { text: `waiting at ${p.planet} — ${p.system} not yours yet`, act: false };
	return { text: `${kind} idle at ${p.system}`, act: true };
}

/**
 * Days a jump until the throwaway-game calibration (docs/open-checks.md) — a placeholder: the
 * save stores no arrival dates and the sublight leg within a system varies.
 */
export const DEFAULT_DAYS_PER_JUMP = 10;

/**
 * Days per jump from two readings of one route to the same last stop: the jumps it made since.
 * Null where it did not move closer (or turned elsewhere).
 */
export function daysPerJump(now: Route, before: Route | undefined, days: number): number | null {
	const a = before?.stops.at(-1);
	const b = now.stops.at(-1);
	if (!a || !b || a.system !== b.system || a.jumps === null || b.jumps === null || !(days > 0))
		return null;
	const made = a.jumps - b.jumps;
	return made > 0 ? days / made : null;
}

/** The median days per jump of every ship and fleet measurable between two saves. */
export function measuredDaysPerJump(
	latest: Pick<Snapshot, 'civilianShips' | 'fleets'>,
	previous: Pick<Snapshot, 'civilianShips' | 'fleets'> | null,
	days: number
): number | null {
	if (!previous) return null;
	const pairs = [
		...(latest.civilianShips ?? []).map((s) => [
			s.route,
			previous.civilianShips?.find((p) => p.fleetId === s.fleetId)?.route
		]),
		...(latest.fleets ?? []).map((f) => [
			f.route,
			f.fleetId === undefined
				? undefined
				: previous.fleets?.find((p) => p.fleetId === f.fleetId)?.route
		])
	] as [Route, Route | undefined][];
	const rates = pairs
		.map(([now, before]) => daysPerJump(now, before, days))
		.filter((r): r is number => r !== null)
		.sort((a, b) => a - b);
	return rates.length ? rates[Math.floor(rates.length / 2)] : null;
}

/**
 * ≈ Months until a ship's order is done where the save gives no rate: what the order still needs
 * at the base rate (one a day — surveys and builds count days), else the travel to its last stop.
 */
export function estimateMonthsLeft(
	ship: CivilianShip,
	levels: Record<string, number | null>,
	perJump: number
): number | null {
	const o = ship.order;
	if (!o) return 0;
	const total = orderTotal(o, ship, levels);
	if (total !== null && o.progress !== null) return Math.max(total - o.progress, 0) / 30;
	const jumps = ship.route.stops.at(-1)?.jumps;
	return jumps === null || jumps === undefined ? null : (jumps * perJump) / 30;
}
