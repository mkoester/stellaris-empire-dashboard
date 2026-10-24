import type { GameData, Resources } from './types.ts';

// Storage per resource. The game does not save it: companion mod 0.5.0 exports it exactly
// (`sdash_m_<res>`); without the mod it is estimated as the resource's base (`max` in
// strategic_resources), which silos, Mega-Engineering, the Galactic Market and the rest raise —
// docs/storage.md lists every source.

export type StorageRow = {
	resource: string;
	name: string;
	have: number;
	max: number;
	exact: boolean;
};

/** Each resource with storage the empire holds: its stockpile against its maximum. */
export function storageRows(
	stockpile: Resources,
	exact: Resources | null,
	info: GameData['resourceInfo']
): StorageRow[] {
	return Object.entries(info)
		.filter(([r, i]) => i.max !== null && i.max > 0 && r in stockpile)
		.map(([r, i]) => ({
			resource: r,
			name: i.name,
			have: stockpile[r],
			max: exact?.[r] ?? i.max!,
			exact: exact?.[r] !== undefined
		}));
}

/**
 * Months until the stockpile is full (net > 0) or empty (net < 0) at this month's net change; 0
 * when already there; null when it does not move.
 */
export function monthsLeft(have: number, max: number, net: number): number | null {
	if (net > 0) return Math.max(0, (max - have) / net);
	if (net < 0) return Math.max(0, have / -net);
	return null;
}

// grey from two years on, amber at 8 months, red at 3 or less (log scale between)
const CALM = 24;
const WARN = 8;
const ALARM = 3;
const GREY = [107, 114, 128]; // tailwind gray-500
const AMBER = [217, 119, 6]; // amber-600
const RED = [220, 38, 38]; // red-600

/** How far `months` has come from `from` towards `to` months, on a log scale, 0…1. */
const towards = (months: number, from: number, to: number) =>
	Math.min(1, Math.max(0, Math.log(from / Math.max(months, to)) / Math.log(from / to)));

/** The colour of a month count: grey when far off, through amber to red the nearer it is. */
export function urgencyColor(months: number): string {
	const [from, to, u] =
		months > WARN
			? [GREY, AMBER, towards(months, CALM, WARN)]
			: [AMBER, RED, towards(months, WARN, ALARM)];
	return `rgb(${from.map((c, i) => Math.round(c + (to[i] - c) * u)).join(', ')})`;
}
