<script lang="ts">
	import FrameSlider from '#lib/FrameSlider.svelte';
	import { followGame } from '#lib/live.ts';
	import {
		CATEGORICAL,
		flows,
		ownerColors,
		RESETTLE_COLOR,
		resettleFlows,
		type MigrationView
	} from '#lib/migration.ts';
	import { putSettings } from '#lib/settings.ts';
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
	const monthFlows = $derived([...flows(rows), ...resettleFlows(rows, frame?.moves ?? null)]);
	const resettling = $derived(monthFlows.some((f) => f.kind === 'resettle'));
	// resettlement pairs from the mod's lines, or estimated from the save's totals
	const exactMoves = $derived(!!frame?.moves?.length);
	const colors = $derived(ownerColors(rows));
	const estimated = $derived(monthFlows.some((f) => f.estimated));
	// the months pops moved, under the slider: migration and resettlement, each a lane
	const lanes = $derived([
		{
			label: 'migration',
			color: CATEGORICAL[0],
			on: data.frames.map((f) => flows(f.rows).length > 0)
		},
		{
			label: 'resettlement',
			color: RESETTLE_COLOR,
			on: data.frames.map((f) => resettleFlows(f.rows, f.moves).length > 0)
		}
	]);
	let view: MigrationView = $derived(data.view);
	const setView = (v: MigrationView) => {
		view = v;
		void putSettings({ migrationView: v });
	};
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
		: ''}. Foreign colonies appear once a migration treaty moves pops. Resettlement among your
	colonies is drawn in violet, apart from migration{resettling
		? exactMoves
			? ' — this month pair by pair, as the companion mod logged it'
			: ' — from the save’s totals; the companion mod (0.16.0) logs each pair'
		: ''}.
</p>

<div class="flex flex-col gap-8">
	<MigrationBars x={data.history.x} colonies={data.history.colonies} />
	<MigrationHeatmap x={data.history.x} colonies={data.history.colonies} />

	<!-- one month at a time: the slider drives the flow diagram and the map below it -->
	<section class="flex flex-col gap-6">
		<FrameSlider
			dates={data.frames.map((f) => f.date)}
			bind:picked
			{lanes}
			label="month shown by the flow diagram and the map"
		/>
		<MigrationSankey flows={monthFlows} {colors} />
		<MigrationMap
			{rows}
			flows={monthFlows}
			{colors}
			systems={data.systems}
			territories={data.territories}
			arkships={data.arkships}
			firstSeen={data.firstSeen}
			{view}
			onView={setView}
		/>
	</section>
</div>
