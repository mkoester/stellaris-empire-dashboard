<script lang="ts">
	import type { ColonySpecies } from './colonySpecies.ts';
	import { fmt } from './format.ts';

	// Who lives on the colony: pops per species with their citizenship, slaves set apart (4.x has no
	// slave stratum — enslaved pops work ordinary jobs).
	let { rows }: { rows: ColonySpecies[] } = $props();
</script>

{#if rows.length}
	<section class="mb-4 rounded border border-gray-300 p-2 text-sm dark:border-gray-700">
		<h2 class="mb-1 font-semibold">Pops by species</h2>
		<table class="w-full">
			<thead class="text-left text-xs text-gray-500">
				<tr>
					<th class="pr-2 font-normal">species</th>
					<th class="pr-2 text-right font-normal">pops</th>
					<th class="pr-2 font-normal">citizenship</th>
					<th class="text-right font-normal">habitability</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.id)}
					<tr class={r.enslaved ? 'bg-amber-50 dark:bg-amber-950' : ''}>
						<td class="pr-2">{r.name}</td>
						<td class="pr-2 text-right tabular-nums">{fmt(r.pops)}</td>
						<td class="pr-2 text-gray-500"
							>{r.citizenship ?? '?'}{r.slavery ? ` (${r.slavery})` : ''}</td
						>
						<td class="text-right text-gray-500 tabular-nums"
							>{r.habitability === null ? '' : `${Math.round(r.habitability * 100)} %`}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}
