// Display helpers shared by pages.

export const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/**
 * Game key → readable text: `district_city` → `city`, `d_decrepit_dwellings` → `decrepit
 * dwellings`, `sr_dark_matter` → `dark matter`.
 */
export const pretty = (key: string) =>
	key.replace(/^(col|district|building|d|sr)_/, '').replaceAll('_', ' ');

/** A first contact's stage by its number alone, as the game counts it: every chain starts at
 * `base_contact_set` (stage 1, `FIRST_CONTACT_FIRST_STAGE`), so `<type>_stage_<n>` is stage n + 1
 * (Gimel `default_stage_2` = "Stage 3", Gamma `default_stage_1` = "Stage 2", 2228.04.09). The key
 * names the contact's kind and the stage's way, both spoilers (the user's ask, 2026-11-17). Null
 * for a stage without a number (`default_end_stage_cautious`). */
export const contactStage = (stage: string): number | null => {
	const m = /_stage_(\d+)$/.exec(stage);
	return m ? Number(m[1]) + 1 : null;
};

/** A game key by its display name when the data has one, else readable. */
export const nameOf = (names: Record<string, string>, key: string) => names[key] ?? pretty(key);
