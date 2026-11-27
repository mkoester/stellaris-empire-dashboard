import type { AmbitionRow, Ideology, IdeologyReading, IdeologyStand } from '#lib/types.ts';
import type { RawSave } from '../save.ts';
import { displayName, isYes, items, list, numOrNull, type Raw, strOrNull } from './values.ts';

const entries = (v: Raw): [string, Raw][] =>
	v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v) : [];

/**
 * Every ideology and every empire's stand (docs/save-format.md, "Ideologies"): the top-level
 * `ideologies.ideologies` and `tenets` databases, and each country's
 * `modules.standard_ideology_module`. Galaxy-wide: `pageLatest()` keeps ours and the known.
 */
export function ideologies(
	raw: Pick<RawSave, 'ideologies' | 'tenets' | 'countryBlocks' | 'galaxy'>
): IdeologyReading {
	const tenetDb = new Map(
		entries(raw.tenets).map(([id, t]) => [
			Number(id),
			{ key: String(t?.type), tier: Number(t?.tier) }
		])
	);
	const list_: Ideology[] = entries(raw.ideologies).map(([id, i]) => ({
		id: Number(id),
		type: String(i?.type ?? ''),
		name: displayName(i?.name),
		founder: numOrNull(i?.origin),
		custodian: numOrNull(i?.custodian),
		adopters: list(i?.adopting_countries),
		tenets: items(i?.tenet_info)
			.map((t) => tenetDb.get(Number(t?.tenet)))
			.filter((t): t is { key: string; tier: number } => !!t)
			.sort((a, b) => a.tier - b.tier),
		offered: items(i?.pending_tenets)
			.map((p) => items(p?.tenets).map(String))
			.filter((t) => t.length > 0),
		systems: list(i?.affected_systems).length
	}));
	const stands: IdeologyStand[] = [];
	for (const [id, c] of entries(raw.countryBlocks)) {
		const m = c?.modules?.standard_ideology_module;
		if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
		const intel = Object.fromEntries(entries(m.intel).map(([k, v]) => [k, Number(v?.intel ?? 0)]));
		if (m.adopted_ideology === undefined && !Object.keys(intel).length) continue;
		const momenta = items(m.past_monthly_strength_momenta);
		stands.push({
			countryId: Number(id),
			adopted: numOrNull(m.adopted_ideology),
			strength: Number(m.value ?? 0),
			level: Number(m.index ?? 0),
			momentum: momenta.length ? Number(momenta.at(-1)) : null,
			pendingLevels: Number(m.pending_levels ?? 0),
			intel
		});
	}
	return { enabled: isYes(raw.galaxy?.ideologies_enabled), ideologies: list_, stands };
}

/**
 * Every empire's ambition: `country.<id>.crisis_progression = { path level }` (docs/save-format.md,
 * "Ambitions"), with its personality, which is what the game reveals of it. Galaxy-wide.
 * From level 2 the save repeats `level` for every level reached, in order: the last is the current.
 */
export function ambitions(raw: Pick<RawSave, 'countryBlocks'>): AmbitionRow[] {
	return entries(raw.countryBlocks).flatMap(([id, c]) => {
		const path = strOrNull(c?.crisis_progression?.path);
		return path
			? [
					{
						countryId: Number(id),
						path,
						level: strOrNull([c.crisis_progression.level].flat().at(-1)),
						personality: strOrNull(c.personality)
					}
				]
			: [];
	});
}
