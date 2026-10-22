import type {
	BudgetSource,
	Costs,
	GalaxySystem,
	GameData,
	KnownSystem,
	Resources,
	Snapshot
} from './types.ts';
import { valueOf } from './value.ts';

// What each of our systems cost and earned, save by save — pure.
// - Monthly: a system's starbase (level, modules, buildings) and stations have base upkeep and
//   output in the data DB; the budget books them per kind for the whole empire (`starbases`,
//   `starbase_modules`, `station_gatherers`, `orbital_mining_deposits`, …), so each kind's booked
//   total is split over the systems by their base values — modifiers then count, empire-wide.
//   Without a budget (older snapshots) the base values stand.
// - One-off: the outpost when a system becomes ours (alloys from the data DB, influence
//   estimated: EXPANSION_COST_BASE + EXPANSION_COST_DISTANCE per jump beyond the first, from our
//   nearest system — the engine's distance basis is not in the files), construction items we pay
//   for in the system (exact, the save's `resources`), else what the starbase gained between two
//   saves at data DB prices; new stations at their size's cost.
// - With colonies, a system's colonies count too: their output and upkeep (the planet view's sums)
//   and the construction on them.

export type SystemData = Pick<GameData, 'depositCategory' | 'defines'> & {
	costs: Pick<GameData['costs'], 'ship' | 'module' | 'starbaseBuilding' | 'deposit'>;
};

export type Flow = { income: Resources; upkeep: Resources };

/** A one-off payment for a system. */
export type SystemSpend = {
	systemId: number;
	date: string;
	label: string;
	cost: Resources;
	approx: boolean; // data DB prices before modifiers, or an estimate
	colony: boolean; // spent on a colony there
};

export type SystemPoint = { date: string; invested: Resources; earned: Resources };

export const LEVELS = ['outpost', 'starport', 'starhold', 'starfortress', 'citadel'];

const STATION_SIZE: Record<string, { size: string; upkeep: string; income: string }> = {
	orbital_mining_deposits: {
		size: 'mining_station',
		upkeep: 'station_gatherers',
		income: 'orbital_mining_deposits'
	},
	orbital_research_deposits: {
		size: 'research_station',
		upkeep: 'station_researchers',
		income: 'orbital_research_deposits'
	}
};

const add = (a: Resources, b: Resources, k = 1): Resources => {
	const out = { ...a };
	for (const [r, v] of Object.entries(b)) out[r] = (out[r] ?? 0) + v * k;
	return out;
};
const sum = (rs: Resources[]) => rs.reduce((a, b) => add(a, b), {});
const NONE: Costs = { cost: {}, upkeep: {}, produces: {} };

const gameDay = (date: string) => {
	const [y, m, d] = date.split('.').map(Number);
	return y * 360 + (m - 1) * 30 + d;
};

/** Months between two game dates (30-day months), counted in whole days. */
export const monthsBetween = (from: string, to: string) => (gameDay(to) - gameDay(from)) / 30;

/** A snapshot's stations by system id; older snapshots name the system only. */
function starbasesOf(s: Snapshot): Map<number, NonNullable<Snapshot['stations']>[number]> {
	const byName = new Map((s.knownSystems ?? []).map((k) => [k.name, k.id]));
	const out = new Map<number, NonNullable<Snapshot['stations']>[number]>();
	for (const st of s.stations ?? []) {
		const id = st.systemId ?? byName.get(st.system);
		if (id !== undefined && id !== null) out.set(id, st);
	}
	return out;
}

const stationKind = (deposits: string[], data: SystemData) =>
	deposits.map((d) => STATION_SIZE[data.depositCategory[d] ?? '']).find(Boolean);

type Part = { systemId: number; source: string; side: keyof Flow; base: Resources };

/** Every base flow of our starbases and stations, tagged with the budget source that books it. */
function parts(s: Snapshot, data: SystemData): Part[] {
	const out: Part[] = [];
	for (const [systemId, st] of starbasesOf(s)) {
		out.push({
			systemId,
			source: 'starbases',
			side: 'upkeep',
			base: (data.costs.ship[`starbase_${st.level}`] ?? NONE).upkeep
		});
		for (const [source, keys, table] of [
			['starbase_modules', st.modules, data.costs.module],
			['starbase_buildings', st.buildings, data.costs.starbaseBuilding]
		] as const)
			for (const k of keys) {
				const c = table[k] ?? NONE;
				out.push({ systemId, source, side: 'upkeep', base: c.upkeep });
				out.push({ systemId, source, side: 'income', base: c.produces });
			}
	}
	for (const o of s.orbitalStations ?? []) {
		const kind = stationKind(o.deposits, data);
		if (!kind) continue;
		out.push({
			systemId: o.systemId,
			source: kind.upkeep,
			side: 'upkeep',
			base: (data.costs.ship[kind.size] ?? NONE).upkeep
		});
		out.push({
			systemId: o.systemId,
			source: kind.income,
			side: 'income',
			base: sum(o.deposits.map((d) => (data.costs.deposit[d] ?? NONE).produces))
		});
	}
	return out;
}

