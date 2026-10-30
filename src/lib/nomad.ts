import type { Resources, Snapshot } from './types.ts';

// A nomadic empire keeps energy and minerals in one pool, the Operational Reserves (4.5.2
// `common/resource_converters/00_resource_converters.txt`, `nomadic_operational_reserves`): both
// are spent from it (`bottomless`, each payable with the other) and their own stockpiles are not
// shown (`visible_stockpile = no`). The pool is the situation `situation_nomad_economy`: its
// progress is the stock, the end of its last stage the capacity (base 15000 + per arkship), and
// every unit of energy or minerals income or expense moves it by one (`affected_situation_mult`).
// Checked 2026-10-30 (throwaway nomad game, 2200.02.01, screenshot 2026_10_30_1): 10069.85 / 20000,
// "69.8" a month = energy +98.91 − minerals 29.06. The save's energy and minerals stockpiles are
// their start values plus their own nets, which the game ignores. Pure.

export const RESERVES = 'operational_reserves';
export const NOMAD_ECONOMY = 'situation_nomad_economy';

export type Reserves = {
	stock: number;
	capacity: number | null; // the last stage's end
	stage: number | null; // index into the stage names (Critical, Low, Medium, High)
	ends: number[]; // where each stage ends
	monthly: number; // energy + minerals net
	estimated: boolean; // a month the mod logged: last save's stock plus the nets since
};

const net = (balance: Resources | null) => (balance?.energy ?? 0) + (balance?.minerals ?? 0);

/** The reserves a snapshot shows; null for a settled empire. */
export function reserves(s: Pick<Snapshot, 'situations' | 'balance'>): Reserves | null {
	const sit = s.situations?.find((x) => x.type === NOMAD_ECONOMY);
	if (!sit) return null;
	const ends = sit.ends ?? [];
	return {
		stock: sit.progress,
		capacity: ends.length ? ends[ends.length - 1] : null,
		stage: sit.stage,
		ends,
		monthly: net(s.balance),
		estimated: false
	};
}

/**
 * The reserves along a branch: read from each save; a month only the mod logged (no situations)
 * after a nomadic save gets the stock before it plus its net, estimated.
 */
export function reservesAlong(snaps: Snapshot[]): (Reserves | null)[] {
	let last: Reserves | null = null;
	return snaps.map((s) => {
		const r = reserves(s);
		if (r) return (last = r);
		if (s.situations !== null || !last) return (last = null);
		const stock = Math.min(Math.max(last.stock + net(s.balance), 0), last.capacity ?? Infinity);
		return (last = { ...last, stock, monthly: net(s.balance), estimated: true });
	});
}

/**
 * Stockpile, balance and storage as a nomad's top bar shows them: energy and minerals folded into
 * the reserves. Unchanged for a settled empire (`r` null).
 */
export function withReserves<
	T extends Pick<Snapshot, 'stockpile' | 'balance' | 'storageMax'> & { ticks?: Snapshot['ticks'] }
>(s: T, r: Reserves | null): T {
	if (!r) return s;
	const without = (x: Resources) =>
		Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'energy' && k !== 'minerals'));
	const fold = (x: Resources, value: number) => ({ ...without(x), [RESERVES]: value });
	return {
		...s,
		stockpile: fold(s.stockpile, r.stock),
		balance: s.balance && fold(s.balance, r.monthly),
		// the mod's daily stockpiles of energy and minerals are the ignored ones; no daily reserves
		...(s.ticks ? { ticks: s.ticks.map((t) => ({ ...t, stockpile: without(t.stockpile) })) } : {}),
		storageMax:
			r.capacity === null ? s.storageMax : { ...(s.storageMax ?? {}), [RESERVES]: r.capacity }
	};
}

/**
 * The next stage the reserves reach at this month's net — up to the next stage's start, down
 * below the current one's — with the months until then; null when it does not move or is at the
 * end already.
 */
export function nextStage(r: Reserves): { stage: number; months: number } | null {
	if (r.stage === null || !r.ends.length || Math.abs(r.monthly) < 0.01) return null;
	if (r.monthly > 0) {
		const end = r.ends[r.stage];
		if (r.stage >= r.ends.length - 1) return null;
		return { stage: r.stage + 1, months: Math.max(0, (end - r.stock) / r.monthly) };
	}
	if (r.stage === 0) return null;
	const start = r.ends[r.stage - 1];
	return { stage: r.stage - 1, months: Math.max(0, (r.stock - start) / -r.monthly) };
}
