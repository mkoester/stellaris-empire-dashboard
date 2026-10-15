<script lang="ts">
	import { resolve } from '$app/paths';
	import Chart from '#lib/Chart.svelte';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const back = $derived(resolve(data.isHead ? '/' : `/?node=${data.tip}`));
</script>

<header class="mb-4 flex flex-wrap items-baseline gap-x-4">
	<h1 class="text-2xl font-bold">{data.colony.name}</h1>
	<span>{pretty(data.colony.designation)}</span>
	<span class="text-lg">{data.latest.date}</span>
	<a class="underline" href={back}>empire</a>
</header>

<h2 class="mb-2 text-xl font-semibold">Build queue</h2>
{#if data.colony.buildQueue.length === 0}
	<p class="mb-4">Empty.</p>
{:else}
	<table class="mb-4 text-left text-sm">
		<tbody>
			{#each data.colony.buildQueue as item, i (i)}
				<tr class="border-b border-gray-200 dark:border-gray-800">
					<td class="p-1">{pretty(item.name)}</td>
					<td class="p-1 text-gray-500">{pretty(item.kind)}</td>
					<td class="p-1 text-right">{fmt(item.progress)} / {fmt(item.needed)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<div class="grid gap-4 lg:grid-cols-2">
	{#key data.tip}
		<Chart title="Pops" series={data.charts.pops} range={data.xRange} />
		<Chart title="Stability" series={data.charts.stability} range={data.xRange} />
		<Chart title="Free housing and amenities" series={data.charts.free} range={data.xRange} />
		<Chart title="Districts" series={data.charts.districts} range={data.xRange} />
	{/key}
</div>
