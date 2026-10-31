import { colonyActiveBuildings } from '#lib/buildings.ts';
import { MEGA_RULES } from '#lib/megastructures.ts';
import { counted, wanderlustName } from '#lib/wanderlust.ts';
import type { GalaxySystem, GameData, Snapshot } from '#lib/types.ts';
import type { Target } from './replay.ts';

// The planner's goal kinds: what each is about (its target), how it is named, and how the latest
// save answers it — done, in progress, open, no longer possible (blocked) or unknown. Every check
// reads what the page may show (the galaxy through `surveyView`, as the other tabs), so a goal
// reveals nothing hidden. Phase 1: the kinds the save can already answer. Pure.

export const GROUPS = [
	{ id: 'exploration', name: 'Exploration' },
	{ id: 'expansion', name: 'Expansion' },
	{ id: 'starbases', name: 'Starbases' },
	{ id: 'colonies', name: 'Colonies' },
	{ id: 'megastructures', name: 'Megastructures' },
	{ id: 'research', name: 'Research' },
	{ id: 'traditions', name: 'Traditions & perks' },
	{ id: 'focus', name: 'Focus' },
	{ id: 'situations', name: 'Situations & contacts' },
	{ id: 'government', name: 'Government & ethics' },
	{ id: 'other', name: 'Other' }
] as const;
export type Group = (typeof GROUPS)[number]['id'];

export type State = 'done' | 'progress' | 'open' | 'blocked' | 'unknown';
export type Status = { state: State; why?: string };

/** Starbase levels in upgrade order (`Station.level`, without `starbase_level_`). */
export const STATION_LEVELS = ['outpost', 'starport', 'starhold', 'starfortress', 'citadel'];

/** What the checks read: the latest full save, the galaxy as shown, names and rules. */
export type PlanCtx = {
	latest: Snapshot;
	galaxy: GalaxySystem[] | null;
	data: Pick<
		GameData,
		| 'techs'
		| 'techRequirements'
		| 'traditionTrees'
		| 'perks'
		| 'names'
		| 'focus'
		| 'situationTypes'
		| 'identityNames'
		| 'anomalyCategories'
		| 'civicAuthority'
	>;
	possible: (t: GameData['techRequirements'][string]['potential']) => boolean | null;
	reach: string[]; // techs within reach (`inReach`)
	// a colony's cap for a district type and what blockers hold back of it; null: unknown
	districtCap: (
		planetId: number,
		district: string
	) => { cap: number | null; blocked: number } | null;
	megaFit: (kind: string, systemId: number) => boolean | null; // the structure's rules, `null` unknown
	// what the branch's saves listed at any time (for "seen, then gone": anomalies, dig sites …)
	seen: { anomalies: number[]; digSites: number[]; situations: string[]; contacts: number[] };
};

type Kind = {
	group: Group;
	name: string; // the kind, as the add form lists it
	fields: string[]; // the target's fields
	label: (t: Target, c: LabelCtx) => string;
	ref?: (t: Target) => string | null; // an explanation key for the popup
	system?: (t: Target, c: PlanCtx) => number | null; // the system it is about, for the map
	check: (t: Target, c: PlanCtx) => Status;
	manual?: boolean; // ticked off by hand
};

/** What naming a target needs; the server fills it, the page reuses it. */
export type LabelCtx = {
	data: PlanCtx['data'];
	system: (id: number) => string;
	planet: (id: number) => string;
	country: (id: number) => string;
};

const n = (t: Target, k: string) => Number(t[k]);
const s = (t: Target, k: string) => String(t[k] ?? '');
const pretty = (k: string) =>
	k.replace(/^(tech|tr|ap|civic|auth|ethic|gov)_/, '').replace(/_/g, ' ');

const sys = (c: PlanCtx, id: number) => c.galaxy?.find((x) => x.id === id) ?? null;
const ownerOf = (c: PlanCtx, id: number) => sys(c, id)?.ownerId ?? null;
const ours = (c: PlanCtx, ownerId: number | null) =>
	ownerId !== null && ownerId === c.latest.countryId;
