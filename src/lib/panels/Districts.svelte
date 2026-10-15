<script lang="ts">
	import { nameOf } from '../format.ts';
	import type { ColonyDistrict } from '../types.ts';
	import Panel from './Panel.svelte';

	// A colony's districts in detail: how many are built, its zones (specialisations) and their
	// buildings by name.
	let { districts, names }: { districts: ColonyDistrict[]; names: Record<string, string> } =
		$props();
</script>

<Panel
	title="Districts"
	note="Free district and building slots are computed by the game and not in the save — see the planet view in game."
>
	<table class="text-left text-sm">
		<thead>
			<tr class="border-b border-gray-300 dark:border-gray-700">
				<th class="p-1">District</th>
				<th class="p-1 text-right">Built</th>
				<th class="p-1">Zone</th>
				<th class="p-1">Buildings</th>
			</tr>
		</thead>
		<tbody>
			{#each districts as d (d.type)}
				{#each d.zones.length ? d.zones : [null] as z, i (i)}
					<tr
						class="align-top {i === d.zones.length - 1 || !d.zones.length
							? 'border-b border-gray-200 dark:border-gray-800'
							: ''}"
					>
						<td class="p-1">{i ? '' : nameOf(names, d.type)}</td>
						<td class="p-1 text-right">{i ? '' : d.built}</td>
						<td class="p-1">{z ? nameOf(names, z.type) : '–'}</td>
						<td class="p-1">
							{#if z}
								{z.buildings.map((b) => nameOf(names, b)).join(', ') || 'none yet'}
							{/if}
						</td>
					</tr>
				{/each}
			{/each}
		</tbody>
	</table>
</Panel>
