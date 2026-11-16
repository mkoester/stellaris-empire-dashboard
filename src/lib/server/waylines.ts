import { facts } from '#lib/government.ts';
import { discovered } from '#lib/situations.ts';
import type { Resources, Snapshot } from '#lib/types.ts';
import {
	bestModules,
	chainTo,
	collectionPoint,
	collectorOf,
	modulePicks,
	neighbours,
	networks,
	siteDeposits,
	tierOf,
	TIER_SLOTS,
	touches,
	trouble,
	unlicensed,
	waystationModules,
	type ModulePick,
	type Trouble,
	type Worth
} from '#lib/waylines.ts';
import { getGameData } from './app.ts';
import { campaignGalaxy } from './mapSystems.ts';
import { display } from './settings.ts';

// The roaming tab's waylines (#lib/waylines.ts): our waystations grouped into waylines, the
// systems worth one, the modules to put in its slots, and whose space it would be in. Only what
// the viewer may see: the galaxy as discovered and surveyed (`campaignGalaxy`, `discovered`).

const PLANNED = /^waystation:system=(\d+)$/;

/** Rare resources have no market price; their AI weight (100) puts them above the strategic ones. */
const worthOf =
	(info: ReturnType<typeof getGameData>['resourceInfo']): Worth =>
	(r) =>
		info[r]?.marketValue ?? ((info[r]?.aiWeight ?? 0) >= 100 ? 20 : 1);

export type WayPick = Pick<
	ModulePick,
	'key' | 'name' | 'collects' | 'worth' | 'wayline' | 'maybe'
> & {
	why: string;
};

export type WaySite = {
	id: number;
	name: string;
	deposits: Resources; // base a month
	best: WayPick[]; // for the free slots of a new tier-1 waystation, best first
	worth: number; // what the best collectors bring a month, in energy at market base value
	trouble: Trouble;
	owner: string | null; // the empire whose space it is, or holds the waystation
	joins: number[]; // indexes of the waylines (ours and planned) it would join
	planned: boolean;
	jumps: number | null; // from our nearest waystation or arkship
	// the systems a wayline from ours (built or planned) needs on its way here; null: none to start
	// from, or no way past others' waystations
	chain: number[] | null;
};

export type WayStation = {
	id: number;
	name: string;
	tier: number;
	modules: string[];
	free: number;
	stockpile: Resources;
	fill: number | null;
	collecting: boolean;
	next: WayPick[]; // for its free slots
};

export type Wayline = {
	systems: number[]; // built and planned
	built: number;
	point: number | null; // where a Logistics Hub collects the whole line
	modules: { key: string; name: string; have: boolean; maybe: boolean }[]; // wayline modules
};

const why = (p: ModulePick, names: Record<string, string>): string => {
	const got = Object.entries(p.collects)
		.map(([r, v]) => `${v.toFixed(1)} ${names[r] ?? r.replace(/_/g, ' ')}`)
		.join(', ');
	if (got) return `collects ${got} a month`;
	return p.wayline ? 'its effects reach the whole wayline' : '';
};

