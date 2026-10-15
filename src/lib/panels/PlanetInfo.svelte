<script lang="ts">
	import { nameOf } from '../format.ts';
	import type { Colony } from '../types.ts';
	import Panel from './Panel.svelte';

	// The planet under a colony: class, size and deposits. Blockers (to clear) come first; the
	// other deposits set what the districts can reach.
	let {
		colony,
		names,
		blockers,
		classNames
	}: {
		colony: Colony;
		names: Record<string, string>;
		blockers: string[];
		classNames: Record<string, string>;
	} = $props();

	const sorted = $derived(
		[...colony.deposits].sort((a, b) => Number(blockers.includes(b)) - Number(blockers.includes(a)))
	);
</script>

<Panel title="Planet">
	<div>
		{classNames[colony.planetClass] ?? colony.planetClass} · size <b>{colony.planetSize}</b>
	</div>
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
</Panel>
