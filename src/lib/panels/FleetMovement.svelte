<script lang="ts">
	import SortTable from '../SortTable.svelte';
	import type { Column } from '../sort.ts';
	import type { Route } from '../types.ts';
	import Panel from './Panel.svelte';

	// Fleets on the move or with destinations queued: where they are, where their orders end, and
	// the first unexplored system on the way — ships fly to its centre, so that is where to step in.
	// The save holds no arrival dates.
	let { fleets }: { fleets: { name: string; kind: string; route: Route }[] } = $props();
	type Fleet = (typeof fleets)[number] & { i: number };

	// working where they are (0 jumps) is not underway
	const shown: Fleet[] = $derived(
		fleets
			.filter((f) => f.route.moving || f.route.stops.some((s) => s.jumps !== 0))
			.map((f, i) => ({ ...f, i }))
	);
	const jumps = (n: number | null) => (n === null ? '? jumps' : n === 1 ? '1 jump' : `${n} jumps`);
	const unknownOf = (f: Fleet) => f.route.stops.find((s) => s.unexplored);
	const columns: Column<Fleet>[] = [
		{ id: 'fleet', label: 'Fleet', value: (f) => f.name, cell: fleet },
		{ id: 'at', label: 'At', value: (f) => f.route.at },
		{
			id: 'unknown',
			label: 'Unexplored on the way',
			value: (f) => unknownOf(f)?.jumps ?? null,
			cell: unknown
		},
		{
			id: 'last',
			label: 'Final destination',
			value: (f) => f.route.stops.at(-1)?.jumps ?? null,
			cell: last
		}
	];
</script>

{#snippet fleet(f: Fleet)}<span class="whitespace-nowrap"
		>{f.name} <span class="text-gray-500">{f.kind}</span></span
	>{/snippet}
{#snippet unknown(f: Fleet)}{@const u = unknownOf(f)}{#if u}<span class="text-amber-600"
			>⚠ {u.system}</span
		>
		<span class="text-gray-500">in {jumps(u.jumps)}</span>{/if}{/snippet}
{#snippet last(f: Fleet)}{@const l = f.route.stops.at(-1)}{#if l}{l.system}
		<span class="text-gray-500">in {jumps(l.jumps)}</span>{:else}–{/if}{/snippet}

<Panel title="Fleets underway">
	{#if shown.length}
		<SortTable rows={shown} {columns} key={(f) => f.i} sort={{ column: '', desc: false }} />
	{:else}<p class="text-sm">none underway</p>{/if}
</Panel>
