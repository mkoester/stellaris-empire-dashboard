// Display helpers shared by pages.

export const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/**
 * Game key → readable text: `district_city` → `city`, `d_decrepit_dwellings` → `decrepit
 * dwellings`, `sr_dark_matter` → `dark matter`.
 */
export const pretty = (key: string) =>
	key.replace(/^(col|district|building|d|sr)_/, '').replaceAll('_', ' ');
