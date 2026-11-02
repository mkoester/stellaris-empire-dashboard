import { scaleColor } from './colors.ts';
import type { Diplomacy, Known } from './diplomacy.ts';
import { monthStarts } from './series.ts';
import type { Territory } from './territories.ts';
import type { AiIntel, Claim, Relation } from './types.ts';

// Map modes: the map tab's borders, or its systems, recoloured by what we know of each empire —
// after the game's own (4.5.2 `common/map_modes/00_map_modes.txt`: empire, union, diplomatic,
// intel, opinion, attitude) plus ours (trust, threat, how fresh our intel is, claims). What our
// intel does not show stays grey, as the game's "no contact"; a reading our intel no longer
// shows is drawn dashed ("unverified since").

export const MAP_MODES = [
	'empire',
	'union',
	'diplomatic',
	'opinion',
	'intel',
	'attitude',
	'trust',
	'threat',
	'freshness',
	'claims'
] as const;
export type MapMode = (typeof MAP_MODES)[number];

export const MODE_INFO: Record<
	MapMode,
	{ label: string; kind: 'country' | 'system'; note: string }
> = {
	empire: { label: 'empire', kind: 'country', note: 'each empire in its map colour' },
	union: {
		label: 'union',
		kind: 'country',
		note: 'federations and overlords with their subjects in one colour each (the game’s Unions)'
	},
	diplomatic: {
		label: 'diplomatic',
		kind: 'country',
		note: 'our relation to each empire, the first that holds in the game’s order: federation, war, subject, overlord, defensive pact, non-aggression pact, research agreement, commercial pact, rivalry, closed borders, migration treaty'
	},
	opinion: {
		label: 'opinion',
		kind: 'country',
		note: 'their opinion of us, red −140 … green +140'
	},
	intel: { label: 'intel', kind: 'country', note: 'our intel on them, red 0 … green 100' },
	attitude: {
		label: 'AI attitude',
		kind: 'country',
		note: 'the AI’s attitude towards us, in the game’s colours'
	},
	trust: {
		label: 'trust',
		kind: 'country',
		note: 'trust in our relation record with them (the save’s `trust`), red 0 … green 100'
	},
	threat: {
		label: 'threat',
		kind: 'country',
		note: 'threat in our relation record with them (the save’s `threat`), green 0 … red 100'
	},
	freshness: {
		label: 'intel freshness',
		kind: 'country',
		note: 'how old the oldest reading is that our intel no longer confirms — green: all current, red: 2 years or more'
	},
	claims: {
		label: 'claims',
		kind: 'system',
		note: 'systems we claim (blue) and our systems others claim (red); borders in empire colours'
	}
};

export const parseMapMode = (v: unknown): MapMode => MAP_MODES.find((m) => m === v) ?? 'empire';

