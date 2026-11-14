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

export type SetupRow = {
	key: string;
	label: string;
	value: string;
	raw: SetupValue;
	default: string | null; // the setup screen's default, formatted; null where not known
	changed: boolean; // differs from the default
	assumed: boolean; // the default is the engine's (not in the files): assumed
};

/** What the defaults are read from: each galaxy size's scenario and the defines. */
export type SetupDefaults = {
	scenarios: Record<string, Record<string, number>>; // size → save key → default (data DB `setup_scenario`)
	defines: Record<string, number>;
};

// Size-independent defaults: the save key's `*_DEFAULT` define (4.5.4 `common/defines/00_defines.txt`).
const DEFINE_DEFAULT: Record<string, string> = {
	mid_game_start: 'MID_GAME_START_DEFAULT',
	end_game_start: 'END_GAME_START_DEFAULT',
	victory_year: 'VICTORY_YEAR_DEFAULT',
	num_guaranteed_colonies: 'GUARANTEED_COLONIES_DEFAULT',
	technology: 'TECH_COST_DEFAULT',
	traditions: 'TRADITION_COST_DEFAULT',
	naval_capacity_mult: 'NAVAL_CAPACITY_MULT_DEFAULT',
	command_limit_galaxy_mult: 'COMMAND_LIMIT_MULT_DEFAULT',
	logistic_ceiling_v2: 'LOGISTIC_CEILING_DEFAULT',
	growth_scale: 'GROWTH_SCALE_DEFAULT',
	logistics_fleet_upkeep_costs: 'LOGISTICS_FLEET_UPKEEP_DEFAULT',
	logistics_planet_deficit_costs: 'LOGISTICS_PLANET_DEFICIT_DEFAULT',
	cosmic_storm_early_game_spawn_chance_scale: 'COSMIC_STORM_SPAWN_CHANCE_SCALE_DEFAULT',
	cosmic_storm_mid_game_spawn_chance_scale: 'COSMIC_STORM_SPAWN_CHANCE_SCALE_DEFAULT',
	cosmic_storm_late_game_spawn_chance_scale: 'COSMIC_STORM_SPAWN_CHANCE_SCALE_DEFAULT',
	cosmic_storm_spawn_cooldown_scale: 'COSMIC_STORM_SPAWN_COOLDOWN_SCALE_DEFAULT',
	cosmic_storm_devastation: 'COSMIC_STORM_DEVASTATION_DEFAULT',
	voidworms_scaling: 'VOIDWORMS_SCALING_DEFAULT',
	fallen_empire_strength_scale: 'FALLEN_EMPIRE_STRENGTH_SCALE_DEFAULT',
	cutholoids_scaling: 'CUTHOLOIDS_SCALING_DEFAULT'
};

// The setup screen's defaults that no file holds (the engine's), assumed. `resource_abundance` is
// left out: its define (RESOURCE_ABUNDANCE_DEFAULT 2, 0–5) is a slider step, the save holds 1.
const ENGINE_DEFAULT: Record<string, SetupValue> = {
	difficulty: 'ensign',
	ironman: 'no',
	crisis_type: 'any',
	aggressiveness: 'normal',
	scaling: 'scaling_off',
	technology_difficulty_scale: 'scaling_normal',
	player_locations: 'normal',
	clustered: 'no',
	advanced_starts_near_player: 'no',
	random_empires: 'no',
	random_advanced_empires: 'no',
	random_fallen_empires: 'no',
	random_marauder_empires: 'no',
	random_nomad_empires: 'no',
	lgate_enabled: 'yes',
	caravaneers_enabled: 'yes',
	difficulty_adjusted_ai_modifiers: 'no'
};

/** A setting's default in a galaxy of `size`, and whether it is assumed; null where unknown. */
export function defaultOf(
	key: string,
	size: string | null,
	d: SetupDefaults
): { value: SetupValue; assumed: boolean } | null {
	const scenario = size ? d.scenarios[size]?.[key] : undefined;
	if (scenario !== undefined) return { value: scenario, assumed: false };
	const storm = key.match(/^cosmic_storm_(early|mid|late)_game_spawn_max_cap$/);
	const define = storm
		? `COSMIC_STORM_${storm[1].toUpperCase()}_GAME_SPAWN_MAX_CAP_DEFAULT_${(size ?? '').toUpperCase()}_GALAXY`
		: DEFINE_DEFAULT[key];
	if (define && d.defines[define] !== undefined)
		return { value: d.defines[define], assumed: false };
	return key in ENGINE_DEFAULT ? { value: ENGINE_DEFAULT[key], assumed: true } : null;
}

const yesNo = (v: SetupValue) => (v === true ? 'yes' : v === false ? 'no' : v);

/** Whether a save's value is its default (numbers to 0.001, booleans as yes/no). */
export function sameSetting(a: SetupValue, b: SetupValue): boolean {
	if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.001;
	return String(yesNo(a)) === String(yesNo(b));
}

/** The setup's settings in the setup screen's groups; keys we do not know go to "Other". */
export function setupGroups(
	setup: GalaxySetup,
	names: Record<string, string> = {},
	defaults: SetupDefaults | null = null
): { title: string; rows: SetupRow[] }[] {
	const known = new Set<string>();
	const size = typeof setup.template === 'string' ? setup.template : null;
	const row = (key: string, label: string, format: Format): SetupRow => {
		const def = defaults ? defaultOf(key, size, defaults) : null;
		return {
			key,
			label,
			value: formatSetting(format, setup[key], names),
			raw: setup[key],
			default: def ? formatSetting(format, def.value, names) : null,
			changed: def !== null && !sameSetting(setup[key], def.value),
			assumed: def?.assumed ?? false
		};
	};
	const groups = GROUPS.map((g) => ({
		title: g.title,
		rows: g.settings.flatMap(([key, label, format]) => {
			known.add(key);
			return key in setup ? [row(key, label, format)] : [];
		})
	}));
	const other = Object.keys(setup)
		.filter((k) => !known.has(k))
		.sort()
		.map((key) => row(key, words(key), 'text'));
	return [...groups, { title: 'Other', rows: other }].filter((g) => g.rows.length);
}
