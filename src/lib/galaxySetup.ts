// The settings the galaxy was created with (the save's `galaxy` block), grouped and labelled as
// the game's setup screen (4.5.x `common/gamesetup_settings/gamesetup_settings.txt`: two tabs,
// categories Gameplay, Galaxy, Empires, Precursors, Game Length, DLC). Labels are the setup
// screen's where the localisation has one (`NUM_HYPERLANES` "Hyperlane Density", …), else ours.
import { difficultyLabel } from './events.ts';

export type SetupValue = string | number | boolean | string[];
export type GalaxySetup = Record<string, SetupValue>;

type Format = 'text' | 'count' | 'mult' | 'percent' | 'yesno' | 'year' | 'difficulty' | 'list';

/** Save key → label and format, in the setup screen's order within each group. */
const GROUPS: { title: string; settings: [key: string, label: string, format: Format][] }[] = [
	{
		title: 'Gameplay',
		settings: [
			['difficulty', 'Difficulty', 'difficulty'],
			['ironman', 'Ironman', 'yesno'],
			['crisis_type', 'Crisis Type', 'text'],
			['crises', 'Crisis Strength', 'mult'],
			['scaling', 'Difficulty Scaling', 'text'],
			['fallen_empire_strength_scale', 'Fallen Empire Strength', 'mult'],
			['difficulty_adjusted_ai_modifiers', 'Difficulty Adjusted AI Modifiers', 'yesno'],
			['aggressiveness', 'AI Aggressiveness', 'text'],
			['logistic_ceiling_v2', 'Logistic Growth Ceiling', 'count'],
			['growth_scale', 'Country Growth Scale', 'percent'],
			['technology', 'Technology Cost', 'mult'],
			['traditions', 'Tradition Cost', 'mult'],
			['technology_difficulty_scale', 'Tech and Tradition Difficulty Scaling', 'text'],
			['naval_capacity_mult', 'Naval Capacity', 'mult'],
			['command_limit_galaxy_mult', 'Command Limit', 'mult'],
			['logistics_fleet_upkeep_costs', 'Logistics: Fleet Upkeep', 'mult'],
			['logistics_planet_deficit_costs', 'Logistics: Planet Deficit', 'mult']
		]
	},
	{
		title: 'Galaxy',
		settings: [
			['template', 'Galaxy Size', 'text'],
			['shape', 'Galaxy Shape', 'text'],
			['num_hyperlanes', 'Hyperlane Density', 'mult'],
			['habitability', 'Habitable Worlds', 'mult'],
			['primitive', 'Pre-FTL Civilizations', 'mult'],
			['player_locations', 'Empire Placement', 'text'],
			['clustered', 'Clustered Starts', 'yesno'],
			['advanced_starts_near_player', 'Advanced Starts Near Players', 'yesno'],
			['num_gateways', 'Abandoned Gateways', 'mult'],
			['num_wormhole_pairs', 'Wormhole Pairs', 'mult'],
			['num_guaranteed_colonies', 'Guaranteed Habitable Worlds', 'count'],
			['resource_abundance', 'Resource Abundance', 'mult']
		]
	},
	{
		title: 'Empires',
		settings: [
			['num_empires', 'AI Empires', 'count'],
			['num_advanced_empires', 'Advanced AI Starts', 'count'],
			['num_fallen_empires', 'Fallen Empires', 'count'],
			['random_empires', 'Random AI Empires', 'yesno'],
			['random_advanced_empires', 'Random Advanced AI Starts', 'yesno'],
			['random_fallen_empires', 'Random Fallen Empires', 'yesno']
		]
	},
	{
		title: 'Precursors',
		settings: [['disabled_precursors', 'Disabled Precursors', 'list']]
	},
	{
		title: 'Game Length',
		settings: [
			['mid_game_start', 'Mid-Game Start', 'year'],
			['end_game_start', 'End-Game Start', 'year'],
			['victory_year', 'Victory Year', 'year']
		]
	},
	{
		title: 'DLC',
		settings: [
			['num_marauder_empires', 'Marauder Empires', 'count'],
			['random_marauder_empires', 'Random Marauder Empires', 'yesno'],
			['num_nomad_empires', 'Randomized Nomadic Empires', 'count'],
			['random_nomad_empires', 'Random Nomadic Empires', 'yesno'],
			['lgate_enabled', 'L-Gates', 'yesno'],
			['caravaneers_enabled', 'Caravaneers', 'yesno'],
			[
				'cosmic_storm_early_game_spawn_chance_scale',
				'Cosmic Storms: Early Game Spawn Chance',
				'mult'
			],
			['cosmic_storm_mid_game_spawn_chance_scale', 'Cosmic Storms: Mid-Game Spawn Chance', 'mult'],
			[
				'cosmic_storm_late_game_spawn_chance_scale',
				'Cosmic Storms: Late Game Spawn Chance',
				'mult'
			],
			['cosmic_storm_early_game_spawn_max_cap', 'Cosmic Storms: Early Game Maximum', 'count'],
			['cosmic_storm_mid_game_spawn_max_cap', 'Cosmic Storms: Mid-Game Maximum', 'count'],
			['cosmic_storm_late_game_spawn_max_cap', 'Cosmic Storms: Late Game Maximum', 'count'],
			['cosmic_storm_spawn_cooldown_scale', 'Cosmic Storms: Spawn Cooldown', 'mult'],
			['cosmic_storm_devastation', 'Cosmic Storms: Devastation', 'mult'],
			['voidworms_scaling', 'Voidworms Scaling', 'mult'],
			['cutholoids_scaling', 'Cutholoids Scaling', 'mult']
		]
	}
];