/** The game's `hsv { h s v }` (all 0–1) as a hex colour. */
export function hsv(h: number, s: number, v: number): string {
	const f = (n: number) => {
		const k = (n + h * 6) % 6;
		return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
	};
	return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

const GREY = hsv(0, 0, 0.8); // the game's "no contact" / observer colour
const US = hsv(0.58, 1, 0.8); // the game's own-empire colour (opinion, intel, attitude)
const US_DIPLOMATIC = hsv(0.3, 1, 0.6);

/** The diplomatic mode, in the game's order: what holds first colours the empire. */
const DIPLOMATIC: { kind: string; label: (mine: boolean) => string; color: string }[] = [
	{ kind: 'federation', label: () => 'in our federation', color: hsv(0.8, 0.5, 0.8) },
	{ kind: 'war', label: () => 'at war with us', color: hsv(0, 1, 0.6) },
	{ kind: 'subject', label: (m) => (m ? 'our subject' : 'our overlord'), color: hsv(0.15, 1, 0.7) },
	{ kind: 'defensive_pact', label: () => 'defensive pact', color: hsv(0.37, 0.8, 1) },
	{ kind: 'non_aggression_pledge', label: () => 'non-aggression pact', color: hsv(0.4, 0.5, 1) },
	{ kind: 'research_agreement', label: () => 'research agreement', color: hsv(0.35, 0.35, 1) },
	{ kind: 'commercial_pact', label: () => 'commercial pact', color: hsv(0.3, 0.48, 1) },
	{ kind: 'is_rival', label: (m) => (m ? 'our rival' : 'rivals us'), color: hsv(0.05, 0.6, 0.8) },
	{
		kind: 'closed_borders',
		label: (m) => (m ? 'we closed our borders' : 'closed borders to us'),
		color: hsv(0, 0.4, 0.7)
	},
	{ kind: 'migration_access', label: () => 'migration treaty', color: hsv(0.6, 0.5, 1) }
];
const NO_PACT = '#9ca3af';

/** The attitude mode's colours, the game's; attitudes it does not list are grey. */
const ATTITUDE: Record<string, string> = {
	friendly: hsv(0.25, 1, 0.6),
	patronizing: hsv(0.22, 0.7, 0.7),
	protective: hsv(0.5, 0.8, 0.65),
	loyal: hsv(0.5, 0.8, 0.75),
	cordial: hsv(0.2, 0.8, 0.75),
	dismissive: hsv(0.14, 0.4, 0.9),
	neutral: hsv(0.16, 0.2, 0.8),
	hostile: hsv(0, 0.9, 0.7),
	threatened: hsv(0.9, 0.9, 0.8),
	angry: hsv(0, 0.9, 0.6),
	unfriendly: hsv(0.03, 0.6, 0.8),
	disloyal: hsv(0.8, 0.4, 0.7),
	domineering: hsv(0.8, 0.7, 0.6),
	overlord: hsv(0.6, 0.3, 0.85)
};

// one colour per union, as `CATEGORICAL` but kept apart from the flag colours by being these
const UNION = ['#c026d3', '#0891b2', '#ea580c', '#65a30d', '#7c3aed', '#db2777', '#0d9488'];

/** A relation between us and one empire, as our intel shows it; `mine`: it points from us. */
export type ModeLink = { kind: string; mine: boolean; stale: boolean; asOf: string };

/** What the modes know of one empire (from `modeData()`, on the server). */
export type ModeCountry = {
	id: number;
	color: string | null; // its map colour
	communications: boolean;
	intel: number | null;
	federation: Known<string> | null;
	overlord: number | null;
	opinion: Known<number> | null; // theirs of us
	attitude: string | null; // towards us
	trust: number | null;
	threat: number | null;
	readings: boolean; // our intel has shown anything of it
	links: ModeLink[];
	oldest: string | null; // the oldest reading our intel no longer confirms
};
export type ModeData = {
	us: number;
	date: string;
	federation: Known<string> | null; // ours
	countries: ModeCountry[];
};

/** What the modes need, from the diplomacy tab's intel-aware view and our relations. Pure. */
export function modeData(
	d: Diplomacy | null,
	relations: Relation[],
	aiIntel: AiIntel[]
): ModeData | null {
	const us = d?.nodes.find((n) => n.us);
	if (!d || !us) return null;
	const rel = new Map(relations.map((r) => [r.countryId, r]));
	const ai = new Map(aiIntel.map((a) => [a.countryId, a]));
	return {
		us: us.id,
		date: d.date,
		federation: us.federation,
		countries: d.nodes
			.filter((n) => !n.us)
			.map((n) => {
				const r = rel.get(n.id);
				const links = d.edges.flatMap((e): ModeLink[] =>
					(e.from === us.id && e.to === n.id) || (e.from === n.id && e.to === us.id)
						? [{ kind: e.kind, mine: e.from === us.id, stale: e.stale, asOf: e.asOf }]
						: []
				);
				const opinion = d.opinions[`${n.id}:${us.id}`] ?? null;
				const readings = [
					n.government,
					n.capital,
					n.federation,
					n.origin,
					opinion,
					...d.edges.filter((e) => e.from === n.id || e.to === n.id)
				];
				const stale = readings.flatMap((k) => (k?.stale ? [k.asOf] : [])).sort();
				return {
					id: n.id,
					color: n.color,
					communications: n.communications,
					intel: n.intel,
					federation: n.federation,
					overlord: n.overlord,
					opinion,
					attitude: n.communications ? (ai.get(n.id)?.attitude ?? null) : null,
					trust: n.communications && r ? r.trust : null,
					threat: n.communications && r ? r.threat : null,
					readings: readings.some(Boolean),
					links,
					oldest: stale[0] ?? null
				};
			})
	};
}

/** One empire's look in a mode: colour, why (shown after its name), dashed when unverified. */
type Look = { color: string; why: string; stale?: boolean };

const asOf = (k: { stale: boolean; asOf: string }) =>
	k.stale ? `, unverified since ${k.asOf}` : '';
const signed = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}`;

function diplomatic(c: ModeCountry, d: ModeData): Look {
	if (!c.communications) return { color: GREY, why: 'no communications' };
	const fed = c.federation;
	if (fed && d.federation && fed.value === d.federation.value)
		return { color: DIPLOMATIC[0].color, why: `in our federation${asOf(fed)}`, stale: fed.stale };
	const at = (kind: string) => c.links.find((l) => l.kind === kind);
	for (const r of DIPLOMATIC.slice(1)) {
		const l = at(r.kind);
		if (l) return { color: r.color, why: `${r.label(l.mine)}${asOf(l)}`, stale: l.stale };
	}
	return { color: NO_PACT, why: 'no pact' };
}

/** Each empire's union: its federation, else its overlord's bloc, else itself. */
function unions(d: ModeData) {
	const names = [
		...new Set(
			[d.federation?.value, ...d.countries.map((c) => c.federation?.value)].filter(
				(x): x is string => !!x
			)
		)
	].sort();
	return (c: Pick<ModeCountry, 'federation' | 'overlord' | 'color'>): Look => {
		if (c.federation) {
			const i = names.indexOf(c.federation.value);
			return {
				color: UNION[i % UNION.length],
				why: `${c.federation.value}${asOf(c.federation)}`,
				stale: c.federation.stale
			};
		}
		const lord = c.overlord;
		if (lord !== null) {
			const o = lord === d.us ? null : d.countries.find((x) => x.id === lord);
			return {
				color: lord === d.us ? US : (o?.color ?? GREY),
				why: lord === d.us ? 'our subject' : 'a subject'
			};
		}
		return { color: c.color ?? GREY, why: 'no union' };
	};
}

/** One empire's look in a country mode. `attitudes`: key → name (data DB). */
function look(
	mode: MapMode,
	c: ModeCountry,
	d: ModeData,
	attitudes: Record<string, { name: string }>,
	union: (c: ModeCountry) => Look
): Look | null {
	switch (mode) {
		case 'union':
			return union(c);
		case 'diplomatic':
			return diplomatic(c, d);
		case 'opinion':
			return c.communications && c.opinion
				? {
						color: scaleColor(Math.max(-140, Math.min(140, c.opinion.value)), -140, 140)!,
						why: `opinion of us ${signed(c.opinion.value)}${asOf(c.opinion)}`,
						stale: c.opinion.stale
					}
				: { color: GREY, why: c.communications ? 'opinion unknown' : 'no communications' };
		case 'intel':
			return c.intel === null
				? { color: GREY, why: 'intel unknown' }
				: { color: scaleColor(c.intel, 0, 100)!, why: `intel ${Math.round(c.intel)}` };
		case 'attitude':
			return c.attitude
				? {
						color: ATTITUDE[c.attitude] ?? GREY,
						why: attitudes[c.attitude]?.name ?? c.attitude
					}
				: { color: GREY, why: c.communications ? 'attitude unknown' : 'no communications' };
		case 'trust':
			return c.trust === null
				? { color: GREY, why: 'no communications' }
				: { color: scaleColor(c.trust, 0, 100)!, why: `trust ${Math.round(c.trust)}` };
		case 'threat':
			return c.threat === null
				? { color: GREY, why: 'no communications' }
				: { color: scaleColor(c.threat, 100, 0)!, why: `threat ${Math.round(c.threat)}` };
		case 'freshness': {
			if (!c.readings) return { color: GREY, why: 'nothing known' };
			if (c.oldest === null) return { color: scaleColor(1, 0, 1)!, why: 'every reading current' };
			const months = monthStarts(c.oldest, d.date);
			return {
				color: scaleColor(Math.min(months, 24), 24, 0)!,
				why: `oldest reading unverified since ${c.oldest} (${months} months)`,
				stale: true
			};
		}
		default:
			return null; // empire, and the system modes: the map colours
	}
}

const countryOf = (key: string) => {
	const m = /^country:(\d+)$/.exec(key);
	return m ? Number(m[1]) : null;
};

/**
 * The territories as a mode colours them: each empire's colour and, after its name, why; our own
 * in the game's own-empire colour, empires our intel does not cover and guessed territories grey.
 * Our sectors are dropped, so the mode's colour shows. The empire and system modes change nothing.
 */
export function recolor(
	mode: MapMode,
	territories: Territory[],
	d: ModeData | null,
	attitudes: Record<string, { name: string }> = {}
): Territory[] {
	if (MODE_INFO[mode].kind === 'system' || mode === 'empire') return territories;
	const byId = new Map((d?.countries ?? []).map((c) => [c.id, c]));
	const union = d ? unions(d) : () => ({ color: GREY, why: 'unknown' });
	return territories.map((t) => {
		const id = countryOf(t.key);
		if (d && id === d.us) {
			const fed =
				mode === 'union' && d.federation
					? union({ federation: d.federation, overlord: null, color: null })
					: null;
			return {
				...t,
				color: fed?.color ?? (mode === 'diplomatic' ? US_DIPLOMATIC : US),
				label: `${t.label} — us${fed ? `, ${fed.why}` : ''}`,
				parts: undefined
			};
		}
		const c = id === null ? undefined : byId.get(id);
		const l = c && d ? look(mode, c, d, attitudes, union) : null;
		return l
			? { ...t, color: l.color, label: `${t.label} — ${l.why}`, guess: t.guess || !!l.stale }
			: { ...t, color: GREY, label: `${t.label} — unknown` };
	});
}

/** The claims mode: each claimed system's fill and hover text. */
export function claimFill(claims: Claim[]): {
	fill: Record<number, string>;
	titles: Record<number, string>;
} {
	const by = new Map<number, Claim[]>();
	for (const c of claims) by.set(c.systemId, [...(by.get(c.systemId) ?? []), c]);
	const fill: Record<number, string> = {};
	const titles: Record<number, string> = {};
	for (const [id, cs] of by) {
		const ours = cs.some((c) => c.ours);
		const theirs = cs.some((c) => !c.ours);
		fill[id] = ours && theirs ? CLAIM.both : ours ? CLAIM.ours : CLAIM.theirs;
		titles[id] = cs
			.map((c) =>
				c.ours
					? `we claim it (${c.claims}×${c.holder ? `, held by ${c.holder}` : ''})`
					: `claimed by ${c.claimant} (${c.claims}×)`
			)
			.join('; ');
	}
	return { fill, titles };
}
export const CLAIM = { ours: '#0e8fd0', theirs: '#dc2626', both: '#d97706' };
