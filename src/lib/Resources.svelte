<script lang="ts">
	import { colorOf } from './colors.ts';
	import { fmt, pretty } from './format.ts';
	import { monthlyLimit } from './market.ts';
	import type { MarketOrder, Resources } from './types.ts';

	// The game's top bar: stockpile and net change per month, in the game's order. Basic resources
	// always show; strategic ones once the empire has or makes any.
	let {
		stockpile,
		balance,
		orders
	}: { stockpile: Resources; balance: Resources; orders: MarketOrder[] } = $props();

	const basic = ['energy', 'minerals', 'food', 'consumer_goods', 'alloys', 'trade'];
	const last = ['unity', 'influence'];
	const skip = new Set([
		...basic,
		...last,
		'physics_research',
		'society_research',
		'engineering_research'
	]);

	const shown = $derived([
		...basic,
		...Object.keys({ ...stockpile, ...balance })
			.filter((k) => !skip.has(k) && ((stockpile[k] ?? 0) !== 0 || (balance[k] ?? 0) !== 0))
			.sort(),
		...last
	]);

	const signed = (n: number) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
</script>

<div class="mb-4 flex flex-wrap gap-x-5 gap-y-1">
	{#each shown as key (key)}
		{@const net = balance[key] ?? 0}
		<span class="whitespace-nowrap">
			<span style:color={colorOf(key)}>{pretty(key)}</span>
			<b>{fmt(stockpile[key] ?? 0)}</b>
			<span class={net < 0 ? 'text-red-600' : net > 0 ? 'text-green-600' : 'text-gray-500'}
				>{signed(net)}</span
			>
		</span>
	{/each}
</div>

{#if orders.length > 0}
	<div class="-mt-3 mb-4 flex flex-wrap gap-x-4 text-sm">
		<span class="text-gray-500">market orders / monthly limit (included in the net change):</span>
		{#each orders as o, i (i)}
			{@const limit = monthlyLimit(o)}
			{@const over = limit !== null && o.amount > limit}
			<span
				class="whitespace-nowrap"
				title={limit === null
					? ''
					: `monthly ${o.kind} limit ${limit}${over ? ' — above it the price inflates' : ''}`}
			>
				{o.kind}
				<b class={over ? 'text-red-600' : ''}>{fmt(o.amount)}</b>{#if limit !== null}<span
						class={over ? 'text-red-600' : 'text-gray-500'}>&thinsp;/&thinsp;{limit}</span
					>{/if}
				<span style:color={colorOf(o.resource)}>{pretty(o.resource)}</span>
			</span>
		{/each}
	</div>
{/if}
