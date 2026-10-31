import { nameOf, pretty } from './format.ts';

// The extraction's normalised triggers (`*_json` columns: `{ op: and|or|not, args }` or
// `{ leaf, value, cmp? }`), read against what a save tells about the empire. Three-valued: a
// condition the save cannot answer (num_rivals, a scope like `any_neighbor_country`) is null,
// "unknown", and so is everything that hangs on it — never guessed as true or false.

export type Trigger =
	{ op: 'and' | 'or' | 'not'; args: Trigger[] } | { leaf: string; value: string; cmp?: string };

/** What the save tells about the empire, for the leaves we can answer. */
export type Facts = {
	countryType: string | null;
	government: string[]; // civics, ethics and authority
	origin: string | null;
	governmentType: string | null;
	dlcs: string[] | null;
	policyFlags: string[];
	countryFlags: string[];
	traditions: string[];
	perks: string[];
	techs: string[];
	atWar: boolean | null;
	situations: number | null; // running situations
	nomadic: boolean | null; // runs situation_nomad_economy (#lib/aiTrade.ts)
	// parameter-free scripted triggers (data DB), looked into when a leaf is one of them
	scripted?: Record<string, Trigger | null>;
	traits?: string[]; // the species' traits, where a trigger is in a species' scope (rights)
	leaderTraits?: string[]; // every trait of the empire's leaders
	edicts?: string[] | null; // active
	factions?: string[] | null; // the types of our factions
	federation?: boolean | null; // in a federation
	subject?: boolean | null; // has an overlord
	electionType?: string | null; // our authority's: democratic, oligarchic, none
	// what ethic attraction reasons look into (#lib/ethicSources.ts; null: not read)
	councilEthics?: string[] | null; // the ruler's and councilors' ethics
	governorEthics?: string[] | null;
	livingStandards?: string[] | null; // of our species
	speciesTraits?: string[] | null; // of our species
	roboticSpecies?: boolean | null; // a robotic species among ours
	// `is_individual_machine`: the founder species a machine (archetype MACHINE), not a gestalt
	individualMachine?: boolean | null;
	usesFood?: boolean | null; // `country_uses_food`: food among the monthly expenses
	jobs?: string[] | null; // worked by at least one pop
	otherOrganicSpecies?: boolean | null; // more than one organic species
	allOrganicFullCitizenship?: boolean | null;
	enslavedOrganicSpecies?: boolean | null;
	// the Galactic Community, for what resolutions test (#lib/proposable.ts)
	activeResolutions?: string[] | null; // in force (`galactic_community.passed`)
	globalFlags?: string[] | null;
	galcomFormed?: boolean | null;
	galcomYears?: number | null; // whole years since the Galactic Community formed
	galcomMember?: boolean | null;
};

const ETHICS =
	/^is_(fanatic_)?(pacifist|militarist|xenophile|xenophobe|egalitarian|authoritarian|spiritualist|materialist)$/;

const HOMICIDAL = [
	'civic_fanatic_purifiers',
	'civic_machine_terminator',
	'civic_hive_devouring_swarm',
	'civic_scorched_earth',
	'civic_hive_scorched_earth'
]; // is_homicidal (4.5.2 scripted_triggers/00_scripted_triggers.txt) without the menace perk

