import { colonyActiveBuildings } from '#lib/buildings.ts';
import { MEGA_RULES } from '#lib/megastructures.ts';
import { counted, wanderlustName } from '#lib/wanderlust.ts';
import type { GalaxySystem, GameData, Snapshot } from '#lib/types.ts';
import type { AutoGoal, Target } from './replay.ts';
import type { Trigger } from '#lib/triggers.ts';

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
		| 'perkTrees'
		| 'perkRules'
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
		// its reward: `<category>_modifier`, for good (4.5.3 missions/01_missions_nomads.txt)
		ref: (t) => `modifier:${s(t, 'category')}_modifier`,
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
		ref: (t) => `outpost:${n(t, 'system')}`,
		system: (t) => n(t, 'system'),
		check: (t, c) => {
			if (nomadic(c.latest))
				return { state: 'blocked', why: 'a nomadic empire builds no outposts' };
			// ours by the branch's own save; the galaxy (the campaign's latest reading) for the rest
			if (c.latest.knownSystems?.some((k) => k.id === n(t, 'system') && k.owned))
				return { state: 'done' };
			const x = sys(c, n(t, 'system'));
			if (!x) return { state: 'unknown' };
			return lost(c, x.id) ?? { state: 'open' };
		}
	},
	waystation: {
		group: 'expansion',
		name: 'build a waystation (nomads)',
		fields: ['system'],
		label: (t, c) => `Waystation in ${c.system(n(t, 'system'))}`,
		ref: (t) => `waystation:${n(t, 'system')}`,
		system: (t) => n(t, 'system'),
		// 4.5.3 megastructures/30_nomad_waystation.txt: nomads only, one waystation per system;
		// an unowned system surveyed, an owned one needs intel on its owner's deposits
		check: (t, c) => {
			const st = stationIn(c, n(t, 'system'));
			if (st?.level.startsWith('waystation'))
				return { state: 'done', why: st.level.replace('_', ' ') };
			if (!nomadic(c.latest)) return { state: 'blocked', why: 'only nomads build waystations' };
			const x = sys(c, n(t, 'system'));
			if (!x?.bodies) return { state: 'unknown', why: 'not visited yet' };
			if (x.megastructures.some((m) => m.startsWith('waystation')))
				return { state: 'progress', why: 'being built' };
			if (x.ownerId !== null && !ours(c, x.ownerId))
				return { state: 'open', why: "needs intel on the owner's deposits" };
			const left = x.bodies.filter((b) => !b.star && !b.surveyed).length;
			return left
				? { state: 'open', why: `survey it first (${left} bodies left)` }
				: { state: 'open' };
		}
	},
	arkship: {
		group: 'expansion',
		name: 'arkships of a type (nomads)',
		fields: ['type', 'count'],
		label: (t) => `${n(t, 'count')} × ${ARKSHIPS[s(t, 'type')] ?? pretty(s(t, 'type'))}`,
		// built as `<type>_arkship_megastructure` (4.5.3 megastructures/29_nomad_arkships.txt),
		// counted by ship size, any tier (`<type>_arkship_tier_<n>`)
		check: (t, c) => {
			if (!nomadic(c.latest)) return { state: 'blocked', why: 'only nomads build arkships' };
			if (c.latest.ships === null) return { state: 'unknown' };
			const have = arkships(c.latest, s(t, 'type'));
			return have >= n(t, 'count')
				? { state: 'done' }
				: { state: 'open', why: `${have} of ${n(t, 'count')}` };
		}
	},
	colony: {
		group: 'expansion',
		name: 'settle a planet, habitat or ring segment',
		fields: ['planet'],
		label: (t, c) => `Settle ${c.planet(n(t, 'planet'))}`,
		system: (t, c) => planetSystem(c, n(t, 'planet')),
		check: (t, c) => {
			if (nomadic(c.latest))
				return { state: 'blocked', why: 'a nomadic empire settles no planets' };
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
			const has = (p: string) => c.latest.progress?.researched.includes(p);
			const missing = [
				...(c.data.techRequirements[key]?.prerequisites ?? []).filter((p) => !has(p)),
				...(c.data.techRequirements[key]?.anyOf ?? [])
					.filter((g) => !g.some(has))
					.map((g) => g.map((p) => c.data.techs[p]?.name ?? p).join(' or '))
			];
			return {
				state: 'open',
				why: missing.length
					? `needs ${missing.map((p) => c.data.techs[p]?.name ?? p).join(', ')}`
					: 'its tier is not open yet'
			};
		}
	},
	tech_tier: {
		group: 'research',
		name: 'techs of a tier in an area (opens the next tier)',
		fields: ['area', 'tier', 'count'],
		label: (t) =>
			`${n(t, 'count')} ${s(t, 'area').replace(/^./, (x) => x.toUpperCase())} techs of tier ${n(t, 'tier')}`,
		check: (t, c) => {
			const researched = c.latest.progress?.researched;
			if (!researched) return { state: 'unknown' };
			const have = researched.filter(
				(k) => c.data.techs[k]?.area === s(t, 'area') && c.data.techs[k]?.tier === n(t, 'tier')
			).length;
			const want = n(t, 'count');
			return have >= want
				? { state: 'done' }
				: { state: have > 0 ? 'progress' : 'open', why: `${have} of ${want}, ${want - have} more` };
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
		// planning one whose conditions do not hold yet is allowed, with a warning (the user's
		// ask: The Flesh is Weak needs two perks taken first — `num_ascension_perks > 1`)
		check: (t, c) => {
			const taken = c.latest.ascensionPerks;
			if (taken === null) return { state: 'unknown' };
			if (taken.includes(s(t, 'perk'))) return { state: 'done' };
			const rules = c.data.perkRules?.[s(t, 'perk')];
			if (rules && c.possible(rules.potential) === false)
				return { state: 'blocked', why: 'not possible for this empire' };
			if (rules && c.possible(rules.possible) === false) {
				const need = perksNeeded(rules.possible);
				return {
					state: 'open',
					why:
						need !== null && taken.length < need
							? `⚠ needs ${need} ascension perks taken first (${taken.length} now)`
							: '⚠ its conditions do not hold yet'
				};
			}
			return { state: 'open' };
		}
	},
	focus_card: {
		group: 'focus',
		name: 'focus card',
		fields: ['card'],
		label: (t, c) => c.data.focus.cards[s(t, 'card')]?.name ?? pretty(s(t, 'card')),
		ref: (t) => `focuscard:${s(t, 'card')}`,
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
		if (t)
			return t.role === 'adopt'
				? `${tree.name} (adopt)`
				: t.role === 'finish'
					? `${tree.name} (finished)`
					: `${tree.name}: ${t.name}`;
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
	const numeric = ['system', 'planet', 'country', 'count', 'tier'];
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

/**
 * A nomadic empire: running the nomad economy situation (the origin misses most nomads, see
 * AGENTS.md "Trade tab"). It claims no systems and settles no planets (the game's
 * `nomadic_gameplay_desc`): no outposts or colonies — waystations and arkships instead.
 */
export const nomadic = (s: Snapshot) =>
	(s.situations ?? []).some((x) => x.type === 'situation_nomad_economy');

/** Kinds that cannot apply to this empire at all, left out of the add form and the suggestions. */
export const unavailable = (s: Snapshot): string[] =>
	nomadic(s) ? ['outpost', 'colony'] : ['waystation', 'arkship'];

/** The arkship types, as the game names them (localisation `<type>_arkship_class` + "Arkship"). */
export const ARKSHIPS: Record<string, string> = {
	civilian: 'Civilian Arkship',
	science: 'Scientific Arkship',
	military: 'Military Arkship'
};
export const arkships = (s: Snapshot, type: string) =>
	(s.ships ?? [])
		.filter((x) => x.size.startsWith(`${type}_arkship`))
		.reduce((a, x) => a + x.count, 0);

/**
 * What the save and the plan imply for traditions and perks: every tradition of each tree adopted
 * — or whose adoption is planned (`wanted`, the user's ask: "wanting Cybernetics only added the
 * adoption") — taken ones in the order picked, then the rest in the tree's order; for a single
 * planned pick its tree's adoption and the picks it needs first (`traditionPrereqs`); and every
 * perk taken. Ids are stable (`auto-tr-<key>`), so the same tradition is one goal whatever
 * implies it.
 */
export function autoGoals(
	s: Snapshot,
	data: Pick<GameData, 'traditionTrees'> & Partial<Pick<GameData, 'traditionPrereqs'>>,
	wanted: string[] = []
): AutoGoal[] {
	const picked = s.traditions ?? [];
	const taken = new Set(picked);
	const goal = (key: string): AutoGoal => ({
		id: `auto-tr-${key}`,
		kind: 'tradition',
		target: { tradition: key },
		polarity: 'want'
	});
	const keys: string[] = [];
	const add = (k: string) => {
		if (!keys.includes(k)) keys.push(k);
	};
	// taken ones first, in the order picked
	for (const k of picked) add(k);
	const want = new Set(wanted);
	const prereqs = data.traditionPrereqs ?? {};
	const needs = (k: string): string[] => [...(prereqs[k] ?? []).flatMap((p) => [...needs(p), p])];
	for (const t of Object.values(data.traditionTrees)) {
		const adopt = t.traditions.find((x) => x.role === 'adopt')?.key;
		if (adopt && (taken.has(adopt) || want.has(adopt))) {
			for (const x of t.traditions) add(x.key);
			continue;
		}
		for (const x of t.traditions)
			if (want.has(x.key)) {
				if (adopt) add(adopt);
				for (const p of needs(x.key)) add(p);
			}
	}
	return [
		...keys.filter((k) => !want.has(k) || taken.has(k)).map(goal),
		...(s.ascensionPerks ?? []).map((k) => ({
			id: `auto-ap-${k}`,
			kind: 'perk',
			target: { perk: k },
			polarity: 'want' as const
		}))
	];
}

/**
 * The traditions group in an order the game allows (the user's ask: "respect the order of
 * tradition picks"): those taken first, as picked; then, in the plan's order, each tradition only
 * after its tree's adoption and the picks it needs, a finisher after every other pick of its tree.
 * Kahn's algorithm, always taking the earliest goal of the plan's order that is free. Pure.
 */
export function orderTraditions<G extends { kind: string; target: Target }>(
	list: G[],
	data: Pick<GameData, 'traditionTrees'> & Partial<Pick<GameData, 'traditionPrereqs'>>,
	picked: string[]
): G[] {
	const keyOf = (g: G) => (g.kind === 'tradition' ? String(g.target.tradition) : null);
	const tree = new Map<string, { adopt?: string; members: string[]; role: string }>();
	for (const t of Object.values(data.traditionTrees)) {
		const adopt = t.traditions.find((x) => x.role === 'adopt')?.key;
		for (const x of t.traditions)
			tree.set(x.key, { adopt, members: t.traditions.map((y) => y.key), role: x.role });
	}
	const present = new Set(list.map(keyOf).filter((k) => k !== null));
	const before = (k: string): string[] => {
		const t = tree.get(k);
		const out = [...((data.traditionPrereqs ?? {})[k] ?? [])];
		if (t?.adopt && t.adopt !== k) out.push(t.adopt);
		if (t?.role === 'finish') out.push(...t.members.filter((m) => m !== k));
		return out.filter((p) => present.has(p) && p !== k);
	};
	const rank = (g: G) => {
		const k = keyOf(g);
		const i = k === null ? -1 : picked.indexOf(k);
		return i >= 0 ? i : Infinity;
	};
	// taken ones first, as picked; the plan's order otherwise
	const queue = list
		.map((g, i) => ({ g, i }))
		.sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i)
		.map((x) => x.g);
	return kahn(queue, (g) => (keyOf(g) === null ? [] : before(keyOf(g)!)), keyOf);
}

/**
 * The research group in an order research allows, each goal as early as it can be (the user's
 * ask: "Fusion Power (tier 1) before 6 Physics techs of tier 1"): a tech after the planned techs it
 * needs (prerequisites and `OR` alternatives) and the tier gates below its tier in its area; a gate
 * after the gate below it and after the planned techs of its own tier and area, which count
 * towards it. Of the goals free to go next the lowest tier goes first (a gate of tier k counts as
 * k + ½), the plan's order deciding within a tier. Pure.
 */
export function orderResearch<G extends { kind: string; target: Target }>(
	list: G[],
	data: Pick<GameData, 'techs' | 'techRequirements'>
): G[] {
	const id = (g: G) =>
		g.kind === 'tech'
			? `tech:${g.target.tech}`
			: g.kind === 'tech_tier'
				? `tier:${g.target.area}:${g.target.tier}`
				: null;
	const present = new Set(list.map(id).filter((x) => x !== null));
	const tierOf = (g: G) => (g.kind === 'tech' ? data.techs[String(g.target.tech)] : undefined);
	const before = (g: G): string[] => {
		if (g.kind === 'tech_tier')
			return [
				`tier:${g.target.area}:${Number(g.target.tier) - 1}`,
				...list
					.filter(
						(x) => tierOf(x)?.area === g.target.area && tierOf(x)?.tier === Number(g.target.tier)
					)
					.map((x) => id(x)!)
			];
		if (g.kind !== 'tech') return [];
		const key = String(g.target.tech);
		const r = data.techRequirements[key];
		const t = data.techs[key];
		const gates =
			t?.tier != null ? Array.from({ length: t.tier }, (_, i) => `tier:${t.area}:${i}`) : [];
		return [...(r?.prerequisites ?? []), ...(r?.anyOf ?? []).flat()]
			.map((p) => `tech:${p}`)
			.concat(gates);
	};
	const level = (g: G) =>
		g.kind === 'tech_tier' ? Number(g.target.tier) + 0.5 : (tierOf(g)?.tier ?? Infinity);
	return kahn(list, (g) => before(g).filter((x) => present.has(x)), id, level);
}

/** A tech's or tier gate's research area (physics, society, engineering), else null. */
export function areaOf(kind: string, target: Target, data: Pick<GameData, 'techs'>): string | null {
	if (kind === 'tech') return data.techs[String(target.tech)]?.area ?? null;
	if (kind === 'tech_tier') return String(target.area);
	return null;
}

/** The badge a goal's row carries: a tech's tier, a tradition's place in its tree, a perk. */
export function badgeOf(
	kind: string,
	target: Target,
	data: Pick<GameData, 'techs' | 'traditionTrees'>
): string | null {
	if (kind === 'tech') {
		const tier = data.techs[String(target.tech)]?.tier;
		return tier != null ? `T${tier}` : null;
	}
	if (kind === 'tech_tier') return `T${target.tier}`;
	if (kind === 'perk') return 'perk';
	if (kind === 'tradition')
		for (const t of Object.values(data.traditionTrees)) {
			const x = t.traditions.find((y) => y.key === target.tradition);
			if (x) return x.role === 'adopt' ? 'adopt' : x.role === 'finish' ? 'finisher' : 'pick';
		}
	return null;
}

/**
 * Kahn's algorithm: of the items whose `before` are placed, the lowest `level` goes next, the
 * earliest in `list` among equals.
 */
function kahn<G>(
	list: G[],
	before: (g: G) => string[],
	id: (g: G) => string | null,
	level: (g: G) => number = () => 0
): G[] {
	const queue = [...list];
	const out: G[] = [];
	const placed = new Set<string>();
	while (queue.length) {
		let at = -1;
		queue.forEach((g, i) => {
			if (before(g).every((p) => placed.has(p)) && (at < 0 || level(g) < level(queue[at]))) at = i;
		});
		const [g] = queue.splice(at < 0 ? 0 : at, 1); // a cycle: take the first
		out.push(g);
		const k = id(g);
		if (k !== null) placed.add(k);
	}
	return out;
}

/** How many perks a perk's `possible` asks to be taken first (`num_ascension_perks > n`), if it does. */
export function perksNeeded(t: Trigger | null): number | null {
	if (t === null) return null;
	if ('leaf' in t) {
		if (t.leaf !== 'num_ascension_perks') return null;
		const v = Number(t.value);
		return t.cmp === '>' ? v + 1 : t.cmp === '>=' || t.cmp === undefined ? v : null;
	}
	for (const a of t.args) {
		const n = perksNeeded(a);
		if (n !== null) return n;
	}
	return null;
}
