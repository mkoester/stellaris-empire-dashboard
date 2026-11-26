// The Ancient Highway mod (stellaris-mod-AncientHighway): a ring of unclaimable systems round the
// galaxy, a portal per empire whose gate leads into it, express wormholes between the ring's
// stations. Read from what the mod writes into the save — star flags, global flags, country flags
// and variables, megastructure types (the mod's `AGENTS.md`, "How it works"). Pure.
//
// Terms (the mod's): the **ring** of **ring nodes**, in eight **reaches**; a **portal** per empire,
// one hyperlane off its **anchor**; the portal's **gate** (entry point) and its **exit gate** in a
// ring node — a **pair** N; **study** (science ship), the techs **Highway Gate Theory** (use, seal)
// and **Highway Gate Construction** (with the theory: repair), **repair**, **head start** (a gate
// someone else repaired: 50 % of each tech), **seal** (Open/Sealed); **express stations** joined
// by **express links**, dormant until the mid game, then unstable until stabilised.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export const THEORY = 'ahw_tech_gate_theory';
export const CONSTRUCTION = 'ahw_tech_gate_construction';
/** All grants together give at most this share of each tech (`ahw_grant_tech`). */
export const GRANT_CAP = 0.8;

/** What a highway system is, on `GalaxySystem.highway`. */
export type HighwaySystem = {
	kind: 'ring' | 'portal';
	reach?: number; // a ring node's reach (variable `ahw_reach`)
	pair?: number; // a portal's pair N (`ahw_entry_N`); a ring node's exits (`ahw_exit_N`) in `exits`
	exits?: number[];
	station?: number[]; // an express station: its links j (`ahw_xst_a_j` / `ahw_xst_b_j`)
};

export type GateStage = 'broken' | 'studied' | 'repaired';

export type HighwayPortal = {
	systemId: number;
	pair: number;
	anchorId: number | null; // the system at the far end of its one hyperlane
	anchorOwnerId: number | null;
	stage: GateStage; // broken, studied (by someone: star flag `ahw_studied`), repaired
	sealed: boolean; // global flag `ahw_sealed_N`
	exitId: number | null; // the ring node with its exit gate (`ahw_exit_N`)
	ours: boolean; // our anchor, or the mod's `ahw_player_portal`
};

export type ExpressState = 'dormant' | 'open' | 'closed' | 'stable';
export type ExpressLink = { link: number; a: number | null; b: number | null; state: ExpressState };

/** What one country knows of the highway and how far it got. */
export type HighwayKnowledge = {
	id: number;
	name: string;
	studied: boolean; // country flag `ahw_highway_studied` (its own study or the head start)
	headStart: boolean; // `ahw_grant_head_start`
	granted: { theory: number; construction: number }; // shares of each tech granted so far
	techs: { theory: TechState; construction: TechState };
	known: number[]; // highway systems it has visited (ring nodes and portals)
};
/** Researched, or the research points it holds (null: none). */
export type TechState = 'researched' | number | null;

export type Highway = {
	nodes: number; // ring nodes
	portals: HighwayPortal[];
	express: ExpressLink[];
	awake: boolean; // the express woke at the mid game (`ahw_express_awake`)
	us: HighwayKnowledge;
	// every other regular empire (nomads included: country type `default`) that has been on the
	// highway or studied it — not fallen empires, fauna or event countries, which see everything
	others: HighwayKnowledge[];
};

const flagsOf = (o: Raw): string[] => Object.keys(o?.flags ?? {});
const ids = (v: Raw): number[] =>
	(Array.isArray(v) ? v : v === undefined || v === null ? [] : [v])
		.map(Number)
		.filter((n) => Number.isFinite(n) && n !== 4294967295);
const numbered = (flags: string[], prefix: string) =>
	flags
		.filter((f) => f.startsWith(prefix) && /^\d+$/.test(f.slice(prefix.length)))
		.map((f) => Number(f.slice(prefix.length)));

/** A system's place on the highway, from its star flags and variables; null for a regular one. */
export function highwaySystem(flags: string[], variables: Raw = {}): HighwaySystem | null {
	if (flags.includes('ahw_portal')) {
		const pair = numbered(flags, 'ahw_entry_')[0];
		return { kind: 'portal', ...(pair !== undefined && { pair }) };
	}
	if (!flags.includes('ahw_ring')) return null;
	const exits = numbered(flags, 'ahw_exit_');
	const station = [
		...new Set([...numbered(flags, 'ahw_xst_a_'), ...numbered(flags, 'ahw_xst_b_')])
	].sort((a, b) => a - b);
	const reach = Number(variables?.ahw_reach);
	return {
		kind: 'ring',
		...(Number.isFinite(reach) && variables?.ahw_reach !== undefined && { reach }),
		...(exits.length && { exits }),
		...(station.length && { station })
	};
}