/** One condition's truth, or null when the save cannot tell. */
function leaf(name: string, value: string, f: Facts): boolean | null {
	const has = (list: string[] | null) => (list === null ? null : list.includes(value));
	const yes = (v: boolean | null) => (v === null ? null : value === 'no' ? !v : v);
	const auth = (a: string) => f.government.includes(a);
	switch (name) {
		case 'always':
			return value === 'yes';
		case 'has_trait':
			return f.traits ? f.traits.includes(value) : null;
		case 'has_owned_leader_trait':
			// the extraction's form of `any_owned_leader = { has_trait = X }` (enclave seats)
			return f.leaderTraits ? f.leaderTraits.includes(value) : null;
		case 'is_country_type':
			return f.countryType === null ? null : f.countryType === value;
		case 'has_ethic':
		case 'has_civic':
		case 'has_valid_civic':
		case 'has_authority':
			return has(f.government);
		case 'has_origin':
			return f.origin === null ? null : f.origin === value;
		case 'has_government':
			return f.governmentType === null ? null : f.governmentType === value;
		case 'host_has_dlc':
			return has(f.dlcs);
		case 'has_policy_flag':
			return has(f.policyFlags);
		case 'has_country_flag':
			return has(f.countryFlags);
		case 'has_tradition':
			return has(f.traditions);
		case 'has_ascension_perk':
			return has(f.perks);
		case 'has_technology':
			return has(f.techs);
		case 'other_organic_species':
			return yes(f.otherOrganicSpecies ?? null);
		case 'all_organic_full_citizenship':
			return yes(f.allOrganicFullCitizenship ?? null);
		case 'enslaved_organic_species':
			return yes(f.enslavedOrganicSpecies ?? null);
		case 'council_leader_ethic':
			return has(f.councilEthics ?? null);
		case 'governor_ethic':
			return has(f.governorEthics ?? null);
		case 'assigned_jobs':
			return has(f.jobs ?? null);
		case 'has_living_standard':
		case 'species_has_living_standard':
			return has(f.livingStandards ?? null);
		case 'species_has_trait':
			return has(f.speciesTraits ?? null);
		case 'species_is_robotic':
			return yes(f.roboticSpecies ?? null);
		case 'has_election_type':
			return f.electionType == null ? null : f.electionType === value;
		case 'has_edict':
			return has(f.edicts ?? null);
		case 'has_faction':
			return has(f.factions ?? null);
		case 'has_federation':
			return yes(f.federation ?? null);
		case 'is_subject':
			return yes(f.subject ?? null);
		case 'exists':
			return value === 'overlord' ? (f.subject ?? null) : null;
		case 'is_at_war':
			return yes(f.atWar);
		case 'is_gestalt':
			return yes(auth('auth_machine_intelligence') || auth('auth_hive_mind'));
		// scripted triggers whose bodies a save cannot answer as written (`founder_species = {…}`,
		// `resource_expenses_compare`), answered from what it says
		case 'is_individual_machine':
			return yes(f.individualMachine ?? null);
		case 'country_uses_food':
			return yes(f.usesFood ?? null);
		case 'is_machine_empire':
			return yes(auth('auth_machine_intelligence'));
		case 'is_hive_empire':
			return yes(auth('auth_hive_mind'));
		case 'is_democratic_authority':
		case 'is_oligarchic_authority':
		case 'is_imperial_authority':
		case 'is_dictatorial_authority':
			// 4.5.2 scripted_triggers/00_scripted_triggers.txt: has_authority = auth_<kind>
			return yes(auth(`auth_${name.slice(3, -'_authority'.length)}`));
		case 'is_megacorp':
			return yes(auth('auth_corporate'));
		case 'is_homicidal':
			return yes(HOMICIDAL.some(auth));
		case 'is_diplomatic':
			// 4.5.2 scripted_triggers: not homicidal, not Inward Perfection
			return yes(!HOMICIDAL.some(auth) && !auth('civic_inwards_perfection'));
		case 'is_wilderness_empire':
			return yes(f.origin === null ? null : f.origin === 'origin_wilderness');
		case 'is_nomadic':
			// built into the game; a nomad runs the nomad economy situation — the origin misses
			// most (2212.06.01: six such empires, one Nomads origin)
			return yes(f.nomadic);
		case 'is_active_resolution':
			return f.activeResolutions ? f.activeResolutions.includes(value) : null;
		case 'has_global_flag':
			return f.globalFlags ? f.globalFlags.includes(value) : null;
		case 'is_galactic_community_formed':
			return yes(f.galcomFormed ?? null);
		case 'is_galactic_community_member':
			return yes(f.galcomMember ?? null);
		case 'is_galactic_council_established':
			return yes(council(f));
		// custodian, emperor and council seats come with the council (4.5.2: the council forms
		// first, `galactic_council_formed`); before it, none exists — after it, the save's fields
		// for them are not known yet
		case 'is_part_of_galactic_council':
		case 'is_galactic_custodian':
		case 'has_galactic_custodian':
		case 'is_galactic_emperor':
		case 'has_galactic_emperor':
			return council(f) === false ? value === 'no' : null;
		case 'any_situation':
			// a scope we cannot look into — but with no situation running, none matches
			return f.situations === 0 ? value === 'no' : null;
		default: {
			// is_<ethic> (the ethic or its fanatic form), is_fanatic_<ethic>: 4.5.2
			// scripted_triggers/00_scripted_triggers.txt
			const e = ETHICS.exec(name);
			if (!e) return scripted(name, value, f);
			const fanatic = f.government.includes(`ethic_fanatic_${e[2]}`);
			return yes(e[1] ? fanatic : fanatic || f.government.includes(`ethic_${e[2]}`));
		}
	}
}