/** Another empire holds the system: a goal needing it is out of reach until that changes. */
const lost = (c: PlanCtx, systemId: number): Status | null => {
	const o = ownerOf(c, systemId);
	return o !== null && !ours(c, o)
		? { state: 'blocked', why: 'another empire owns the system' }
		: null;
};
const planetSystem = (c: PlanCtx, planetId: number) =>
	c.galaxy?.find((x) => x.bodies?.some((b) => b.id === planetId))?.id ?? null;
const colonyOf = (c: PlanCtx, planetId: number) =>
	c.latest.colonies.find((x) => x.planetId === planetId) ?? null;
const stationIn = (c: PlanCtx, systemId: number) =>
	c.latest.stations?.find((x) => x.systemId === systemId) ?? null;

/** Seen once, gone now: an anomaly researched, a dig site finished (or lost — the save cannot tell). */
const seenThenGone = (present: boolean, seen: boolean): Status =>
	present
		? { state: 'progress' }
		: seen
			? { state: 'done', why: 'no longer listed' }
			: { state: 'unknown', why: 'not found yet' };

export const KINDS: Record<string, Kind> = {
	survey: {
		group: 'exploration',
		name: 'survey a system',
		fields: ['system'],
		label: (t, c) => `Survey ${c.system(n(t, 'system'))}`,
		system: (t) => n(t, 'system'),
		check: (t, c) => {
			const x = sys(c, n(t, 'system'));
			if (!x?.bodies) return { state: 'unknown', why: 'not visited yet' };
			const planets = x.bodies.filter((b) => !b.star);
			const done = planets.filter((b) => b.surveyed).length;
			if (done === planets.length) return { state: 'done' };
			return {
				state: done > 0 ? 'progress' : 'open',
				why: `${done} of ${planets.length} surveyed`
			};
		}
	},
	anomaly: {
		group: 'exploration',
		name: 'research an anomaly',
		fields: ['planet'],
		label: (t, c) => `Anomaly at ${c.planet(n(t, 'planet'))}`,
		system: (t, c) =>
			c.latest.anomalies?.find((a) => a.planetId === n(t, 'planet'))?.systemId ??
			planetSystem(c, n(t, 'planet')),
		check: (t, c) =>
			seenThenGone(
				(c.latest.anomalies ?? []).some((a) => a.planetId === n(t, 'planet')),
				c.seen.anomalies.includes(n(t, 'planet'))
			)
	},
	digsite: {
		group: 'exploration',
		name: 'excavate a dig site',
		fields: ['planet'],
		label: (t, c) => `Dig site at ${c.planet(n(t, 'planet'))}`,
		system: (t, c) =>
			c.latest.digSites?.find((d) => d.planetId === n(t, 'planet'))?.systemId ??
			planetSystem(c, n(t, 'planet')),
		check: (t, c) =>
			seenThenGone(
				(c.latest.digSites ?? []).some((d) => d.planetId === n(t, 'planet')),
				c.seen.digSites.includes(n(t, 'planet'))
			)
	},
	wanderlust: {
		group: 'exploration',
		name: 'Wanderlust category',
		fields: ['category'],
		label: (t) => `Wanderlust: ${wanderlustName(s(t, 'category'))}`,
		check: (t, c) => {
			const w = c.latest.wanderlust;
			if (!w) return { state: 'unknown', why: 'no Wanderlust perk' };
			const cat = w.categories.find((x) => x.key === s(t, 'category'));
			if (w.complete || cat?.done) return { state: 'done' };
			if (!cat) return { state: 'unknown' };
			return { state: cat.seen > 0 ? 'progress' : 'open', why: `${cat.seen} of ${cat.count}` };
		}
	},
	wanderlust_visit: {
		group: 'exploration',
		name: 'Wanderlust visit (an arkship enters)',
		fields: ['system'],
		label: (t, c) => `Arkship visit to ${c.system(n(t, 'system'))}`,
		system: (t) => n(t, 'system'),
		check: (t, c) => {
			if (!c.latest.wanderlust) return { state: 'unknown', why: 'no Wanderlust perk' };
			const at = counted(c.latest.wanderlust, n(t, 'system'));
			return at ? { state: 'done', why: `counted ${at}` } : { state: 'open' };
		}
	},
	outpost: {
		group: 'expansion',
		name: 'build an outpost',
		fields: ['system'],
		label: (t, c) => `Outpost in ${c.system(n(t, 'system'))}`,
		system: (t) => n(t, 'system'),
		check: (t, c) => {
			// ours by the branch's own save; the galaxy (the campaign's latest reading) for the rest
			if (c.latest.knownSystems?.some((k) => k.id === n(t, 'system') && k.owned))
				return { state: 'done' };
			const x = sys(c, n(t, 'system'));
			if (!x) return { state: 'unknown' };
			return lost(c, x.id) ?? { state: 'open' };
		}
	},
	colony: {
		group: 'expansion',
		name: 'settle a planet, habitat or ring segment',
		fields: ['planet'],
		label: (t, c) => `Settle ${c.planet(n(t, 'planet'))}`,
		system: (t, c) => planetSystem(c, n(t, 'planet')),
		check: (t, c) => {
			const col = colonyOf(c, n(t, 'planet'));
			if (col)
				return col.colonizing ? { state: 'progress', why: 'being settled' } : { state: 'done' };
			const at = planetSystem(c, n(t, 'planet'));
			const body = sys(c, at ?? -1)?.bodies?.find((b) => b.id === n(t, 'planet'));
			if (body?.colonized) return { state: 'blocked', why: 'colonized by another empire' };
			return (at !== null && lost(c, at)) || { state: 'open' };
		}
	},
	station_level: {
		group: 'starbases',
		name: 'upgrade a starbase',
		fields: ['system', 'level'],
		label: (t, c) => `Starbase in ${c.system(n(t, 'system'))} to ${s(t, 'level')}`,
		system: (t) => n(t, 'system'),
		check: (t, c) => {
			const st = stationIn(c, n(t, 'system'));
			const want = STATION_LEVELS.indexOf(s(t, 'level'));
			if (!st) return lost(c, n(t, 'system')) ?? { state: 'open', why: 'no starbase of ours' };
			const have = STATION_LEVELS.indexOf(st.level);
			if (have >= want && want >= 0) return { state: 'done' };
			const queued = st.queue.some((q) => q.name.includes(s(t, 'level')));
			return { state: queued ? 'progress' : 'open', why: `now ${st.level}` };
		}
	},
	station_module: {
		group: 'starbases',
		name: 'starbase module',
		fields: ['system', 'module'],
		label: (t, c) =>
			`${c.data.names[s(t, 'module')] ?? pretty(s(t, 'module'))} at ${c.system(n(t, 'system'))}`,
		system: (t) => n(t, 'system'),
		check: (t, c) => stationHas(t, c, 'module', (st) => st.modules)
	},
	station_building: {
		group: 'starbases',
		name: 'starbase building',
		fields: ['system', 'building'],
		label: (t, c) =>
			`${c.data.names[s(t, 'building')] ?? pretty(s(t, 'building'))} at ${c.system(n(t, 'system'))}`,
		system: (t) => n(t, 'system'),
		check: (t, c) => stationHas(t, c, 'building', (st) => st.buildings)
	},
	district: {
		group: 'colonies',
		name: 'districts on a colony',
		fields: ['planet', 'district', 'count'],
		label: (t, c) =>
			`${n(t, 'count')} × ${c.data.names[s(t, 'district')] ?? pretty(s(t, 'district'))} on ${c.planet(n(t, 'planet'))}`,
		system: (t, c) => planetSystem(c, n(t, 'planet')),
		check: (t, c) => {
			const col = colonyOf(c, n(t, 'planet'));
			if (!col) return { state: 'unknown', why: 'not a colony of ours' };
			const want = n(t, 'count');
			const built = col.districtList.find((d) => d.type === s(t, 'district'))?.built ?? 0;
			if (built >= want) return { state: 'done' };
			const cap = c.districtCap(col.planetId, s(t, 'district'));
			if (cap?.cap != null && cap.cap + cap.blocked < want)
				return {
					state: 'blocked',
					why: `the cap is ${cap.cap}${cap.blocked ? ` (+${cap.blocked} behind blockers)` : ''}`
				};
			const queued = col.buildQueue.some((q) => q.name === s(t, 'district'));
			return { state: queued || built > 0 ? 'progress' : 'open', why: `${built} of ${want}` };
		}
	},
	building: {
		group: 'colonies',
		name: 'building on a colony',
		fields: ['planet', 'building'],
		label: (t, c) =>
			`${c.data.names[s(t, 'building')] ?? pretty(s(t, 'building'))} on ${c.planet(n(t, 'planet'))}`,
		ref: (t) => `building:${s(t, 'building')}`,
		system: (t, c) => planetSystem(c, n(t, 'planet')),
		check: (t, c) => {
			const col = colonyOf(c, n(t, 'planet'));
			if (!col) return { state: 'unknown', why: 'not a colony of ours' };
			if (colonyActiveBuildings(col.districtList).includes(s(t, 'building')))
				return { state: 'done' };
			const queued = col.buildQueue.some((q) => q.name === s(t, 'building'));
			return { state: queued ? 'progress' : 'open', why: queued ? 'queued' : undefined };
		}
	},
	megastructure: {
		group: 'megastructures',
		name: 'kilo- or megastructure',
		fields: ['system', 'structure'],
		label: (t, c) =>
			`${MEGA_RULES[s(t, 'structure') as keyof typeof MEGA_RULES]?.name ?? pretty(s(t, 'structure'))} in ${c.system(n(t, 'system'))}`,
		system: (t) => n(t, 'system'),
		check: (t, c) => {
			const x = sys(c, n(t, 'system'));
			if (!x) return { state: 'unknown' };
			const there = x.megastructures.filter((m) => m.startsWith(s(t, 'structure')));
			if (there.some((m) => !m.endsWith('_ruined')) && x.owned)
				return {
					state: there.some((m) => /_(0|1)$/.test(m)) ? 'progress' : 'done',
					why: there.join(', ')
				};
			const away = lost(c, x.id);
			if (away) return away;
			const fit = c.megaFit(s(t, 'structure'), x.id);
			if (fit === false && !there.length)
				return { state: 'blocked', why: 'the system does not fit the rules' };
			return { state: fit === null ? 'unknown' : 'open' };
		}
	},
	tech: {
		group: 'research',
		name: 'research a tech',
		fields: ['tech'],
		label: (t, c) => c.data.techs[s(t, 'tech')]?.name ?? pretty(s(t, 'tech')),
		ref: (t) => `tech:${s(t, 'tech')}`,
		check: (t, c) => {
			const key = s(t, 'tech');
			if (c.latest.progress?.researched.includes(key)) return { state: 'done' };
			if (c.latest.progress?.research.some((r) => r.tech === key))
				return { state: 'progress', why: 'being researched' };
			if (c.possible(c.data.techRequirements[key]?.potential ?? null) === false)
				return { state: 'blocked', why: 'not possible for this empire' };
			if (c.latest.techPermanent?.includes(key))
				return { state: 'open', why: 'a permanent option' };
			if (c.reach.includes(key)) return { state: 'open', why: 'within reach' };
			const missing = (c.data.techRequirements[key]?.prerequisites ?? []).filter(
				(p) => !c.latest.progress?.researched.includes(p)
			);
			return {
				state: 'open',
				why: missing.length
					? `needs ${missing.map((p) => c.data.techs[p]?.name ?? p).join(', ')}`
					: 'its tier is not open yet'
			};
		}
	},
	tradition: {
		group: 'traditions',
		name: 'tradition (or a tree, by its adoption)',
		fields: ['tradition'],
		label: (t, c) => traditionName(s(t, 'tradition'), c.data),
		ref: (t) => `tradition:${s(t, 'tradition')}`,
		check: (t, c) =>
			c.latest.traditions === null
				? { state: 'unknown' }
				: c.latest.traditions.includes(s(t, 'tradition'))
					? { state: 'done' }
					: { state: 'open' }
	},
	perk: {
		group: 'traditions',
		name: 'ascension perk',
		fields: ['perk'],
		label: (t, c) => c.data.perks[s(t, 'perk')] ?? pretty(s(t, 'perk')),
		ref: (t) => `perk:${s(t, 'perk')}`,
		check: (t, c) =>
			c.latest.ascensionPerks === null
				? { state: 'unknown' }
				: c.latest.ascensionPerks.includes(s(t, 'perk'))
					? { state: 'done' }
					: { state: 'open' }
	},
	focus_card: {
		group: 'focus',
		name: 'focus card',
		fields: ['card'],
		label: (t, c) => c.data.focus.cards[s(t, 'card')]?.name ?? pretty(s(t, 'card')),
		check: (t, c) => {
			const card = c.latest.focus?.cards.find((x) => x.key === s(t, 'card'));
			if (!c.latest.focus) return { state: 'unknown' };
			if (card?.done) return { state: 'done' };
			return { state: 'open', why: card ? 'on offer' : 'not on offer now' };
		}
	},
	situation_approach: {
		group: 'situations',
		name: 'situation approach',
		fields: ['situation', 'approach'],
		label: (t, c) => {
			const x = c.data.situationTypes[s(t, 'situation')];
			return `${x?.name ?? pretty(s(t, 'situation'))}: ${x?.approaches[s(t, 'approach')] ?? pretty(s(t, 'approach'))}`;
		},
		check: (t, c) => {
			const x = c.latest.situations?.find((y) => y.type === s(t, 'situation'));
			if (!x) return { state: 'unknown', why: 'not running' };
			return x.approach === s(t, 'approach')
				? { state: 'done' }
				: { state: 'open', why: `now ${x.approach ?? 'none'}` };
		}
	},
	situation_end: {
		group: 'situations',
		name: 'see a situation through',
		fields: ['situation'],
		label: (t, c) =>
			`${c.data.situationTypes[s(t, 'situation')]?.name ?? pretty(s(t, 'situation'))} ends`,
		check: (t, c) =>
			seenThenGone(
				(c.latest.situations ?? []).some((y) => y.type === s(t, 'situation')),
				c.seen.situations.includes(s(t, 'situation'))
			)
	},
	contact: {
		group: 'situations',
		name: 'first contact',
		fields: ['country'],
		label: (t, c) => `First contact: ${c.country(n(t, 'country'))}`,
		system: (t, c) =>
			c.latest.firstContacts?.find((f) => f.countryId === n(t, 'country'))?.systemId ?? null,
		check: (t, c) => {
			const f = c.latest.firstContacts?.find((x) => x.countryId === n(t, 'country'));
			if (!f) {
				const talked = c.latest.relations?.some(
					(r) => r.countryId === n(t, 'country') && r.communications
				);
				return talked ? { state: 'done' } : { state: 'unknown' };
			}
			if (f.status === 'finished') return { state: 'done' };
			if (f.status === 'aborted') return { state: 'blocked', why: 'aborted' };
			return { state: f.leaderId !== null ? 'progress' : 'open', why: `stage ${f.stage}` };
		}
	},
	identity: {
		group: 'government',
		name: 'civic, authority or ethic',
		fields: ['key'],
		label: (t, c) => c.data.identityNames[s(t, 'key')] ?? pretty(s(t, 'key')),
		ref: (t) => identityRef(s(t, 'key')),
		check: (t, c) => {
			const key = s(t, 'key');
			if (c.latest.government === null) return { state: 'unknown' };
			if (c.latest.government.includes(key)) return { state: 'done' };
			const rule = c.data.civicAuthority[key];
			const auth = c.latest.government.find((k) => k.startsWith('auth_'));
			if (
				rule &&
				auth &&
				(rule.forbid.includes(auth) || (rule.require.length && !rule.require.includes(auth)))
			)
				return { state: 'blocked', why: `not with ${c.data.identityNames[auth] ?? auth}` };
			return { state: 'open' };
		}
	},
	government_type: {
		group: 'government',
		name: 'government type (by reform)',
		fields: ['key'],
		label: (t, c) => c.data.identityNames[s(t, 'key')] ?? pretty(s(t, 'key')),
		ref: (t) => `gov:${s(t, 'key')}`,
		check: (t, c) =>
			c.latest.governmentType === null
				? { state: 'unknown' }
				: c.latest.governmentType === s(t, 'key')
					? { state: 'done' }
					: { state: 'open' }
	},
	free: {
		group: 'other',
		name: 'anything (ticked off by hand)',
		fields: [],
		label: () => '',
		manual: true,
		check: () => ({ state: 'open' })
	}
};

