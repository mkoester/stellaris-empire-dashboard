import type { ArchiveHolding, Exhibit } from '#lib/types.ts';
import type { RawSave } from '../save.ts';
import { timedFlags } from './country.ts';
import { isYes, items, type Raw, strOrNull } from './values.ts';

/** The flag the game sets on an empire that traded specimens (defines: SPECIMEN_TRADE, 3600 days). */
export const SPECIMEN_TRADE_FLAG = 'has_already_traded_specimens';

const MULT_VARS: Record<string, string> = {
	aesthetic_wonder: 'sdash_sp_aw',
	historical_item: 'sdash_sp_hi',
	xeno_geology: 'sdash_sp_xg'
};

/**
 * Each exhibition's multiplier, value:<category>_specimens_modifiers_mult = 1 + its category's
 * produces_mult + specimens_produces_mult, from companion mod 0.15.0's variables; null without them.
 */
export function archiveMults(variables: Raw): Record<string, number> | null {
	const general = variables?.sdash_sp;
	if (typeof general !== 'number') return null;
	return Object.fromEntries(
		Object.entries(MULT_VARS).map(([cat, v]) => [
			cat,
			1 + general + (typeof variables[v] === 'number' ? (variables[v] as number) : 0)
		])
	);
}

/**
 * Every empire's Grand Archive collection (docs/save-format.md, "Grand Archive"): the top-level
 * `exhibits` database (`id → { exhibit_state, activated, specimen = { specimen origin date_added
 * exhibition_date }, owner }`) and each country's
 * `modules.standard_grand_archive_module.exhibits.<category> = { ids }`, its exhibitions. An
 * exhibit an empire holds that no exhibition lists is in storage (the save's own storage key is
 * not known yet: docs/open-points.md). Galaxy-wide: `pageLatest()` keeps ours only.
 */
export function archives(
	raw: Pick<RawSave, 'exhibits' | 'countryBlocks' | 'date'>
): ArchiveHolding[] {
	const byOwner = new Map<number, Exhibit[]>();
	for (const [id, e] of Object.entries(raw.exhibits ?? {})) {
		const specimen = strOrNull(e?.specimen?.specimen);
		if (!specimen || typeof e?.owner !== 'number') continue;
		const list = byOwner.get(e.owner) ?? [];
		list.push({
			id: Number(id),
			specimen,
			category: null,
			unlocked: e.exhibit_state === 'unlocked',
			active: isYes(e.activated),
			added: strOrNull(e.specimen.date_added),
			exhibited: strOrNull(e.specimen.exhibition_date)
		});
		byOwner.set(e.owner, list);
	}
	const out: ArchiveHolding[] = [];
	for (const [id, c] of Object.entries(raw.countryBlocks ?? {})) {
		if (!c || typeof c !== 'object') continue;
		const held = byOwner.get(Number(id)) ?? [];
		const lists = (c.modules?.standard_grand_archive_module?.exhibits ?? {}) as Record<string, Raw>;
		const categoryOf = new Map<number, string>(
			Object.entries(lists).flatMap(([cat, ids]) => items(ids).map((x) => [Number(x), cat]))
		);
		const tradeUntil =
			timedFlags(c.flags, raw.date).find((f) => f.key === SPECIMEN_TRADE_FLAG)?.until ?? null;
		if (!held.length && !tradeUntil) continue;
		const placed = held.map((e) => ({ ...e, category: categoryOf.get(e.id) ?? null }));
		out.push({
			countryId: Number(id),
			exhibits: placed.filter((e) => e.category !== null),
			storage: placed.filter((e) => e.category === null),
			tradeUntil,
			mults: archiveMults(c.variables)
		});
	}
	return out;
}
