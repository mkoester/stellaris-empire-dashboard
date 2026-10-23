import { error } from '@sveltejs/kit';
import { ENCLAVE_DEAL, enclaveDeal, modelFrom } from '#lib/aiTrade.ts';
import { marketFee, price } from '#lib/market.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { display } from '#lib/server/settings.ts';

// Trading with the empires we talk to: what the game shows of them (personality, attitude, opinion
// and its modifiers, our deals) and, with the `tradeIntel` spoiler, their economy — what they have
// to spare and need, and what they would give for what, estimated (#lib/aiTrade.ts). Trader
// enclaves' offers are fixed (no spoiler needed).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const latest = snaps.findLast((s) => s.kind === 'save' && s.aiIntel !== null) ?? null;
	const data = getGameData();
	const { tradeIntel } = display();
	const names = new Map((latest?.relations ?? []).map((r) => [r.countryId, r.name]));
	// empires that trade (the reader keeps only those since READER 10; older readings had more)
	const types = new Map((latest?.countries ?? []).map((c) => [c.id, c.type]));
	const trading = ['default', 'fallen_empire', 'awakened_fallen_empire'];
	const empires = (latest?.aiIntel ?? [])
		.filter((ai) => trading.includes(types.get(ai.countryId) ?? 'default'))
		.map((ai) => ({
			...ai,
			name: names.get(ai.countryId) ?? String(ai.countryId),
			fallen: (types.get(ai.countryId) ?? '').includes('fallen_empire'),
			// hidden by the game: only with the spoiler on
			stockpile: tradeIntel ? ai.stockpile : {},
			net: tradeIntel ? ai.net : {},
			income: tradeIntel ? ai.income : {},
			deals: (latest?.tradeDeals ?? []).filter((d) => d.partner === names.get(ai.countryId)).length
		}));
	const fee = latest ? (marketFee(latest)?.fee ?? null) : null;
	// trade has no ai_weight; the model guesses its worth
	const tradable = Object.entries(data.resourceInfo)
		.filter(([key, r]) => r.tradable && (r.aiWeight !== null || key === 'trade'))
		.map(([key]) => key);
	const enclaves = (latest?.traderEnclaves ?? []).map((e) => ({
		...e,
		resource: ENCLAVE_DEAL.resource[e.kind] as string,
		running: enclaveDeal(e.kind, latest?.countryModifiers ?? [])
	}));
	return {
		...rest,
		date: latest?.date ?? null,
		tradeIntel,
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
