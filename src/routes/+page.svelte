<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Chart from '#lib/Chart.svelte';

	let { data } = $props();

	// Reload whenever the server ingests a save — but only while following the head.
	onMount(() => {
		const events = new EventSource('/api/events');
		events.onmessage = () => {
			if (data.empty || data.isHead) invalidateAll();
		};
		return () => events.close();
	});

	const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
	const designation = (d: string) => d.replace(/^col_/, '').replaceAll('_', ' ');
</script>

{#if data.empty}
	<h1 class="text-2xl font-bold">Empire dashboard</h1>
	<p>Waiting for the first save.</p>
{:else}
	<header class="mb-4 flex flex-wrap items-baseline gap-x-4">
		<h1 class="text-2xl font-bold">{data.latest.empireName}</h1>
		<span class="text-lg">{data.latest.date}</span>
		{#if data.latest.empireSize !== null}
			<span>empire size <b>{fmt(data.latest.empireSize)}</b></span>
		{/if}
		{#if data.latest.starbases}
			<span>starbases <b>{data.latest.starbases.used} / {data.latest.starbases.capacity}</b></span>
		{/if}
		{#if data.latest.navalUsed !== null}
			<span>naval capacity used <b>{fmt(data.latest.navalUsed)}</b></span>
		{/if}
		<a class="underline" href={resolve('/timeline')}>save graph</a>
		{#if !data.isHead}
			<a class="underline" href={resolve('/')}>back to the current game</a>
		{/if}
		{#if data.guessedLinks > 0}
			<span class="text-amber-600">
				{data.guessedLinks} branch point{data.guessedLinks > 1 ? 's' : ''} guessed — check the save graph
			</span>
		{/if}
	</header>

	<div class="grid gap-4 lg:grid-cols-2">
		{#key data.tip}
			<Chart title="Empire size" series={data.charts.empireSize} range={data.xRange} yMin={50} />
			<Chart title="Pops" series={data.charts.pops} range={data.xRange} />
			<Chart title="Research per month" series={data.charts.research} range={data.xRange} />
			<Chart title="Net per month" series={data.charts.balance} range={data.xRange} />
			<Chart title="Stockpile" series={data.charts.stockpile} range={data.xRange} />
			<Chart title="Income per month" series={data.charts.income} range={data.xRange} />
		{/key}
	</div>

	<h2 class="mt-6 mb-2 text-xl font-semibold">Colonies</h2>
	<div class="overflow-x-auto">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-gray-300 dark:border-gray-700">
					<th class="p-1">Planet</th>
					<th class="p-1">Designation</th>
					<th class="p-1 text-right">Pops</th>
					<th class="p-1 text-right">Employable</th>
					<th class="p-1 text-right">Stability</th>
					<th class="p-1 text-right">Free housing</th>
					<th class="p-1 text-right">Free amenities</th>
					<th class="p-1 text-right">Districts</th>
				</tr>
			</thead>
			<tbody>
				{#each data.latest.colonies as c (c.planetId + ':' + c.name)}
					<tr class="border-b border-gray-200 dark:border-gray-800">
						<td class="p-1">{c.name}</td>
						<td class="p-1">{designation(c.designation)}</td>
						<td class="p-1 text-right">{fmt(c.pops)}</td>
						<td class="p-1 text-right">{fmt(c.employablePops)}</td>
						<td class="p-1 text-right">{fmt(c.stability)}</td>
						<td class="p-1 text-right">{fmt(c.freeHousing)}</td>
						<td class="p-1 text-right">{fmt(c.freeAmenities)}</td>
						<td class="p-1 text-right">{c.districts}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
