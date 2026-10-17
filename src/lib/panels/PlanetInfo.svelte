<script lang="ts">
	import { nameOf } from '../format.ts';
	import type { PlanetDetailsData } from '../districtCaps.ts';
	import PlanetDetails from '../PlanetDetails.svelte';
	import type { Colony } from '../types.ts';
	import Panel from './Panel.svelte';

	// The planet under a colony: class, size, and its details (district caps, features, blockers,
	// modifiers) — or, for a snapshot from before those were read, its deposits by name.
	let {
		colony,
		names,
		blockers,
		classNames,
		details,
		date
	}: {
		colony: Colony;
		names: Record<string, string>;
		blockers: string[];
		classNames: Record<string, string>;
		details: PlanetDetailsData | null;
		date: string;
	} = $props();

	const sorted = $derived(
		[...colony.deposits].sort((a, b) => Number(blockers.includes(b)) - Number(blockers.includes(a)))
	);
</script>

<Panel title="Planet">
	<div>
		{classNames[colony.planetClass] ?? colony.planetClass} · size <b>{colony.planetSize}</b>
	</div>
	{#if details}
		<div class="mt-2"><PlanetDetails {...details} {date} /></div>
	{:else}
		<div class="mt-1 text-gray-500">deposits</div>
		{#each sorted as d, i (i)}
			<div>
				{#if blockers.includes(d)}<span
						class="text-amber-600"
						title="blocker: clear it to free its district slots">⛔</span
					>{/if}
				{nameOf(names, d)}
			</div>
		{:else}
			<div>none</div>
		{/each}
	{/if}
</Panel>
