// Tech shortcuts for the planner (the user's ask 2026-11-06: "techs almost every player would want
// for a playthrough, offered as shortcuts"). Pure.
//
// The list is ours, not the game's: a web search found no reliable 4.x consensus, so each entry
// is a tech whose unlock the 4.5.3 game files show (zone slots in `common/zone_slots/`, zone
// buildings in `common/buildings/03_resource_buildings.txt`, the tech's own modifier), picked
// for being worth it in nearly every game. Playstyle needs no condition here: a tech whose
// `potential` is false for the empire (Battleships for bio shipsets, Stingers for the rest,
// robots for hive minds) shows blocked and is left out. Prerequisites and tier gates follow
// from `techNeeds()` once a tech is planned.

export type Shortcut = {
	id: string;
	name: string;
	why: string;
	techs: { tech: string; why: string }[];
};

export const SHORTCUTS: Shortcut[] = [
	{
		id: 'economy',
		name: 'Economy core',
		why: 'early, every empire',
		techs: [
			{ tech: 'tech_power_hub_1', why: 'zone slot in generator districts' },
			{ tech: 'tech_mineral_purification_1', why: 'zone slot in mining districts' },
			{ tech: 'tech_food_processing_1', why: 'zone slot in farming districts' },
			{
				tech: 'tech_planetary_unification',
				why: 'city zone slots 4 and 5 (with Colonial Bureaucracy)'
			},
			{ tech: 'tech_colonial_bureaucracy', why: 'city zone slots 4 and 5' },
			{ tech: 'tech_genome_mapping', why: '+10 % pop growth' },
			{ tech: 'tech_administrative_ai', why: '+5 % research speed' },
			{ tech: 'tech_colonial_centralization', why: '+1 commander, official and scientist cap' },
			{ tech: 'tech_galactic_administration', why: '+1 civic slot' },
			{ tech: 'tech_robotic_workers', why: 'robot pops' }
		]
	},
	{
		id: 'economy2',
		name: 'Economy, second step',
		why: 'the zone buildings upgraded, more housing',
		techs: [
			{ tech: 'tech_power_hub_2', why: 'Energy Grid → Energy Nexus' },
			{ tech: 'tech_mineral_purification_2', why: 'Purification Plant → Hub' },
			{ tech: 'tech_food_processing_2', why: 'Processing Facility → Center' },
			{ tech: 'tech_droid_workers', why: 'droids: robots in specialist jobs' },
			{ tech: 'tech_global_research_initiative', why: 'research building upgrade' },
			{ tech: 'tech_housing_1', why: 'housing in city districts' },
			{ tech: 'tech_housing_2', why: 'housing in city districts' }
		]
	},
	{
		id: 'strategic',
		name: 'Strategic resources',
		why: 'zones in the resource districts',
		techs: [
			{ tech: 'tech_mine_exotic_gases', why: 'Exotic Gases zone in farming districts' },
			{ tech: 'tech_mine_rare_crystals', why: 'Rare Crystals zone in mining districts' },
			{ tech: 'tech_mine_volatile_motes', why: 'Volatile Motes zone in generator districts' }
		]
	},
	{
		id: 'expansion',
		name: 'Habitats and terraforming',
		why: 'more and better planets',
		techs: [
			{ tech: 'tech_habitat_1', why: 'orbital habitats' },
			{ tech: 'tech_space_science_1', why: 'habitat research slot' },
			{ tech: 'tech_habitat_2', why: 'second habitat slot' },
			{ tech: 'tech_terrestrial_sculpting', why: 'terraforming' },
			{ tech: 'tech_ecological_adaptation', why: 'terraforming inhabited planets' },
			{ tech: 'tech_climate_restoration', why: 'restores Tomb Worlds, Gaia links' }
		]
	},
	{
		id: 'military',
		name: 'Military',
		why: 'the hull line follows the shipset',
		techs: [
			{ tech: 'tech_battleships', why: 'largest regular hull' },
			{ tech: 'tech_stingers', why: 'bio shipsets' },
			{ tech: 'tech_doctrine_navy_size_1', why: '+25 naval capacity' },
			{ tech: 'tech_interstellar_fleet_traditions', why: 'naval capacity' },
			{ tech: 'tech_starbase_5', why: 'Citadel' },
			{ tech: 'tech_titans', why: 'Titans' }
		]
	},
	{
		id: 'late',
		name: 'Late game',
		why: 'megastructures and mobility',
		techs: [
			{ tech: 'tech_mega_engineering', why: 'megastructures' },
			{ tech: 'tech_gateway_construction', why: 'build gateways' },
			{ tech: 'tech_galactic_markets', why: 'the Galactic Market' },
			{ tech: 'tech_zero_point_power', why: 'energy' }
		]
	}
];

export type ShortcutRow<T> = Omit<Shortcut, 'techs'> & { techs: (Shortcut['techs'][number] & T)[] };

/**
 * Per bundle, the techs still worth adding: not planned (`planned`), and `offer` returns their
 * row (null when researched, under way or not possible here). Bundles left empty are dropped.
 */
export function shortcutRows<T>(
	list: Shortcut[],
	planned: (tech: string) => boolean,
	offer: (tech: string) => T | null
): ShortcutRow<T>[] {
	return list
		.map((s) => ({
			...s,
			techs: s.techs.flatMap((t) => {
				if (planned(t.tech)) return [];
				const row = offer(t.tech);
				return row === null ? [] : [{ ...t, ...row }];
			})
		}))
		.filter((s) => s.techs.length > 0);
}
