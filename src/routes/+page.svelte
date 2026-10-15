<script lang="ts">
	import { resolve } from '$app/paths';
	import Chart from '#lib/Chart.svelte';
	import Resources from '#lib/Resources.svelte';
	import Upcoming from '#lib/Upcoming.svelte';
	import { colorOf } from '#lib/colors.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { gameYear } from '#lib/series.ts';
	import { announceBranch, followGame, postBranch } from '#lib/live.ts';
	import type { Colony } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.empty || data.isHead);

	// Planet pages in other panes follow the branch shown here.
	const shown = () => (data.empty || data.isHead ? null : data.tip);
	announceBranch(shown);
	$effect(() => postBranch(shown()));

	const events = $derived(data.empty ? [] : data.upcoming);
	// Research per field (physics, society, engineering), then tradition, then agenda.
	const headerOrder = [
		'physics_research',
		'society_research',
		'engineering_research',
		'unity',
		'agenda'
	];
	const headerProgress = $derived(
		headerOrder.flatMap((tint) => events.filter((e) => e.tint === tint && e.total))
	);
	const headerLabel = (e: (typeof events)[number]) =>
		e.kind === 'research'
			? `next ${e.tint.replace('_research', '')} research`
			: e.kind === 'tradition'
				? 'next tradition'
				: 'agenda';
	const percent = (e: (typeof events)[number]) =>
		`${Math.min(100, Math.floor((100 * e.done!) / e.total!))}%`;
	const researchMarkers = $derived(
		events
			.filter((e) => e.kind === 'research')
			.map((e) => ({ x: gameYear(e.date), tint: e.tint, label: `${e.date.slice(0, 7)} ${e.what}` }))
	);

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
	<header class="mb-2 flex flex-col gap-1">
		<div class="flex flex-wrap items-baseline gap-x-4">
			<h1 class="text-2xl font-bold">{data.latest.empireName}</h1>
			<span class="text-lg">{data.latest.date}</span>
			{#if data.latest.empireSize !== null}
				<span>empire size <b>{fmt(data.latest.empireSize)}</b></span>
			{/if}
			{#if data.latest.starbases}
				<span>starbases <b>{data.latest.starbases.used} / {data.latest.starbases.capacity}</b></span
				>
			{/if}
			{#if data.latest.envoys}
				<span>envoys <b>{data.latest.envoys.used} / {data.latest.envoys.total}</b></span>
			{/if}
			{#if data.latest.navalUsed !== null}
				<span>naval capacity used <b>{fmt(data.latest.navalUsed)}</b></span>
			{/if}
			{#each headerProgress.filter((e) => e.kind === 'research') as e (e.tint)}
				{@render progress(e)}
			{/each}
			<a class="underline" href={resolve('/timeline')}>save graph</a>
			{#if !data.isHead}
				<a class="underline" href={resolve('/')}>back to the current game</a>
			{/if}
			{#if data.guessedLinks > 0}
				<span class="text-amber-600">
					{data.guessedLinks} branch point{data.guessedLinks > 1 ? 's' : ''} guessed — check the save
					graph
				</span>
			{/if}
		</div>
		<div class="flex flex-wrap items-baseline gap-x-4">
			{#each headerProgress.filter((e) => e.kind !== 'research') as e (e.tint)}
				{@render progress(e)}
			{/each}
		</div>
	</header>

	{#snippet progress(e: (typeof events)[number])}
		<span
			style:color={colorOf(e.tint)}
			title="{e.what}: {fmt(e.done!)} / {fmt(e.total!)}, ≈ {e.date}"
		>
			{headerLabel(e)} <b>{percent(e)}</b> ≈ {Math.round(e.months)} mo
		</span>
	{/snippet}

	<Resources
		stockpile={data.latest.stockpile}
		balance={data.latest.balance}
		orders={data.latest.marketOrders}
	/>

	<h2 class="mb-2 text-xl font-semibold">Upcoming</h2>
	<Upcoming events={data.upcoming} node={data.isHead ? null : data.tip} />

	<div class="mt-6 grid gap-4 lg:grid-cols-2">
		{#key data.tip}
			<Chart title="Empire size" series={data.charts.empireSize} range={data.xRange} yMin={50} />
			<Chart title="Pops" series={data.charts.pops} range={data.xRange} />
			<Chart
				title="Research per month"
				series={data.charts.research}
				range={data.xRange}
				markers={researchMarkers}
			/>
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
