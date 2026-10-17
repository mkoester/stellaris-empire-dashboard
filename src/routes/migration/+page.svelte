<script lang="ts">
	import { followGame } from '#lib/live.ts';
	import { flows, ownerColors } from '#lib/migration.ts';
	import MigrationBars from '#lib/panels/MigrationBars.svelte';
	import MigrationHeatmap from '#lib/panels/MigrationHeatmap.svelte';
	import MigrationMap from '#lib/panels/MigrationMap.svelte';
	import MigrationSankey from '#lib/panels/MigrationSankey.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	// The month shown by the flow diagram and the map: the latest until the slider is moved; a
	// reload with new data jumps back to the latest.
	let picked: number | null = $state(null);
	const last = $derived(data.frames.length - 1);
	const at = $derived(picked === null || picked > last ? last : picked);
	const frame = $derived(data.frames[at]);
	const rows = $derived(frame?.rows ?? []);
	const monthFlows = $derived(flows(rows));
	const colors = $derived(ownerColors(rows));
	const estimated = $derived(monthFlows.some((f) => f.estimated));
</script>

<header class="mb-4 flex items-start gap-4">
	<div class="flex flex-1 flex-wrap items-baseline gap-x-4">
		<h1 class="text-2xl font-bold">Migration</h1>
	</div>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<p class="mb-4 max-w-3xl text-sm text-gray-500">
	The save records, per colony, how many pops arrived and left in a month — not where they came from
	or went. With one sender or one receiver the flows are exact{estimated
		? '; in this month they are an estimate (each sender split over the receivers by their share)'
		: ''}. Foreign colonies appear once a migration treaty moves pops.
</p>

<div class="flex flex-col gap-8">
	<MigrationBars x={data.history.x} colonies={data.history.colonies} />
	<MigrationHeatmap x={data.history.x} colonies={data.history.colonies} />

	<!-- one month at a time: the slider drives the flow diagram and the map below it -->
	<section class="flex flex-col gap-6">
		{#if data.frames.length}
			<div class="flex max-w-3xl items-center gap-3 text-sm">
				<span class="text-gray-500">month</span>
				<input
					type="range"
					min="0"
					max={last}
					value={at}
					oninput={(e) => (picked = Number(e.currentTarget.value))}
					class="flex-1"
					aria-label="month shown by the flow diagram and the map"
				/>
				<b class="tabular-nums">{frame.date.slice(0, 7)}</b>
				{#if at !== last}
					<button class="underline" onclick={() => (picked = null)}>latest</button>
				{/if}
			</div>
		{/if}
		<MigrationSankey flows={monthFlows} {colors} />
		<MigrationMap {rows} flows={monthFlows} {colors} systems={data.systems} />
	</section>
</div>
