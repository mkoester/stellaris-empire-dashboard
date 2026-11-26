// What the enabled mods add that the data DB (the game's own files) cannot know: their texts and
// their techs. Pure; `server/mods.ts` reads the files.
import type { GameData } from './types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/** `@name = 1000` lines of a script file (scripted variables, or a file's own). */
export function scriptedVariables(text: string): Record<string, number> {
	const out: Record<string, number> = {};
	for (const m of text.matchAll(/^\s*@(\w+)\s*=\s*(-?[\d.]+)/gm)) out[m[1]] = Number(m[2]);
	return out;
}

const num = (v: unknown, vars: Record<string, number>): number | null => {
	if (typeof v === 'number') return v;
	const s = String(v ?? '');
	if (s.startsWith('@')) return vars[s.slice(1)] ?? null;
	return s && !Number.isNaN(Number(s)) ? Number(s) : null;
};

/**
 * Techs from a parsed `common/technology/*.txt` (jomini, key → definition), as `GameData.techs`
 * holds them: the name from the mods' texts (else the key), the base cost with `@variables`
 * resolved (`cost = { factor = … }` reads its factor, as the extractor does).
 */
export function modTechs(
	defs: Record<string, Raw>,
	vars: Record<string, number>,
	text: Record<string, string>
): GameData['techs'] {
	const out: GameData['techs'] = {};
	for (const [key, d] of Object.entries(defs)) {
		if (key.startsWith('@') || !d || typeof d !== 'object' || !d.area) continue;
		const category = Array.isArray(d.category) ? d.category[0] : d.category;
		out[key] = {
			name: text[key] ?? key,
			cost: num(typeof d.cost === 'object' ? d.cost?.factor : d.cost, vars),
			area: String(d.area),
			tier: num(d.tier, vars),
			category: category ? String(category) : null,
			rare: d.is_rare === true || d.is_rare === 'yes'
		};
	}
	return out;
}

/**
 * The game data with the mods' additions: their texts (`modText`, for names the data DB lacks)
 * and techs the data DB does not have. The data DB's own entries always win.
 */
export function withModContent(
	data: GameData,
	mods: { text: Record<string, string>; techs: GameData['techs'] }
): GameData {
	return {
		...data,
		modText: mods.text,
		techs: { ...mods.techs, ...data.techs }
	};
}

/** A key's name: the data DB's (`known`), else a mod's text, else the fallback. */
export const modName = (
	data: Pick<GameData, 'modText'>,
	key: string,
	known?: string | null,
	fallback: (k: string) => string = (k) => k
): string => known ?? data.modText?.[key] ?? fallback(key);
