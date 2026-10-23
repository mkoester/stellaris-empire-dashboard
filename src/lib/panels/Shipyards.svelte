<script lang="ts">
	import { pretty } from '../format.ts';
	import QueueList from '../QueueList.svelte';
	import { CAPITAL_SHIPS, capitalYardMissing, megaShipyardDone, megaStage } from '../shipyards.ts';
	import SortTable from '../SortTable.svelte';
	import type { Column } from '../sort.ts';
	import type { MegaShipyard, Station } from '../types.ts';
	import Panel from './Panel.svelte';

	// Every place that builds ships: starbases with a shipyard and Mega Shipyards. A starbase with
	// a shipyard appears here and under Starbases.
	let {
		stations,
		megas,
		researched,
		date
	}: { stations: Station[]; megas: MegaShipyard[]; researched: string[]; date: string } = $props();

	const yards = $derived(stations.filter((s) => s.shipyard));
	const techFor = (canBuild: boolean) =>
		CAPITAL_SHIPS.map((c) => ({
			...c,
			ok: canBuild && researched.includes(c.tech),
			hasTech: researched.includes(c.tech)
		}));

	// starbases with a shipyard and Mega Shipyards in one table
	type Row =
		| { key: string; system: string; yard: Station; mega?: undefined }
		| { key: string; system: string; mega: MegaShipyard; yard?: undefined };
	const rows: Row[] = $derived([
		...yards.map((s) => ({ key: `s${s.id}`, system: s.system, yard: s })),
		...megas.map((m) => ({ key: `m${m.id}`, system: m.system, mega: m }))
	]);
	const slots = (r: Row) => (r.yard ? r.yard.shipyard!.slots : r.mega.queue ? r.mega.slots : null);
	const missing = (r: Row) =>
		r.yard
			? capitalYardMissing(r.yard)
			: megaShipyardDone(r.mega)
				? []
				: ['the Mega Shipyard complete'];
	const columns: Column<Row>[] = [
		{ id: 'yard', label: 'Shipyard', value: (r) => r.system, cell: yardCell },
		{ id: 'slots', label: 'Capacity', value: slots, cell: slotsCell, right: true },
		{ id: 'capital', label: 'Capital ships', value: (r) => missing(r).length, cell: capitalCell },
		{
			id: 'queue',
			label: 'Queue',
			value: (r) => (r.yard ? r.yard.shipyard!.queue.length : (r.mega.queue?.length ?? null)),
			cell: queueCell
		}
	];
</script>

{#snippet yardCell(r: Row)}{r.system}
	<span class="text-gray-500"
		>{r.yard ? pretty(r.yard.level) : `Mega Shipyard, ${megaStage(r.mega.type)}`}</span
	>{/snippet}
{#snippet slotsCell(r: Row)}{slots(r) ?? '?'}{/snippet}
{#snippet capitalCell(r: Row)}
	{@render capital(missing(r))}
	{#if r.yard && missing(r).length}
		<div class="text-xs text-gray-500">needs {missing(r).join(', ')}</div>
	{/if}
{/snippet}
{#snippet queueCell(r: Row)}
	{#if r.yard}<QueueList
			queue={r.yard.shipyard!.queue}
			slots={r.yard.shipyard!.slots}
			{date}
		/>{:else if r.mega.queue}<QueueList
			queue={r.mega.queue}
			slots={r.mega.slots}
			{date}
		/>{:else}<span class="text-gray-500">queue not found</span>{/if}
{/snippet}

{#snippet capital(missing: string[])}
	{#if missing.length}
		<span class="text-gray-500" title="capital ships need: {missing.join(', ')}"
			>no capital ships</span
		>
	{:else}
		{#each techFor(true) as c (c.size)}
			<span class="mr-2 {c.ok ? '' : 'text-gray-500'}" title={c.ok ? '' : `needs ${pretty(c.tech)}`}
				>{c.ok ? '✓' : '✗'} {c.size}</span
			>
		{/each}
	{/if}
{/snippet}

<Panel
	title="Shipyards"
	note="Build capacity = ships built at once. Capital ships need the yard below and their tech."
>
	{#if rows.length}
		<SortTable {rows} {columns} key={(r) => r.key} sort={{ column: '', desc: false }} />
	{:else}<p class="text-sm">none</p>{/if}
</Panel>
