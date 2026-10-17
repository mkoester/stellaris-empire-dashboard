<script lang="ts">
	import Chart from '#lib/Chart.svelte';
	import { colorOf } from '#lib/colors.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import { basePrice, monthlyLimit, price } from '#lib/market.ts';
	import { byTopBar } from '#lib/resourceGroups.ts';
	import { gameYear } from '#lib/series.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const galactic = $derived(data.market?.galactic ?? false);
	const since = $derived(data.switches.at(-1)?.date ?? null);
	const rows = $derived(
		Object.entries(data.market?.fluctuations ?? {})
			.sort(([a], [b]) => byTopBar(a, b))
			.map(([resource, fluctuation]) => ({
				resource,
				fluctuation,
				base: basePrice(resource),
				price: price(resource, fluctuation),
				orders: data.orders.filter((o) => o.resource === resource)
			}))
	);
	const markers = $derived(
		data.switches.map((s) => ({
			x: gameYear(s.date),
			tint: 'trade',
			label: s.galactic ? 'galactic market' : 'internal market'
		}))
	);

	const money = (n: number | null) => (n === null ? '–' : n.toFixed(2));
	const pct = (f: number) => `${Math.round(f * 1000) / 10} %`;
	// price paid (+1) or got (−1) with the fee; unknown without it
	const withFee = (p: number | null, side: 1 | -1) =>
		p === null || !data.fee ? null : p * (1 + side * data.fee.fee);
	const signed = (n: number) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n)) + ' %';
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Market</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if data.market === null}
	<p class="text-gray-500">No save with market data yet.</p>
{:else}
	<p class="mb-4 max-w-3xl text-sm text-gray-500">
		{#if galactic}
			<b class="text-current">Galactic market</b>{since ? ` since ${since}` : ''}: one market for
			every member, so everyone's trades move its prices and there is no monthly limit of your own.
		{:else}
			<b class="text-current">Internal market</b>: the empire's own. Trading moves its prices twice
			as much as on the galactic market, and they recover three times slower. Access to the galactic
			market comes once it is founded and the empire is in the Galactic Community.
		{/if}
		Prices are trade per unit; buying adds the market fee, selling deducts it.
	</p>

	{#if data.fee}
		<p class="mb-4 text-sm">
			Market fee <b>{pct(data.fee.fee)}</b>
			<span class="text-gray-500"
				>= base 30 %{#each data.fee.sources as s (s.key)}, {s.name}{s.count > 1
						? ` ×${s.count}`
						: ''}
					{s.fee < 0 ? '−' : '+'}{pct(Math.abs(s.fee * s.count))}{/each}{data.fee.fee === 0.05
					? ' (5 % at least)'
					: ''} — not counted: an enclave trader councilor (−1 %)</span
			>
		</p>
	{/if}

	<table class="mb-6 text-sm tabular-nums">
		<thead class="text-left text-gray-500">
			<tr>
				<th class="pr-6 font-normal">resource</th>
				<th class="pr-6 text-right font-normal">base</th>
				<th class="pr-6 text-right font-normal">price</th>
				<th class="pr-6 text-right font-normal">vs. base</th>
				<th class="pr-6 text-right font-normal">buy</th>
				<th class="pr-6 text-right font-normal">sell</th>
				<th class="font-normal">your monthly orders</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.resource)}
				<tr>
					<td class="pr-6" style:color={colorOf(r.resource)}>{pretty(r.resource)}</td>
					<td class="pr-6 text-right text-gray-500">{money(r.base)}</td>
					<td class="pr-6 text-right font-semibold">{money(r.price)}</td>
					<td class="pr-6 text-right text-gray-500">{signed(r.fluctuation)}</td>
					<td class="pr-6 text-right">{money(withFee(r.price, 1))}</td>
					<td class="pr-6 text-right">{money(withFee(r.price, -1))}</td>
					<td>
						{#each r.orders as o, i (i)}
							{@const limit = monthlyLimit(o, galactic)}
							<span class="mr-3 whitespace-nowrap"
								>{o.kind}
								<b class={limit !== null && o.amount > limit ? 'text-red-600' : ''}
									>{fmt(o.amount)}</b
								>{#if limit !== null}<span class="text-gray-500">&thinsp;/&thinsp;{limit}</span
									>{/if}</span
							>
						{/each}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<div class="grid gap-6 lg:grid-cols-2">
		{#if Object.keys(data.basic.lines).length > 0}
			<Chart
				title="prices: basic and advanced"
				series={data.basic}
				range={data.xRange}
				yMin={0}
				{markers}
				events={data.milestones}
			/>
		{/if}
		{#if data.fees.lines['market fee %'].some((v) => v !== null)}
			<Chart
				title="market fee"
				series={data.fees}
				range={data.xRange}
				yMin={0}
				yMax={40}
				events={data.milestones}
			/>
		{/if}
		{#if Object.keys(data.strategic.lines).length > 0}
			<Chart
				title="prices: strategic"
				series={data.strategic}
				range={data.xRange}
				yMin={0}
				{markers}
				events={data.milestones}
			/>
		{/if}
	</div>
{/if}
