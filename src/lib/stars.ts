/**
 * Stars that change the fight in their system: the star classes with a `modifier` in 4.5.x
 * `common/star_classes/00_star_classes.txt` (re-check on game updates). Every other class has
 * none, the Astral Scar (`sc_rift_star`) an empty one. Names are the localisation's
 * (`sc_<class>`); the crisis variants (`sc_crisis_*`, a star the Cetana crisis turned) keep the
 * name and the effect of the star they replace.
 */
export type StarEffect = 'shields' | 'speed' | 'escape' | 'armor';

export type SpecialStar = {
	name: string;
	effect: StarEffect; // which icon
	binary: boolean; // a binary system: the icon gets a companion dot
	effects: string[]; // what the modifier does, one line each
};

const PULSAR = ['Shields −100 % (ships and stations: disabled)']; // ship_shield_reduction = 1.0
const NEUTRON = ['Sublight speed −50 %']; // ship_speed_reduction = 0.5

export const SPECIAL_STARS: Record<string, SpecialStar> = {
	sc_black_hole: {
		name: 'Black Hole',
		effect: 'escape',
		binary: false,
		effects: [
			'Disengage chance −50 %', // ship_disengage_chance_reduction = 0.5
			'Emergency FTL minimum days +50 %' // ship_emergency_ftl_min_days_mult = 0.5
		]
	},
	sc_neutron_star: { name: 'Neutron Star', effect: 'speed', binary: false, effects: NEUTRON },
	sc_pulsar: { name: 'Pulsar', effect: 'shields', binary: false, effects: PULSAR },
	sc_binary_1: {
		name: 'Binary Stars with a Pulsar',
		effect: 'shields',
		binary: true,
		effects: PULSAR
	},
	sc_crisis_binary_1: {
		name: 'Binary Stars with a Pulsar',
		effect: 'shields',
		binary: true,
		effects: PULSAR
	},
	sc_binary_2: {
		name: 'Binary Stars with a Neutron Star',
		effect: 'speed',
		binary: true,
		effects: NEUTRON
	},
	sc_crisis_binary_2: {
		name: 'Binary Stars with a Neutron Star',
		effect: 'speed',
		binary: true,
		effects: NEUTRON
	},
	sc_toxoid_star: {
		name: 'Viridescent Lightbringer',
		effect: 'armor',
		binary: false,
		effects: ['Armor −100 %'] // ship_armor_reduction = 1.0
	}
};

/** The star class's effects, or null for an ordinary star (or none known). */
export const specialStar = (star: string | undefined): SpecialStar | null =>
	(star && SPECIAL_STARS[star]) || null;

/** One line for a tooltip: "Pulsar: Shields −100 % (…)" — every ship in the system. */
export const starTitle = (s: SpecialStar) => `${s.name}: ${s.effects.join(', ')} in this system`;

/** The legend's kinds, one per icon, in the order drawn. */
export const STAR_LEGEND: { effect: StarEffect; title: string }[] = [
	{ effect: 'shields', title: 'Pulsar, or binary with one: shields −100 %' },
	{ effect: 'speed', title: 'Neutron star, or binary with one: sublight speed −50 %' },
	{
		effect: 'escape',
		title: 'Black hole: disengage chance −50 %, emergency FTL minimum days +50 %'
	},
	{ effect: 'armor', title: 'Viridescent Lightbringer: armor −100 %' }
];
