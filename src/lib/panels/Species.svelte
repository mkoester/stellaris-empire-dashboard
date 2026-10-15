<script lang="ts">
	import { fmt } from '../format.ts';
	import type { TraitBudget } from '../species.ts';
	import Panel from './Panel.svelte';

	type Row = {
		id: string;
		name: string;
		className: string;
		pops: number;
		traits: string[];
		budget: TraitBudget | null;
	};
	let { species }: { species: Row[] } = $props();
</script>

<Panel
	title="Species"
	note="Trait points and picks left from the archetype's base budget; techs that raise it are not included."
>
	<table class="text-left text-sm">
		<thead>
			<tr class="border-b border-gray-300 dark:border-gray-700">
				<th class="p-1">Species</th>
				<th class="p-1">Class</th>
				<th class="p-1 text-right">Pops</th>
				<th class="p-1">Traits</th>
				<th class="p-1 text-right">Points left</th>
				<th class="p-1 text-right">Picks left</th>
			</tr>
		</thead>
		<tbody>
			{#each species as s (s.id)}
				<tr class="border-b border-gray-200 dark:border-gray-800">
					<td class="p-1">{s.name}</td>
					<td class="p-1 text-gray-500">{s.className}</td>
					<td class="p-1 text-right">{fmt(s.pops)}</td>
					<td class="p-1">{s.traits.join(', ')}</td>
					<td class="p-1 text-right"
						>{s.budget ? `${s.budget.points} / ${s.budget.maxPoints}` : '?'}</td
					>
					<td class="p-1 text-right"
						>{s.budget ? `${s.budget.picks} / ${s.budget.maxPicks}` : '?'}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>
</Panel>