/** Never claimable: ring nodes and portals (star flag `ahw_unclaimable`). */
export const unclaimable = (flags: string[]) => flags.includes('ahw_unclaimable');

/** A tech's state in a country block: researched, or its points (queue or kept). */
export function techState(country: Raw, tech: string): TechState {
	const ts = country?.tech_status;
	const done = ts?.technology;
	if ((Array.isArray(done) ? done : [done]).includes(tech)) return 'researched';
	for (const area of ['physics', 'society', 'engineering']) {
		const queue = ts?.[`${area}_queue`];
		for (const q of Array.isArray(queue) ? queue : queue ? [queue] : [])
			if (q?.technology === tech) return Number(q.progress) || 0;
	}
	const kept = Number(ts?.stored_techpoints_for_tech?.[tech]);
	return Number.isFinite(kept) && kept > 0 ? kept : null;
}

function knowledge(
	id: number,
	country: Raw,
	highwayIds: Set<number>,
	nameOf: (country: Raw, id: number) => string
): HighwayKnowledge {
	const flags = flagsOf(country);
	const v = country?.variables ?? {};
	return {
		id,
		name: nameOf(country, id),
		studied: flags.includes('ahw_highway_studied'),
		headStart: flags.includes('ahw_grant_head_start'),
		granted: {
			theory: Number(v.ahw_got_theory) || 0,
			construction: Number(v.ahw_got_construction) || 0
		},
		techs: { theory: techState(country, THEORY), construction: techState(country, CONSTRUCTION) },
		known: ids(country?.visited_objects).filter((s) => highwayIds.has(s))
	};
}

/**
 * The highway in a save; null without one (no ring node). `playerPortals`: the systems of the
 * mod's `ahw_player_portal` targets (`saved_event_target`).
 */
export function readHighway(p: {
	systems: Record<string, Raw>; // galactic_object
	megastructures: Record<string, Raw>;
	globalFlags: string[];
	countryId: number;
	countryBlocks: Record<string, Raw>;
	stationOwner: (system: Raw) => number | null;
	nameOf: (country: Raw, id: number) => string;
	playerPortals: number[];
}): Highway | null {
	const kinds = new Map<number, HighwaySystem>();
	for (const [key, s] of Object.entries(p.systems)) {
		const h = highwaySystem(flagsOf(s), s?.variables);
		if (h) kinds.set(Number(key), h);
	}
	if (![...kinds.values()].some((h) => h.kind === 'ring')) return null;
	const global = new Set(p.globalFlags);
	const exitOf = new Map<number, number>();
	for (const [id, h] of kinds) for (const n of h.exits ?? []) exitOf.set(n, id);
	const repairedAt = new Set<number>();
	for (const m of Object.values(p.megastructures))
		if (/^ahw_gate_\d+$/.test(String(m?.type ?? ''))) repairedAt.add(Number(m?.coordinate?.origin));

	const portals: HighwayPortal[] = [];
	for (const [id, h] of kinds) {
		if (h.kind !== 'portal' || h.pair === undefined) continue;
		const s = p.systems[String(id)];
		const flags = flagsOf(s);
		const lanes = Array.isArray(s?.hyperlane) ? s.hyperlane : s?.hyperlane ? [s.hyperlane] : [];
		const anchorId = lanes.length ? Number(lanes[0]?.to) : null;
		const anchorOwnerId = anchorId === null ? null : p.stationOwner(p.systems[String(anchorId)]);
		const repaired = repairedAt.has(id) || !flags.includes('ahw_broken');
		portals.push({
			systemId: id,
			pair: h.pair,
			anchorId,
			anchorOwnerId,
			stage: repaired ? 'repaired' : flags.includes('ahw_studied') ? 'studied' : 'broken',
			sealed: global.has(`ahw_sealed_${h.pair}`),
			exitId: exitOf.get(h.pair) ?? null,
			ours: anchorOwnerId === p.countryId || p.playerPortals.includes(id)
		});
	}
	portals.sort((a, b) => a.pair - b.pair);

	const ends = new Map<number, { a: number | null; b: number | null }>();
	for (const [key, s] of Object.entries(p.systems)) {
		const flags = flagsOf(s);
		for (const j of numbered(flags, 'ahw_xst_a_'))
			ends.set(j, { a: Number(key), b: ends.get(j)?.b ?? null });
		for (const j of numbered(flags, 'ahw_xst_b_'))
			ends.set(j, { a: ends.get(j)?.a ?? null, b: Number(key) });
	}
	const awake = global.has('ahw_express_awake');
	const express = [...ends.entries()]
		.sort(([a], [b]) => a - b)
		.map(([link, e]): ExpressLink => ({
			link,
			...e,
			state: global.has(`ahw_express_stable_${link}`)
				? 'stable'
				: !awake
					? 'dormant'
					: global.has(`ahw_express_open_${link}`)
						? 'open'
						: 'closed'
		}));

	const highwayIds = new Set(kinds.keys());
	const us = knowledge(p.countryId, p.countryBlocks[String(p.countryId)], highwayIds, p.nameOf);
	const others = Object.entries(p.countryBlocks)
		.filter(([key, c]) => Number(key) !== p.countryId && c?.type === 'default')
		.map(([key, c]) => knowledge(Number(key), c, highwayIds, p.nameOf))
		.filter((k) => k.studied || k.known.length || k.techs.theory || k.techs.construction);
	return {
		nodes: [...kinds.values()].filter((h) => h.kind === 'ring').length,
		portals,
		express,
		awake,
		us,
		others
	};
}

