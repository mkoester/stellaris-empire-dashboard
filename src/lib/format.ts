// Display helpers shared by pages.

export const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/**
 * Game key → readable text: `district_city` → `city`, `d_decrepit_dwellings` → `decrepit
 * dwellings`, `sr_dark_matter` → `dark matter`.
 */
export const pretty = (key: string) =>
	key.replace(/^(col|district|building|d|sr)_/, '').replaceAll('_', ' ');

/** A game key by its display name when the data has one, else readable. */
export const nameOf = (names: Record<string, string>, key: string) => names[key] ?? pretty(key);
