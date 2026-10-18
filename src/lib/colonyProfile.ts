import type { BlockerHint } from './blockers.ts';
import type { PlanetCaps } from './districtCaps.ts';
import { nameOf, pretty } from './format.ts';
import { formatModifierValue, modifierLabel } from './modifiers.ts';
import type { Colony, Explanation, Modifier } from './types.ts';

// What a colony is good and bad at, at a glance — what the game spreads over the planet's
// features, modifiers and district screen. Pros and cons:
// - district caps per type ("Mining cap 7"), summed from features, modifiers and buildings
//   (districtCaps.ts) — the strongest hint at a specialisation;
// - every other effect of its features and planet modifiers, one each, good or bad by the
//   modifier's direction (`value > 0 === positiveIsGood`);
// - blockers (the districts they take) and habitability below 100 %; free district room.
// `suits` ranks resources by that evidence: a district cap counts its size, a pro +2, a con −2.
// `mismatch` is set when the designation's resources score under half the best one.

export type Trait = {
	label: string;
	detail: string; // where it comes from
	resource: string | null; // the resource it bears on, for colour and `suits`
	ref: string | null; // popup id (`deposit:…`, `modifier:…`)
	until?: string; // a temporary planet modifier's end date
};
export type Suit = { resource: string; score: number; why: string[] };
export type Profile = { pros: Trait[]; cons: Trait[]; suits: Suit[]; mismatch: string | null };

/** "6" or, with temporary ones among them, "6 (5+1)". */
export const countLabel = (traits: Trait[]) => {
	const temporary = traits.filter((t) => t.until).length;
	return temporary
		? `${traits.length} (${traits.length - temporary}+${temporary})`
		: String(traits.length);
};

const RESOURCES = [
	'minerals',
	'energy',
	'food',
	'alloys',
	'consumer_goods',
	'physics_research',
	'society_research',
	'engineering_research',
	'unity',
	'trade',
	'rare_crystals',
	'volatile_motes',
	'exotic_gases'
];
// job and district words that stand for a resource
const WORDS: [RegExp, string][] = [
	[/miners?|mining/, 'minerals'],
	[/technicians?|generator/, 'energy'],
	[/farmers?|farming|agri/, 'food'],
	[/metallurgists?|foundry/, 'alloys'],
	[/artisans?|factory/, 'consumer_goods'],
	[/physic/, 'physics_research'],
	[/societ|biolog/, 'society_research'],
	[/engineer/, 'engineering_research']
];

/** The resource a modifier or district key bears on, if it names one. */
export function resourceOf(key: string): string | null {
	return RESOURCES.find((r) => key.includes(r)) ?? WORDS.find(([re]) => re.test(key))?.[1] ?? null;
}

// what a designation is meant to make; capitals, cities and the like aim at nothing in particular
const DESIGNATION: [RegExp, string[]][] = [
	[/mining|extraction/, ['minerals']],
	[/farming/, ['food']],
	[/generator|energy/, ['energy']],
	[/foundry|forge/, ['alloys']],
	[/factory/, ['consumer_goods']],
	[/industrial/, ['alloys', 'consumer_goods']],
	[/research|tech/, ['physics_research', 'society_research', 'engineering_research']],
	[/trade/, ['trade']],
	[/bureau/, ['unity']]
];
export const designationResources = (key: string) =>
	key.startsWith('col_capital') ? [] : (DESIGNATION.find(([re]) => re.test(key))?.[1] ?? []);

