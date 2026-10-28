import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { feeSeries, marketFee, marketSwitches, priceSeries } from '#lib/market.ts';
import { xExtent } from '#lib/series.ts';

const BASIC = ['energy', 'minerals', 'food', 'consumer_goods', 'alloys'];
const STRATEGIC = [
	'volatile_motes',
	'exotic_gases',
	'rare_crystals',
	'sr_living_metal',
	'sr_zro',
	'sr_dark_matter'
];

// Market prices along the branch: the internal market's, then the galactic market's once the
// empire has access. Prices come from saves only.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	return {
		...rest,
		market: snaps.findLast((s) => s.market !== null)?.market ?? null,
		orders: snaps.findLast((s) => s.kind === 'save')?.marketOrders ?? [],
		fee: snaps.map(marketFee).findLast((f) => f !== null) ?? null,
		fees: feeSeries(snaps),
		switches: marketSwitches(snaps),
		basic: priceSeries(snaps, BASIC),
		strategic: priceSeries(snaps, STRATEGIC),
		xExtent: xExtent(snaps)
	};
}