/** Not settings: the galaxy's generated id. */
const SKIP = new Set(['name']);

/** The save's `galaxy` block as plain values (lists of strings kept), without its id. */
export function readSetup(raw: unknown): GalaxySetup | null {
	if (!raw || typeof raw !== 'object') return null;
	const out: GalaxySetup = {};
	for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
		if (SKIP.has(k)) continue;
		if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
		else if (Array.isArray(v)) out[k] = v.map(String);
	}
	return Object.keys(out).length ? out : null;
}

const words = (s: string) =>
	s
		.replace(/^scaling_/, '')
		.replaceAll('_', ' ')
		.replace(/^\w/, (c) => c.toUpperCase());
const trim = (n: number) => String(Math.round(n * 1000) / 1000);
const START_YEAR = 2200;

/** A setting's value as the setup screen would show it; `names` names list entries (precursors). */
export function formatSetting(
	format: Format,
	value: SetupValue,
	names: Record<string, string> = {}
): string {
	if (Array.isArray(value))
		return value.length ? value.map((v) => names[v] ?? v).join(', ') : 'none';
	if (typeof value === 'boolean') return value ? 'yes' : 'no';
	if (format === 'yesno') return value === 'yes' ? 'yes' : value === 'no' ? 'no' : String(value);
	if (typeof value === 'number') {
		if (format === 'mult') return `×${trim(value)}`;
		if (format === 'percent') return `${trim(value * 100)} %`;
		if (format === 'year') return `${START_YEAR + value} (after ${trim(value)} years)`;
		return trim(value);
	}
	if (format === 'difficulty') return difficultyLabel(value);
	return words(value);
}

export type SetupRow = { key: string; label: string; value: string };

/** The setup's settings in the setup screen's groups; keys we do not know go to "Other". */
export function setupGroups(
	setup: GalaxySetup,
	names: Record<string, string> = {}
): { title: string; rows: SetupRow[] }[] {
	const known = new Set<string>();
	const groups = GROUPS.map((g) => ({
		title: g.title,
		rows: g.settings.flatMap(([key, label, format]) => {
			known.add(key);
			return key in setup ? [{ key, label, value: formatSetting(format, setup[key], names) }] : [];
		})
	}));
	const other = Object.keys(setup)
		.filter((k) => !known.has(k))
		.sort()
		.map((key) => ({ key, label: words(key), value: formatSetting('text', setup[key], names) }));
	return [...groups, { title: 'Other', rows: other }].filter((g) => g.rows.length);
}
