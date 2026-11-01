import type { ExpansionRow } from './expansion.ts';
import { distances, graph } from './galaxyGraph.ts';
import type { GalaxySystem, Snapshot } from './types.ts';

// Settling down (a nomad's arkship becomes a planet's colony) and embarking (a settled empire
// takes to the stars) — what the game asks of the empire, read from 4.5.2's files:
// - settle: the arkship action `arkship_settle` (`common/scripted_actions/03_arkships.txt`), its
//   empire condition `nomad_can_settle_trigger` (`scripted_triggers/09_scripted_triggers_nomads.txt`)
//   and game rule `can_nomad_settle` (`game_rules/00_rules.txt`); the outcome `nomads.4705`;
// - embark: the planet decision `decision_nomad_embarkation`
//   (`decisions/15_nomads_dlc_decisions.txt`), its potential `can_embark_trigger`.
// Influence, alloys and other costs are left out (the user's call: they fluctuate). Each check is
// three-valued: `met` null where the save cannot tell.

export type Requirement = {
	key: string;
	label: string;
	met: boolean | null;
	detail: string;
	never?: boolean; // can never be met (an origin, a civic, a perk)
};

type Names = Record<string, string>;
const nameOf = (names: Names, key: string) => names[key] ?? key;

const GESTALT = ['auth_hive_mind', 'auth_machine_intelligence'];
const HOMICIDAL = [
	'civic_fanatic_purifiers',
	'civic_machine_terminator',
	'civic_hive_devouring_swarm',
	'civic_scorched_earth',
	'civic_hive_scorched_earth'
];
const SETTLE_NEVER = ['origin_sacred_path', 'origin_heirs_of_the_khan'];
const EMBARK_NEVER_ORIGINS = [
	'origin_legendary_leader',
	'origin_legendary_leader_death',
	'origin_legendary_leader_imperial',
	'origin_legendary_leader_dictatorial',
	'origin_endbringers',
	'origin_shroud_forged',
	'origin_fear_of_the_dark',
	'origin_toxic_knights',
	'origin_tree_of_life',
	'origin_fruitful'
];
const EMBARK_SITUATIONS = ['situation_red_giant_expansion', 'situation_cosmic_dawn'];

/** The tree that unlocks both: Versatility for a Machine Intelligence, Adaptability otherwise. */
export const settleTree = (s: Pick<Snapshot, 'government'>) =>
	s.government?.includes('auth_machine_intelligence')
		? 'tradition_versatility'
		: 'tradition_adaptability';

function treeRequirement(
	s: Pick<Snapshot, 'traditions' | 'government'>,
	trees: Record<string, { name: string; traditions: { key: string }[] }>
): Requirement {
	const tree = settleTree(s);
	const t = trees[tree];
	const finish = tree.replace(/^tradition_/, 'tr_') + '_finish';
	const keys = t?.traditions.map((x) => x.key) ?? [];
	const taken = s.traditions === null ? null : keys.filter((k) => s.traditions!.includes(k)).length;
	return {
		key: 'tradition',
		label: `${t?.name ?? tree} finished`,
		met: s.traditions === null ? null : s.traditions.includes(finish),
		detail:
			taken === null
				? 'traditions unknown in this save'
				: `${taken} of ${keys.length} taken${taken ? '' : ' — not adopted yet'}`
	};
}

const notSubject = (s: Pick<Snapshot, 'subjects'>): Requirement => {
	const overlord = s.subjects?.find((x) => !x.weAreOverlord);
	return {
		key: 'independent',
		label: 'not a subject',
		met: s.subjects === null ? null : !overlord,
		detail: overlord ? `subject of ${overlord.name}` : ''
	};
};

/**
 * What settling asks of a nomadic empire. Sacred Path and Heirs of the Khan never settle; Forever
 * Cruise settles after its planetfall (flag `forever_cruise_planetfall`), the Knights of the Toxic
 * God once they visited the Toxic God (`visited_toxic_god_system`) — either without the tradition
 * —, or with it once their keep is destroyed (`toxic_knights_destroyed_keep`).
 */
