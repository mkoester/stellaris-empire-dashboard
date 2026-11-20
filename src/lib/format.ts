// Display helpers shared by pages.

export const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/**
 * Game key → readable text: `district_city` → `city`, `d_decrepit_dwellings` → `decrepit
 * dwellings`, `sr_dark_matter` → `dark matter`.
 */
export const pretty = (key: string) =>
	key.replace(/^(col|district|building|d|sr)_/, '').replaceAll('_', ' ');

/** A first contact's stage by its number alone (`cutholoids_stage_1` → 1): the key names the
 * contact's kind and the stage's way, both spoilers (the user's ask, 2026-11-17). Null for a
 * stage without one (`default_end_stage_cautious`). */
export const contactStage = (stage: string): number | null => {
	const m = /_stage_(\d+)$/.exec(stage);
	return m ? Number(m[1]) : null;
};

/** A game key by its display name when the data has one, else readable. */
export const nameOf = (names: Record<string, string>, key: string) => names[key] ?? pretty(key);
