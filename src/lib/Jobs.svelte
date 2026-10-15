<script lang="ts">
	import ResourceChips from './ResourceChips.svelte';
	import { fmt } from './format.ts';
	import InfoPopup from './InfoPopup.svelte';
	import type { JobRow } from './jobs.ts';
	import type { Explanation } from './types.ts';

	let { rows, explain = {} }: { rows: JobRow[]; explain?: Record<string, Explanation> } = $props();

	const open = (r: JobRow) => (r.positions === null ? null : Math.max(r.positions - r.filled, 0));
</script>

{#if rows.length === 0}
	<p>No jobs.</p>
{:else}
	<table class="text-left text-sm">
		<thead>
			<tr class="border-b border-gray-300 dark:border-gray-700">
				<th class="p-1">Job</th>
				<th class="p-1">Stratum</th>
				<th class="p-1 text-right">Pops</th>
				<th class="p-1 text-right">Positions</th>
				<th class="p-1 text-right">Open</th>
				<th class="p-1">Uses</th>
				<th class="p-1">Produces</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.type)}
				<tr class="border-b border-gray-200 dark:border-gray-800">
					<td class="p-1"><InfoPopup explanation={explain[`job:${r.type}`]}>{r.name}</InfoPopup></td
					>
					<td class="p-1 text-gray-500">{r.category}</td>
					<td class="p-1 text-right">{fmt(r.pops)}</td>
					<td class="p-1 text-right">{r.positions === null ? '∞' : fmt(r.positions)}</td>
					<td class="p-1 text-right">{open(r) === null ? '' : fmt(open(r)!)}</td>
					<td class="p-1 pr-4" title={r.estimated ? 'share of the empire total by pops' : ''}>
						{r.estimated ? '≈ ' : ''}<ResourceChips flows={r.flows ?? {}} sign={-1} />
					</td>
					<td class="p-1" title={r.estimated ? 'share of the empire total by pops' : ''}>
						{r.estimated ? '≈ ' : ''}<ResourceChips flows={r.flows ?? {}} sign={1} />
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
