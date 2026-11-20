import { nomadic } from './planner/kinds.ts';
import type { Snapshot } from './types.ts';

// Where influence can go — the user's ask 2026-11-16: "this time I have too much influence;
// find all possible sinks", then "hide things I won't be able to use in this playthrough (nomads:
// assume never settles; settled: assume never embarks), grey out things not yet available". Pure.
//
// The list is every cost and upkeep that names influence in the 4.5.4 files (`common/**`, a scan
// of every `cost`/`upkeep` block) plus the defines (`00_defines.txt`: EXPANSION_COST_BASE,
// CLAIM_COST_BASE, BRANCH_OFFICE_INFLUENCE_COST_*, MOVE_CAPITAL_INFLUENCE_COST, the GalCom and
// agreement costs). Costs are base costs: modifiers scale them. Re-check on game updates.
// Left out: the relic CFL trophies (200, which relics we hold is not read) and the astral action
// Flash-Forge Hyper Relay (50, the rift is not read).

/** What the save tells about the empire, for the sinks' rules. */
export type SinkFacts = {
	nomad: boolean;
	megacorp: boolean;
	origin: string | null;
	civics: string[]; // and authority and ethics keys: the save's `government`
	perks: string[];
	techs: Set<string>;
	flags: string[]; // country flags
	situations: string[];
	partners: number; // regular empires we have communications with
	commercialPacts: number;
	primitives: number; // pre-FTL civilisations we know
	galcom: { formed: boolean; member: boolean; council: boolean; nominating: boolean };
	subjects: number; // ours
	overlord: boolean; // we are someone's subject
	specialist: boolean; // a subject with a specialization
	colonies: number;
	envoysFree: number | null;
};

export type SinkGroup =
	| 'expansion'
	| 'nomads'
	| 'megastructures'
	| 'diplomacy'
	| 'galcom'
	| 'subjects'
	| 'covert'
	| 'decisions';

export const SINK_GROUPS: Record<SinkGroup, string> = {
	expansion: 'Expansion',
	nomads: 'Nomads',
	megastructures: 'Megastructures',
	diplomacy: 'Diplomacy (a month)',
	galcom: 'Galactic Community',
	subjects: 'Subjects',
	covert: 'Espionage and proxy wars',
	decisions: 'Decisions and the rest'
};

type Sink = {
	id: string;
	group: SinkGroup;
	name: string;
	cost: string; // base influence, as text: "75+", "0.25 / month"
	note?: string;
	/** false: this empire cannot use it in this playthrough — hidden */
	applies?: (f: SinkFacts) => boolean;
	/** why it is not available yet — greyed — or null */
	blocked?: (f: SinkFacts) => string | null;
};

const civic = (f: SinkFacts, ...keys: string[]) => keys.some((k) => f.civics.includes(k));
const tech = (key: string, name: string) => (f: SinkFacts) =>
	f.techs.has(key) ? null : `needs ${name}`;
const perk = (key: string, name: string) => (f: SinkFacts) =>
	f.perks.includes(key) ? null : `needs the ascension perk ${name}`;
const settled = (f: SinkFacts) => !f.nomad;
const nomads = (f: SinkFacts) => f.nomad;
const talk = (f: SinkFacts) =>
	f.partners > 0 ? null : 'no empire to deal with: needs communications with one';
const envoy = (f: SinkFacts) => talk(f) ?? (f.envoysFree === 0 ? 'no free envoy' : null);
const member = (f: SinkFacts) =>
	!f.galcom.formed
		? 'the Galactic Community is not founded yet'
		: f.galcom.member
			? null
			: 'not a member of the Galactic Community';
const council = (f: SinkFacts) =>
	member(f) ?? (f.galcom.council ? null : 'no Galactic Council yet');