function stationHas(
	t: Target,
	c: PlanCtx,
	field: 'module' | 'building',
	list: (st: NonNullable<Snapshot['stations']>[number]) => string[]
): Status {
	const st = stationIn(c, n(t, 'system'));
	if (!st) return lost(c, n(t, 'system')) ?? { state: 'open', why: 'no starbase of ours' };
	if (list(st).includes(s(t, field))) return { state: 'done' };
	return st.queue.some((q) => q.name === s(t, field))
		? { state: 'progress', why: 'queued' }
		: { state: 'open' };
}

const identityRef = (key: string) =>
	key.startsWith('auth_')
		? `authority:${key}`
		: key.startsWith('ethic_')
			? `ethic:${key}`
			: `civic:${key}`;

export function traditionName(key: string, data: Pick<GameData, 'traditionTrees'>): string {
	for (const tree of Object.values(data.traditionTrees)) {
		const t = tree.traditions.find((x) => x.key === key);
		if (t) return t.role === 'adopt' ? `${tree.name} (adopt)` : t.name;
	}
	return pretty(key);
}

export const groupOf = (kind: string): Group => KINDS[kind]?.group ?? 'other';

/** A goal's status for its polarity: an avoided goal that came true "happened". */
export function check(kind: string, target: Target, checked: boolean, c: PlanCtx): Status {
	const k = KINDS[kind];
	if (!k) return { state: 'unknown', why: `unknown kind ${kind}` };
	if (k.manual) return checked ? { state: 'done' } : { state: 'open' };
	return k.check(target, c);
}

export function label(kind: string, target: Target, title: string, c: LabelCtx): string {
	return title || KINDS[kind]?.label(target, c) || kind;
}

/** Whether a goal's target is well formed for its kind (its fields present, ids numbers). */
export function validTarget(kind: string, target: Target): boolean {
	const k = KINDS[kind];
	if (!k) return false;
	const numeric = ['system', 'planet', 'country', 'count'];
	return (
		Object.keys(target).length === k.fields.length &&
		k.fields.every((f) =>
			numeric.includes(f)
				? Number.isFinite(Number(target[f])) && typeof target[f] === 'number'
				: typeof target[f] === 'string' &&
					String(target[f]).length > 0 &&
					String(target[f]).length <= 200
		)
	);
}

/** Where each target field's choices come from in the add form; per kind where a name means different things. */
const SOURCE: Record<string, string> = {
	'district.planet': 'colonies',
	'building.planet': 'colonies',
	'station_building.building': 'starbaseBuildings',
	'station_module.module': 'modules',
	'government_type.key': 'govtype'
};
export const sourceOf = (kind: string, field: string) => SOURCE[`${kind}.${field}`] ?? field;
