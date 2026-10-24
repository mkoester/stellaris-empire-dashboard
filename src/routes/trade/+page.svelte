<script lang="ts">
	import {
		canGive,
		ENCLAVE_DEAL,
		enclaveUnitCost,
		giftOpinion,
		lumpForMonthly,
		marketPrice,
		marketRate,
		monthlyCap,
		offerPrice,
		rate,
		room,
		roomExact,
		spare,
		stance,
		terms,
		wantPrice
	} from '#lib/aiTrade.ts';
	import { colorOf, scaleColor } from '#lib/colors.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import EmpireName from '#lib/EmpireName.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	type Empire = (typeof data.empires)[number];
	type EnclaveRow = (typeof data.enclaves)[number];
	// who a row is: an empire, an enclave or the market, with its marks
	type Party = { name: string; nomadic?: boolean; fallen?: boolean; enclave?: boolean };

	const termsOf = (e: Empire) => terms(e, data.personalities, data.attitudes);
	const GIFT = 'opinion_trade_gift';
	const gift = (e: Empire) => e.opinionModifiers.find((m) => m.key === GIFT)?.value ?? null;
	const decay = $derived(data.opinionModifiers[GIFT]?.decay ?? null); // in the files; not seen
	const modifierName = (k: string) => data.opinionModifiers[k]?.name ?? pretty(k);
	const resName = (r: string) => data.resourceInfo[r]?.name ?? pretty(r);
	const fee = $derived(data.market.fee);
	const prices = $derived(data.market.prices);
	const marketName = $derived(data.market.galactic ? 'galactic' : 'internal');

	// Willing, Opinion, Trust: red at the column's worst, green at its best
	const span = (vs: (number | null)[]) => {
		const xs = vs.filter((v) => v !== null);
		return xs.length ? { lo: Math.min(...xs), hi: Math.max(...xs) } : null;
	};
	const tint = (v: number | null, s: { lo: number; hi: number } | null) =>
		v === null || s === null ? null : scaleColor(v, s.lo, s.hi);
	const willingSpan = $derived(span(data.empires.map((e) => termsOf(e).willingness)));
	const opinionSpan = $derived(span(data.empires.map((e) => e.opinion)));
	const trustSpan = $derived(span(data.empires.map((e) => e.trust)));

	const empireColumns: Column<Empire>[] = [
		{ id: 'name', label: 'Empire', value: (e) => e.name, cell: party },
		{
			id: 'personality',
			label: 'Personality',
			value: (e) =>
				e.personality ? (data.personalities[e.personality]?.name ?? pretty(e.personality)) : null
		},
		{
			id: 'willing',
			label: 'Willing',
			value: (e) => termsOf(e).willingness,
			cell: willing,
			right: true
		},
		{ id: 'attitude', label: 'Attitude', value: (e) => e.attitude, cell: attitude },
		{ id: 'opinion', label: 'Opinion', value: (e) => e.opinion, cell: opinion, right: true },
		{ id: 'trust', label: 'Trust', value: (e) => e.trust, cell: trust, right: true },
		{ id: 'gift', label: 'Gift', value: gift, cell: giftCell },
		{ id: 'deals', label: 'Deals', value: (e) => e.deals || null, right: true },
		{
			id: 'from',
			label: 'Opinion from',
			value: (e) => e.opinionModifiers.length || null,
			cell: opinionFrom
		}
	];

	// the deal finder: what we give, what we want
	let give = $state('trade');
	let get = $state('energy');
	const giveable = $derived(data.tradable.filter((r) => canGive(r, data.weNomadic)));
	// spare: at once (null: an enclave sells monthly only); perMonth: a month at most (null: unknown)
	// takes: how much of what we give it takes in at worth (0.8 of its storage); null: no limit known
	type Offer = Party & {
		key: string;
		r: number;
		spare: number | null;
		perMonth: number | null;
		takes: number | null;
		takesExact: boolean; // their storage from companion mod 0.5.0, not estimated
	};
	const offers: Offer[] = $derived([
		...data.empires.flatMap((e) => {
			const r = rate(give, get, e, termsOf(e), data.resourceInfo, data.model);
			return r === null
				? []
				: [
						{
							...e,
							key: `e${e.countryId}`,
							r,
							spare: spare(get, e, data.resourceInfo, data.model),
							perMonth: monthlyCap(get, e, data.model),
							takes: room(give, e, data.resourceInfo, data.model),
							takesExact: roomExact(give, e)
						}
					];
		}),
		// an enclave sells its resource for energy only
		...data.enclaves
			.filter((x) => give === 'energy' && x.resource === get)
			.map((x) => ({
				name: x.name,
				enclave: true,
				key: `x${x.countryId}`,
				r: 1 / enclaveUnitCost(),
				spare: null,
				perMonth: ENCLAVE_DEAL.maxPerMonth,
				takes: null,
				takesExact: false
			}))
	]);
	const market = $derived(marketRate(give, get, prices, fee));
	const offerColumns: Column<Offer>[] = $derived([
		{ id: 'name', label: 'Empire', value: (o) => o.name, cell: party },
		{
			id: 'rate',
			label: `${resName(get)} per ${resName(give)}`,
			value: (o) => o.r,
			cell: offerRate,
			right: true
		},
		{
			id: 'market',
			label: 'vs market',
			value: (o) => (market ? o.r / market : null),
			cell: vsMarket,
			right: true
		},
		{
			id: 'takes',
			label: `They take ${resName(give)}`,
			value: (o) => o.takes,
			cell: offerTakes,
			right: true
		},
		{ id: 'spare', label: 'They spare', value: (o) => o.spare, cell: offerSpare, right: true },
		{
			id: 'perMonth',
			label: 'They pay a month',
			value: (o) => o.perMonth,
			cell: offerPerMonth,
			right: true
		}
	]);
	let offerSort = $state({ column: 'rate', desc: true });

	// the same finder, paying once for a monthly deal: twice the units of a swap over the deal
	let dealMode: 'swap' | 'monthly' = $state('swap');
	let lump = $state(1000);
	let years = $state(10);
	type MonthlyRow = Party & { key: string } & NonNullable<ReturnType<typeof lumpForMonthly>>;
	const monthlyRows: MonthlyRow[] = $derived(
		data.empires.flatMap((e) => {
			if (!(lump > 0)) return [];
			const d = lumpForMonthly(
				give,
				lump,
				get,
				years,
				e,
				termsOf(e),
				data.resourceInfo,
				data.model
			);
			return d === null ? [] : [{ ...e, key: `e${e.countryId}`, ...d }];
		})
	);
	const monthlyColumns: Column<MonthlyRow>[] = $derived([
		{ id: 'name', label: 'Empire', value: (o) => o.name, cell: party },
		{
			id: 'perMonth',
			label: `${resName(get)} a month`,
			value: (o) => o.perMonth,
			cell: monthlyPerMonth,
			right: true
		},
		{
			id: 'total',
			label: `over ${years} years`,
			value: (o) => o.total,
			cell: monthlyTotal,
			right: true
		},
		{
			id: 'market',
			label: 'vs market',
			value: (o) => (market ? o.total / (lump * market) : null),
			cell: monthlyVsMarket,
			right: true
		},
		{
			id: 'safe',
			label: 'Can they afford it',
			value: (o) => (o.monthsLeft === null ? Infinity : o.monthsLeft),
			cell: monthlySafe
		}
	]);
	let monthlySort = $state({ column: 'total', desc: true });

	// what a resource costs, or fetches, in trade at each empire
	let priceMode: 'want' | 'offer' | 'both' = $state('want');
	const priced = $derived(data.tradable.filter((r) => r !== 'trade'));
	type Price = { pay: number | null; receive: number | null };
	type PriceRow = Party & {
		key: string;
		market?: boolean;
		willing?: number | null; // empires only
		prices: Record<string, Price>;
	};
	const marketPay = (r: string) => marketPrice(r, 'buy', prices, fee);
	const marketReceive = (r: string) =>
		canGive(r, data.weNomadic) ? marketPrice(r, 'sell', prices, fee) : null;
	// an enclave's resource, paid in energy we could have sold
	const enclavePay = (x: EnclaveRow, r: string) => {
		const energy = marketPrice('energy', 'sell', prices, fee);
		return x.resource === r && energy !== null ? enclaveUnitCost() * energy : null;
	};
	const priceRows: PriceRow[] = $derived([
		{
			name: `Market (${marketName})`,
			key: 'market',
			market: true,
			prices: Object.fromEntries(
				priced.map((r) => [r, { pay: marketPay(r), receive: marketReceive(r) }])
			)
		},
		...data.empires.map((e) => {
			const t = termsOf(e);
			return {
				...e,
				key: `e${e.countryId}`,
				willing: t.willingness,
				prices: Object.fromEntries(
					priced.map((r) => [
						r,
						{
							pay: wantPrice(r, e, t, data.resourceInfo, data.model),
							receive: canGive(r, data.weNomadic)
								? offerPrice(r, e, t, data.resourceInfo, data.model)
								: null
						}
					])
				)
			};
		}),
		...data.enclaves.map((x) => ({
			name: x.name,
			enclave: true,
			key: `x${x.countryId}`,
			prices: Object.fromEntries(priced.map((r) => [r, { pay: enclavePay(x, r), receive: null }]))
		}))
	]);
	const priceColumns: Column<PriceRow>[] = $derived([
		{ id: 'name', label: 'Empire', value: (p) => p.name, cell: party },
		{
			id: 'willing',
			label: 'Willing',
			value: (p) => p.willing ?? null,
			cell: priceWilling,
			right: true
		},
		...priced.map((r) => ({
			id: r,
			label: resName(r),
			value: (p: PriceRow) =>
				priceMode === 'offer' ? p.prices[r].receive : (p.prices[r].pay ?? null),
			cell: priceCell,
			color: colorOf(r),
			right: true
		}))
	]);
	let priceSort = $state({ column: 'name', desc: false });

	// what a gift buys: opinion per empire, for 1000 of each resource — whatever the attitude
	const GIFT_AMOUNT = 1000;
	const giftable = $derived(data.tradable.filter((r) => r in data.model.worth));
	const giftFor = (e: Empire, r: string) =>
		giftOpinion(r, GIFT_AMOUNT, e, termsOf(e), data.resourceInfo, data.model, {
			max: data.opinionModifiers[GIFT]?.max ?? null,
			current: gift(e) ?? 0
		});
	const giftColumns: Column<Empire>[] = $derived([
		{ id: 'name', label: 'Empire', value: (e) => e.name, cell: party },
		{ id: 'attitude', label: 'Attitude', value: (e) => e.attitude, cell: attitude },
		{ id: 'gift', label: 'Gift now', value: gift, cell: giftCell },
		...giftable.map((r) => ({
			id: r,
			label: resName(r),
			value: (e: Empire) => giftFor(e, r),
			cell: giftBuys,
			color: colorOf(r),
			right: true
		}))
	]);
	let giftSort = $state({ column: 'name', desc: false });

	// what they need and have to spare
	const needColumns: Column<Empire>[] = $derived([
		{ id: 'name', label: 'Empire', value: (e) => e.name, cell: party },
		...data.tradable.map((r) => ({
			id: r,
			label: resName(r),
			value: (e: Empire) => e.stockpile[r] ?? 0,
			cell: needCell,
			color: colorOf(r),
			right: true
		}))
	]);
	const enclaveColumns: Column<EnclaveRow>[] = [
		{ id: 'name', label: 'EnclaveRow', value: (x) => x.name, cell: enclaveName },
		{ id: 'sells', label: 'Sells', value: (x) => resName(x.resource), cell: sells },
		{
			id: 'energy',
			label: 'Energy per unit',
			value: () => enclaveUnitCost(),
			cell: energyPer,
			right: true
		},
		{
			id: 'trade',
			label: 'Trade per unit',
			value: (x) => enclavePay(x, x.resource),
			cell: tradePer,
			right: true
		},
		{
			id: 'market',
			label: 'Market buys at',
			value: (x) => marketPay(x.resource),
			cell: marketAt,
			right: true
		},
		{ id: 'deal', label: 'Our deal', value: (x) => x.running?.perMonth ?? null, cell: deal }
	];
