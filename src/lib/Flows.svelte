<script lang="ts">
	import ResourceChips from './ResourceChips.svelte';
	import type { Resources } from './types.ts';

	// Rows of resource flows per month: what is used first, then what is produced. Total rows
	// (`strong`) are not split: their net values span both columns in a fixed order.
	let { rows }: { rows: { label: string; flows: Resources; strong?: boolean }[] } = $props();
</script>

<table class="text-left text-sm">
	<thead>
		<tr class="border-b border-gray-300 dark:border-gray-700">
			<th class="p-1"></th>
			<th class="p-1">Uses</th>
			<th class="p-1">Produces</th>
		</tr>
	</thead>
	<tbody>
		{#each rows as r (r.label)}
			<tr class="border-b border-gray-200 dark:border-gray-800" class:font-semibold={r.strong}>
				<td class="p-1 pr-4 whitespace-nowrap">{r.label}</td>
				{#if r.strong}
					<td class="p-1" colspan="2"><ResourceChips flows={r.flows} /></td>
				{:else}
					<td class="p-1 pr-4"><ResourceChips flows={r.flows} sign={-1} /></td>
					<td class="p-1"><ResourceChips flows={r.flows} sign={1} /></td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>
