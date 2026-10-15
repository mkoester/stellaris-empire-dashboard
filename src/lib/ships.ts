import { pretty } from './format.ts';
import type { CivilianShip, ShipOrder, Snapshot } from './types.ts';

// What civilian ships are doing and when they are done. The save stores an order's progress, not
// its total; the totals below are read off the game:
// - research_anomaly counts to 100 (percent): +1.2/day matched the 80-day "2 levels above" row of
//   SCIENCE_SHIP_ANOMALY_RESEARCH_DAYS (2202.02–05, UNE 3);
// - survey_planet is taken to count to 100 as well (unconfirmed);
// - build_orbital_station counts days (+1/day) to the ship size's base_buildtime
//   (common/ship_sizes, 4.5.2).
// The rate is measured between the two latest saves for the same order, so speed bonuses count.

const BUILD_DAYS: Record<string, number> = {
	starbase_outpost: 360,
	mining_station: 720,
	research_station: 720
};

export function orderTotal(o: ShipOrder): number | null {
	if (o.kind === 'research_anomaly' || o.kind === 'survey_planet') return 100;
	if (o.kind === 'build_orbital_station') return BUILD_DAYS[o.size ?? ''] ?? null;
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
	return o.target ? `${what} ${o.target}` : what;
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
export function monthsLeft(ship: CivilianShip, rate: number | null) {
	const o = ship.order;
	if (!o) return 0;
	const total = orderTotal(o);
	if (total === null || o.progress === null || !(rate && rate > 0)) return null;
	return Math.max(total - o.progress, 0) / rate;
}
