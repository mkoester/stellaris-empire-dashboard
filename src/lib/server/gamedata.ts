import { DatabaseSync } from 'node:sqlite';
import { parseTrigger } from '#lib/triggers.ts';
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
				rows<{
					key: string;
					name: string | null;
					cost: number | null;
					unlocked_by_json: string | null;
				}>('SELECT key, name, cost, unlocked_by_json FROM council_agenda ORDER BY sort_order').map(
					(r) => [
						r.key,
						{ name: r.name ?? r.key, cost: r.cost, unlockedBy: jsonList(r.unlocked_by_json) }
					]
				)
			),
			jobs: Object.fromEntries(
				rows<{ key: string; name: string | null; category: string | null }>(
					'SELECT key, name, category FROM job'
				).map((r) => [r.key, { name: r.name ?? r.key, category: r.category }])
			),
			edicts: Object.fromEntries(
				rows<{
					key: string;
					name: string | null;
					category: string | null;
					length: number | null;
					cost_json: string | null;
					potential_json: string | null;
					unlocked_by_json: string | null;
				}>(
					'SELECT key, name, category, length, cost_json, potential_json, unlocked_by_json FROM edict ORDER BY sort_order'
				).map((r) => [
					r.key,
					{
						name: r.name ?? r.key,
						category: r.category,
						length: r.length,
						cost: r.cost_json ? JSON.parse(r.cost_json) : {},
						potential: parseTrigger(r.potential_json),
						unlockedBy: jsonList(r.unlocked_by_json)
					}
				])
			),
			policies: policies(
				rows('SELECT key, name, category FROM policy ORDER BY sort_order'),
				rows(
					'SELECT key, policy_key, name, potential_json, valid_json FROM policy_option ORDER BY sort_order'
				)
			),
			factionTypes: factionTypes(
				rows(
					'SELECT key, name, description, guiding_ethic FROM pop_faction_type ORDER BY sort_order'
				),
				rows(
					'SELECT faction_key, title, unfulfilled_title, description, fulfilled_effect, unfulfilled_effect, potential_json, trigger_json FROM faction_demand ORDER BY faction_key, sort_order'
				)
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
				rows<{
					key: string;
					name: string | null;
					colonizable: number;
					ideal: number;
					is_standard: number;
					climate: string | null;
				}>('SELECT key, name, colonizable, ideal, is_standard, climate FROM planet_class').map(
					(r) => [
						r.key,
						{
							name: r.name ?? r.key,
							colonizable: r.colonizable === 1,
							ideal: r.ideal === 1,
							standard: r.is_standard === 1,
							climate: r.climate
						}
					]
				)
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
			// the border colour of each district's grid-box icon; districts without one are left out
			districtColors: Object.fromEntries(
				rows<{ key: string; color: string }>(
					'SELECT key, color FROM district WHERE color IS NOT NULL'
				).map((r) => [r.key, r.color])
			),
			habitability: {
				traits: rows<{ trait: string; key: string; value: number }>(
					`SELECT trait_key AS trait, modifier_key AS key, modifier_value AS value FROM trait_modifier
					 WHERE modifier_key LIKE 'pc_%_habitability'
					   OR modifier_key IN ('pop_environment_tolerance', 'habitability_floor_add')`
				).reduce<Record<string, Record<string, number>>>(
					(acc, r) => ({ ...acc, [r.trait]: { ...acc[r.trait], [r.key]: r.value } }),
					{}
				),
				planet: Object.fromEntries(
					rows<{ owner: string; value: number }>(
						`SELECT 'modifier:' || static_key AS owner, modifier_value AS value FROM static_modifier_modifier
						 WHERE modifier_key = 'pop_environment_tolerance'
						 UNION ALL SELECT 'deposit:' || deposit_key, modifier_value FROM deposit_modifier
						 WHERE modifier_key = 'pop_environment_tolerance'`
					).map((r) => [r.owner, r.value])
				)
			},
			habitatEffects: rows<{ owner: string; key: string; value: number }>(
				'SELECT deposit_key AS owner, modifier_key AS key, modifier_value AS value FROM deposit_habitat_modifier'
			).reduce<Record<string, Record<string, number>>>(
				(acc, r) => ({ ...acc, [r.owner]: { ...acc[r.owner], [r.key]: r.value } }),
				{}
			),
			identityNames: Object.fromEntries(
				rows<{ key: string; name: string }>(
					`SELECT key, name FROM civic WHERE name IS NOT NULL
					 UNION ALL SELECT key, name FROM origin WHERE name IS NOT NULL
					 UNION ALL SELECT key, name FROM authority WHERE name IS NOT NULL
					 UNION ALL SELECT key, label FROM ethic WHERE label IS NOT NULL
					 UNION ALL SELECT key, name FROM government_type WHERE name IS NOT NULL`
				).map((r) => [r.key, r.name])
			),
			dlcs: rows<{
				name: string;
				dlc_key: string | null;
				category: string | null;
				release_date: string | null;
				affects_gameplay: number;
				host_checks: number;
			}>(
				'SELECT name, dlc_key, category, release_date, affects_gameplay, host_checks FROM dlc ORDER BY dlc_key'
			).map((r) => ({
				name: r.name,
				key: r.dlc_key ?? '',
				category: r.category,
				releaseDate: r.release_date,
				gameplay: r.affects_gameplay === 1,
				baseGame: r.affects_gameplay === 1 && r.host_checks === 0
			})),
			situationTypes: situationTypes(
				rows('SELECT key, name, category FROM situation'),
				rows('SELECT situation_key, key, name FROM situation_approach ORDER BY sort_order')
			),
			projects: Object.fromEntries(
				rows<{
					key: string;
					name: string | null;
					days: number | null;
					department: string | null;
					outcomes_json: string | null;
				}>('SELECT key, name, days, department, outcomes_json FROM special_project').map((r) => [
					r.key,
					{
						name: r.name ?? r.key,
						days: r.days,
						department: r.department,
						outcomes: jsonList(r.outcomes_json)
					}
				])
			),
			anomalyCategories: Object.fromEntries(
				rows<{
					key: string;
					name: string | null;
					level: number | null;
					outcomes_json: string | null;
				}>('SELECT key, name, level, outcomes_json FROM anomaly_category').map((r) => [
					r.key,
					{ name: r.name ?? r.key, level: r.level, outcomes: jsonList(r.outcomes_json) }
				])
			),
			focus: {
				categories: Object.fromEntries(
					rows<{ key: string; name: string | null }>('SELECT key, name FROM focus_category').map(
						(r) => [r.key, r.name ?? r.key]
					)
				),
				cards: Object.fromEntries(
					rows<{
						key: string;
						category: string | null;
						tier: number | null;
						name: string | null;
						hint: string | null;
						requirement: string | null;
					}>('SELECT key, category, tier, name, hint, requirement FROM focus_card').map((r) => [
						r.key,
						{ ...r, name: r.name ?? r.key }
					])
				),
				rewards: Object.fromEntries(
					rows<{
						key: string;
						category: string | null;
						cost: number | null;
						techs_json: string | null;
					}>('SELECT key, category, cost, techs_json FROM focus_reward').map((r) => [
						r.key,
						{ category: r.category, cost: r.cost, techs: jsonList(r.techs_json) }
					])
				)
			},
			depositCategories: Object.fromEntries(
				rows<{ key: string; category: string }>(
					'SELECT key, category FROM deposit WHERE category IS NOT NULL'
				).map((r) => [r.key, r.category])
			),
			councilPositions: Object.fromEntries(
				rows<{
					key: string;
					name: string | null;
					civic_key: string | null;
					leader_classes: string | null;
					possible_json: string | null;
				}>(
					'SELECT key, name, civic_key, leader_classes, possible_json FROM council_position ORDER BY sort_order'
				).map((r) => [
					r.key,
					{
						name: r.name ?? r.key,
						civic: r.civic_key,
						classes: r.leader_classes ? r.leader_classes.split(',') : [],
						possible: parseTrigger(r.possible_json)
					}
				])
			),
			capEffects: capEffects(
				rows<{ owner: string; key: string; value: number }>(
					`SELECT 'deposit:' || deposit_key AS owner, modifier_key AS key, modifier_value AS value FROM deposit_modifier
					 UNION ALL SELECT 'modifier:' || static_key, modifier_key, modifier_value FROM static_modifier_modifier
					 UNION ALL SELECT 'building:' || building_key, modifier_key, value FROM building_modifier
					   WHERE scope = 'planet' AND condition IS NULL`
				)
			),
			blockerInfo: blockerInfo(
				rows<{
					key: string;
					category: string | null;
					clear_time: number | null;
					prerequisites: string | null;
				}>('SELECT key, category, clear_time, prerequisites FROM deposit WHERE is_blocker = 1'),
				rows<{ key: string; resource: string; amount: number }>(
					`SELECT deposit_key AS key, resource, amount FROM deposit_resource WHERE kind = 'cost'`
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

/** Per blocker: clearing days and cost, the techs it needs, natural or not (Ranger Lodge). */
export function blockerInfo(
	blockers: {
		key: string;
		category: string | null;
		clear_time: number | null;
		prerequisites: string | null;
	}[],
	costs: { key: string; resource: string; amount: number }[]
): GameData['blockerInfo'] {
	return Object.fromEntries(
		blockers.map((b) => [
			b.key,
			{
				days: b.clear_time,
				cost: Object.fromEntries(
					costs.filter((c) => c.key === b.key).map((c) => [c.resource, c.amount])
				),
				prerequisites: b.prerequisites ? b.prerequisites.split(',') : [],
				natural: b.category === 'deposit_cat_blockers_natural'
			}
		])
	);
}

const jsonList = <T = string>(json: string | null): T[] => (json ? JSON.parse(json) : []);

/** Situations with their approaches' names. */
export function situationTypes(
	types: { key: string; name: string | null; category: string | null }[],
	approaches: { situation_key: string; key: string; name: string | null }[]
): GameData['situationTypes'] {
	return Object.fromEntries(
		types.map((t) => [
			t.key,
			{
				name: t.name ?? t.key,
				category: t.category,
				approaches: Object.fromEntries(
					approaches.filter((a) => a.situation_key === t.key).map((a) => [a.key, a.name ?? a.key])
				)
			}
		])
	);
}

/** Policies with their options, in the game files' order. */
export function policies(
	ps: { key: string; name: string | null; category: string | null }[],
	options: {
		key: string;
		policy_key: string;
		name: string | null;
		potential_json: string | null;
		valid_json: string | null;
	}[]
): GameData['policies'] {
	return ps.map((p) => ({
		key: p.key,
		name: p.name ?? p.key,
		category: p.category,
		options: options
			.filter((o) => o.policy_key === p.key)
			.map((o) => ({
				key: o.key,
				name: o.name ?? o.key,
				potential: parseTrigger(o.potential_json),
				valid: parseTrigger(o.valid_json)
			}))
	}));
}

/** Pop faction types with their demands. */
export function factionTypes(
	types: {
		key: string;
		name: string | null;
		description: string | null;
		guiding_ethic: string | null;
	}[],
	demands: {
		faction_key: string;
		title: string | null;
		unfulfilled_title: string | null;
		description: string | null;
		fulfilled_effect: number | null;
		unfulfilled_effect: number | null;
		potential_json: string | null;
		trigger_json: string | null;
	}[]
): GameData['factionTypes'] {
	return types.map((t) => ({
		key: t.key,
		name: t.name ?? t.key,
		description: t.description,
		ethic: t.guiding_ethic,
		demands: demands
			.filter((d) => d.faction_key === t.key)
			.map((d) => ({
				title: d.title ?? '',
				unfulfilledTitle: d.unfulfilled_title,
				description: d.description,
				fulfilled: d.fulfilled_effect,
				unfulfilled: d.unfulfilled_effect,
				potential: parseTrigger(d.potential_json),
				trigger: parseTrigger(d.trigger_json)
			}))
	}));
}
