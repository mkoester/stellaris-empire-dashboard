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
	colonization: '#36a862' // a new world: the society green
};

export const colorOf = (key: string): string | undefined => COLORS[key];
