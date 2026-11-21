import { error } from '@sveltejs/kit';
import { ENCLAVE_DEAL, enclaveDeal, modelFrom, offersTrade, terms } from '#lib/aiTrade.ts';
import {
	allKinds,
	blockers,
	CATEGORIES,
	factsOf,
	refusals,
	specimenDeal,
	specimenGives
} from '#lib/archive.ts';
import type { AiIntel, ArchiveHolding, Exhibit, Snapshot, Specimen } from '#lib/types.ts';
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
// Trader enclaves' offers are fixed (no spoiler needed). With the `specimenTrade` spoiler the
// Grand Archive specimens each empire would trade us and what it would pay for ours (≈, #lib/archive.ts);
// `specimenTradeAll` (cheat) adds those blocked now, with the reason.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const latest = snaps.findLast((s) => s.kind === 'save' && s.aiIntel !== null) ?? null;
	const data = getGameData();
	const { tradeIntel, tradeStockpiles, specimenTrade, specimenTradeAll } = display();
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
	const specimens = specimenTrade
		? specimenRows(latest, empires, data, specimenTradeAll, values)
		: null;
	return {
		...rest,
		specimens,
		specimenTradeAll,
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

/**
 * The specimens each empire we can trade with holds (`theirs`) with what we would pay for one in
 * energy and trade, and ours with what each would pay (`ours`), from the trade value the defines
 * give and the personality's willingness. A row with `blocked` reasons is one the trade screen
 * would refuse now: sent only with `all` (the cheat).
 */
function specimenRows(
	latest: Snapshot | null,
	empires: (AiIntel & { name: string; fallen: boolean })[],
	data: ReturnType<typeof getGameData>,
	all: boolean,
	values: Record<string, number>
) {
	if (!latest || Object.keys(data.specimens).length === 0)
		return { theirs: [], ours: [], known: false, kinds: [] as string[] };
	const archives = latest.archives ?? [];
	const holding = (id: number | null) => archives.find((a) => a.countryId === id) ?? null;
	const us = holding(latest.countryId);
	const facts = factsOf(latest, data);
	const held = (h: ArchiveHolding | null): Exhibit[] => [
		...(h?.exhibits ?? []),
		...(h?.storage ?? [])
	];
	const energy = values.energy ?? 1;
	const category = (k: string) => CATEGORIES.find((c) => c.key === k)?.name ?? k;
	// what a specimen would give us exhibited and active, × our exhibition's multiplier
	const gives = (spec: Specimen) => specimenGives(spec, facts, us?.mults?.[spec.category] ?? 1);
	const theirs = [];
	const ours = [];
	// a fallen empire's trade screen has no specimens on either side (2026-11-21)
	for (const e of empires.filter((x) => !x.fallen)) {
		const them = holding(e.countryId);
		const t = terms(e, data.personalities, data.attitudes);
		const ctx = { date: latest.date };
		const refused = refusals({ trades: t.trades });
		for (const x of held(them)) {
			const spec = data.specimens[x.specimen];
			if (!spec) continue;
			const blocked = blockers(spec, x.specimen, them, us, { ...ctx, receiverIsUs: true });
			if (blocked.length && !all) continue;
			const { price } = specimenDeal(spec, them, t.willingness);
			theirs.push({
				id: `${e.countryId}:${x.id}`,
				empire: e.name,
				key: x.specimen,
				name: spec.name,
				category: category(spec.category),
				rarity: spec.rarity,
				exhibited: x.active,
				...gives(spec),
				price,
				priceTrade: price === null ? null : price * energy,
				refused,
				blocked
			});
		}
		for (const x of held(us)) {
			const spec = data.specimens[x.specimen];
			if (!spec) continue;
			const blocked = blockers(spec, x.specimen, us, them, { ...ctx, receiverIsUs: false });
			if (blocked.length && !all) continue;
			const { bid } = specimenDeal(spec, them, t.willingness);
			ours.push({
				id: `${e.countryId}:${x.id}`,
				empire: e.name,
				key: x.specimen,
				name: spec.name,
				category: category(spec.category),
				rarity: spec.rarity,
				exhibited: x.active,
				...gives(spec),
				bid,
				bidTrade: bid * energy,
				refused,
				blocked
			});
		}
	}
	ours.sort((a, b) => b.bid - a.bid);
	return { theirs, ours, known: archives.length > 0, kinds: allKinds(data) };
}