const CAP = /^(district_\w+_max_(add|mult)|planet_max_districts_(add|mult))$/;
const good = (m: Modifier) => m.value > 0 === m.positiveIsGood;
const short = (name: string) => name.replace(/ District$/, '');
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function profile(p: {
	colony: Pick<Colony, 'designation' | 'habitability' | 'planet'>;
	caps: PlanetCaps | null;
	hints: BlockerHint[]; // this colony's
	explain: Record<string, Explanation>; // deposit: and modifier: popups
	names: Record<string, string>;
}): Profile {
	const pros: Trait[] = [];
	const cons: Trait[] = [];
	// a cap source's name: `building:<key>`, or a popup id (`deposit:`, `modifier:`)
	const from = (ref: string) =>
		ref.startsWith('building:')
			? nameOf(p.names, ref.slice('building:'.length))
			: (p.explain[ref]?.title ?? pretty(ref.replace(/^\w+:/, '')));

	for (const t of p.caps?.types ?? [])
		if (t.cap)
			pros.push({
				label: `${short(nameOf(p.names, t.district))} cap ${t.cap}`,
				detail: t.sources
					.map(
						(s) =>
							`${s.value > 0 ? '+' : ''}${s.key.endsWith('_mult') ? pct(s.value) : s.value} ${from(s.from)}${s.blocked ? ' (behind a blocker)' : ''}`
					)
					.join(', '),
				resource: resourceOf(t.district),
				ref: null
			});

	// features are permanent; a planet modifier with an end date is temporary
	const sources: { ref: string; until: string | null }[] = [
		...(p.colony.planet?.deposits ?? [])
			.filter((d) => !p.hints.some((h) => h.blocker === d.key))
			.map((d) => ({ ref: `deposit:${d.key}`, until: null })),
		...(p.colony.planet?.modifiers ?? []).map((m) => ({ ref: `modifier:${m.key}`, until: m.until }))
	];
	for (const { ref, until } of sources) {
		const e = p.explain[ref];
		for (const m of e?.modifiers ?? []) {
			if (CAP.test(m.key) || m.value === 0) continue;
			(good(m) ? pros : cons).push({
				label: `${formatModifierValue(m)} ${modifierLabel(m)}`,
				detail: e.title,
				resource: resourceOf(m.key),
				ref,
				...(until ? { until } : {})
			});
		}
	}

	for (const h of p.hints)
		cons.push({
			label: `${nameOf(p.names, h.blocker)} −${h.districts} district${h.districts === 1 ? '' : 's'}`,
			detail: [
				h.days !== null ? `clearing takes ${h.days} days` : null,
				h.missing.length ? `needs ${h.missing.map((t) => nameOf(p.names, t)).join(', ')}` : null,
				h.lodge ? 'cannot be cleared: Ranger Lodge' : null,
				h.clearing ? 'being cleared' : null
			]
				.filter(Boolean)
				.join(', '),
			resource: null,
			ref: `deposit:${h.blocker}`
		});

	const hab = p.colony.habitability;
	if (hab !== null && hab < 1)
		cons.push({
			label: `habitability ${pct(hab)}`,
			detail: 'pops-weighted',
			resource: null,
			ref: null
		});
	const room = p.caps?.limit != null ? p.caps.limit - p.caps.built : 0;
	if (room > 0)
		pros.push({
			label: `${room} district${room === 1 ? '' : 's'} free`,
			detail: `${p.caps!.built} of ${p.caps!.limit} built`,
			resource: null,
			ref: null
		});

	const suits = rank(p.caps, pros, cons, p.names);
	return { pros, cons, suits, mismatch: mismatch(p.colony.designation, suits) };
}

function rank(
	caps: PlanetCaps | null,
	pros: Trait[],
	cons: Trait[],
	names: Record<string, string>
): Suit[] {
	const by = new Map<string, Suit>();
	const add = (resource: string | null, score: number, why: string) => {
		if (!resource) return;
		const s = by.get(resource) ?? { resource, score: 0, why: [] };
		s.score += score;
		s.why.push(why);
		by.set(resource, s);
	};
	for (const t of caps?.types ?? [])
		if (t.cap)
			add(resourceOf(t.district), t.cap, `${short(nameOf(names, t.district))} cap ${t.cap}`);
	for (const t of pros) if (t.ref) add(t.resource, 2, `${t.label} (${t.detail})`);
	for (const t of cons) if (t.ref) add(t.resource, -2, `${t.label} (${t.detail})`);
	return [...by.values()].filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
}

function mismatch(designation: string, suits: Suit[]): string | null {
	const meant = designationResources(designation);
	const best = suits[0];
	if (!meant.length || !best || meant.includes(best.resource)) return null;
	const own = Math.max(0, ...suits.filter((s) => meant.includes(s.resource)).map((s) => s.score));
	if (own * 2 >= best.score) return null;
	return `suits ${pretty(best.resource)} better (${best.score} vs ${own}): ${best.why.join(', ')}`;
}
