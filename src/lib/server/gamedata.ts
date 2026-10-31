import { DatabaseSync } from 'node:sqlite';
import { attractionSources } from '#lib/ethicSources.ts';
import { parseTrigger } from '#lib/triggers.ts';
import type { ActionKind, CapEffect, Costs, GameData } from '#lib/types.ts';

// Names and base costs from stellaris-data-extraction's SQLite (STELLARIS_DATA_DB), read once at
// start. It must match the game version being played — regenerate it after a game update.

/** The game version the data DB was extracted from (`Cygnus v4.5.3 (7793)`), null if it has none. */
export function loadDataVersion(file: string): string | null {
	const db = new DatabaseSync(file, { readOnly: true });
	try {
		const row = db.prepare("SELECT value FROM meta WHERE key = 'game_version'").get() as
			{ value: string } | undefined;
		return row?.value ?? null;
	} catch {
		return null; // no meta table
	} finally {
		db.close();
	}
}

// the leader limits' modifiers: per class, and `leader` for every class
const LEADER_CAP = `modifier_key IN ('country_official_cap_add', 'country_scientist_cap_add',
	'country_commander_cap_add', 'country_leader_cap_add')`;
// … and the recruitment cost's
const LEADER_COST = `modifier_key IN ('leaders_cost_mult', 'leader_officials_cost_mult',
	'leader_scientists_cost_mult', 'leader_commanders_cost_mult')`;

