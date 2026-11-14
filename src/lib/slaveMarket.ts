import type { SlaveMarketMode } from './profiles.ts';
import { gameYear } from './series.ts';
import type { LogEvent, SlaveOffer, Snapshot } from './types.ts';

// The Slave Market along a branch: what was offered when, and — with the companion mod (0.12.0) —
// who bought it. The save keeps only the offers of the moment (pop group → pops), so an offer's
// end is the first save without it; a sold pop group's pops move into new groups of the buyer
// (Fangnaur 2200.07: group 71's 100 Quenti → two new groups on the buyer's capital), so only the
// mod's `slave-sold` line names the buyer. Pure.

/** Full citizenship (`citizenship_full`, `citizenship_full_machine`, 4.5.3 citizenship_types). */
const FULL_CITIZENSHIP = /^citizenship_full/;

/** The empire allows slavery (policy `slavery` = `slavery_allowed`). */
export const allowsSlavery = (s: Pick<Snapshot, 'policies'>) =>
	s.policies?.slavery === 'slavery_allowed';

/**
 * Our species with full citizenship, by name: a sold pop keeps its species, and a modified one its
 * parent's name (`speciesByEmpire` matches by name for the same reason).
 */
export function citizenSpecies(s: Pick<Snapshot, 'species' | 'speciesRights'>): Set<string> {
	return new Set(
		(s.species ?? [])
			.filter((sp) => FULL_CITIZENSHIP.test(s.speciesRights?.[sp.id]?.citizenship ?? ''))
			.map((sp) => sp.name)
	);
}

/** Whether the tab shows: always where slavery is allowed, else as the mode says. */
export function slaveTabShown(
	latest: Pick<Snapshot, 'policies' | 'species' | 'speciesRights' | 'slaveMarket'> | undefined,
	mode: SlaveMarketMode
): boolean {
	if (!latest) return false;
	if (allowsSlavery(latest)) return true;
	if (mode !== 'mine') return mode === 'all';
	const ours = citizenSpecies(latest);
	return (latest.slaveMarket ?? []).some((o) => ours.has(o.species));
}

export type Sale = {
	date: string;
	species: string;
	pops: number;
	buyer: string;
	seller: string;
};

/** The mod's `slave-sold` lines along the branch, oldest first, each once. */
export function sales(history: Pick<Snapshot, 'logEvents'>[]): Sale[] {
	const seen = new Set<string>();
	return history
		.flatMap((s) => s.logEvents ?? [])
		.filter((e): e is LogEvent & { kind: 'slave-sold' } => e.kind === 'slave-sold')
		.flatMap((e) => {
			const [species, pops, buyer, seller] = e.fields;
			const key = [e.date, ...e.fields].join('|');
			if (seen.has(key)) return [];
			seen.add(key);
			return [{ date: e.date, species, pops: Number(pops) || 0, buyer, seller }];
		})
		.sort((a, b) => a.date.localeCompare(b.date));
}

/** A sale between two other empires: the game shows neither side to us (intel). */
export const othersSale = (sale: Sale, us: string) => sale.buyer !== us && sale.seller !== us;

export type OfferEntry = {
	offer: SlaveOffer; // as last seen
	firstSeen: string;
	lastSeen: string;
	active: boolean; // still on the market in the latest save
	gone: string | null; // the first save without it
	sale: Sale | null; // the mod's line of its sale
};

/** How long after the last save showing an offer its sale may be dated: a month, and some slack. */
const SALE_WINDOW_YEARS = 45 / 360;

/**
 * Every offer along the branch, newest first. Keyed by pop group and seller (a group stays one
 * while on sale). An ended offer takes the first unclaimed sale of its species and seller dated
 * between its first save and a month and a half after its last.
 */
export function offerHistory(history: Snapshot[]): OfferEntry[] {
	const saves = history.filter((s) => s.slaveMarket !== null);
	const latest = saves.at(-1)?.slaveMarket ?? [];
	const key = (o: SlaveOffer) => `${o.popGroup}|${o.seller}`;
	const seen = new Map<string, Omit<OfferEntry, 'active' | 'sale'>>();
	saves.forEach((s, i) => {
		for (const o of s.slaveMarket!) {
			const k = key(o);
			const known = seen.get(k);
			seen.set(k, {
				offer: o,
				firstSeen: known?.firstSeen ?? s.date,
				lastSeen: s.date,
				gone: null
			});
		}
		const next = saves[i + 1];
		if (next)
			for (const [k, e] of seen)
				if (e.lastSeen === s.date && !next.slaveMarket!.some((o) => key(o) === k))
					e.gone = next.date;
	});
	const unclaimed = sales(history);
	return [...seen.entries()]
		.map(([k, e]) => {
			const active = latest.some((o) => key(o) === k);
			let sale: Sale | null = null;
			if (!active) {
				const until = gameYear(e.lastSeen) + SALE_WINDOW_YEARS;
				const i = unclaimed.findIndex(
					(x) =>
						x.species === e.offer.species &&
						x.seller === e.offer.sellerName &&
						x.date >= e.firstSeen &&
						gameYear(x.date) <= until
				);
				if (i >= 0) [sale] = unclaimed.splice(i, 1);
			}
			return { ...e, active, sale };
		})
		.sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));
}