/**
 * Each part's share of what the budget booked for its source, by resource: booked × base ÷ the
 * source's summed base. A source the budget lacks keeps the base values.
 */
export function allocate(all: Part[], budget: BudgetSource[] | null): Map<number, Flow> {
	const booked = (source: string, side: keyof Flow): Resources | null => {
		const b = budget?.find((x) => x.source === source);
		return b ? (side === 'income' ? b.income : b.expenses) : null;
	};
	const totals = new Map<string, Resources>();
	for (const p of all)
		totals.set(`${p.source}|${p.side}`, add(totals.get(`${p.source}|${p.side}`) ?? {}, p.base));
	const out = new Map<number, Flow>();
	for (const p of all) {
		const real = booked(p.source, p.side);
		const total = totals.get(`${p.source}|${p.side}`)!;
		const share = Object.fromEntries(
			Object.entries(p.base).map(([r, v]) => [
				r,
				real === null ? v : total[r] ? ((real[r] ?? 0) * v) / total[r] : 0
			])
		);
		const f = out.get(p.systemId) ?? { income: {}, upkeep: {} };
		out.set(p.systemId, { ...f, [p.side]: add(f[p.side], share) });
	}
	return out;
}

/** A snapshot's monthly flows per system; with `colonySystem`, its colonies' too. */
export function ledger(
	s: Snapshot,
	data: SystemData,
	colonySystem: Map<number, number> | null
): Map<number, Flow> {
	const out = allocate(parts(s, data), s.budget);
	if (colonySystem)
		for (const c of s.colonies) {
			const id = colonySystem.get(c.planetId);
			if (id === undefined) continue;
			const f = out.get(id) ?? { income: {}, upkeep: {} };
			out.set(id, { income: add(f.income, c.produces), upkeep: add(f.upkeep, c.upkeep) });
		}
	return out;
}

const owned = (s: Snapshot) =>
	new Set((s.knownSystems ?? []).filter((k) => k.owned).map((k) => k.id));

/** Hyperlane jumps from any of `from` to `to` over the known systems; null if unreachable. */
export function jumps(systems: KnownSystem[], from: Set<number>, to: number): number | null {
	const next = new Map<number, number[]>();
	for (const k of systems)
		for (const l of k.lanes) {
			next.set(k.id, [...(next.get(k.id) ?? []), l]);
			next.set(l, [...(next.get(l) ?? []), k.id]);
		}
	const seen = new Set(from);
	let frontier = [...from];
	for (let d = 0; frontier.length; d++) {
		if (frontier.includes(to)) return d;
		frontier = frontier.flatMap((id) => (next.get(id) ?? []).filter((n) => !seen.has(n)));
		for (const n of frontier) seen.add(n);
	}
	return null;
}

/** The influence an outpost `jumps` beyond our nearest system costs — an estimate. */
export function outpostInfluence(j: number | null, defines: Record<string, number>): number {
	const base = defines.EXPANSION_COST_BASE ?? 75;
	const step = defines.EXPANSION_COST_DISTANCE ?? 75;
	return Math.min(defines.EXPANSION_COST_MAX ?? 1000, base + step * Math.max(0, (j ?? 1) - 1));
}

function outpost(s: Snapshot, systemId: number, before: Set<number>, data: SystemData) {
	const others = before.size ? before : new Set([...owned(s)].filter((id) => id !== systemId));
	const j = jumps(s.knownSystems ?? [], others, systemId);
	return add((data.costs.ship.starbase_outpost ?? NONE).cost, {
		influence: outpostInfluence(j, data.defines)
	});
}

