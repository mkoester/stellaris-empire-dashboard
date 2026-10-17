<script lang="ts">
	import Chart from '#lib/Chart.svelte';
	import { dealEnd, sideSummary } from '#lib/deals.ts';
	import { followGame } from '#lib/live.ts';
	import type { TradeDeal } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const active = $derived(data.history.filter((e) => e.active));
	const past = $derived(data.history.filter((e) => !e.active));
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Trade deals</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<p class="mb-4 max-w-3xl text-sm text-gray-500">
	No trade deal has been seen in a save yet, so how they are read is a guess. Each deal shows the
	save's own data — check the first one against the game's diplomacy screen.
</p>

{#if data.history.length === 0}
	<p class="text-gray-500">No trade deals on this branch.</p>
{:else}
	<h2 class="mb-2 text-xl font-semibold">Running</h2>
	{#if active.length === 0}
		<p class="mb-6 text-gray-500">None.</p>
	{:else}
		<div class="mb-6 flex flex-col gap-3">
			{#each active as e (e.deal.id)}
				{@render deal(e.deal, e.firstSeen)}
			{/each}
		</div>
	{/if}

	{#if Object.keys(data.flows.lines).length > 0}
		<div class="mb-6 max-w-4xl">
			<Chart
				title="monthly resources from trade deals"
				series={data.flows}
				range={data.xRange}
				events={data.milestones}
			/>
		</div>
	{/if}

	{#if past.length > 0}
		<h2 class="mb-2 text-xl font-semibold">Ended</h2>
		<div class="flex flex-col gap-3">
			{#each past as e (e.deal.id)}
				{@render deal(e.deal, e.firstSeen, e.lastSeen)}
			{/each}
		</div>
	{/if}
{/if}

{#snippet deal(d: TradeDeal, firstSeen: string, lastSeen?: string)}
	{@const end = dealEnd(d)}
	<section class="rounded border border-gray-200 p-3 text-sm dark:border-gray-800">
		<div class="mb-1 flex flex-wrap items-baseline gap-x-4">
			<b class="text-base">{d.partner}</b>
			<span class="text-gray-500 tabular-nums"
				>{d.start ?? `seen ${firstSeen}`}{end ? ` – ${end}` : ''}{lastSeen
					? ` (last seen ${lastSeen})`
					: ''}</span
			>
			{#if !d.understood}<span class="text-red-600"
					>not understood{d.raw ? ' — see the save data' : ''}</span
				>{/if}
		</div>
		<div>we give: {sideSummary(d.gives)}</div>
		<div>we get: {sideSummary(d.gets)}</div>
		{#if d.raw}
			<details class="mt-1 text-gray-500">
				<summary class="cursor-pointer">save data</summary>
				<pre class="text-xs break-all whitespace-pre-wrap">{d.raw}</pre>
			</details>
		{/if}
	</section>
{/snippet}