/** A tech's share done: researched 1, else its points ÷ cost (null without a cost). */
export function techShare(state: TechState, cost: number | null): number | null {
	if (state === 'researched') return 1;
	if (!cost) return null;
	return Math.min(1, (state ?? 0) / cost);
}

/** What our gate needs next, in the mod's words. */
export function nextStep(portal: HighwayPortal | undefined, us: HighwayKnowledge): string {
	if (!portal) return 'no portal of ours found';
	if (portal.stage === 'repaired')
		return us.techs.theory === 'researched'
			? portal.sealed
				? 'repaired and sealed'
				: 'repaired and open: usable, can be sealed'
			: 'repaired: research Highway Gate Theory to use it';
	if (portal.anchorOwnerId !== us.id) return 'claim the anchor (an outpost) to study the gate';
	if (!us.studied) return 'study the gate with a science ship';
	if (us.techs.theory !== 'researched' || us.techs.construction !== 'researched')
		return 'research Highway Gate Theory and Construction to repair it — or hire a nomad (contract)';
	return 'repair it on the gate: 300 alloys, 50 influence, 90 days';
}

/** The bits of the diplomacy reading `closeFriends()` needs (`Snapshot.diplomacy`, `allWars`). */
type FriendsInput = {
	diplomacy: {
		id: number;
		overlord: number | null;
		federation: string | null;
		relations: { countryId: number; agreements: string[] }[];
	}[];
	wars: { attackers: number[]; defenders: number[] }[];
};

/**
 * Our close friends as the mod counts them (`ahw_close_friend`, design "For a friend's gate too"):
 * federation, overlord or subject either way, fellow subjects, defensive pact or guarantee either
 * way, the same side of a war — not a non-aggression pact, migration treaty or open borders.
 */
export function closeFriends(me: number, p: FriendsInput): Set<number> {
	const out = new Set<number>();
	const us = p.diplomacy.find((c) => c.id === me);
	if (!us) return out;
	const pact = (a: string[]) => a.includes('defensive_pact') || a.includes('guarantee');
	for (const c of p.diplomacy) {
		if (c.id === me) continue;
		const ours = us.relations.find((r) => r.countryId === c.id)?.agreements ?? [];
		const theirs = c.relations.find((r) => r.countryId === me)?.agreements ?? [];
		if (
			(us.federation !== null && c.federation === us.federation) ||
			c.overlord === me ||
			us.overlord === c.id ||
			(us.overlord !== null && c.overlord === us.overlord) ||
			pact(ours) ||
			pact(theirs)
		)
			out.add(c.id);
	}
	for (const w of p.wars)
		for (const side of [w.attackers, w.defenders])
			if (side.includes(me)) for (const id of side) if (id !== me) out.add(id);
	return out;
}

/** Why a row or a system is shown: our own knowledge, a friend's (spoiler), anyone's (cheat). */
export type HighwayWhy = 'ours' | 'friend' | 'cheat';

export type HighwayView = {
	portals: (HighwayPortal & { why: HighwayWhy })[];
	express: (ExpressLink & { why: HighwayWhy })[];
	known: number[]; // highway systems the map may show (for `mapView`'s `also`)
	others: (HighwayKnowledge & { why: HighwayWhy; friend: boolean })[];
};