/** What a starbase has beyond `from` (null: nothing), priced from the data DB. */
function starbaseGain(
	from: { level: string; modules: string[]; buildings: string[] } | null,
	to: { level: string; modules: string[]; buildings: string[] },
	data: SystemData
): { label: string; cost: Resources }[] {
	const out: { label: string; cost: Resources }[] = [];
	const lo = from ? LEVELS.indexOf(from.level) : 0;
	for (const level of LEVELS.slice(lo + 1, LEVELS.indexOf(to.level) + 1))
		out.push({ label: level, cost: (data.costs.ship[`starbase_${level}`] ?? NONE).cost });
	const extra = (a: string[], b: string[]) => {
		const left = [...a];
		return b.filter((x) => {
			const i = left.indexOf(x);
			if (i < 0) return true;
			left.splice(i, 1);
			return false;
		});
	};
	for (const m of extra(from?.modules ?? [], to.modules))
		out.push({ label: m, cost: (data.costs.module[m] ?? NONE).cost });
	for (const b of extra(from?.buildings ?? [], to.buildings))
		out.push({ label: b, cost: (data.costs.starbaseBuilding[b] ?? NONE).cost });
	return out;
}

/**
 * The saves along `history`, each with a station list: a save read before stations were (READER 5)
 * borrows the nearest listing — the last earlier one, else the first later one — kept to the
 * systems it owned. Older and newer readings sit side by side (saves still on disk are read
 * again), so without it every gap would count the stations anew.
 */
export function saveHistory(history: Snapshot[]): Snapshot[] {
	const saves = history.filter((s) => s.kind === 'save' && s.knownSystems !== null);
	return saves.map((s, i) => {
		if (s.orbitalStations) return s;
		const near =
			saves.slice(0, i).findLast((x) => x.orbitalStations) ??
			saves.slice(i + 1).find((x) => x.orbitalStations);
		if (!near) return s;
		const mine = owned(s);
		return { ...s, orbitalStations: near.orbitalStations!.filter((o) => mine.has(o.systemId)) };
	});
}

const isStarbaseItem = (kind: string) => kind.startsWith('starbase');
const isColonyItem = (kind: string) => !isStarbaseItem(kind) && kind !== 'ship' && kind !== 'army';

/**
 * Every one-off payment for our systems along `history` (saves only), oldest first. What the
 * first save already shows was paid before the history: dated to it, approximate — except the
 * capital's starbase, which the game starts with.
 */
export function systemSpending(
	history: Snapshot[],
	data: SystemData,
	colonies: boolean
): SystemSpend[] {
	const saves = saveHistory(history);
	const out: SystemSpend[] = [];
	const push = (s: Snapshot, systemId: number, label: string, cost: Resources, approx = true) =>
		out.push({ systemId, date: s.date, label, cost, approx, colony: false });
	saves.forEach((s, i) => {
		const prev = i > 0 ? saves[i - 1] : null;
		const mine = owned(s);
		const before = prev ? owned(prev) : new Set<number>();
		const capital = (s.knownSystems ?? []).find((k) => k.capital)?.id;
		for (const id of mine)
			if (!before.has(id) && id !== capital)
				push(s, id, prev ? 'outpost' : 'outpost (before history)', outpost(s, id, before, data));
		// the starbase: exact construction items when both saves list them, else the state's gain
		const exact = prev?.construction && s.construction;
		const prevBases = prev ? starbasesOf(prev) : new Map();
		for (const [id, st] of starbasesOf(s)) {
			if (exact || (!prev && id === capital)) continue;
			const from =
				prevBases.get(id) ??
				(prev && before.has(id) ? null : { level: 'outpost', modules: [], buildings: [] });
			for (const g of starbaseGain(from, st, data))
				push(s, id, prev ? g.label : `${g.label} (before history)`, g.cost);
		}
		if (exact) {
			const seen = new Set(prev.construction!.map((c) => c.id));
			for (const c of s.construction!) {
				if (seen.has(c.id) || c.systemId === null || c.systemId === undefined) continue;
				if (isStarbaseItem(c.kind)) push(s, c.systemId, c.design ?? c.name, c.cost, false);
				else if (colonies && isColonyItem(c.kind))
					out.push({
						systemId: c.systemId,
						date: s.date,
						label: `${c.name}${c.where ? ` (${c.where})` : ''}`,
						cost: c.cost,
						approx: false,
						colony: true
					});
			}
		}
		// stations: new ones between saves that both list them; the first listing's as before
		if (s.orbitalStations) {
			const had = prev?.orbitalStations
				? new Set(prev.orbitalStations.map((o) => o.planetId))
				: null;
			for (const o of s.orbitalStations) {
				if (had?.has(o.planetId)) continue;
				const kind = stationKind(o.deposits, data);
				if (!kind) continue;
				push(
					s,
					o.systemId,
					had ? kind.size : `${kind.size} (before history)`,
					(data.costs.ship[kind.size] ?? NONE).cost
				);
			}
		}
	});
	return out;
}

