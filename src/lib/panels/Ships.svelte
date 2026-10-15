<script lang="ts">
	import { fmt, pretty } from '../format.ts';
	import type { Fleet, ShipCount } from '../types.ts';
	import Panel from './Panel.svelte';

	// Ships by size per group, then the military fleets with their power. Naval capacity: only
	// the used part is in the save, the maximum is computed by the game.
	let {
		ships,
		fleets,
		navalUsed
	}: { ships: ShipCount[]; fleets: Fleet[]; navalUsed: number | null } = $props();

	const groups = ['military', 'civilian', 'station'] as const;
</script>

<Panel title="Ships">
	{#each groups as g (g)}
		{@const of = ships.filter((s) => s.group === g)}
		{#if of.length}
			<div class="mt-1 text-gray-500">{g}</div>
			{#each of as s (s.size)}
				<div>{pretty(s.size)} <b>{s.count}</b></div>
			{/each}
		{/if}
	{/each}
	{#if fleets.length}
		<div class="mt-3 text-gray-500">
			fleets{navalUsed !== null ? ` · naval capacity used ${fmt(navalUsed)}` : ''}
		</div>
		{#each fleets as f, i (i)}
			<div>{f.name}: {f.ships} ships, power <b>{fmt(f.power)}</b></div>
		{/each}
	{/if}
</Panel>
