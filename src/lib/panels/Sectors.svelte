<script lang="ts">
	import type { Sector } from '../types.ts';
	import Panel from './Panel.svelte';

	let { sectors }: { sectors: Sector[] } = $props();
</script>

<Panel title="Sectors">
	{#each sectors as s, i (i)}
		<div>
			{s.name} <span class="text-gray-500">{s.type}</span> · {s.systems} system{s.systems === 1
				? ''
				: 's'} · {s.colonies} colon{s.colonies === 1 ? 'y' : 'ies'}
		</div>
	{:else}
		<div>none</div>
	{/each}
</Panel>