export const SINKS: Sink[] = [
	// --- expansion: settled empires
	{
		id: 'outpost',
		group: 'expansion',
		name: 'Outpost',
		cost: '75+',
		note: 'grows with distance and the outposts you have',
		applies: settled
	},
	{
		id: 'claim',
		group: 'expansion',
		name: 'Claim on another empire’s system',
		cost: '50+',
		note: 'per claim level; grows with distance',
		applies: settled,
		blocked: talk
	},
	{
		id: 'capital',
		group: 'expansion',
		name: 'Move the capital',
		cost: '250',
		applies: settled,
		blocked: (f) => (f.colonies > 1 ? null : 'needs a second colony')
	},
	{
		id: 'resettle-last',
		group: 'expansion',
		name: 'Resettle a colony’s last pop',
		cost: '50',
		note: 'surcharge, on top of the resettlement'
	},
	// --- nomads (`common/megastructures/30_nomad_waystation.txt`, ship_sizes, starbase_modules,
	// scripted_variables/10_scripted_variables_nomads.txt)
	{
		id: 'waystation',
		group: 'nomads',
		name: 'Waystation',
		cost: '100',
		note: '50 where a subject may expand with a tithe',
		applies: nomads
	},
	{
		id: 'waystation-2',
		group: 'nomads',
		name: 'Waystation upgrade to tier 2',
		cost: '50',
		applies: nomads,
		blocked: tech('tech_waystation_2', 'Waystations II')
	},
	{
		id: 'waystation-3',
		group: 'nomads',
		name: 'Waystation upgrade to tier 3',
		cost: '50',
		applies: nomads,
		blocked: tech('tech_waystation_3', 'Waystations III')
	},
	{
		id: 'arkship-new',
		group: 'nomads',
		name: 'A new arkship',
		cost: '500',
		applies: nomads,
		blocked: tech('tech_arkship_construction', 'Arkship Construction')
	},
	{
		id: 'arkship-2',
		group: 'nomads',
		name: 'Arkship upgrade to tier 2',
		cost: '250',
		note: 'each arkship',
		applies: nomads,
		blocked: tech('tech_arkship_tier_2', 'Arkship Engineering')
	},
	{
		id: 'arkship-3',
		group: 'nomads',
		name: 'Arkship upgrade to tier 3',
		cost: '250',
		note: 'each arkship',
		applies: nomads,
		blocked: tech('tech_arkship_tier_3', 'Arkship Mastery')
	},
	{
		id: 'arkship-habitation',
		group: 'nomads',
		name: 'Arkship habitation module',
		cost: '25',
		applies: nomads
	},
	{
		id: 'arkship-exodus',
		group: 'nomads',
		name: 'Arkship Exodus Jump module',
		cost: '250',
		applies: nomads,
		blocked: tech('tech_arkship_exodus_jump', 'Exodus Jump')
	},
	{
		id: 'waystation-pact',
		group: 'nomads',
		name: 'Wayline pact',
		cost: '0.25 / month',
		note: 'each; no diplomatic penalty for waystations in their space',
		applies: nomads,
		blocked: talk
	},
	{
		id: 'knights-arkship',
		group: 'nomads',
		name: 'Consecrate an arkship to the Knights',
		cost: '500',
		applies: (f) => f.nomad && f.origin === 'origin_toxic_knights'
	},
	// --- megastructures: settled only where they must be inside the borders
	{
		id: 'gateway',
		group: 'megastructures',
		name: 'Gateway',
		cost: '75',
		applies: settled,
		blocked: tech('tech_gateway_construction', 'Gateway Construction')
	},
	{
		id: 'hyper-relay',
		group: 'megastructures',
		name: 'Hyper Relay',
		cost: '25',
		blocked: tech('tech_hyper_relays', 'Hyper Relays')
	},
	{
		id: 'orbital-ring',
		group: 'megastructures',
		name: 'Orbital ring, and its tiers',
		cost: '50, then 50 / 100 / 150',
		applies: settled,
		blocked: tech('tech_orbital_ring_tier_1', 'Orbital Rings')
	},
	{
		id: 'orbital-ring-habitation',
		group: 'megastructures',
		name: 'Orbital ring habitation module',
		cost: '25',
		applies: settled,
		blocked: tech('tech_orbital_ring_tier_1', 'Orbital Rings')
	},
	{
		id: 'habitat-complex',
		group: 'megastructures',
		name: 'Habitat central complex',
		cost: '200',
		applies: settled,
		blocked: (f) =>
			f.techs.has('tech_habitat_1') ||
			civic(f, 'civic_diadochi', 'civic_great_khans_legacy') ||
			f.flags.includes('democratic_khanate_flag')
				? null
				: 'needs Orbital Habitats'
	},
	{
		id: 'ring-world',
		group: 'megastructures',
		name: 'Ring World',
		cost: '300',
		applies: settled,
		blocked: tech('tech_ring_world', 'Ring World')
	},
	{
		id: 'catapult',
		group: 'megastructures',
		name: 'Quantum Catapult',
		cost: '300',
		blocked: tech('tech_quantum_catapult', 'Quantum Catapult')
	},
	{
		id: 'dyson-gun',
		group: 'megastructures',
		name: 'Dyson gun',
		cost: '300',
		applies: settled,
		blocked: tech('tech_dyson_gun', 'the Dyson gun')
	},
	{
		id: 'cosmogenesis',
		group: 'megastructures',
		name: 'Cosmogenesis world',
		cost: '300',
		blocked: tech('tech_cosmogenesis_world', 'Cosmogenesis')
	},
	{
		id: 'behemoth-egg',
		group: 'megastructures',
		name: 'Behemoth egg, and hatching it',
		cost: '300, then 150',
		blocked: (f) =>
			f.perks.includes('menp_behemoth_egg') ? null : 'needs the Behemoth Fury crisis path'
	},
	// --- diplomacy: upkeep per relation (`common/diplomacy_economy/00_diplomacy_economy.txt`)
	{
		id: 'defensive-pact',
		group: 'diplomacy',
		name: 'Defensive pact',
		cost: '1 / month',
		blocked: talk
	},
	{
		id: 'federation',
		group: 'diplomacy',
		name: 'Federation membership',
		cost: '1 / month',
		blocked: talk
	},
	{
		id: 'guarantee',
		group: 'diplomacy',
		name: 'Guarantee independence',
		cost: '0.5 / month',
		blocked: talk
	},
	{
		id: 'pacts',
		group: 'diplomacy',
		name: 'Non-aggression, research, commercial or migration pact',
		cost: '0.25 / month',
		note: 'each',
		blocked: talk
	},
	{
		id: 'closed-borders',
		group: 'diplomacy',
		name: 'Closed borders',
		cost: '0.25 / month',
		note: 'each; free towards a rival',
		blocked: talk
	},
	{
		id: 'envoy-relations',
		group: 'diplomacy',
		name: 'Envoy improving or harming relations',
		cost: '0.25 / month',
		note: 'each envoy',
		blocked: envoy
	},
	{
		id: 'enlightenment',
		group: 'diplomacy',
		name: 'Enlightening a pre-FTL civilisation',
		cost: '0.1 / month',
		blocked: (f) => (f.primitives > 0 ? null : 'no pre-FTL civilisation known')
	},
	// --- Galactic Community (scripted_variables `@resolution_cost_*`, defines, galactic_community_actions)
	{
		id: 'join',
		group: 'galcom',
		name: 'Join the Galactic Community',
		cost: '100',
		applies: (f) => !f.galcom.member,
		blocked: (f) => (f.galcom.formed ? null : 'the Galactic Community is not founded yet')
	},
	{
		id: 'propose',
		group: 'galcom',
		name: 'Propose a resolution',
		cost: '100–300',
		note: 'by tier',
		blocked: member
	},
	{ id: 'denounce', group: 'galcom', name: 'Denounce', cost: '25', blocked: member },
	{
		id: 'end-session',
		group: 'galcom',
		name: 'End the Senate session',
		cost: '190',
		note: 'Galactic Council',
		blocked: council
	},
	{
		id: 'freeze',
		group: 'galcom',
		name: 'Freeze a resolution',
		cost: '200',
		note: 'Galactic Council',
		blocked: council
	},
	{
		id: 'market-nomination',
		group: 'galcom',
		name: 'Nominate a planet for the Galactic Market, boost or revoke it',
		cost: '150 / 300 / 10',
		blocked: (f) =>
			f.galcom.nominating ? null : 'only while the Galactic Market’s site is being chosen'
	},
	{
		id: 'leave',
		group: 'galcom',
		name: 'Leave the Galactic Community',
		cost: '100–500',
		note: 'half your empire size, kept within that range',
		applies: (f) => f.galcom.member
	},
	{
		id: 'imperial-council',
		group: 'galcom',
		name: 'Change a member of the Imperial Council',
		cost: '100',
		blocked: () => 'only under a Galactic Emperor (not read from the save)'
	},
	// --- subjects (defines AGREEMENT_*: 50 / 25 + 5 × the loyalty change)
	{
		id: 'agreement',
		group: 'subjects',
		name: 'Propose new subject terms, or refuse them',
		cost: '50+ (overlord refusing: 25+)',
		note: '+5 per point of loyalty change',
		blocked: (f) => (f.subjects > 0 || f.overlord ? null : 'no subject, no overlord')
	},
	{
		id: 'specialist-conversion',
		group: 'subjects',
		name: 'Converting a subject to a specialist',
		cost: '3 / month',
		blocked: (f) =>
			f.subjects === 0 ? 'no subject' : perk('ap_shared_destiny', 'Shared Destiny')(f)
	},
	// --- espionage and proxy wars (espionage_operation_types, casus_belli `proxy_war_resources`)
	{
		id: 'espionage',
		group: 'covert',
		name: 'Espionage operations',
		cost: '20–320',
		note: 'each; needs a spy network',
		blocked: talk
	},
	{
		id: 'proxy-war',
		group: 'covert',
		name: 'Proxy war',
		cost: '100–200',
		note: 'by casus belli',
		blocked: talk
	},
	// --- decisions and the rest (decisions: data DB `decision.cost_json`; gates from `potential_json`)
	{
		id: 'branch-office',
		group: 'decisions',
		name: 'Branch office',
		cost: '75 + 5 a jump',
		note: 'at most 1000',
		applies: (f) => f.megacorp,
		blocked: (f) =>
			f.commercialPacts > 0 || civic(f, 'civic_criminal_heritage')
				? null
				: 'needs a commercial pact'
	},
	{
		id: 'branch-buildings',
		group: 'decisions',
		name: 'Branch office buildings',
		cost: '10–30',
		note: 'each',
		applies: (f) => f.megacorp
	},
	{
		id: 'arcology',
		group: 'decisions',
		name: 'Arcology Project',
		cost: '200',
		applies: settled,
		blocked: perk('ap_arcology_project', 'Arcology Project')
	},
	{
		id: 'mastery-of-nature',
		group: 'decisions',
		name: 'Mastery of Nature',
		cost: '100',
		applies: settled,
		blocked: perk('ap_mastery_of_nature', 'Mastery of Nature')
	},
	{
		id: 'hydrocentric',
		group: 'decisions',
		name: 'Expand a planetary sea, flood a habitat',
		cost: '50',
		applies: settled,
		blocked: perk('ap_hydrocentric', 'Hydrocentric')
	},
	{
		id: 'worldscaping',
		group: 'decisions',
		name: 'Cultivated worldscaping',
		cost: '100',
		applies: (f) =>
			settled(f) &&
			civic(
				f,
				'civic_environmental_architects',
				'civic_environmental_architects_hive',
				'civic_environmental_architects_machine',
				'civic_environmental_architects_megacorp'
			)
	},
	{
		id: 'wilderness',
		group: 'decisions',
		name: 'Expand the wilderness',
		cost: '50',
		applies: (f) => f.origin === 'origin_wilderness'
	},
	{
		id: 'deep-sleep',
		group: 'decisions',
		name: 'Deep sleep',
		cost: '100',
		applies: (f) =>
			civic(
				f,
				'civic_deep_sleep',
				'civic_corporate_deep_sleep',
				'civic_hive_deep_sleep',
				'civic_machine_deep_sleep'
			)
	},
	{
		id: 'strip-mining',
		group: 'decisions',
		name: 'Strip mining',
		cost: '15',
		applies: (f) => f.specialist
	},
	{
		id: 'crystalline',
		group: 'decisions',
		name: 'Crystalline architecture, crystalline refugees',
		cost: '10',
		applies: (f) =>
			f.flags.includes('crystalline_architecture_flag') ||
			f.flags.includes('crystalline_refugees_flag')
	},
	{
		id: 'knights-habitat',
		group: 'decisions',
		name: 'Consecrate a habitat to the Knights',
		cost: '50',
		applies: (f) => settled(f) && f.origin === 'origin_toxic_knights'
	},
	{
		id: 'knights-situation',
		group: 'decisions',
		name: 'The Toxic Knights’ situation',
		cost: '100',
		applies: (f) => f.origin === 'origin_toxic_knights'
	},
	{
		id: 'paperclips',
		group: 'decisions',
		name: 'The paperclip situation',
		cost: '1 / month',
		applies: (f) => f.situations.includes('situation_paperclips')
	},
	{
		id: 'inner-focus',
		group: 'decisions',
		name: 'Inner Focus edict',
		cost: '3, then 3 / month',
		applies: (f) =>
			civic(
				f,
				'civic_sovereign_guardianship',
				'civic_hive_sovereign_guardianship',
				'civic_machine_sovereign_guardianship',
				'civic_corporate_sovereign_guardianship'
			)
	}
];