export function settleRequirements(
	s: Pick<Snapshot, 'traditions' | 'government' | 'origin' | 'countryFlags' | 'subjects'>,
	trees: Record<string, { name: string; traditions: { key: string }[] }>,
	names: Names = {}
): Requirement[] {
	const flag = (f: string) => (s.countryFlags === null ? null : s.countryFlags.includes(f));
	const origin = s.origin;
	if (origin !== null && SETTLE_NEVER.includes(origin))
		return [
			{
				key: 'origin',
				label: `origin ${nameOf(names, origin)}`,
				met: false,
				detail: '“We are nomadic to our core. We will never settle.”',
				never: true
			}
		];
	if (origin === 'origin_forever_cruise')
		return [
			{
				key: 'origin',
				label: 'planetfall (Forever Cruise)',
				met: flag('forever_cruise_planetfall'),
				detail: 'the origin settles only after its planetfall; no tradition needed'
			},
			notSubject(s)
		];
	if (origin === 'origin_toxic_knights' && flag('toxic_knights_destroyed_keep') !== true)
		return [
			{
				key: 'origin',
				label: 'the Toxic God visited',
				met: flag('visited_toxic_god_system'),
				detail: 'the Knights settle once their quest reached the Toxic God; no tradition needed'
			},
			notSubject(s)
		];
	return [treeRequirement(s, trees), notSubject(s)];
}

/**
 * What embarking asks of a settled empire (`can_embark_trigger` and the decision's `allow`): the
 * tree (or flag `doomsday_embark_unlocked`), none of the origins, civics, perk or situations that
 * rule it out, independence, not embarking already, no colony being settled.
 */
export function embarkRequirements(
	s: Pick<
		Snapshot,
		| 'traditions'
		| 'government'
		| 'origin'
		| 'countryFlags'
		| 'subjects'
		| 'ascensionPerks'
		| 'situations'
		| 'colonies'
	>,
	trees: Record<string, { name: string; traditions: { key: string }[] }>,
	names: Names = {}
): Requirement[] {
	const flag = (f: string) => (s.countryFlags === null ? null : s.countryFlags.includes(f));
	const out: Requirement[] = [];
	const tree = treeRequirement(s, trees);
	out.push(
		flag('doomsday_embark_unlocked') === true
			? { ...tree, met: true, detail: 'unlocked by the Doomsday origin' }
			: tree
	);
	const origin = s.origin;
	const blockedOrigin =
		origin === 'origin_wilderness' || (origin !== null && EMBARK_NEVER_ORIGINS.includes(origin));
	out.push({
		key: 'origin',
		label: 'origin',
		met: origin === null ? null : !blockedOrigin,
		detail: blockedOrigin ? `${nameOf(names, origin!)} never embarks` : '',
		never: blockedOrigin || undefined
	});
	const homicidal = (s.government ?? []).filter((c) => HOMICIDAL.includes(c));
	const perk = s.ascensionPerks?.includes('ap_cosmogenesis') ?? null;
	out.push({
		key: 'identity',
		label: 'not homicidal, no Cosmogenesis',
		met: s.government === null || perk === null ? null : !homicidal.length && !perk,
		detail: [...homicidal, ...(perk ? ['ap_cosmogenesis'] : [])]
			.map((k) => nameOf(names, k))
			.join(', '),
		never: homicidal.length || perk ? true : undefined
	});
	const situation = s.situations?.find((x) => EMBARK_SITUATIONS.includes(x.type));
	out.push({
		key: 'situation',
		label: `no ${EMBARK_SITUATIONS.map((k) => nameOf(names, k)).join(' or ')}`,
		met: s.situations === null ? null : !situation,
		detail: situation ? `${nameOf(names, situation.type)} running — fine once it ends` : ''
	});
	out.push(notSubject(s));
	const colonizing = s.colonies.filter((c) => c.colonizing);
	out.push({
		key: 'colonizing',
		label: 'no colony being settled',
		met: !colonizing.length,
		detail: colonizing.map((c) => c.name).join(', ')
	});
	if (flag('already_embarking'))
		out.push({ key: 'embarking', label: 'embarkation under way', met: true, detail: '' });
	return out;
}

/** All met; null when one is unknown and none is unmet. */
export function allMet(rs: Requirement[]): boolean | null {
	if (rs.some((r) => r.met === false)) return false;
	return rs.some((r) => r.met === null) ? null : true;
}

/** Arkship tier → minerals and alloys each back from scuttling one (10 % of its alloys). */
export const SCUTTLE_REFUND: Record<number, number> = { 1: 1000, 2: 1500, 3: 2000 };

export type SettleOutcome = {
	arkships: number;
	// the arkships besides the one that settles: their pops and the refund were they scuttled
	others: { name: string; pops: number; refund: number }[];
	waystations: number; // become outposts (in systems no one owns)
	logistic: number; // logistic ships → construction ships, engineer vessels → engineering ships
	subjectOptions: boolean | null; // options c and d: a subject can be released
	why: string; // why c and d are not open
};

/**
 * What settling would do now, assuming the capital arkship settles: with one arkship option a,
 * else b (the others scuttled), c (it becomes a settled subject, we roam on) or d (we settle, the
 * others become a nomadic subject). c and d: not homicidal, not the Knights, a gestalt only as a
 * Progenitor Hive.
 */
