import { gameYear } from './series.ts';
import type { CountryModifier } from './types.ts';

/** Expiring ones first, soonest on top; then the permanent ones, by name. */
export function byExpiry<T extends CountryModifier & { name: string }>(mods: T[]): T[] {
	return [...mods].sort(
		(a, b) =>
			(a.until === null ? 1 : 0) - (b.until === null ? 1 : 0) ||
			(a.until ?? '').localeCompare(b.until ?? '') ||
			a.name.localeCompare(b.name)
	);
}

/** Time from `now` to `until` in years and months: "3 y 2 m", "5 m", "< 1 m". */
export function timeLeft(now: string, until: string): string {
	const months = Math.floor((gameYear(until) - gameYear(now)) * 12 + 1e-9);
	if (months < 1) return '< 1 m';
	const y = Math.floor(months / 12);
	const m = months % 12;
	return [y ? `${y} y` : '', m ? `${m} m` : ''].filter(Boolean).join(' ');
}