</script>

{#snippet enclaveName(x: EnclaveRow)}<EmpireName
		name={x.name}
		bold={false}
		kind="enclaves"
	/>{/snippet}
{#snippet sells(x: EnclaveRow)}<span style:color={colorOf(x.resource)}>{resName(x.resource)}</span
	>{/snippet}
{#snippet energyPer()}{fmt(enclaveUnitCost())}{/snippet}
{#snippet tradePer(x: EnclaveRow)}{@const pay = enclavePay(x, x.resource)}{@const buy = marketPay(
		x.resource
	)}<span class={pay !== null && buy !== null && pay < buy ? 'text-green-600' : ''}
		>{pay === null ? '–' : fmt(pay)}</span
	>{/snippet}
{#snippet marketAt(x: EnclaveRow)}{@const buy = marketPay(x.resource)}{buy === null
		? '–'
		: fmt(buy)}{/snippet}
{#snippet deal(x: EnclaveRow)}{x.running
		? `+${x.running.perMonth}/month until ${x.running.until ?? '?'}`
		: '–'}{/snippet}
{#snippet party(p: Party)}
	<EmpireName
		name={p.name}
		bold={false}
		kind={p.fallen ? 'fallen' : p.enclave ? 'enclaves' : null}
		nomadic={p.nomadic}
	/>
{/snippet}
{#snippet willing(e: Empire)}
	{@const w = termsOf(e).willingness}
	<span style:color={tint(w, willingSpan)}>{w ?? '?'}</span>
{/snippet}
{#snippet priceWilling(p: PriceRow)}
	{#if p.willing !== undefined}<span style:color={tint(p.willing, willingSpan)}
			>{p.willing ?? '?'}</span
		>{/if}
{/snippet}
{#snippet attitude(e: Empire)}
	{@const t = termsOf(e)}
	<span class={t.trades ? '' : 'text-red-600'}
		>{e.attitude ? (data.attitudes[e.attitude]?.name ?? pretty(e.attitude)) : '–'}{t.trades
			? ''
			: ' — no trades'}</span
	>
{/snippet}
{#snippet opinion(e: Empire)}
	<span style:color={tint(e.opinion, opinionSpan)}>{e.opinion ?? '–'}</span>
{/snippet}
{#snippet trust(e: Empire)}
	<span style:color={tint(e.trust, trustSpan)}>{fmt(e.trust)}</span>
{/snippet}
{#snippet giftCell(e: Empire)}
	{@const g = gift(e)}
	{#if g !== null}+{fmt(g)}{/if}
{/snippet}
{#snippet giftBuys(e: Empire, r: string)}
	{@const v = giftFor(e, r)}
	{v === null ? '–' : `+${fmt(v)}`}
{/snippet}
{#snippet opinionFrom(e: Empire)}
	<span class="text-xs"
		>{e.opinionModifiers
			.map((m) => `${modifierName(m.key)} ${m.value > 0 ? '+' : ''}${fmt(m.value)}`)
			.join(' · ')}</span
	>
{/snippet}
{#snippet offerRate(o: Offer)}{fmt(o.r)}{/snippet}
{#snippet vsMarket(o: Offer)}
	<span class={market !== null && o.r > market ? 'text-green-600' : ''}
		>{market ? `${fmt(o.r / market)} ×` : ''}</span
	>
{/snippet}
{#snippet offerTakes(o: Offer)}<span
		title="at worth: up to {Math.round(
			data.model.fullShare * 100
		)} % of their storage — more counts nothing ({o.takesExact
			? 'their storage, stored by companion mod 0.5.0'
			: '≈ their base storage, fallen empires +100,000; silos and techs unknown without companion mod 0.5.0'})"
		>{o.takes === null ? '–' : `${o.takesExact ? '' : '≈'}${fmt(o.takes)}`}</span
	>{/snippet}
{#snippet offerSpare(o: Offer)}{o.spare === null ? '–' : fmt(o.spare)}{/snippet}
{#snippet monthlyPerMonth(o: MonthlyRow)}<span
		title={o.capped
			? `their cap: ${Math.round(data.model.monthlyShare * 100)} % of their gross income of it — the lump buys more`
			: ''}>{fmt(o.perMonth)}{o.capped ? ' (cap)' : ''}</span
	>{/snippet}
{#snippet monthlyTotal(o: MonthlyRow)}{fmt(o.total)}{/snippet}
{#snippet monthlyVsMarket(o: MonthlyRow)}
	{@const x = market ? o.total / (lump * market) : null}
	<span class={x !== null && x > 1 ? 'text-green-600' : ''}>{x === null ? '–' : `${fmt(x)}×`}</span>
{/snippet}
{#snippet monthlySafe(o: MonthlyRow)}
	{#if o.monthsLeft === null}<span
			class="text-green-600"
			title="their net income of it after paying">yes, net {fmt(o.netAfter)}/month left</span
		>{:else}<span
			class={o.monthsLeft < years * 12 ? 'text-red-600' : ''}
			title="paying puts them at {fmt(
				o.netAfter
			)}/month; the deal breaks when they cannot afford it"
			>stockpile lasts {fmt(o.monthsLeft)} months</span
		>{/if}
{/snippet}
{#snippet offerPerMonth(o: Offer)}<span
		title={o.perMonth === null
			? 'read before the dashboard knew their gross income: the next save tells'
			: ''}>{o.perMonth === null ? '?' : fmt(o.perMonth)}</span
	>{/snippet}
{#snippet priceCell(p: PriceRow, r: string)}
	{@const x = p.prices[r]}
	{@const payBetter = !p.market && x.pay !== null && (marketPay(r) ?? Infinity) > x.pay}
	{@const receiveBetter = !p.market && x.receive !== null && (marketReceive(r) ?? 0) < x.receive}
	{#if priceMode !== 'offer'}<span
			class={payBetter ? 'text-green-600' : ''}
			title="trade we pay per {resName(r)}">{x.pay === null ? '–' : fmt(x.pay)}</span
		>{/if}{#if priceMode === 'both'}<span class="text-gray-400">
			/
		</span>{/if}{#if priceMode !== 'want'}<span
			class={receiveBetter ? 'text-green-600' : ''}
			title="trade we receive per {resName(r)}">{x.receive === null ? '–' : fmt(x.receive)}</span
		>{/if}
{/snippet}
{#snippet needCell(e: Empire, r: string)}
	{@const s = stance(r, e, data.resourceInfo, data.model)}
	<span
		class={s === 'needs' ? 'text-red-600' : s === 'plenty' ? 'text-green-600' : ''}
		title="net {fmt(e.net[r] ?? 0)}/month"
		>{s === 'needs' ? '↑ ' : s === 'plenty' ? '↓ ' : ''}{fmt(e.stockpile[r] ?? 0)}</span
	>
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Trade</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !data.date}
	<p>No save with the other empires read yet; it fills after the next save.</p>
{:else}
	<div class="flex flex-col gap-6">
		<Panel
			title="Empires we talk to"
			note="As the diplomacy screen shows them: personality (and how good a deal must be for it — at 1.0 it accepts a deal equally good for both sides, at 0 none), attitude towards us (some attitudes refuse every trade), their opinion of us and what makes it up. Willing, opinion and trust run from red (the lowest here) to green (the highest). A gift's 'Favorable Trade Deal' adds up to {data
				.opinionModifiers[GIFT]?.max ?? 100} — the files say it fades by {decay ??
				2} a month, but none was seen over four months. Nomadic empires take energy and minerals but never give them{data.weNomadic
				? ' — nor can we, being nomadic'
				: ''}."
		>
			<div class="overflow-x-auto">
				<SortTable rows={data.empires} columns={empireColumns} key={(e) => e.countryId} />
			</div>
		</Panel>

		{#if data.enclaves.length}
			<Panel
				title="Trader enclaves"
				note="Each sells one strategic resource for energy: {ENCLAVE_DEAL.once} energy at once and {ENCLAVE_DEAL.monthly} a month per unit a month, for {ENCLAVE_DEAL.months /
					12} years, 1–{ENCLAVE_DEAL.maxPerMonth} a month, one deal per enclave — {fmt(
					enclaveUnitCost()
				)} energy per unit over the deal, whatever its size. In trade at the energy we could sell instead."
			>
				<SortTable rows={data.enclaves} columns={enclaveColumns} key={(x) => x.countryId} />
			</Panel>
		{/if}

		{#if !data.tradeIntel}
			<p class="text-sm text-gray-500">
				What they have to spare, what they need and what they would give for what needs their
				stockpiles, which the game does not show — switch on "Trade: other empires’ stockpiles" in ⚙
				(cheating).
			</p>
		{:else}
			<Panel
				title="Who would trade what (estimated)"
				note="For what we give, what each empire would give at most per unit, against selling ours and buying theirs on the {marketName} market ({Math.round(
					fee * 100
				)} % fee). Estimated: the game decides in its engine; the model is fitted to the game's own tooltips at three empires (one fallen) and to gifts at 13 more (a unit's worth by resource, less the more the empire earns of it; its personality's willingness) — within 3 % at one date; minerals and food drift upward over the years (6–8 % a half year so far, an engine 'need' the save does not show), energy did for a while; other resources are not measured, an empire shows – for them (docs/trade-calibration.md{data
					.model.calibrated
					? ''
					: ', not done yet'}. Monthly for monthly: the same rate; they pay at most {Math.round(
					data.model.monthlyShare * 100
				)} % of their gross income of it a month (measured). Trader enclaves take energy only."
			>
				<div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
					<label
						>we give <select
							class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
							bind:value={give}
						>
							{#each giveable as r (r)}<option value={r}>{resName(r)}</option>{/each}
						</select></label
					>
					<label
						>for <select
							class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
							bind:value={get}
						>
							{#each data.tradable as r (r)}<option value={r}>{resName(r)}</option>{/each}
						</select></label
					>
					<select
						class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
						bind:value={dealMode}
					>
						<option value="swap">swap at once</option>
						<option value="monthly">we pay once, they pay monthly</option>
					</select>
					{#if dealMode === 'monthly'}
						<label
							><input
								type="number"
								min="1"
								step="100"
								class="w-20 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
								bind:value={lump}
							/> at once</label
						>
						<label
							>for <select
								class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
								bind:value={years}
							>
								{#each [10, 15, 20, 25, 30] as y (y)}<option value={y}>{y}</option>{/each}
							</select> years</label
						>
					{/if}
					<span class="text-gray-500"
						>market: {market === null
							? '–'
							: `${fmt(market)} ${resName(get)} per ${resName(give)}`}</span
					>
				</div>
				{#if dealMode === 'monthly'}
					<p class="mb-2 text-sm text-gray-500">
						A unit a month is worth half as much to them, so over the deal they pay twice what they
						would at once — the same total for any length, so the shortest gets it soonest. Their
						monthly payment is capped at {Math.round(data.model.monthlyShare * 100)} % of their gross
						income of it, and the deal breaks when they can no longer afford it: check the last column.
					</p>
					{#if monthlyRows.length}
						<SortTable
							rows={monthlyRows}
							columns={monthlyColumns}
							key={(o) => o.key}
							bind:sort={monthlySort}
						/>
					{:else}
						<p class="text-sm text-gray-500">Nobody would make this deal.</p>
					{/if}
				{:else if offers.length}
					<SortTable
						rows={offers}
						columns={offerColumns}
						key={(o) => o.key}
						bind:sort={offerSort}
					/>
				{:else}
					<p class="text-sm text-gray-500">Nobody would make this trade.</p>
				{/if}
			</Panel>

			<Panel
				title="What a resource costs in trade (estimated)"
				note="Per empire and resource: the trade we would pay for one unit (I want — it gives the resource for our trade) and the trade we would get for one (I offer), from the same model as above; green where it beats the {marketName} market's row. – : it would not trade it (nothing to spare, a nomad's reserve, an attitude that refuses). Enclaves: their deal, in the energy we could sell instead."
			>
				<div class="mb-3 flex gap-1 text-sm">
					{#each [['want', 'I want — pay trade'], ['offer', 'I offer — receive trade'], ['both', 'both']] as [mode, label] (mode)}
						<button
							class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700 {priceMode ===
							mode
								? 'bg-gray-200 dark:bg-gray-800'
								: ''}"
							onclick={() => (priceMode = mode as typeof priceMode)}>{label}</button
						>
					{/each}
				</div>
				<div class="overflow-x-auto">
					<SortTable
						rows={priceRows}
						columns={priceColumns}
						rowClass={(p) => (p.market ? 'bg-gray-100 dark:bg-gray-800/60' : '')}
						key={(p) => p.key}
						bind:sort={priceSort}
					/>
				</div>
			</Panel>

			<Panel
				title="What a gift buys (estimated)"
				note="Opinion per empire for {fmt(
					GIFT_AMOUNT
				)} of each resource given: its worth to them at their willingness, as the trade screen's acceptance shows it (measured: that figure or one less) — 'Favorable Trade Deal', at most {data
					.opinionModifiers[GIFT]?.max ??
					100} (so less where earlier gifts are left; it did not fade over four months, whatever the files say). An empire whose storage of the resource is full takes it for nothing (seen at the fallen empires). Every attitude takes gifts, rivals and unfriendly ones too: a way to mend one that refuses trades."
			>
				<div class="overflow-x-auto">
					<SortTable
						rows={data.empires}
						columns={giftColumns}
						key={(e) => e.countryId}
						bind:sort={giftSort}
					/>
				</div>
			</Panel>

			<Panel
				title="What they need and have to spare"
				note="Per empire and resource: ↑ short of it (under a third of its storage — it pays more), ↓ flush (over three quarters — it gives it cheaper), and the stockpile. A resource it holds less of than it wants is not on offer."
			>
				<div class="overflow-x-auto">
					<SortTable rows={data.empires} columns={needColumns} key={(e) => e.countryId} />
				</div>
			</Panel>
		{/if}

		<p class="text-sm text-gray-500">
			Gifts: a gift raises an empire's opinion of us by what the trade screen's acceptance shows for
			it (its worth to them at their willingness) — "Favorable Trade Deal", at most 100, not fading
			in four months — whatever their attitude. With the spoiler on, "What a gift buys" estimates it
			per empire.
		</p>
	</div>
{/if}