/** A numeric condition (`num_x > 2`), where the save gives the number; else unknown. */
function compare(name: string, cmp: string, value: number, f: Facts): boolean | null {
	const n = name === 'is_years_since_community_formation' ? (f.galcomYears ?? null) : null;
	if (n === null || Number.isNaN(value)) return null;
	switch (cmp) {
		case '>':
			return n > value;
		case '>=':
			return n >= value;
		case '<':
			return n < value;
		case '<=':
			return n <= value;
		default:
			return n === value;
	}
}

const council = (f: Facts) =>
	f.globalFlags ? f.globalFlags.includes('galactic_council_formed') : null;

// scripted triggers being looked into, so one that (indirectly) calls itself stays unknown
const inside = new Set<string>();

/** `some_scripted_trigger = yes|no`, by its body; null when it is none or calls itself. */
function scripted(name: string, value: string, f: Facts): boolean | null {
	const body = f.scripted?.[name];
	if (body === undefined || (value !== 'yes' && value !== 'no') || inside.has(name)) return null;
	inside.add(name);
	try {
		const v = evaluate(body, f);
		return v === null ? null : value === 'no' ? !v : v;
	} finally {
		inside.delete(name);
	}
}

/** Whether `t` holds for the empire: true, false, or null if the save cannot tell. */
export function evaluate(t: Trigger | null, f: Facts): boolean | null {
	if (t === null) return true;
	if ('leaf' in t)
		return t.cmp ? compare(t.leaf, t.cmp, Number(t.value), f) : leaf(t.leaf, t.value, f);
	const vals = t.args.map((a) => evaluate(a, f));
	if (t.op === 'not') {
		// a `not` of several conditions negates their conjunction (NOT = { a b })
		const all = vals.includes(false) ? false : vals.includes(null) ? null : true;
		return all === null ? null : !all;
	}
	if (t.op === 'and') return vals.includes(false) ? false : vals.includes(null) ? null : true;
	return vals.includes(true) ? true : vals.includes(null) ? null : false;
}

/** A short readable form: "policy flag unrestricted wars or policy flag liberation wars". */
export function describe(t: Trigger | null, names: Record<string, string> = {}): string {
	if (t === null) return 'always';
	if ('leaf' in t) {
		const what = pretty(t.leaf.replace(/^(has|is)_/, ''));
		if (t.value === 'scope') return `${what} (…)`;
		if (t.cmp) return `${what} ${t.cmp} ${t.value}`;
		if (t.value === 'yes') return what;
		if (t.value === 'no') return `not ${what}`;
		return `${what} ${nameOf(names, t.value)}`;
	}
	const parts = t.args.map((a) => {
		const s = describe(a, names);
		return 'op' in a && a.op !== 'not' && a.args.length > 1 ? `(${s})` : s;
	});
	if (t.op === 'not') return `not ${parts.length > 1 ? `(${parts.join(' and ')})` : parts[0]}`;
	return parts.join(t.op === 'and' ? ' and ' : ' or ');
}

export const parseTrigger = (json: string | null): Trigger | null =>
	json ? (JSON.parse(json) as Trigger) : null;
