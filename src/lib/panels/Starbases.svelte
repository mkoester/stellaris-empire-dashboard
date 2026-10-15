<script lang="ts">
	import { pretty } from '../format.ts';
	import QueueList from '../QueueList.svelte';
	import type { Station } from '../types.ts';
	import Panel from './Panel.svelte';

	let { stations, date }: { stations: Station[]; date: string } = $props();
</script>

<Panel title="Starbases">
	<table class="text-left text-sm">
		<thead>
			<tr class="border-b border-gray-300 dark:border-gray-700">
				<th class="p-1">System</th>
				<th class="p-1">Level</th>
				<th class="p-1">Modules</th>
				<th class="p-1">Buildings</th>
				<th class="p-1">Queue</th>
			</tr>
		</thead>
		<tbody>
			{#each stations as s (s.id)}
				<tr class="border-b border-gray-200 align-top dark:border-gray-800">
					<td class="p-1">{s.system}</td>
					<td class="p-1">{pretty(s.level)}</td>
					<td class="p-1">{s.modules.map(pretty).join(', ') || '–'}</td>
					<td class="p-1">{s.buildings.map(pretty).join(', ') || '–'}</td>
					<td class="p-1"><QueueList queue={s.queue} slots={s.slots} {date} /></td>
				</tr>
			{:else}
				<tr><td class="p-1" colspan="5">none</td></tr>
			{/each}
		</tbody>
	</table>
</Panel>
