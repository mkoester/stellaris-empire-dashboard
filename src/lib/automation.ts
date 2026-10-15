// Planet automation settings (common/colony_automation_categories/00_categories.txt, 4.5.2) with
// their English names. `hidden`: shown in game only to empires that unlock them, so the save may
// have them switched on while the panel does not list them.

const SETTINGS: Record<string, { name: string; hidden?: boolean }> = {
	planet_automation_deficit_restriction: { name: 'Prevent Deficit Construction' },
	planet_automation_designation_construction: { name: 'Designation' },
	planet_automation_upgrade_buildings: { name: 'Upgrade Buildings' },
	planet_automation_amenities: { name: 'Amenities' },
	planet_automation_rare_resources: { name: 'Rare Resources' },
	planet_automation_pop_assembly: { name: 'Pop Assembly' },
	planet_automation_housing: { name: 'Housing' },
	planet_automation_crime: { name: 'Crime' },
	planet_automation_clear_blockers: { name: 'Clear Blockers' },
	planet_automation_biotrophy_management: { name: 'Biotrophies', hidden: true },
	planet_automation_worm: { name: 'Omega Alignment', hidden: true },
	planet_automation_permanent_employment_center: { name: 'Posthumous Employment', hidden: true },
	planet_automation_psi_corps_building: { name: 'Psi Corps', hidden: true }
};

/** The settings as the game's panel lists them, each with whether it is on. */
export function automationRows(on: string[]) {
	return Object.entries(SETTINGS)
		.filter(([, s]) => !s.hidden)
		.map(([key, s]) => ({ key, name: s.name, on: on.includes(key) }));
}
