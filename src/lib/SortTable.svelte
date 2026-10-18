<script lang="ts" generics="T">
	import { sortBy, type Column } from './sort.ts';

	// A table whose headers sort it (click again to reverse), for the tabs that list game objects.
	// Each column gives the value it sorts by and, optionally, a cell snippet (else the value).

	// `link` ties a row to a system: hovering the row sets `hovered` (bindable, shared with a map
	// beside), and the row whose system is hovered there is highlighted. Binding `selected` as well
	// makes a row click pick its system (again: unpick); a system picked elsewhere marks its row and
	// scrolls it into view.
	let {
		rows,
		columns,
		key,
		sort = $bindable({ column: columns[0].id, desc: false }),
		link,
		hovered = $bindable(null),
		selected = $bindable()
	}: {
		rows: T[];
		columns: Column<T>[];
		key: (r: T) => string | number;
		sort?: { column: string; desc: boolean };
		link?: (r: T) => number | null;
		hovered?: number | null;
		selected?: number | null;
	} = $props();

	const column = $derived(columns.find((c) => c.id === sort.column) ?? columns[0]);
	const sorted = $derived(sortBy(rows, column.value, sort.desc));
	const onSort = (id: string) =>
		(sort = { column: id, desc: sort.column === id ? !sort.desc : false });

	const selectable = $derived(link !== undefined && selected !== undefined);
	let body: HTMLTableSectionElement | undefined = $state();
	let picked: number | null = null; // the last pick made here, which needs no scrolling
	const pick = (id: number | null) => {
		picked = selected = id === selected ? null : id;
	};
	$effect(() => {
		if (selected === null || selected === undefined || selected === picked) return;
		body?.querySelector(`[data-system="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
	});
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
	<tbody bind:this={body}>
		{#each sorted as r (key(r))}
			{@const sys = link?.(r) ?? null}
			<tr
				class="border-b border-gray-100 align-top dark:border-gray-900 {sys !== null &&
				hovered === sys
					? 'bg-amber-100 dark:bg-amber-900/40'
					: selectable && sys !== null && selected === sys
						? 'bg-sky-100 dark:bg-sky-900/40'
						: ''} {selectable ? 'cursor-pointer' : ''}"
				data-system={sys}
				onpointerenter={link ? () => (hovered = sys) : undefined}
				onpointerleave={link ? () => (hovered = null) : undefined}
				onclick={selectable ? () => pick(sys) : undefined}
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
