// Colors as the game shows them: resources and research fields after their icons
// (gfx/interface/icons/resources/*.dds), the rest after the game's text colours
// (interface/fonts.gfx). Picked to read on both light and dark backgrounds.

const COLORS: Record<string, string> = {
	energy: '#d9a521',
	minerals: '#d0403a',
	food: '#4caf3a',
	alloys: '#b55bc4',
	consumer_goods: '#c8743a',
	unity: '#22a99c',
	influence: '#8f6ad8',
	trade: '#4f94b5',
	physics_research: '#2f8fe0',
	society_research: '#36a862',
	engineering_research: '#e08a2e',
	exotic_gases: '#2e8b3e',
	rare_crystals: '#c9a227',
	volatile_motes: '#b0603a',
	// events without a resource of their own
	agenda: '#e09a1f', // the game's highlight orange (§H)
	election: '#8f6ad8', // politics: influence
	construction: '#d0403a', // built with minerals
	ship: '#4f94b5', // civilian ships: the game's sensor blue
	colonization: '#36a862', // a new world: the society green
	// milestones (#lib/milestones.ts) not covered above
	system: '#4f94b5', // borders: sensor blue
	colony: '#2e7d32',
	'colony-gained': '#7cb342',
	'colony-lost': '#c62828',
	war: '#d0403a',
	combat: '#a8322d', // war, darker
	'tradition-tree': '#127a70',
	tradition: '#22a99c', // unity
	perk: '#8f6ad8',
	research: '#2f8fe0',
	species: '#c8743a',
	'trade-deal': '#d9a521', // energy
	leader: '#6b7280',
	ruler: '#8c6d1f',
	government: '#d64a9b',
	policy: '#a3a830',
	edict: '#b55bc4',
	sector: '#3bb2c2',
	dlc: '#2f8fe0',
	mod: '#c8743a',
	district: '#8c6d1f',
	building: '#d0403a', // built with minerals
	// leader classes, after the game's class icons
	'class-official': '#d9a521',
	'class-commander': '#d0403a',
	'class-scientist': '#2f8fe0',
	'class-envoy': '#8a7fb8', // ours: envoys have no class colour of their own
	// empire focus categories, after the game's focus panel (blue, red, gold; core cards brown)
	'focus-exploration': '#3a86c8',
	'focus-conquest': '#c8463a',
	'focus-development': '#c9962e',
	'focus-core_focus': '#9a8059',
	// planet classes by climate (#lib/climate.ts), after the climate-preference trait icons
	// (gfx/interface/icons/traits/trait_pc_*_preference.dds)
	'climate-dry': '#b99037',
	'climate-wet': '#559028',
	'climate-cold': '#47a0a0',
	'climate-volcanic': '#aa6a10',
	'climate-special': '#ae9301', // Gaia, ring world, habitat, city, relic …: the gold icons
	'climate-toxic': '#7f8a3a' // no preference icon: olive, after the toxic planet's
};

export const colorOf = (key: string): string | undefined => COLORS[key];
