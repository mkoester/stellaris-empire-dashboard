<script lang="ts">
	import InfoPopup from '../InfoPopup.svelte';
	import type { Explanation } from '../types.ts';
	import Panel from './Panel.svelte';

	// Active edicts. The edict fund (10 / 15 in game) is computed from modifiers the save does not
	// hold (base 10, councilors +5, authority and cohesion multipliers), so only the count shows.
	let {
		edicts,
		explain = {}
	}: { edicts: { key: string; name: string }[]; explain?: Record<string, Explanation> } = $props();
</script>

<Panel title="Edicts">
	<div class="text-gray-500">{edicts.length} active</div>
	{#each edicts as e (e.key)}
		<div><InfoPopup explanation={explain[`edict:${e.key}`]}>{e.name}</InfoPopup></div>
	{:else}
		<div>none</div>
	{/each}
</Panel>
