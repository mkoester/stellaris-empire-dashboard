<script lang="ts">
	import { resolve } from '$app/paths';
	import { fmt } from '../format.ts';
	import SortTable from '../SortTable.svelte';
	import type { Column } from '../sort.ts';
	import type { Colony } from '../types.ts';
	import Panel from './Panel.svelte';

	// Last month's pop movement between the empire's colonies: who loses pops to emigration, who
	// gains by immigration, next to natural growth.
	// node: the save shown when not following the game, so the details page stays on it
	let { colonies, node = null }: { colonies: Colony[]; node?: number | null } = $props();
	const details = $derived(
		node === null ? resolve('/migration') : resolve(`/migration?node=${node}`)
	);

	const rows = $derived(
		colonies
			.filter((c) => c.growth)
			.map((c, i) => ({
				i,
				name: c.name,
				out: -(c.growth!.by.emigration ?? 0),
				in: c.growth!.by.immigration ?? 0,
				growth: c.growth!.by.growth ?? 0,
				net: c.growth!.net
			}))
	);
	const total = $derived(rows.reduce((n, r) => n + r.in, 0));
	const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '0');
	type Row = (typeof rows)[number];
	const columns: Column<Row>[] = [
		{ id: 'name', label: 'Colony', value: (r) => r.name },
		{ id: 'out', label: 'Leaving', value: (r) => r.out, cell: out, right: true },
		{ id: 'in', label: 'Arriving', value: (r) => r.in, cell: inCell, right: true },
		{ id: 'growth', label: 'Growth', value: (r) => r.growth, cell: growth, right: true },
		{ id: 'net', label: 'Net', value: (r) => r.net, cell: net, right: true }
	];
</script>

{#snippet out(r: Row)}<span class={r.out ? 'text-red-600' : 'text-gray-500'}
		>{r.out ? `−${fmt(r.out)}` : '0'}</span
	>{/snippet}
{#snippet inCell(r: Row)}<span class={r.in ? 'text-green-600' : 'text-gray-500'}
		>{r.in ? `+${fmt(r.in)}` : '0'}</span
	>{/snippet}
{#snippet growth(r: Row)}{signed(r.growth)}{/snippet}
{#snippet net(r: Row)}<b>{signed(r.net)}</b>{/snippet}

<Panel
	title="Migration"
	note="Last month, in pops. Emigrants leave for the empire's other colonies."
>
	<div class="mb-1">
		moving: <b>{fmt(total)}</b> a month · <a class="underline" href={details}>details</a>
	</div>
	<SortTable {rows} {columns} key={(r) => r.i} sort={{ column: '', desc: false }} />
</Panel>
