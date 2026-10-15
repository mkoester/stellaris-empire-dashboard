<script lang="ts">
	import { pretty } from '../format.ts';
	import type { ExpansionPlanet } from '../types.ts';
	import Panel from './Panel.svelte';

	type Row = ExpansionPlanet & { className: string; colonizable: boolean };
	let { planets }: { planets: Row[] } = $props();
</script>

<Panel
	title="Expansion"
	note="Surveyed planets nobody owns, nearest first. Habitability is not shown; 'colonizable class' is the planet class rule from the game files — terraforming and species decide the rest."
>
	{#if planets.length === 0}
		<p>No surveyed planets left.</p>
	{:else}
		<table class="text-left text-sm">
			<thead>
				<tr class="border-b border-gray-300 dark:border-gray-700">
					<th class="p-1">Planet</th>
					<th class="p-1">Class</th>
					<th class="p-1 text-right">Size</th>
					<th class="p-1">System</th>
					<th class="p-1 text-right">Jumps</th>
					<th class="p-1">Modifier</th>
					<th class="p-1">Colonizable class</th>
				</tr>
			</thead>
			<tbody>
				{#each planets as p (p.planetId)}
					<tr class="border-b border-gray-200 dark:border-gray-800">
						<td class="p-1">{p.name}</td>
						<td class="p-1">{p.className}</td>
						<td class="p-1 text-right">{p.size}</td>
						<td class="p-1">{p.system}</td>
						<td class="p-1 text-right">{p.jumps ?? '–'}</td>
						<td class="p-1">{p.modifier ? pretty(p.modifier.replace(/^pm_/, '')) : ''}</td>
						<td class="p-1">{p.colonizable ? 'yes' : ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Panel>
