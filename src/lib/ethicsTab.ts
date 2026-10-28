import { gameYear, type Series } from './series.ts';
import type { EthicsState, Faction, Snapshot, TimedModifier } from './types.ts';

// The ethics tab: our pops' ethics and the pull on them, and our factions with what embracing one
// takes. Pure. The rules are 4.5.2's (stellaris-modding-insights/docs/18-changing-governing-ethics.md):
// embracing a faction costs 5000 unity, needs support > 20 % and waits 10 years between embraces
// (`embraced_faction_timer`); adding a new ethic drops our lowest-attraction one unless we hold a
// fanatic ethic, which is demoted instead.

export const EMBRACE_UNITY = 5000;
export const EMBRACE_SUPPORT = 0.2;

/** An `EthicsState` list by ethic key, leaving out the ethics at 0 (the fanatic slots always are). */
export function byEthic(values: number[], order: string[]): Record<string, number> {
	return Object.fromEntries(
		values.flatMap((v, i) => (v && order[i] ? [[order[i], v] as [string, number]] : []))
	);
}

export type EthicRow = {
	key: string;
	pops: number;
	share: number; // of our pops with an ethic, 0–1
	attraction: number; // share of the attraction-weighted pops, 0–1: where the pops are heading
	change: number; // pops last month
	weight: number | null; // empire-wide `ethics_attraction` (meaning unverified)
	held: boolean; // a governing ethic of ours, fanatic or not
	dropped: boolean; // the one we would lose by embracing a faction of an ethic we do not hold
};

/** The regular ethic of a governing ethic (`ethic_fanatic_x` → `ethic_x`). */
export const regular = (ethic: string) => ethic.replace('ethic_fanatic_', 'ethic_');

/** One row per ethic our pops hold or are drawn to, the strongest pull first. */
export function ethicRows(e: EthicsState, order: string[], government: string[]): EthicRow[] {
	const pops = byEthic(e.pops, order);
	const attraction = byEthic(e.attraction, order);
	const change = byEthic(e.change, order);
	const weight = byEthic(e.weight, order);
	const ours = government.filter((k) => k.startsWith('ethic_'));
	const held = ours.map(regular);
	const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
	const [popTotal, pullTotal] = [total(pops), total(attraction)];
	const keys = [...new Set([...Object.keys(pops), ...Object.keys(attraction), ...held])];
	// a fanatic ethic is demoted to free the point; otherwise the weakest held ethic goes
	const lowest = ours.some((k) => k.startsWith('ethic_fanatic_'))
		? null
		: (held
				.filter((k) => keys.includes(k))
				.sort((a, b) => (attraction[a] ?? 0) - (attraction[b] ?? 0))[0] ?? null);
	return keys
		.map((key) => ({
			key,
			pops: pops[key] ?? 0,
			share: popTotal ? (pops[key] ?? 0) / popTotal : 0,
			attraction: pullTotal ? (attraction[key] ?? 0) / pullTotal : 0,
			change: change[key] ?? 0,
			weight: weight[key] ?? null,
			held: held.includes(key),
			dropped: held.length > 1 && key === lowest
		}))
		.sort((a, b) => b.attraction - a.attraction || b.share - a.share);
}

/**
 * Per ethic, its share (%) of our pops (`pops`) or of the attraction (`attraction`) per snapshot;
 * null where a snapshot has no reading. Labelled by name.
 */
export function ethicSeries(
	history: Snapshot[],
	order: string[],
	field: 'pops' | 'attraction',
	names: Record<string, string>
): Series {
	const shares = history.map((s) => {
		if (!s.ethics) return null;
		const r = byEthic(s.ethics[field], order);
		const t = Object.values(r).reduce((a, b) => a + b, 0);
		return t ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (v / t) * 100])) : null;
	});
	const keys = order.filter((k) => shares.some((r) => r && r[k] !== undefined));
	return {
		x: history.map((s) => gameYear(s.date)),
		lines: Object.fromEntries(
			keys.map((k) => [names[k] ?? k, shares.map((r) => (r ? (r[k] ?? 0) : null))])
		)
	};
}

/**
 * Per faction, its support or approval (%) per snapshot; null before it formed. Lines follow the
 * faction type, named as the latest snapshot names it — older readings hold shorter names.
 */
export function factionSeries(history: Snapshot[], field: 'support' | 'approval'): Series {
	const names = new Map<string, string>();
	for (const s of history) for (const f of s.factions ?? []) names.set(f.type, f.name);
	return {
		x: history.map((s) => gameYear(s.date)),
		lines: Object.fromEntries(
			[...names].map(([type, name]) => [
				name,
				history.map((s) => {
					const f = s.factions?.find((x) => x.type === type);
					return f ? f[field] * 100 : null;
				})
			])
		)
	};
}

export type Embrace = {
	support: boolean; // > 20 %
	unity: boolean; // ≥ 5000 in the stockpile
	cooldownUntil: string | null; // the empire-wide 10 years since the last embrace
	fanatic: boolean; // already fanatic in its ethic: nothing left to embrace
	possible: boolean;
	promoted: boolean; // `promoted_<ethic>` on the empire
	suppressed: boolean; // `suppressed_<ethic>` on the empire
};

/** What embracing a faction of `ethic` (its guiding ethic) takes, and where we stand. */
export function embrace(
	f: Faction,
	ethic: string | null,
	government: string[],
	unity: number,
	modifiers: TimedModifier[]
): Embrace {
	const name = ethic?.replace(/^ethic_/, '') ?? '';
	const has = (k: string) => modifiers.some((m) => m.key === k);
	const timer = modifiers.find((m) => m.key === 'embraced_faction_timer');
	const r = {
		support: f.support > EMBRACE_SUPPORT,
		unity: unity >= EMBRACE_UNITY,
		cooldownUntil: timer ? (timer.until ?? '?') : null,
		fanatic: ethic !== null && government.includes(`ethic_fanatic_${name}`),
		promoted: has(`promoted_${name}`),
		suppressed: has(`suppressed_${name}`)
	};
	return { ...r, possible: r.support && r.unity && !r.cooldownUntil && !r.fanatic };
}

export type ColonyEthics = {
	planetId: number;
	pops: Record<string, number>;
	change: Record<string, number>;
};

/** Where each ethic's pops live, by colony, the most pops first. */
export function colonyEthics(e: EthicsState, order: string[]): ColonyEthics[] {
	const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
	return e.colonies
		.map((c) => ({
			planetId: c.planetId,
			pops: byEthic(c.pops, order),
			change: byEthic(c.change, order)
		}))
		.filter((c) => sum(c.pops) > 0)
		.sort((a, b) => sum(b.pops) - sum(a.pops));
}
