import { addGameDays } from './series.ts';
import type { Storm } from './types.ts';

// The storms map mode, after the game's Weather Forecast map mode (4.5.4 `storm_map_mode`): every
// storm where it is; with storm movement intel (Cosmic Weather Models, `tech_storm_prediction_1`:
// `country_storm_movement_intel_add`) also the systems ahead on its path, with when it reaches each.
// Pure.

export const STORM_FORECAST_TECHS = ['tech_storm_prediction_1', 'tech_storm_prediction_2'];

/** Whether our techs give storm movement intel. */
export const canForecast = (researched: readonly string[]) =>
	STORM_FORECAST_TECHS.some((t) => researched.includes(t));

/** The storms as our intel shows them: without movement intel, no path (it stays on the server). */
export const stormsSeen = (storms: Storm[], forecast: boolean): Storm[] =>
	forecast ? storms : storms.map((s) => ({ ...s, path: [] }));

/** Days until a storm reaches each system on its path: the save's days to the next, then each leg's
 * straight-line distance at its speed (2226.08.01: 43.3 units at 0.02 a day = 2165 days; the save
 * said 2163). Systems without a position, and those after them, are left out. */
export function stormArrivals(
	s: Pick<Storm, 'path' | 'daysToNext' | 'speed'>,
	at: (id: number) => { x: number; y: number } | undefined
): { systemId: number; days: number }[] {
	if (s.daysToNext === null || !s.path.length) return [];
	const out = [{ systemId: s.path[0], days: s.daysToNext }];
	if (!s.speed) return out;
	for (let i = 1; i < s.path.length; i++) {
		const a = at(s.path[i - 1]);
		const b = at(s.path[i]);
		if (!a || !b) break;
		out.push({
			systemId: s.path[i],
			days: out[i - 1].days + Math.hypot(b.x - a.x, b.y - a.y) / s.speed
		});
	}
	return out;
}

export const STORM_COLOR: Record<string, string> = {
	magnetic_storm: '#c26ec0',
	particle_storm: '#e0312f',
	gravity_storm: '#2b7bd6',
	electric_storm: '#e0a400'
};
const OTHER = '#7c7c7c';
const AHEAD = '66'; // the alpha of a system the storm has yet to reach

/** The game's name for a storm type: `particle_storm` → "Particle Storm" (its localisation). */
export const stormType = (type: string) =>
	type
		.split('_')
		.map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`)
		.join(' ');

// the game's year: 12 months of 30 days (`addGameDays`)
const years = (days: number) =>
	days < 360 ? `${Math.round(days / 30)} months` : `${(days / 360).toFixed(1)} years`;

/** The storms mode: each covered system filled in its storm's colour, each one ahead (with
 * movement intel) in a lighter one, with hover text. A system covered now is not marked ahead. */
export function stormFill(
	storms: Storm[],
	at: (id: number) => { x: number; y: number } | undefined,
	date: string
): { fill: Record<number, string>; titles: Record<number, string> } {
	const fill: Record<number, string> = {};
	const titles: Record<number, string> = {};
	const note = (id: number, text: string) =>
		(titles[id] = titles[id] ? `${titles[id]}; ${text}` : text);
	const kind = (s: Storm) => `${s.name} (${stormType(s.type)})`;
	for (const s of storms)
		for (const id of s.systems) {
			fill[id] = STORM_COLOR[s.type] ?? OTHER;
			note(id, `${kind(s)} is here${s.affectsUs ? ', over us' : ''}`);
		}
	for (const s of storms)
		for (const a of stormArrivals(s, at)) {
			if (s.systems.includes(a.systemId)) continue;
			fill[a.systemId] ??= `${STORM_COLOR[s.type] ?? OTHER}${AHEAD}`;
			note(
				a.systemId,
				`${kind(s)} ≈ ${addGameDays(date, Math.round(a.days))} (in ≈ ${years(a.days)})`
			);
		}
	return { fill, titles };
}
