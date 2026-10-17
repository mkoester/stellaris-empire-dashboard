import { DatabaseSync } from 'node:sqlite';
import type { CapEffect, GameData } from '#lib/types.ts';

// Names and base costs from stellaris-data-extraction's SQLite (STELLARIS_DATA_DB), read once at
// start. It must match the game version being played — regenerate it after a game update.

export function loadGameData(file: string): GameData {
	const db = new DatabaseSync(file, { readOnly: true });
	try {
		const rows = <T>(sql: string) => db.prepare(sql).all() as T[];
		return {
			techs: Object.fromEntries(
				rows<{
					key: string;
					label: string | null;
					cost: number | null;
					area: string;
					tier: number | null;
				}>('SELECT key, label, cost, area, tier FROM technology').map((r) => [
					r.key,
					{ name: r.label ?? r.key, cost: r.cost, area: r.area, tier: r.tier }
				])
			),
			agendas: Object.fromEntries(
				rows<{ key: string; name: string | null; cost: number | null }>(
					'SELECT key, name, cost FROM council_agenda'
				).map((r) => [r.key, { name: r.name ?? r.key, cost: r.cost }])
			),
			jobs: Object.fromEntries(
				rows<{ key: string; name: string | null; category: string | null }>(
					'SELECT key, name, category FROM job'
				).map((r) => [r.key, { name: r.name ?? r.key, category: r.category }])
			),
			edicts: Object.fromEntries(
				rows<{ key: string; name: string | null }>('SELECT key, name FROM edict').map((r) => [
					r.key,
					{ name: r.name ?? r.key }
				])
			),
			traits: Object.fromEntries(
				rows<{ key: string; cost: number | null }>('SELECT key, cost FROM trait').map((r) => [
					r.key,
					{ cost: r.cost }
				])
			),
			speciesClasses: Object.fromEntries(
				rows<{ key: string; label: string | null; archetype: string | null }>(
					'SELECT key, label, archetype FROM species_class'
				).map((r) => [r.key, { name: r.label ?? r.key, archetype: r.archetype }])
			),
			archetypes: Object.fromEntries(
				rows<{ key: string; trait_points: number | null; max_traits: number | null }>(
					'SELECT key, trait_points, max_traits FROM species_archetype'
				).map((r) => [r.key, { points: r.trait_points ?? 0, maxTraits: r.max_traits ?? 0 }])
			),
			planetClasses: Object.fromEntries(
				rows<{ key: string; name: string | null; colonizable: number }>(
					'SELECT key, name, colonizable FROM planet_class'
				).map((r) => [r.key, { name: r.name ?? r.key, colonizable: r.colonizable === 1 }])
			),
			// Blockers are named "Blocker Sprawling Slums" in the data; the game shows "Sprawling Slums".
			names: Object.fromEntries(
				rows<{ key: string; name: string }>(
					`SELECT key, name FROM building WHERE name IS NOT NULL
					 UNION ALL SELECT key, name FROM deposit WHERE name IS NOT NULL
					 UNION ALL SELECT key, name FROM district WHERE name IS NOT NULL
					 UNION ALL SELECT key, name FROM zone WHERE name IS NOT NULL`
				).map((r) => [r.key, r.name.replace(/^Blocker /, '')])
			),
			capEffects: capEffects(
				rows<{ owner: string; key: string; value: number }>(
					`SELECT 'deposit:' || deposit_key AS owner, modifier_key AS key, modifier_value AS value FROM deposit_modifier
					 UNION ALL SELECT 'modifier:' || static_key, modifier_key, modifier_value FROM static_modifier_modifier
					 UNION ALL SELECT 'building:' || building_key, modifier_key, value FROM building_modifier
					   WHERE scope = 'planet' AND condition IS NULL`
				)
			),
			blockers: rows<{ key: string }>('SELECT key FROM deposit WHERE is_blocker = 1').map(
				(r) => r.key
			),
			traditionTrees: traditionTrees(
				rows<{ key: string; name: string | null }>('SELECT key, name FROM tradition_category'),
				rows<{ key: string; name: string | null; category_key: string; role: string }>(
					'SELECT key, name, category_key, role FROM tradition ORDER BY sort_order'
				)
			),
			perks: Object.fromEntries(
				rows<{ key: string; name: string | null }>('SELECT key, name FROM ascension_perk').map(
					(r) => [r.key, r.name ?? r.key]
				)
			),
			anomalyLevels: Object.fromEntries(
				rows<{ key: string; level: number | null }>('SELECT key, level FROM anomaly_category').map(
					(r) => [r.key, r.level]
				)
			),
			defines: Object.fromEntries(
				rows<{ key: string; value: number }>('SELECT key, value FROM game_define').map((r) => [
					r.key,
					r.value
				])
			)
		};
	} finally {
		db.close();
	}
}

function traditionTrees(
	trees: { key: string; name: string | null }[],
	traditions: { key: string; name: string | null; category_key: string; role: string }[]
): GameData['traditionTrees'] {
	return Object.fromEntries(
		trees.map((tree) => [
			tree.key,
			{
				name: tree.name ?? tree.key,
				traditions: traditions
					.filter((t) => t.category_key === tree.key)
					.map((t) => ({ key: t.key, name: t.name ?? t.key, role: t.role }))
			}
		])
	);
}

const CAP = /^(district_\w+_max_(add|mult)|planet_max_districts_(add|mult))$/;

/** The district cap modifiers among `rows`, grouped by owner. */
export function capEffects(
	rows: { owner: string; key: string; value: number }[]
): Record<string, CapEffect[]> {
	const out: Record<string, CapEffect[]> = {};
	for (const r of rows)
		if (CAP.test(r.key)) (out[r.owner] ??= []).push({ key: r.key, value: r.value });
	return out;
}