/**
 * Per system, cumulative invested (one-offs + upkeep) and earned (output) at each save. Between
 * two saves the later one's monthly flows count for the months in between.
 */
export function systemHistory(
	history: Snapshot[],
	data: SystemData,
	colonySystem: Map<number, number> | null
): Map<number, SystemPoint[]> {
	const saves = saveHistory(history);
	const spends = systemSpending(saves, data, colonySystem !== null);
	const out = new Map<number, SystemPoint[]>();
	const last = (id: number): SystemPoint | undefined => out.get(id)?.at(-1);
	saves.forEach((s, i) => {
		const months = i > 0 ? monthsBetween(saves[i - 1].date, s.date) : 0;
		const flows = ledger(s, data, colonySystem);
		const ids = new Set([...owned(s), ...flows.keys()]);
		for (const id of ids) {
			const p = last(id) ?? { date: s.date, invested: {}, earned: {} };
			const f = flows.get(id) ?? { income: {}, upkeep: {} };
			const paid = sum(
				spends.filter((x) => x.systemId === id && x.date === s.date).map((x) => x.cost)
			);
			out.set(id, [
				...(out.get(id) ?? []),
				{
					date: s.date,
					invested: add(add(p.invested, f.upkeep, months), paid),
					earned: add(p.earned, f.income, months)
				}
			]);
		}
	});
	return out;
}

/** `months` ahead at the latest flows: the cumulative points, one per month. */
export function projection(from: SystemPoint, flow: Flow, months: number, year0: number) {
	return Array.from({ length: months }, (_, i) => ({
		x: year0 + (i + 1) / 12,
		invested: add(from.invested, flow.upkeep, i + 1),
		earned: add(from.earned, flow.income, i + 1)
	}));
}

/** Months until earned catches up with invested at `net` per month; 0 if it has, null if never. */
export function breakEven(invested: number, earned: number, net: number): number | null {
	if (earned >= invested) return 0;
	return net > 0 ? Math.ceil((invested - earned) / net) : null;
}

export const netValue = (f: Flow, weights: Resources) =>
	valueOf(f.income, weights) - valueOf(f.upkeep, weights);

/** What we know of a system from the galaxy: its bodies, deposits, sites. */
export function systemFacts(g: GalaxySystem, data: Pick<SystemData, 'costs'>) {
	const bodies = (g.bodies ?? []).filter((b) => !b.star);
	return {
		star: g.star,
		bodies: g.bodies === null ? null : bodies.length,
		colonized: bodies.filter((b) => b.colonized).length,
		deposits: sum(
			bodies.flatMap((b) => b.deposits.map((d) => (data.costs.deposit[d] ?? NONE).produces))
		),
		freeDeposits: bodies.filter(
			(b) =>
				b.surveyed && !b.station && !b.colonized && b.deposits.some((d) => data.costs.deposit[d])
		).length,
		anomalies: bodies.filter((b) => b.anomaly).length,
		megastructures: g.megastructures,
		bypasses: g.bypasses ?? []
	};
}

/** The tab's view, the profile's: systems shown, colonies counted, projection, the system picked. */
export type SystemView = {
	range: string; // 'mine' | '0'…'10' jumps beyond the border | 'all'
	colonies: boolean; // count the colonies' output, upkeep and construction
	months: number; // projection
	selected: number | null;
};
export const SYSTEM_RANGES = ['mine', ...Array.from({ length: 11 }, (_, i) => String(i)), 'all'];
export const PROJECTION_MONTHS = [12, 24, 60, 120];
export const DEFAULT_SYSTEM_VIEW: SystemView = {
	range: 'mine',
	colonies: false,
	months: 24,
	selected: null
};

export function parseSystemView(v: unknown): SystemView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<SystemView>;
	return {
		range: SYSTEM_RANGES.includes(o.range as string)
			? (o.range as string)
			: DEFAULT_SYSTEM_VIEW.range,
		colonies: o.colonies === true,
		months: PROJECTION_MONTHS.includes(o.months as number)
			? (o.months as number)
			: DEFAULT_SYSTEM_VIEW.months,
		selected: typeof o.selected === 'number' ? o.selected : null
	};
}
