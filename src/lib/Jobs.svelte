<script lang="ts">
	import { fmt } from './format.ts';
	import type { JobRow } from './jobs.ts';

	let { rows }: { rows: JobRow[] } = $props();

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
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.type)}
				<tr class="border-b border-gray-200 dark:border-gray-800">
					<td class="p-1">{r.name}</td>
					<td class="p-1 text-gray-500">{r.category}</td>
					<td class="p-1 text-right">{fmt(r.pops)}</td>
					<td class="p-1 text-right">{r.positions === null ? '∞' : fmt(r.positions)}</td>
					<td class="p-1 text-right">{open(r) === null ? '' : fmt(open(r)!)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
