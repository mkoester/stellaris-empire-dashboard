<script lang="ts">
	import { resolve } from '$app/paths';
	import { followGame } from '#lib/live.ts';
	import MigrationBars from '#lib/panels/MigrationBars.svelte';
	import MigrationHeatmap from '#lib/panels/MigrationHeatmap.svelte';
	import MigrationMap from '#lib/panels/MigrationMap.svelte';
	import MigrationSankey from '#lib/panels/MigrationSankey.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	const back = $derived(resolve(data.isHead ? '/' : `/?node=${data.tip}`));
	const estimated = $derived(data.flows.some((f) => f.estimated));
</script>

<header class="mb-4 flex items-start gap-4">
	<div class="flex flex-1 flex-wrap items-baseline gap-x-4">
		<h1 class="text-2xl font-bold">Migration</h1>
		<a class="underline" href={back}>empire</a>
	</div>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<p class="mb-4 max-w-3xl text-sm text-gray-500">
	The save records, per colony, how many pops arrived and left last month — not where they came from
	or went. With one sender or one receiver the flows are exact{estimated
		? '; this month they are an estimate (each sender split over the receivers by their share)'
		: ''}. Foreign colonies appear once a migration treaty moves pops.
</p>

<div class="flex flex-col gap-8">
	<MigrationSankey flows={data.flows} colors={data.colors} />
	<MigrationMap rows={data.rows} flows={data.flows} colors={data.colors} />
	<MigrationBars x={data.history.x} colonies={data.history.colonies} />
	<MigrationHeatmap x={data.history.x} colonies={data.history.colonies} />
</div>