/**
 * What the player may see of the highway: what we visited, our portal and its exit; with the
 * `highwayFriends` spoiler also what our close friends know and their rows; with the
 * `highwayAll` cheat everything and every other country.
 */
export function highwayView(
	h: Highway,
	opts: { friends: Set<number>; spoiler: boolean; cheat: boolean }
): HighwayView {
	const ours = new Set<number>(h.us.known);
	for (const p of h.portals)
		if (p.ours) {
			ours.add(p.systemId);
			if (p.exitId !== null && h.us.studied) ours.add(p.exitId); // the study reveals it
		}
	const friendly = new Set<number>();
	if (opts.spoiler)
		for (const o of h.others)
			if (opts.friends.has(o.id)) for (const id of o.known) if (!ours.has(id)) friendly.add(id);
	const why = (ids: (number | null)[]): HighwayWhy | null =>
		ids.some((id) => id !== null && ours.has(id))
			? 'ours'
			: ids.some((id) => id !== null && friendly.has(id))
				? 'friend'
				: opts.cheat
					? 'cheat'
					: null;
	const portals = h.portals.flatMap((p) => {
		const w = why([p.systemId]);
		return w ? [{ ...p, why: w }] : [];
	});
	const express = h.express.flatMap((e) => {
		const w = why([e.a, e.b]);
		return w ? [{ ...e, why: w }] : [];
	});
	const others = h.others.flatMap((o) => {
		const friend = opts.friends.has(o.id);
		const w: HighwayWhy | null = opts.spoiler && friend ? 'friend' : opts.cheat ? 'cheat' : null;
		return w ? [{ ...o, why: w, friend }] : [];
	});
	const all = opts.cheat
		? [
				...new Set([
					...h.portals.map((p) => p.systemId),
					...h.others.flatMap((o) => o.known),
					...h.us.known
				])
			]
		: [...new Set([...ours, ...friendly])];
	return { portals, express, known: all, others };
}

/** One mark on a map: a portal by its gate's stage, an express station. */
export type HighwayMark = {
	systemId: number;
	symbol: string;
	color: string;
	title: string;
};
/** A line on a map: a gate pair (portal → exit node) or an express link. */
export type HighwayLine = {
	from: number;
	to: number;
	kind: 'gate' | 'express';
	open: boolean;
	title: string;
};

export const STAGE_COLOR: Record<GateStage, string> = {
	broken: '#9ca3af',
	studied: '#d9a521',
	repaired: '#1baf7a'
};
export const EXPRESS_COLOR = '#a855f7';

/** The highway on a map, from what the view shows (`names`: system id → name). */
export function highwayMarks(
	v: Pick<HighwayView, 'portals' | 'express'>,
	names: Map<number, string>
): { marks: HighwayMark[]; lines: HighwayLine[] } {
	const name = (id: number | null) => (id === null ? '?' : (names.get(id) ?? `system ${id}`));
	const marks: HighwayMark[] = v.portals.map((p) => ({
		systemId: p.systemId,
		symbol: p.sealed ? '⛔' : '◈',
		color: STAGE_COLOR[p.stage],
		title: `Portal ${name(p.systemId)}: gate ${p.stage}${p.sealed ? ', sealed' : ''}${p.ours ? ' (ours)' : ''}`
	}));
	const lines: HighwayLine[] = v.portals.flatMap((p) =>
		p.exitId === null
			? []
			: [
					{
						from: p.systemId,
						to: p.exitId,
						kind: 'gate' as const,
						open: p.stage === 'repaired' && !p.sealed,
						title: `Gate pair ${p.pair}: ${name(p.systemId)} ↔ ${name(p.exitId)}, ${p.stage}${p.sealed ? ', sealed' : ''}`
					}
				]
	);
	const stations = new Map<number, number[]>();
	for (const e of v.express) {
		for (const s of [e.a, e.b])
			if (s !== null) stations.set(s, [...(stations.get(s) ?? []), e.link]);
		if (e.a !== null && e.b !== null)
			lines.push({
				from: e.a,
				to: e.b,
				kind: 'express',
				open: e.state === 'open' || e.state === 'stable',
				title: `Express link ${e.link}: ${name(e.a)} ↔ ${name(e.b)}, ${e.state}`
			});
	}
	for (const [s, links] of stations)
		marks.push({
			systemId: s,
			symbol: '⇶',
			color: EXPRESS_COLOR,
			title: `Express station ${name(s)}: links ${links.join(', ')}`
		});
	return { marks, lines };
}
