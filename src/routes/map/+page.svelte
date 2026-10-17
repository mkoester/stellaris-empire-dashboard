<script lang="ts">
	import { followGame } from '#lib/live.ts';
	import { flows, ownerColors } from '#lib/migration.ts';
	import MigrationMap from '#lib/panels/MigrationMap.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	const rows = $derived(data.frame?.rows ?? []);
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Map</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<MigrationMap {rows} flows={flows(rows)} colors={ownerColors(rows)} systems={data.systems} />
