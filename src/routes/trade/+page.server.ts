import { error } from '@sveltejs/kit';
import { ENCLAVE_DEAL, enclaveDeal, modelFrom, offersTrade } from '#lib/aiTrade.ts';
import { marketFee, price } from '#lib/market.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { display } from '#lib/server/settings.ts';
import { valuesOf } from '#lib/server/unitCosts.ts';
import { valueOf } from '#lib/value.ts';

// Trading with the empires we talk to: what the game shows of them (personality, attitude, opinion
// and its modifiers, our deals); with the `tradeIntel` spoiler what they would give for what and
// what a gift buys, estimated (#lib/aiTrade.ts); with the `tradeStockpiles` cheat their stockpiles,
// what they spare, take and need. The estimates rest on stockpile and income, so either switch
// sends them; the page shows them only with the cheat. Both are off in multiplayer and Ironman.
// Trader enclaves' offers are fixed (no spoiler needed).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const latest = snaps.findLast((s) => s.kind === 'save' && s.aiIntel !== null) ?? null;
	const data = getGameData();
	const { tradeIntel, tradeStockpiles } = display();
	const economy = tradeIntel || tradeStockpiles;
	const names = new Map((latest?.relations ?? []).map((r) => [r.countryId, r.name]));
	// empires we can offer a deal (the reader keeps only trading types since READER 10; older
	// readings had more, and it keeps the berserk custodian)
	const countries = new Map((latest?.countries ?? []).map((c) => [c.id, c]));
	const types = new Map([...countries].map(([id, c]) => [id, c.type]));
	const empires = (latest?.aiIntel ?? [])
		.filter((ai) => offersTrade(countries.get(ai.countryId) ?? { type: 'default', civics: [] }))
		.map((ai) => ({
			...ai,
			name: names.get(ai.countryId) ?? String(ai.countryId),
			fallen: (types.get(ai.countryId) ?? '').includes('fallen_empire'),
			// hidden by the game: only with a switch on
			stockpile: economy ? ai.stockpile : {},
			net: economy ? ai.net : {},
			income: economy ? ai.income : {},
			deals: (latest?.tradeDeals ?? []).filter((d) => d.partner === names.get(ai.countryId)).length
		}));
	const fee = latest ? (marketFee(latest)?.fee ?? null) : null;
	// trade has no ai_weight but is traded; an empire values only what is measured (#lib/aiTrade.ts),
	// the rest stays listed for the trader enclaves
	const tradable = Object.entries(data.resourceInfo)
		.filter(([key, r]) => r.tradable && (r.aiWeight !== null || key === 'trade'))
		.map(([key]) => key);
	const enclaves = (latest?.traderEnclaves ?? []).map((e) => ({
		...e,
		resource: ENCLAVE_DEAL.resource[e.kind] as string,
		running: enclaveDeal(e.kind, latest?.countryModifiers ?? [])
	}));
	// a unit of each resource in trade (the gift table's "per 1,000 trade")
	const values = valuesOf(snaps);
	const unitValue = Object.fromEntries(tradable.map((r) => [r, valueOf({ [r]: 1 }, values)]));
	return {
		...rest,
		unitValue,
		date: latest?.date ?? null,
		tradeIntel,
		tradeStockpiles,
		empires,
		enclaves,
		weNomadic: (latest?.situations ?? []).some((s) => s.type === 'situation_nomad_economy'),
		tradable,
		resourceInfo: Object.fromEntries(tradable.map((k) => [k, data.resourceInfo[k]])),
		personalities: data.personalities,
		attitudes: data.attitudes,
		opinionModifiers: data.opinionModifiers,
		model: modelFrom(data.defines),
		market: {
			fee: fee ?? 0.3,
			galactic: latest?.market?.galactic ?? false,
			prices: Object.fromEntries(
				tradable.flatMap((r) => {
					const p = price(r, latest?.market?.fluctuations[r] ?? 0);
					return p === null ? [] : [[r, p]];
				})
			)
		}
	};
}
