<script lang="ts" generics="T">
	import { sortBy, type Column } from './sort.ts';

	// A table whose headers sort it (click again to reverse), for the tabs that list game objects.
	// Each column gives the value it sorts by and, optionally, a cell snippet (else the value).

	// `link` ties a row to a system: hovering the row sets `hovered` (bindable, shared with a map
	// beside), and the row whose system is hovered there is highlighted.
	let {
		rows,
		columns,
		key,
		sort = $bindable({ column: columns[0].id, desc: false }),
		link,
		hovered = $bindable(null)
	}: {
		rows: T[];
		columns: Column<T>[];
		key: (r: T) => string | number;
		sort?: { column: string; desc: boolean };
		link?: (r: T) => number | null;
		hovered?: number | null;
	} = $props();

	const column = $derived(columns.find((c) => c.id === sort.column) ?? columns[0]);
	const sorted = $derived(sortBy(rows, column.value, sort.desc));
	const onSort = (id: string) =>
		(sort = { column: id, desc: sort.column === id ? !sort.desc : false });
</script>

<!-- no overflow wrapper: it would clip the popups -->
<table class="text-left text-sm">
	<thead>
		<tr class="border-b border-gray-300 dark:border-gray-700">
			{#each columns as c (c.id)}
				<th class="p-1 {c.right ? 'text-right' : ''}" title={c.title}>
					<button
						class="cursor-pointer whitespace-nowrap hover:underline {sort.column === c.id
							? 'font-semibold'
							: 'font-normal'}"
						onclick={() => onSort(c.id)}
						>{c.label}{#if sort.column === c.id}{sort.desc ? ' ▼' : ' ▲'}{/if}</button
					>
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each sorted as r (key(r))}
			<tr
				class="border-b border-gray-100 align-top dark:border-gray-900 {link &&
				hovered !== null &&
				link(r) === hovered
					? 'bg-amber-100 dark:bg-amber-900/40'
					: ''}"
				onpointerenter={link ? () => (hovered = link(r)) : undefined}
				onpointerleave={link ? () => (hovered = null) : undefined}
			>
				{#each columns as c (c.id)}
					<td class="p-1 {c.right ? 'text-right tabular-nums' : ''}">
						{#if c.cell}{@render c.cell(r)}{:else}{c.value(r) ?? '–'}{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
