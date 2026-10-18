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
		case 'is_at_war':
			return yes(f.atWar);
		case 'is_gestalt':
			return yes(auth('auth_machine_intelligence') || auth('auth_hive_mind'));
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
		case 'is_wilderness_empire':
			return yes(f.origin === null ? null : f.origin === 'origin_wilderness');
		case 'is_nomadic':
			// built into the game; Nomads origins are the only way to be one (approximation)
			return yes(f.origin === null ? null : f.origin.includes('nomad'));
		case 'any_situation':
			// a scope we cannot look into — but with no situation running, none matches
			return f.situations === 0 ? value === 'no' : null;
		default: {
			// is_<ethic> (the ethic or its fanatic form), is_fanatic_<ethic>: 4.5.2
			// scripted_triggers/00_scripted_triggers.txt
			const e = ETHICS.exec(name);
			if (!e) return null;
			const fanatic = f.government.includes(`ethic_fanatic_${e[2]}`);
			return yes(e[1] ? fanatic : fanatic || f.government.includes(`ethic_${e[2]}`));
		}
	}
}

/** Whether `t` holds for the empire: true, false, or null if the save cannot tell. */
export function evaluate(t: Trigger | null, f: Facts): boolean | null {
	if (t === null) return true;
	if ('leaf' in t) return t.cmp ? null : leaf(t.leaf, t.value, f);
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
