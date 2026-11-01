// A MegaCorp's branch offices: what one is worth and what it costs, from 4.5.x
// `common/defines/00_defines.txt` (NGameplay): its income is BRANCH_OFFICE_INCOME_SCALE (0.5) of
// the colony's trade (loc BRANCH_OFFICE_VALUE_DESC: "determined by the total trade of the
// colony"), its influence cost BRANCH_OFFICE_INFLUENCE_COST_BASE (75) + _INCREASE_SCALE (5) per
// hyperlane jump, at most _MAX_COST (1000); each adds EMPIRE_SIZE_FROM_BRANCH_OFFICES (5) to empire
// size. **Estimated (≈)**: the jumps are counted from our capital (the defines do not say from
// where), and value modifiers (`branch_office_value_mult`, civics) are left out — the one office
// in our saves (an AI's, Planetforgers 2214.02.01) booked 59.48 trade on a colony making 112.24,
// 6 % above 0.5 ×. Its buildings' output is not counted.
import type { BranchSite, Relation } from './types.ts';

export const INCOME_SCALE = 0.5;
export const COST_BASE = 75;
export const COST_PER_JUMP = 5;
export const COST_MAX = 1000;
export const EMPIRE_SIZE = 5;

/** Trade a month an office on a colony making `trade` brings (≈). */
export const officeValue = (trade: number) => INCOME_SCALE * trade;

/** The influence an office costs `jumps` away (≈: from our capital); unknown without jumps. */
export const officeCost = (jumps: number | null) =>
	jumps === null ? null : Math.min(COST_MAX, COST_BASE + COST_PER_JUMP * jumps);

export type SiteRow = BranchSite & {
	value: number; // trade a month (≈)
	cost: number | null; // influence (≈)
	perInfluence: number | null; // trade a month per 100 influence spent
	pact: boolean; // we have a commercial pact with the owner (the game requires one)
};

/**
 * The sites as rows, best value per influence first; without `all` only those an office can open
 * on now: a commercial pact with the owner, no office there yet.
 */
export function siteRows(sites: BranchSite[], relations: Relation[], all = false): SiteRow[] {
	const pacts = new Set(
		relations.filter((r) => r.agreements.includes('commercial_pact')).map((r) => r.countryId)
	);
	return sites
		.map((s) => {
			const value = officeValue(s.trade);
			const cost = officeCost(s.jumps);
			return {
				...s,
				value,
				cost,
				perInfluence: cost ? (value / cost) * 100 : null,
				pact: pacts.has(s.ownerId)
			};
		})
		.filter((r) => all || (r.pact && r.office === null))
		.sort((a, b) => (b.perInfluence ?? -1) - (a.perInfluence ?? -1) || b.value - a.value);
}
