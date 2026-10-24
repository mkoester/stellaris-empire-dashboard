<script lang="ts">
	import { colorOf } from './colors.ts';
	import { fmt, pretty } from './format.ts';
	import { monthlyLimit } from './market.ts';
	import { followTicks } from './live.ts';
	import { stripOrder } from './resourceGroups.ts';
	import { monthsLeft, urgencyColor, type StorageRow } from './storage.ts';
	import type { MarketOrder, Resources, Tick } from './types.ts';

	// The game's top bar: stockpile and net change per month, in the game's order. Basic resources
	// always show; strategic ones once the empire has or makes any.
	// On the galactic market there are no per-empire monthly limits (see market.ts).
	// With `live` (the page shows the head), the stockpile follows the companion mod's daily tick.
	// Under each resource with storage, in grey: its limit (≈ without companion mod 0.5.0) and the
	// months until full or empty at this month's net, redder the sooner.
	let {
		stockpile: saved,
		balance,
		orders,
		galactic = false,
		date,
		live = false,
		storage = []
	}: {
		stockpile: Resources;
		balance: Resources;
		orders: MarketOrder[];
		galactic?: boolean;
		date: string;
		live?: boolean;
		storage?: StorageRow[];
	} = $props();

	const limits = $derived(new Map(storage.map((s) => [s.resource, s])));
	const months = (m: number) => (m >= 100 ? '100+ mo' : m < 1 ? '<1 mo' : `${Math.round(m)} mo`);

	let tick = $state<Tick | null>(null);
	followTicks((t) => (tick = t));
	const today = $derived(live && tick && tick.date > date ? tick : null);
	const stockpile = $derived(today?.stockpile ?? saved);

	const shown = $derived(
		stripOrder(
			Object.keys({ ...stockpile, ...balance }).filter(
				(k) => (stockpile[k] ?? 0) !== 0 || (balance[k] ?? 0) !== 0
			)
		)
	);

	const signed = (n: number) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
</script>

<div class="mb-4 flex flex-wrap gap-x-5 gap-y-1">
	{#if today}
		<span
			class="text-sm whitespace-nowrap text-gray-500"
			title="stockpile from the companion mod's daily tick">as of {today.date}</span
		>
	{/if}
	{#each shown as key (key)}
		{@const net = balance[key] ?? 0}
		{@const limit = limits.get(key)}
		{@const have = stockpile[key] ?? 0}
		{@const left = limit ? monthsLeft(have, limit.max, net) : null}
		<span class="inline-flex flex-col whitespace-nowrap">
			<span>
				<span style:color={colorOf(key)}>{pretty(key)}</span>
				<b>{fmt(have)}</b>
				<span class={net < 0 ? 'text-red-600' : net > 0 ? 'text-green-600' : 'text-gray-500'}
					>{signed(net)}</span
				>
			</span>
			{#if limit}
				<span
					class="text-right text-xs text-gray-500"
					title={`storage ${limit.exact ? '' : '≈ '}${fmt(limit.max)}${limit.exact ? '' : " (the base; silos, Mega-Engineering and others add to it — companion mod 0.5.0 stores the game's value)"}${left === null ? '' : `; ${net > 0 ? 'full' : 'empty'} in ${months(left)} at ${signed(net)} a month`}`}
					>({limit.exact ? '' : '≈'}{fmt(limit.max)}){#if left !== null}
						<span style:color={urgencyColor(left)}
							>&ensp;{left === 0 ? (net > 0 ? 'full' : 'empty') : months(left)}</span
						>{/if}</span
				>
			{/if}
		</span>
	{/each}
</div>

{#if orders.length > 0}
	<div class="-mt-3 mb-4 flex flex-wrap gap-x-4 text-sm">
		<span class="text-gray-500"
			>{galactic ? 'galactic market orders' : 'market orders / monthly limit'} (included in the net change):</span
		>
		{#each orders as o, i (i)}
			{@const limit = monthlyLimit(o, galactic)}
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
