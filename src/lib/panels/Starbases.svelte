<script lang="ts">
	import { pretty } from '../format.ts';
	import QueueList from '../QueueList.svelte';
	import SortTable from '../SortTable.svelte';
	import type { Column } from '../sort.ts';
	import type { Station } from '../types.ts';
	import Panel from './Panel.svelte';

	let { stations, date }: { stations: Station[]; date: string } = $props();
	const columns: Column<Station>[] = [
		{ id: 'system', label: 'System', value: (s) => s.system },
		{ id: 'level', label: 'Level', value: (s) => pretty(s.level) },
		{ id: 'modules', label: 'Modules', value: (s) => s.modules.map(pretty).join(', ') || null },
		{
			id: 'buildings',
			label: 'Buildings',
			value: (s) => s.buildings.map(pretty).join(', ') || null
		},
		{ id: 'queue', label: 'Queue', value: (s) => s.queue.length, cell: queue }
	];
</script>

{#snippet queue(s: Station)}<QueueList queue={s.queue} slots={s.slots} {date} />{/snippet}

<Panel title="Starbases">
	{#if stations.length}
		<SortTable rows={stations} {columns} key={(s) => s.id} sort={{ column: '', desc: false }} />
	{:else}<p class="text-sm">none</p>{/if}
</Panel>