export function loadGameData(file: string): GameData {
	const db = new DatabaseSync(file, { readOnly: true });
	try {
		const rows = <T>(sql: string) => db.prepare(sql).all() as T[];
		// what an empire may hold that has modifiers `where` picks, as source (`tradition:<key>` —
		// perks, edicts, policies too —, `civic:` — authorities too —, `origin:`, `tech:`,
		// `modifier:`) → `group(modifier key)` → their sum
		const bySource = (where: string, group: (key: string) => string) =>
			rows<{ owner: string; key: string; value: number }>(
				`SELECT 'tradition:' || owner_key AS owner, modifier_key AS key, modifier_value AS value
				   FROM tradition_modifier WHERE potential_json IS NULL AND ${where}
				 UNION ALL SELECT 'civic:' || civic_key, modifier_key, modifier_value FROM civic_modifier WHERE ${where}
				 UNION ALL SELECT 'civic:' || authority_key, modifier_key, modifier_value FROM authority_modifier WHERE ${where}
				 UNION ALL SELECT 'origin:' || origin_key, modifier_key, modifier_value FROM origin_modifier WHERE ${where}
				 UNION ALL SELECT 'tech:' || tech_key, modifier_key, modifier_value FROM technology_modifier WHERE ${where}
				 UNION ALL SELECT 'modifier:' || static_key, modifier_key, modifier_value FROM static_modifier_modifier WHERE ${where}`
			).reduce<Record<string, Record<string, number>>>((out, r) => {
				const g = group(r.key);
				(out[r.owner] ??= {})[g] = (out[r.owner][g] ?? 0) + r.value;
				return out;
			}, {});
		const accords = rows<{ patron_key: string; kind: string; key: string; name: string | null }>(
			'SELECT patron_key, kind, key, name FROM patron_accord ORDER BY sort_order'
		);
		const tiers = rows<{ calling_key: string; tier: number; attunement: number | null }>(
			'SELECT calling_key, tier, attunement FROM calling_tier'
		);
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
					potential_json: string | null;
					allow_json: string | null;
					finish_days: number | null;
					cooldown_days: number | null;
				}>(
					'SELECT key, name, cost, unlocked_by_json, potential_json, allow_json, finish_days, cooldown_days FROM council_agenda ORDER BY sort_order'
				).map((r) => [
					r.key,
					{
						name: r.name ?? r.key,
						cost: r.cost,
						unlockedBy: jsonList(r.unlocked_by_json),
						finishDays: r.finish_days,
						cooldownDays: r.cooldown_days,
						potential: parseTrigger(r.potential_json),
						allow: parseTrigger(r.allow_json)
					}
				])
			),
			jobs: Object.fromEntries(
				rows<{
					key: string;
					name: string | null;
					category: string | null;
					budget_source: string | null;
				}>('SELECT key, name, category, budget_source FROM job').map((r) => [
					r.key,
					{ name: r.name ?? r.key, category: r.category, budgetSource: r.budget_source }
				])
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
					prerequisites_json: string | null;
				}>(
					'SELECT key, name, category, length, cost_json, potential_json, unlocked_by_json, prerequisites_json FROM edict ORDER BY sort_order'
				).map((r) => [
					r.key,
					{
						name: r.name ?? r.key,
						category: r.category,
						length: r.length,
						cost: r.cost_json ? JSON.parse(r.cost_json) : {},
						potential: parseTrigger(r.potential_json),
						unlockedBy: jsonList(r.unlocked_by_json),
						prerequisites: jsonList(r.prerequisites_json)
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
					 UNION ALL SELECT key, name FROM zone WHERE name IS NOT NULL
					 UNION ALL SELECT key, name FROM starbase_part WHERE name IS NOT NULL`
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
			// hidden terms (protectorate, loyalty, …) are not on the game's agreements screen: unnamed
			diploNames: Object.fromEntries(
				rows<{ key: string; name: string }>(
					`SELECT key, name FROM resolution WHERE name IS NOT NULL
					 UNION ALL SELECT key, name FROM resolution_category WHERE name IS NOT NULL
					 UNION ALL SELECT key, name FROM agreement_term WHERE name IS NOT NULL AND hidden = 0
					 UNION ALL SELECT key, name FROM agreement_term_value WHERE name IS NOT NULL
					 UNION ALL SELECT key, name FROM agreement_preset WHERE name IS NOT NULL`
				).map((r) => [r.key, r.name])
			),
			resolutions: Object.fromEntries(
				rows<{
					key: string;
					category_key: string | null;
					level: number | null;
					target: number;
					influence_cost: number | null;
					repeal: number;
					potential_json: string | null;
					allow_json: string | null;
					valid_target_json: string | null;
					ai_weight_json: string | null;
				}>(
					`SELECT key, category_key, level, target, influence_cost, repeal, potential_json,
					        allow_json, valid_target_json, ai_weight_json FROM resolution
					 WHERE category_key IS NOT NULL ORDER BY sort_order`
				).map((r) => [
					r.key,
					{
						category: r.category_key,
						level: r.level,
						target: r.target === 1,
						cost: r.influence_cost,
						repeal: r.repeal === 1,
						potential: parseTrigger(r.potential_json),
						allow: parseTrigger(r.allow_json),
						validTarget: parseTrigger(r.valid_target_json),
						aiWeight: r.ai_weight_json ? JSON.parse(r.ai_weight_json) : null
					}
				])
			),
			// what makes proposing cheaper: traditions (Gravitas) and modifiers (Pioneer Politics)
			resolutionCostMult: Object.fromEntries(
				rows<{ owner: string; value: number }>(
					`SELECT 'tradition:' || owner_key AS owner, modifier_value AS value FROM tradition_modifier
					   WHERE modifier_key = 'resolutions_cost_mult' AND potential_json IS NULL
					 UNION ALL SELECT 'modifier:' || static_key, modifier_value FROM static_modifier_modifier
					   WHERE modifier_key = 'resolutions_cost_mult'`
				).map((r) => [r.owner, r.value])
			),
			resolutionGroups: Object.fromEntries(
				rows<{ key: string; group_key: string }>(
					'SELECT key, group_key FROM resolution_category WHERE group_key IS NOT NULL'
				).map((r) => [r.key, r.group_key])
			),
			resolutionCategories: Object.fromEntries(
				rows<{ key: string; category: string }>(
					'SELECT key, category_key AS category FROM resolution WHERE category_key IS NOT NULL'
				).map((r) => [r.key, r.category])
			),
			shroud: {
				patrons: Object.fromEntries(
					rows<{
						key: string;
						name: string | null;
						category: string | null;
						color: string | null;
						covenant: string | null;
					}>('SELECT key, name, category, color, covenant FROM patron').map((p) => [
						p.key,
						{
							name: p.name ?? p.key,
							category: p.category,
							// minor patrons are black in the game files
							color: p.color === '#000000' ? null : p.color,
							covenant: p.covenant,
							accords: accords
								.filter((a) => a.patron_key === p.key)
								.map((a) => ({ kind: a.kind, name: a.name ?? a.key }))
						}
					])
				),
				callings: Object.fromEntries(
					rows<{ key: string; name: string | null }>('SELECT key, name FROM calling').map((c) => [
						c.key,
						{
							name: c.name ?? c.key,
							tiers: Object.fromEntries(
								tiers.filter((t) => t.calling_key === c.key).map((t) => [t.tier, t.attunement])
							)
						}
					])
				),
				deeds: Object.fromEntries(
					rows<{ key: string; name: string | null; attunement: number | null }>(
						'SELECT key, name, attunement FROM deed'
					).map((d) => [d.key, { name: d.name ?? d.key, attunement: d.attunement ?? 0 }])
				)
			},
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
				rows('SELECT situation_key, key, name FROM situation_approach ORDER BY sort_order'),
				rows('SELECT situation_key, key, name FROM situation_stage ORDER BY sort_order')
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
			actionTimers: actionTimers(
				rows(
					'SELECT timer_kind, timer_key, action_kind, action_key, action_name, role FROM action_timer ORDER BY action_kind, action_key'
				)
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
						progress_json: string | null;
					}>(
						'SELECT key, category, tier, name, hint, requirement, progress_json FROM focus_card'
					).map(({ progress_json, ...r }) => [
						r.key,
						{ ...r, name: r.name ?? r.key, gives: jsonList(progress_json) }
					])
				),
				rewards: Object.fromEntries(
					rows<{
						key: string;
						category: string | null;
						cost: number | null;
						options_json: string | null;
					}>('SELECT key, category, cost, options_json FROM focus_reward').map((r) => [
						r.key,
						{ category: r.category, cost: r.cost, options: jsonList(r.options_json) }
					])
				)
			},
			speciesRights: speciesRights(
				rows(
					'SELECT key, kind, name, is_slavery, is_purge, potential_json, allow_json FROM species_right ORDER BY kind_order, sort_order'
				)
			),
			scriptedTriggers: Object.fromEntries(
				rows<{ key: string; trigger_json: string | null }>(
					'SELECT key, trigger_json FROM scripted_trigger'
				).map((r) => [r.key, parseTrigger(r.trigger_json)])
			),
			entryEvents: rows<{
				event_id: string;
				title: string | null;
				description: string | null;
				star_flags_json: string;
				any_star_flags_json: string | null;
				not_star_flags_json: string | null;
				once_flag: string | null;
			}>(
				`SELECT event_id, title, description, star_flags_json, any_star_flags_json,
				        not_star_flags_json, once_flag
				 FROM system_entry_event ORDER BY sort_order`
			).map((r) => ({
				id: r.event_id,
				title: r.title ?? r.event_id,
				description: r.description,
				flags: JSON.parse(r.star_flags_json) as string[],
				anyFlags: r.any_star_flags_json ? (JSON.parse(r.any_star_flags_json) as string[]) : [],
				notFlags: r.not_star_flags_json ? (JSON.parse(r.not_star_flags_json) as string[]) : [],
				onceFlag: r.once_flag
			})),
			prescriptedNames: Object.fromEntries(
				rows<{ key: string; text: string }>('SELECT key, text FROM prescripted_name').map((r) => [
					r.key,
					r.text
				])
			),
			councilorSkill: Object.fromEntries(
				rows<{ owner: string; value: number }>(
					`SELECT 'tradition:' || owner_key AS owner, modifier_value AS value FROM tradition_modifier
					   WHERE modifier_key = 'councilor_skill_add' AND potential_json IS NULL
					 UNION ALL SELECT 'civic:' || civic_key, modifier_value FROM civic_modifier
					   WHERE modifier_key = 'councilor_skill_add'
					 UNION ALL SELECT 'modifier:' || static_key, modifier_value FROM static_modifier_modifier
					   WHERE modifier_key = 'councilor_skill_add'`
				).map((r) => [r.owner, r.value])
			),
			leaderCap: bySource(LEADER_CAP, (k) => k.replace(/^country_(\w+)_cap_add$/, '$1')),
			// `leaders_cost_mult` (every class: `leader`), `leader_<class>s_cost_mult`
			leaderCost: bySource(LEADER_COST, (k) =>
				k === 'leaders_cost_mult' ? 'leader' : k.replace(/^leader_(\w+)s_cost_mult$/, '$1')
			),
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
					   WHERE scope = 'planet' AND condition IS NULL
					 UNION ALL SELECT 'civic:' || civic_key, modifier_key, modifier_value FROM civic_modifier
					 UNION ALL SELECT 'origin:' || origin_key, modifier_key, modifier_value FROM origin_modifier
					 UNION ALL SELECT 'tradition:' || owner_key, modifier_key, modifier_value FROM tradition_modifier
					   WHERE potential_json IS NULL`
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
			flagColors: Object.fromEntries(
				rows<{ key: string; r: number; g: number; b: number }>(
					'SELECT key, r, g, b FROM flag_color'
				).map((c) => [
					c.key,
					`#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
				])
			),
			ethicAxes: Object.fromEntries(
				rows<{ key: string; category: string | null; category_value: number | null }>(
					'SELECT key, category, category_value FROM ethic WHERE category IS NOT NULL'
				).map((e) => [
					e.key,
					{ axis: e.category!, pos: e.category === 'hive' ? 0 : (e.category_value ?? 2) - 2 }
				])
			),
			ethicOrder: rows<{ key: string }>('SELECT key FROM ethic ORDER BY sort_order').map(
				(r) => r.key
			),
			ethicRules: rows<{
				ethic_key: string;
				kind: 'tag' | 'country';
				description: string | null;
				factor: number | null;
				factor_text: string | null;
				trigger_json: string | null;
				op?: 'factor' | 'add' | null; // extractor 0.1.5+
				per_json?: string | null;
				per_value?: number | null;
			}>(
				// `*`: a data DB from an older extractor has no `op` (its rules are all factors)
				'SELECT * FROM ethic_attraction ORDER BY ethic_key, sort_order'
			).reduce<GameData['ethicRules']>((out, r) => {
				(out[r.ethic_key] ??= []).push({
					kind: r.kind,
					description: r.description,
					op: r.op ?? null,
					per: parseTrigger(r.per_json ?? null),
					perValue: r.per_value ?? null,
					factor: r.factor,
					factorText: r.factor_text,
					trigger: parseTrigger(r.trigger_json)
				});
				return out;
			}, {}),
			attractionSources: attractionSources(
				rows<{ tbl: string; owner: string; modifier: string; value: number; scope: string | null }>(
					`SELECT 'tradition_modifier' AS tbl, owner_key AS owner, modifier_key AS modifier, modifier_value AS value, NULL AS scope FROM tradition_modifier
					 UNION ALL SELECT 'building', building_key, modifier_key, value, scope FROM building_modifier
					 UNION ALL SELECT 'civic', civic_key, modifier_key, modifier_value, NULL FROM civic_modifier
					 UNION ALL SELECT 'origin', origin_key, modifier_key, modifier_value, NULL FROM origin_modifier
					 UNION ALL SELECT 'designation', colony_type_key, modifier, value, NULL FROM colony_type_modifier
					 UNION ALL SELECT 'council', position_key, modifier_key, modifier_value, NULL FROM council_position_modifier
					 UNION ALL SELECT 'leader', trait_key, modifier_key, modifier_value, scope FROM leader_trait_modifier
					 UNION ALL SELECT 'static', static_key, modifier_key, modifier_value, NULL FROM static_modifier_modifier
					 UNION ALL SELECT 'deposit', deposit_key, modifier_key, modifier_value, NULL FROM deposit_modifier
					 UNION ALL SELECT 'relic', relic_key, modifier_key, modifier_value, NULL FROM precursor_relic_active_modifier`
				),
				{
					tradition: rows<{ key: string }>('SELECT key FROM tradition').map((r) => r.key),
					perk: rows<{ key: string }>('SELECT key FROM ascension_perk').map((r) => r.key),
					edict: rows<{ key: string }>('SELECT key FROM edict').map((r) => r.key),
					agenda: rows<{ key: string }>('SELECT key FROM council_agenda').map((r) => r.key),
					policy: rows<{ key: string }>('SELECT key FROM policy_option').map((r) => r.key),
					origin: rows<{ key: string }>('SELECT key FROM origin').map((r) => r.key)
				}
			),
			civicAuthority: rows<{ civic_key: string; kind: string; operator: string; value: string }>(
				`SELECT civic_key, kind, operator, value FROM civic_requirement
				 WHERE kind = 'authority' OR (kind = 'ethic' AND value = 'ethic_gestalt_consciousness')`
			).reduce<GameData['civicAuthority']>((out, r) => {
				const c = (out[r.civic_key] ??= { require: [], forbid: [] });
				const key = r.kind === 'ethic' ? 'gestalt' : r.value;
				(r.operator === 'forbid' ? c.forbid : c.require).push(key);
				return out;
			}, {}),
			buildingUnlocks: rows<{ owner_key: string; building_key: string }>(
				'SELECT owner_key, building_key FROM building_unlock ORDER BY owner_key'
			).reduce<GameData['buildingUnlocks']>(
				(out, r) => ({ ...out, [r.building_key]: [...(out[r.building_key] ?? []), r.owner_key] }),
				{}
			),
			speciesArchetypes: Object.fromEntries(
				rows<{ key: string; archetype: string | null }>(
					'SELECT key, archetype FROM species_class WHERE archetype IS NOT NULL'
				).map((r) => [r.key, r.archetype!])
			),
			electionTypes: Object.fromEntries(
				rows<{ key: string; election_type: string }>(
					'SELECT key, election_type FROM authority'
				).map((r) => [r.key, r.election_type])
			),
			authorities: rows<{ key: string }>('SELECT key FROM authority ORDER BY sort_order').map(
				(r) => r.key
			),
			anomalyLevels: Object.fromEntries(
				rows<{ key: string; level: number | null }>('SELECT key, level FROM anomaly_category').map(
					(r) => [r.key, r.level]
				)
			),
			// before modifiers: districts', ship sizes' (stations, outposts) and buildings' build cost
			// and upkeep; what deposits produce
			costs: {
				district: byKind(rows('SELECT key, kind, resource, amount FROM district_resource')),
				ship: byKind(rows('SELECT key, kind, resource, amount FROM ship_size_resource')),
				building: byKind(
					rows('SELECT building_key AS key, kind, resource, amount FROM building_resource')
				),
				deposit: byKind(
					rows('SELECT deposit_key AS key, kind, resource, amount FROM deposit_resource')
				),
				module: byKind(rows('SELECT key, kind, resource, amount FROM starbase_module_resource')),
				starbaseBuilding: byKind(
					rows('SELECT key, kind, resource, amount FROM starbase_building_resource')
				)
			},
			// jobs (positions, in pops) per district and building, build days, deposit categories
			districtJobs: byKey(rows('SELECT key, job AS name, amount FROM district_job')),
			buildingJobs: byKey(
				rows('SELECT building_key AS key, job AS name, amount FROM building_job')
			),
			buildDays: Object.fromEntries(
				rows<{ key: string; days: number }>('SELECT key, days FROM build_time').map((r) => [
					r.key,
					r.days
				])
			),
			depositCategory: Object.fromEntries(
				rows<{ key: string; category: string | null }>('SELECT key, category FROM deposit').map(
					(r) => [r.key, r.category]
				)
			),
			techRequirements: Object.fromEntries(
				rows<{
					tech_key: string;
					prerequisites_json: string;
					potential_json: string | null;
					is_rare: number;
					is_dangerous: number;
				}>(
					'SELECT tech_key, prerequisites_json, potential_json, is_rare, is_dangerous FROM technology_requirement'
				).map((r) => [
					r.tech_key,
					{
						prerequisites: jsonList(r.prerequisites_json),
						potential: parseTrigger(r.potential_json),
						rare: r.is_rare === 1,
						dangerous: r.is_dangerous === 1
					}
				])
			),
			buildingCategory: Object.fromEntries(
				rows<{ key: string; category: string | null }>('SELECT key, category FROM building').map(
					(r) => [r.key, r.category]
				)
			),
			// what the AI makes of a trade: each resource's weight, stockpile target and base storage;
			// personalities' willingness, which attitudes trade, opinion modifiers (the trade tab)
			resourceInfo: Object.fromEntries(
				rows<{
					key: string;
					name: string | null;
					ai_weight: number | null;
					ai_wants: number | null;
					max: number | null;
					tradable: number;
				}>('SELECT key, name, ai_weight, ai_wants, max, tradable FROM strategic_resource').map(
					(r) => [
						r.key,
						{
							name: r.name ?? r.key,
							aiWeight: r.ai_weight,
							aiWants: r.ai_wants,
							max: r.max,
							tradable: r.tradable === 1
						}
					]
				)
			),
			personalities: Object.fromEntries(
				rows<{ key: string; name: string | null; trade_willingness: number | null }>(
					'SELECT key, name, trade_willingness FROM personality'
				).map((r) => [r.key, { name: r.name ?? r.key, willingness: r.trade_willingness }])
			),
			attitudes: Object.fromEntries(
				rows<{ key: string; name: string | null; trade: number }>(
					'SELECT key, name, trade FROM attitude'
				).map((r) => [r.key, { name: r.name ?? r.key, trade: r.trade === 1 }])
			),
			opinionModifiers: Object.fromEntries(
				rows<{ key: string; name: string | null; max: number | null; decay: number | null }>(
					'SELECT key, name, max, decay FROM opinion_modifier'
				).map((r) => [r.key, { name: r.name ?? r.key, max: r.max, decay: r.decay }])
			),
			// modules and buildings a starbase of each level holds (`starbase_level_starport` → starport)
			starbaseSlots: Object.fromEntries(
				rows<{ key: string; module_slots: number; building_slots: number }>(
					'SELECT key, module_slots, building_slots FROM starbase_level'
				).map((r) => [
					r.key.replace(/^starbase_level_/, ''),
					{ modules: r.module_slots, buildings: r.building_slots }
				])
			),
			// what an edict changes while active (its unconditional modifiers; the produce tab)
			edictModifiers: byKey(
				rows(
					`SELECT owner_key AS key, modifier_key AS name, modifier_value AS amount
					   FROM tradition_modifier
					  WHERE potential_json IS NULL AND owner_key IN (SELECT key FROM edict)`
				)
			),
			// what techs and traditions change in costs, upkeep and output (the trade-offs tab)
			growthModifiers: byKey(
				rows(
					`SELECT 'tech:' || tech_key AS key, modifier_key AS name, modifier_value AS amount
					   FROM technology_modifier
					 UNION ALL SELECT 'tradition:' || owner_key, modifier_key, modifier_value
					   FROM tradition_modifier WHERE potential_json IS NULL`
				).filter((r) =>
					/_cost_mult$|_produces_mult$|^stations_upkeep_mult$/.test((r as { name: string }).name)
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

/** `(key, kind, resource, amount)` rows → key → kind (cost, upkeep, produces) → resources. */
export function byKind(rows: unknown[]): Record<string, Costs> {
	const out: Record<string, Costs> = {};
	for (const r of rows as { key: string; kind: string; resource: string; amount: number }[]) {
		// own keys only: the ship size `constructor` would find Object's constructor through `??=`
		if (!Object.hasOwn(out, r.key)) out[r.key] = { cost: {}, upkeep: {}, produces: {} };
		const c = out[r.key];
		if (r.kind === 'cost' || r.kind === 'upkeep' || r.kind === 'produces')
			c[r.kind][r.resource] = r.amount;
	}
	return out;
}

/** `(key, name, amount)` rows → key → name → amount. */
export function byKey(rows: unknown[]): Record<string, Record<string, number>> {
	const out: Record<string, Record<string, number>> = {};
	for (const r of rows as { key: string; name: string; amount: number }[]) {
		if (!Object.hasOwn(out, r.key)) out[r.key] = {};
		out[r.key][r.name] = r.amount;
	}
	return out;
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

const CAP =
	/^(district_\w+_max_(add|mult)|(planet|planet_non_artificial|pc_\w+)_max_districts_(add|mult))$/;

/** The district cap modifiers among `rows`, grouped by owner. */
export function capEffects(
	rows: { owner: string; key: string; value: number }[]
): Record<string, CapEffect[]> {
	const out: Record<string, CapEffect[]> = {};
	// a tradition's alternative modifier sets are keyed `<tradition>#<n>`
	for (const r of rows)
		if (CAP.test(r.key))
			(out[r.owner.replace(/#\w+$/, '')] ??= []).push({ key: r.key, value: r.value });
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
	approaches: { situation_key: string; key: string; name: string | null }[],
	stages: { situation_key: string; key: string; name: string | null }[]
): GameData['situationTypes'] {
	return Object.fromEntries(
		types.map((t) => [
			t.key,
			{
				name: t.name ?? t.key,
				category: t.category,
				approaches: Object.fromEntries(
					approaches.filter((a) => a.situation_key === t.key).map((a) => [a.key, a.name ?? a.key])
				),
				stages: stages.filter((x) => x.situation_key === t.key).map((x) => x.name ?? x.key)
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

/** Species rights grouped by kind, kinds and options in the game's order. */
export function speciesRights(
	rights: {
		key: string;
		kind: string;
		name: string | null;
		is_slavery: number;
		is_purge: number;
		potential_json: string | null;
		allow_json: string | null;
	}[]
): GameData['speciesRights'] {
	const kinds = [...new Set(rights.map((r) => r.kind))];
	return kinds.map((kind) => ({
		kind,
		options: rights
			.filter((r) => r.kind === kind)
			.map((r) => ({
				key: r.key,
				name: r.name ?? r.key,
				isSlavery: r.is_slavery === 1,
				isPurge: r.is_purge === 1,
				potential: parseTrigger(r.potential_json),
				allow: parseTrigger(r.allow_json)
			}))
	}));
}

/** Per timer (`modifier:<key>`, `flag:<key>`) the actions it belongs to, from `action_timer`. */
export function actionTimers(
	rows: {
		timer_kind: string;
		timer_key: string;
		action_kind: string;
		action_key: string;
		action_name: string | null;
		role: string;
	}[]
): GameData['actionTimers'] {
	const out: GameData['actionTimers'] = {};
	for (const r of rows)
		(out[`${r.timer_kind}:${r.timer_key}`] ??= []).push({
			kind: r.action_kind as ActionKind,
			key: r.action_key,
			name: r.action_name ?? r.action_key,
			cooldown: r.role === 'cooldown',
			...(r.role === 'bonus' && { bonus: true })
		});
	return out;
}
