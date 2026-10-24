<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { sortBy, type Column } from './sort.ts';

	// A table whose headers sort it (click again to reverse), for the tabs that list game objects.
	// Each column gives the value it sorts by and, optionally, a cell snippet (else the value).
	// `sort={{ column: '', desc: false }}` shows the rows in their given order at first.

	// `link` ties a row to a system: hovering the row sets `hovered` (bindable, shared with a map
	// beside), and the row whose system is hovered there is highlighted. Binding `selected` as well
	// makes a row click pick its system (again: unpick); a system picked elsewhere marks its row and
	// scrolls it into view. `rowClass` sets a row apart (a reference row, say), `rowStyle` styles it
	// (a row in its event's colour). `below` adds a full-width line under each row (details).
	let {
		rows,
		columns,
		key,
		sort = $bindable({ column: columns[0].id, desc: false }),
		link,
		hovered = $bindable(null),
		selected = $bindable(),
		rowClass,
		rowStyle,
		below
	}: {
		rows: T[];
		columns: Column<T>[];
		key: (r: T) => string | number;
		sort?: { column: string; desc: boolean };
		link?: (r: T) => number | null;
		hovered?: number | null;
		selected?: number | null;
		rowClass?: (r: T) => string;
		rowStyle?: (r: T) => string;
		below?: Snippet<[T]>;
	} = $props();

	// an unknown column (`''`) keeps the rows in their given order until a header is clicked
	const column = $derived(columns.find((c) => c.id === sort.column));
	const sorted = $derived(column ? sortBy(rows, column.value, sort.desc) : rows);
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
						style:color={c.color}
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
				class="align-top {below ? '' : 'border-b border-gray-100 dark:border-gray-900'} {sys !==
					null && hovered === sys
					? 'bg-amber-100 dark:bg-amber-900/40'
					: selectable && sys !== null && selected === sys
						? 'bg-sky-100 dark:bg-sky-900/40'
						: (rowClass?.(r) ?? '')} {selectable ? 'cursor-pointer' : ''}"
				style={rowStyle?.(r)}
				data-system={sys}
				onpointerenter={link ? () => (hovered = sys) : undefined}
				onpointerleave={link ? () => (hovered = null) : undefined}
				onclick={selectable ? () => pick(sys) : undefined}
			>
				{#each columns as c (c.id)}
					<td class="p-1 {c.right ? 'text-right tabular-nums' : ''}">
						{#if c.cell}{@render c.cell(r, c.id)}{:else}{c.value(r) ?? '–'}{/if}
					</td>
				{/each}
			</tr>
			{#if below}
				<tr class="border-b border-gray-200 text-xs dark:border-gray-800">
					<td></td>
					<td class="p-1 pb-2" colspan={columns.length - 1}>{@render below(r)}</td>
				</tr>
			{/if}
		{/each}
	</tbody>
</table>
