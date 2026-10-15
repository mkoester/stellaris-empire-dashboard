<script lang="ts">
	import { resolve } from '$app/paths';
	import Chart from '#lib/Chart.svelte';
	import Upcoming from '#lib/Upcoming.svelte';
	import { fmt, pretty } from '#lib/format.ts';
	import { announceBranch, followGame, postBranch } from '#lib/live.ts';
	import type { Colony } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.empty || data.isHead);

	// Planet pages in other panes follow the branch shown here.
	const shown = () => (data.empty || data.isHead ? null : data.tip);
	announceBranch(shown);
	$effect(() => postBranch(shown()));

	// Stay on the same branch when opening a planet.
	const planetHref = (planetId: number) =>
		!data.empty && !data.isHead
			? resolve(`/planet/[id]?node=${data.tip}`, { id: String(planetId) })
			: resolve('/planet/[id]', { id: String(planetId) });

	const queue = (c: Colony) =>
		c.buildQueue.length === 0
			? '∅'
			: pretty(c.buildQueue[0].name) +
				(c.buildQueue.length > 1 ? ` (+${c.buildQueue.length - 1})` : '');
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

	<h2 class="mb-2 text-xl font-semibold">Upcoming</h2>
	<Upcoming events={data.upcoming} node={data.isHead ? null : data.tip} />

	<div class="mt-6 grid gap-4 lg:grid-cols-2">
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
					<th class="p-1 text-right">Employed</th>
					<th class="p-1 text-right">Civilians</th>
					<th class="p-1 text-right">Stability</th>
					<th class="p-1 text-right">Free housing</th>
					<th class="p-1 text-right">Free amenities</th>
					<th class="p-1 text-right">Districts</th>
					<th class="p-1 text-right">Build queue</th>
				</tr>
			</thead>
			<tbody>
				{#each data.latest.colonies as c (c.planetId + ':' + c.name)}
					<tr class="border-b border-gray-200 dark:border-gray-800">
						<td class="p-1">
							{#if c.planetId >= 0}
								<a class="underline" href={planetHref(c.planetId)}>{c.name}</a>
							{:else}
								{c.name}
							{/if}
						</td>
						<td class="p-1">{pretty(c.designation)}</td>
						<td class="p-1 text-right">{fmt(c.pops)}</td>
						<td class="p-1 text-right">{fmt(c.employed)}</td>
						<td class="p-1 text-right">{fmt(c.civilians)}</td>
						<td class="p-1 text-right">{fmt(c.stability)}</td>
						<td class="p-1 text-right">{fmt(c.freeHousing)}</td>
						<td class="p-1 text-right">{fmt(c.freeAmenities)}</td>
						<td class="p-1 text-right">{c.districts}</td>
						<td class="p-1 text-right">{queue(c)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