export type SinkRow = {
	id: string;
	group: SinkGroup;
	name: string;
	cost: string;
	note: string | null;
	blocked: string | null; // why it is not available yet (greyed)
};

/** The sinks this empire can use in this playthrough, each with why not yet, if so. */
export const sinkRows = (f: SinkFacts, list: Sink[] = SINKS): SinkRow[] =>
	list
		.filter((s) => s.applies?.(f) ?? true)
		.map((s) => ({
			id: s.id,
			group: s.group,
			name: s.name,
			cost: s.cost,
			note: s.note ?? null,
			blocked: s.blocked?.(f) ?? null
		}));

/** The facts from the latest full save. Pacts need a regular empire (type `default`) to sign. */
export function sinkFacts(s: Snapshot): SinkFacts {
	const types = new Map((s.countries ?? []).map((c) => [c.id, c.type]));
	const relations = s.relations ?? [];
	const subjects = s.subjects ?? [];
	const flags = s.galcom?.globalFlags ?? [];
	return {
		nomad: nomadic(s),
		megacorp: (s.government ?? []).includes('auth_corporate'),
		origin: s.origin,
		civics: s.government ?? [],
		perks: s.ascensionPerks ?? [],
		techs: new Set(s.progress?.researched ?? []),
		flags: s.countryFlags ?? [],
		situations: (s.situations ?? []).map((x) => x.type),
		partners: relations.filter(
			(r) => r.communications && (types.get(r.countryId) ?? 'default') === 'default'
		).length,
		commercialPacts: relations.filter((r) => r.agreements.includes('commercial_pact')).length,
		primitives: (s.countries ?? []).filter((c) => c.type === 'primitive').length,
		galcom: {
			formed: s.galcom !== null,
			member: s.galcom?.member ?? false,
			council: flags.includes('galactic_council_formed'),
			nominating:
				flags.includes('ongoing_market_nomination') ||
				flags.includes('ongoing_market_relocation_nomination')
		},
		subjects: subjects.filter((x) => x.weAreOverlord).length,
		overlord: subjects.some((x) => !x.weAreOverlord),
		specialist: subjects.some((x) => !x.weAreOverlord && x.specialistLevel > 0),
		colonies: s.colonies.length,
		envoysFree: s.envoys ? s.envoys.total - s.envoys.used : null
	};
}
