<script lang="ts">
	import DistrictName from '../DistrictName.svelte';
	import { nameOf } from '../format.ts';
	import type { ColonyDistrict } from '../types.ts';
	import Panel from './Panel.svelte';

	// A colony's districts in detail: how many are built, its zones (specialisations) and their
	// buildings by name.
	let {
		districts,
		names,
		colors
	}: {
		districts: ColonyDistrict[];
		names: Record<string, string>;
		colors: Record<string, string>;
	} = $props();
</script>

<Panel
	title="Districts"
	note="Free district slots: see the planet's district caps. Free building slots are computed by the game and not in the save."
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
						<td class="p-1"
							>{#if !i}<DistrictName name={nameOf(names, d.type)} color={colors[d.type]} />{/if}</td
						>
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
