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
