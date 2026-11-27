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
	nomads?: true; // offered to nomads only
	techs: { tech: string; why: string }[];
};

export const SHORTCUTS: Shortcut[] = [
	// Nomads first: they need some of it fast (the user's ask 2026-11-16: "there are things I need
	// rather fast, e.g. more logistic ships"). Every tech here has `potential = { is_nomadic = yes }`
	// (4.5.4 `technology/00_nomads_dlc_tech.txt`); `nomads` keeps the bundle from settled empires
	// all the same, as the society techs below are open to every empire.
	// Logistic ships (`nomads_constructor`, `nomads_engineer_vessel`) are capped by the modifier
	// `nomadic_constructor_limit_add` (`country_limits/ship_of_size_limits/00_ship_of_size_limits.txt`):
	// 2 from the start (Space Construction's nomad swap, `00_eng_tech.txt`), +2 each from Waystations
	// II and III, +1 per Logistics Hub — a waystation module of Waystations III
	// (`starbase_modules/00_waystation_modules.txt`). Nothing else in the 4.5.4 files raises it.
	// Waystations count against starbase capacity (`country_starbase_capacity_add`, 4.6.1 files): the
	// two waystation techs, and Stellar Expansion and Manifest Destiny (no `potential`, so nomads get
	// them too) — the society techs are the only exception to the nomad-only rule above. Interstellar
	// Expansion (+1, repeatable up to 5 times) follows them; Mega-Engineering (+3) is in Late game.
	{
		id: 'nomads',
		name: 'Nomads',
		why: 'logistic ships, waystations (station capacity) and arkships',
		nomads: true,
		techs: [
			{
				tech: 'tech_waystation_2',
				why: '+2 logistic ships (2 at the start), +4 waystations, +25 % logistic ship stockpile'
			},
			{
				tech: 'tech_waystation_3',
				why: '+2 logistic ships, +6 waystations; Logistics Hub module (+1 logistic ship each)'
			},
			{ tech: 'tech_galactic_ambitions', why: '+2 waystations' },
			{
				tech: 'tech_manifest_destiny',
				why: '+2 waystations; then Interstellar Expansion (+1 each, repeatable up to 5 times)'
			},
			{
				tech: 'tech_arkship_construction',
				why: 'arkships build more arkships (megastructure menu)'
			},
			{ tech: 'tech_civilian_arkship', why: 'civilian arkships' },
			{ tech: 'tech_science_arkship', why: 'science arkships' },
			{ tech: 'tech_military_arkship', why: 'military arkships' },
			{ tech: 'tech_arkship_tier_2', why: 'arkship upgrade to tier 2' },
			{ tech: 'tech_arkship_tier_3', why: 'arkship upgrade to tier 3' }
		]
	},
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
				why: 'campaign edicts (Education, Learning, Recycling …), +2.5 % unity'
			},
			{
				tech: 'tech_colonial_bureaucracy',
				why: 'Administrative Park (Network Junction for gestalts)'
			},
			{ tech: 'tech_genome_mapping', why: '+10 % pop growth' },
			{ tech: 'tech_administrative_ai', why: '+5 % research speed' },
			{ tech: 'tech_colonial_centralization', why: '+1 commander, official and scientist cap' },
			{ tech: 'tech_galactic_administration', why: '+1 civic slot' },
			{ tech: 'tech_robotic_workers', why: 'robot pops' }
		]
	},
	{
		id: 'research',
		name: 'Research buildings',
		why: 'one per field, early',
		techs: [
			{ tech: 'tech_physics_1', why: 'Field Dynamics Center (physics)' },
			{ tech: 'tech_society_1', why: 'Xenobiological Lab (society)' },
			{ tech: 'tech_engineering_1', why: 'Materials Workshop (engineering)' }
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
			{ tech: 'tech_global_research_initiative', why: 'Research Institute' },
			// Weather Control (+100, +10 %) comes along as its prerequisite: too little on its own
			{
				tech: 'tech_housing_2',
				why: '+200 housing per city district (+20 % of 1000; not Agrarian Idyll), with Weather Control’s +100'
			}
		]
	},
	{
		id: 'strategic',
		name: 'Strategic resources',
		why: 'per resource: mining its deposits, and making it in a building',
		techs: [
			{
				tech: 'tech_mine_exotic_gases',
				why: 'Exotic Gas deposits mined; Exotic Gases zone in farming districts'
			},
			{ tech: 'tech_exotic_gases', why: 'Exotic Gas Refineries' },
			{
				tech: 'tech_mine_rare_crystals',
				why: 'Rare Crystal deposits mined; Rare Crystals zone in mining districts'
			},
			{ tech: 'tech_rare_crystals', why: 'Synthetic Crystal Plants' },
			{
				tech: 'tech_mine_volatile_motes',
				why: 'Volatile Mote deposits mined; Volatile Motes zone in generator districts'
			},
			{ tech: 'tech_volatile_motes', why: 'Chemical Plants' }
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
			{ tech: 'tech_ecological_adaptation', why: 'terraforming planets with pops on them' },
			{ tech: 'tech_climate_restoration', why: 'terraforming devastated (nuked) worlds' }
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
			{
				tech: 'tech_interstellar_fleet_traditions',
				why: 'Naval Logistics Office (starbase, +3 naval capacity per Anchorage), Fleet Academy'
			},
			{ tech: 'tech_starbase_5', why: 'Citadel' },
			{ tech: 'tech_titans', why: 'Titans' },
			{ tech: 'tech_zero_point_power', why: 'Zero Point Reactor (ship power)' }
		]
	},
	{
		id: 'late',
		name: 'Late game',
		why: 'megastructures and gateways',
		// not Galactic Markets: rare, and only the Galactic Stock Exchange (−5 % market fee,
		// traders on one planet) — worth it for a market-heavy empire, not nearly every game
		techs: [
			{ tech: 'tech_mega_engineering', why: 'megastructures' },
			{ tech: 'tech_gateway_construction', why: 'build gateways' }
		]
	}
];

export type ShortcutRow<T> = Omit<Shortcut, 'techs'> & { techs: (Shortcut['techs'][number] & T)[] };

/**
 * Per bundle, the techs still worth adding: not planned (`planned`), and `offer` returns their
 * row (null when researched, under way or not possible here). Bundles left empty are dropped, and
 * a nomads-only bundle for a settled empire.
 */
export function shortcutRows<T>(
	list: Shortcut[],
	planned: (tech: string) => boolean,
	offer: (tech: string) => T | null,
	isNomad = false
): ShortcutRow<T>[] {
	return list
		.filter((s) => !s.nomads || isNomad)
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