export function waylinesOf(save: Snapshot, plannedKeys: string[], arkshipSystems: number[]) {
	const game = getGameData();
	const g = campaignGalaxy(save.campaign);
	if (!g) return null;
	const galaxy = discovered(g.systems, { whole: display().wholeGalaxy, stars: false });
	const byId = new Map(galaxy.map((s) => [s.id, s]));
	const next = neighbours(galaxy);
	const me = save.countryId ?? -1;
	const f = facts(save, game.scriptedTriggers, { shipKinds: game.shipKinds });
	const mods = waystationModules(game.starbaseParts, f);
	const worth = worthOf(game.resourceInfo);
	const resNames = Object.fromEntries(
		Object.entries(game.resourceInfo).map(([k, v]) => [k, v.name])
	);
	const pick = (p: ModulePick): WayPick => ({
		key: p.key,
		name: p.name,
		collects: p.collects,
		worth: p.worth,
		wayline: p.wayline,
		maybe: p.maybe,
		why: why(p, resNames)
	});
	const pacts = new Set(
		(save.relations ?? [])
			.filter((r) => r.agreements.includes('waystation_pact'))
			.map((r) => r.countryId)
	);
	const countryName = (id: number) =>
		save.countries?.find((c) => c.id === id)?.name ?? `empire ${id}`;
	const deposits = (id: number) =>
		siteDeposits(byId.get(id)!, {
			depositCategory: game.depositCategory,
			produces: (d) => game.costs.deposit[d]?.produces
		});

	const own = (save.stations ?? []).filter(
		(s) => s.level.startsWith('waystation') && s.systemId != null
	);
	const ownIds = own.map((s) => s.systemId!);
	const planned = plannedKeys
		.flatMap((k) => {
			const m = PLANNED.exec(k);
			return m ? [Number(m[1])] : [];
		})
		.filter((id) => !ownIds.includes(id) && byId.has(id));
	const lines = networks(next, [...ownIds, ...planned]);
	const lineOf = (id: number) => lines.findIndex((l) => l.includes(id));
	const builtOn = (i: number) => own.filter((s) => lines[i].includes(s.systemId!));
	const onLine = (i: number) => new Set(i < 0 ? [] : builtOn(i).flatMap((s) => s.modules));

	const stations: WayStation[] = own.map((s) => {
		const tier = tierOf(s.level);
		const free = Math.max(0, TIER_SLOTS[tier - 1] - s.modules.length);
		const picks = modulePicks(
			deposits(s.systemId!),
			mods,
			f,
			worth,
			tier,
			s.modules,
			onLine(lineOf(s.systemId!))
		);
		return {
			id: s.systemId!,
			name: byId.get(s.systemId!)?.name ?? s.system,
			tier,
			modules: s.modules,
			free,
			stockpile: s.stockpile ?? {},
			fill: s.fill ?? null,
			collecting: s.collecting ?? false,
			next: bestModules(picks, free).map(pick)
		};
	});

	const waylines: Wayline[] = lines.map((l, i) => {
		const have = onLine(i);
		return {
			systems: l,
			built: builtOn(i).length,
			point: collectionPoint(next, l),
			modules: mods
				.filter((m) => m.part.modifiers.some((x) => x.scope.startsWith('waystation_network')))
				.map((m) => ({
					key: m.part.key,
					name: m.part.name,
					have: have.has(m.part.key),
					maybe: m.available === null
				}))
		};
	});

	// how far each system is from what we have: our waystations, else our arkships
	const from = ownIds.length ? ownIds : arkshipSystems;
	const jumps = new Map<number, number>(from.map((id) => [id, 0]));
	let frontier = [...from];
	for (let d = 1; frontier.length; d++) {
		const step: number[] = [];
		for (const at of frontier)
			for (const n of next.get(at) ?? [])
				if (!jumps.has(n)) {
					jumps.set(n, d);
					step.push(n);
				}
		frontier = step;
	}

	const taken = new Set(
		galaxy.filter((s) => s.waystation !== undefined && s.waystation !== me).map((s) => s.id)
	);
	const sites: WaySite[] = galaxy.flatMap((s) => {
		if (!s.bodies || ownIds.includes(s.id)) return [];
		const dep = deposits(s.id);
		const picks = modulePicks(dep, mods, f, worth, 1);
		const best = bestModules(picks, TIER_SLOTS[0]);
		const value = best.reduce((t, p) => t + p.worth, 0);
		const isPlanned = planned.includes(s.id);
		// a site needs a deposit to collect: the Hydroponics Bay's flat food works anywhere
		if (!isPlanned && (value <= 0 || !Object.keys(dep).some((r) => collectorOf(r)))) return [];
		const t = trouble(s, me, pacts);
		return [
			{
				id: s.id,
				name: s.name,
				deposits: dep,
				best: best.map(pick),
				worth: value,
				trouble: t,
				owner: t.kind === 'none' ? null : countryName(t.ownerId),
				joins: touches(next, lines, s.id),
				planned: isPlanned,
				jumps: jumps.get(s.id) ?? null,
				chain: t.kind === 'taken' ? null : chainTo(next, [...ownIds, ...planned], s.id, taken)
			}
		];
	});

	const unlicensedBy = [...unlicensed(galaxy, ownIds, me, pacts)].map(([id, v]) => ({
		id,
		name: countryName(id),
		...v
	}));
	const researched = new Set(save.progress?.researched ?? []);
	return {
		stations,
		waylines,
		sites: sites.sort((a, b) => b.worth - a.worth),
		unlicensed: unlicensedBy,
		pacts: [...pacts].map(countryName),
		hub: researched.has('tech_waystation_3'),
		tiers: [1, 2, 3].filter((t) => t === 1 || researched.has(`tech_waystation_${t}`)),
		// segments between neighbouring waystations of a line: drawn on the map
		segments: lines.flatMap((l) =>
			l.flatMap((a) =>
				(next.get(a) ?? [])
					.filter((b) => b > a && l.includes(b))
					.map((b) => ({ a, b, planned: planned.includes(a) || planned.includes(b) }))
			)
		),
		planned
	};
}
export type Waylines = NonNullable<ReturnType<typeof waylinesOf>>;