export function settleOutcome(
	s: Pick<
		Snapshot,
		'arkships' | 'colonies' | 'stations' | 'civilianShips' | 'government' | 'origin'
	>
): SettleOutcome {
	const arks = s.arkships ?? [];
	const settling = arks.find((a) => a.capital) ?? arks[0];
	// an arkship's colony has the planet id −1 − ship id (colonyPlaces)
	const popsOf = (shipId: number) => s.colonies.find((c) => c.planetId === -1 - shipId)?.pops ?? 0;
	const gov = s.government;
	const why =
		gov === null
			? ''
			: [
					...(gov.some((c) => HOMICIDAL.includes(c)) ? ['homicidal'] : []),
					...(s.origin === 'origin_toxic_knights' ? ['Knights of the Toxic God'] : []),
					...(gov.some((c) => GESTALT.includes(c)) && s.origin !== 'origin_progenitor_hive'
						? ['gestalt (only a Progenitor Hive may)']
						: [])
				].join(', ');
	return {
		arkships: arks.length,
		others: arks
			.filter((a) => a !== settling)
			.map((a) => ({ name: a.name, pops: popsOf(a.shipId), refund: SCUTTLE_REFUND[a.tier] ?? 0 })),
		waystations: (s.stations ?? []).filter((x) => x.level.startsWith('waystation')).length,
		logistic: (s.civilianShips ?? []).filter((x) => x.size?.startsWith('nomads_')).length,
		subjectOptions: gov === null ? null : why === '',
		why
	};
}

/**
 * Arkship Remains (`arkship_parts`, `common/static_modifiers/25_static_modifiers_nomads.txt`), the
 * settled planet's lasting modifier: +60 % `pop_environment_tolerance`, +2 districts.
 */
export const ARKSHIP_REMAINS = { tolerance: 0.6, districts: 2 };
/** Days to settle before arkship action speed (`@arkship_settle_required_progress`). */
export const SETTLE_DAYS = 360;

export type SettleTarget = {
	planetId: number;
	name: string;
	className: string;
	climate: ExpansionRow['climate'];
	size: number;
	system: string;
	systemId: number | null;
	hab: number; // today's estimate for the species
	settled: number; // with Arkship Remains' tolerance (≈: assumed to count on every colonizable class)
	deposits: number; // deposits on the system's other bodies: each gets a station on settling (≈)
	fromArk: number | null; // jumps from the nearest of our arkships
	fromCapital: number | null; // jumps from the capital arkship
};

/**
 * Where an arkship could settle: the expansion candidates the game offers for it — colonizable,
 * in a surveyed system no one owns (`arkship_settle`'s `possible`; the candidates hold only
 * unowned planets) — but a consecrated world (`can_nomad_settle`). Best first: habitability once
 * settled, then size.
 */
export function settleTargets(
	rows: ExpansionRow[],
	galaxy: GalaxySystem[],
	arks: { systemId: number | null; capital: boolean }[],
	species: string | null
): SettleTarget[] {
	const systemOf = new Map<number, GalaxySystem>();
	for (const g of galaxy) for (const b of g.bodies ?? []) systemOf.set(b.id, g);
	const lanes = graph(
		galaxy.flatMap((g) => g.lanes.map((to): [number, number] => [g.id, to])),
		[]
	);
	const from = (ids: (number | null)[]) =>
		distances(
			lanes,
			ids.filter((x) => x !== null)
		).jumps;
	const fromArk = from(arks.map((a) => a.systemId));
	const fromCapital = from(arks.filter((a) => a.capital).map((a) => a.systemId));
	return rows
		.filter(
			(r) =>
				r.colonizable && !(r.planet?.modifiers ?? []).some((m) => m.key === 'consecrated_world')
		)
		.map((r) => {
			const sys = systemOf.get(r.planetId);
			const hab = species === null ? 0 : (r.hab[species] ?? 0);
			return {
				planetId: r.planetId,
				name: r.name,
				className: r.className,
				climate: r.climate,
				size: r.size,
				system: r.system,
				systemId: sys?.id ?? null,
				hab,
				settled: Math.min(1, hab + ARKSHIP_REMAINS.tolerance),
				deposits: (sys?.bodies ?? [])
					.filter((b) => b.id !== r.planetId)
					.reduce((n, b) => n + b.deposits.length, 0),
				fromArk: sys ? (fromArk.get(sys.id) ?? null) : null,
				fromCapital: sys ? (fromCapital.get(sys.id) ?? null) : null
			};
		})
		.sort((a, b) => b.settled - a.settled || b.size - a.size || a.name.localeCompare(b.name));
}
