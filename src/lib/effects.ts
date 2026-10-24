import type { Modifier } from './types.ts';

// The empire's choices (ethics → authority → civics → origin) summed per modifier, for the
// Government panel. Adapted from the planner's `collectEffects` (stellaris-empire-planner
// `src/lib/effects.ts`), which lists them per source; here equal modifiers are added up and keep
// where each part comes from, and what kind of thing that is. Only the flat `modifier` blocks — triggered and scripted effects
// are in the choices' own texts. The Shroud's "Add Attunement" (on every civic) is left out.

/** What kind of thing a part comes from — shown as a badge (`SourceBadge.svelte`). */
export type EffectKind =
	| 'origin'
	| 'civic'
	| 'ethic'
	| 'gestalt'
	| 'authority'
	| 'species'
	| 'tradition'
	| 'perk'
	| 'edict'
	| 'policy'
	| 'resolution'
	| 'event'
	| 'agenda'
	| 'situation'
	| 'tech';
export type EffectSource = { name: string; modifiers: Modifier[]; kind?: EffectKind };
export type EffectPart = { name: string; value: number; kind?: EffectKind };
export type EffectTotal = { mod: Modifier; sources: EffectPart[] };

export function totalEffects(sources: EffectSource[]): EffectTotal[] {
	const byKey = new Map<string, EffectTotal>();
	for (const s of sources)
		for (const m of s.modifiers) {
			if (m.key.includes('attunement')) continue;
			const t = byKey.get(m.key) ?? { mod: { ...m, value: 0 }, sources: [] };
			t.mod.value += m.value;
			t.sources.push({ name: s.name, value: m.value, ...(s.kind ? { kind: s.kind } : {}) });
			byKey.set(m.key, t);
		}
	return [...byKey.values()];
}
