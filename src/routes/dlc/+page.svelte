<script lang="ts">
	import { DLC_CATEGORIES, type DlcRow } from '#lib/addons.ts';
	import EventList from '#lib/EventList.svelte';
	import { followGame } from '#lib/live.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	let grouped = $state(true);
	let activeOnly = $state(false);
	let sort = $state({ column: 'released', desc: false });

	const categoryLabel = (c: string | null) =>
		DLC_CATEGORIES.find((x) => x.key === c)?.label ?? c ?? '';
	const shown = $derived(data.rows.filter((r) => !activeOnly || r.active || r.baseGame));
	const groups = $derived(
		DLC_CATEGORIES.map((c) => ({ ...c, rows: shown.filter((r) => r.category === c.key) })).filter(
			(g) => g.rows.length > 0
		)
	);
	const count = $derived(data.rows.filter((r) => r.active).length);
	const merged = $derived(data.rows.filter((r) => r.baseGame && !r.active).length);

	const columns: Column<DlcRow>[] = $derived([
		{ id: 'name', label: 'DLC', value: (r) => r.name },
		...(grouped
			? []
			: [{ id: 'category', label: 'Category', value: (r: DlcRow) => categoryLabel(r.category) }]),
		{ id: 'released', label: 'Released', value: (r) => r.releaseDate, title: 'Steam store date' },
		{
			id: 'active',
			label: 'Active',
			value: (r) => (r.active || r.baseGame ? 1 : r.active === null ? null : 0),
			cell: active,
			title: 'in the latest save'
		},
		{
			id: 'gameplay',
			label: 'Gameplay',
			value: (r) => (r.gameplay ? 1 : 0),
			cell: gameplay,
			title: 'changes gameplay, as opposed to portraits or music'
		}
	]);
</script>

{#snippet active(r: DlcRow)}{#if r.baseGame && !r.active}<span
			class="text-gray-500"
			title="merged into the base game: no script checks for it, and saves leave it out"
			>base game</span
		>{:else}{r.active === null ? '?' : r.active ? '✓' : '–'}{/if}{/snippet}
{#snippet gameplay(r: DlcRow)}{r.gameplay ? 'yes' : 'no'}{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">DLC</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<p class="mb-4 max-w-3xl text-sm text-gray-500">
	{#if data.seenAt}{count} of {data.rows.length} active in the save of {data.seenAt}{merged
			? `, ${merged} more merged into the base game (always on: no script checks for them, and saves leave them out)`
			: ''}.{:else}No save read since the DLC list was added; it shows after the next one.{/if}
	Categories come from the installed DLCs' own files; one that is not installed has none.
</p>

<div class="mb-4 flex flex-wrap items-center gap-4 text-sm">
	<span class="flex gap-1">
		<button
			class="rounded border px-2 py-0.5 {grouped
				? 'border-gray-300 dark:border-gray-700'
				: 'border-blue-500 font-semibold'}"
			onclick={() => (grouped = false)}>all</button
		>
		<button
			class="rounded border px-2 py-0.5 {grouped
				? 'border-blue-500 font-semibold'
				: 'border-gray-300 dark:border-gray-700'}"
			onclick={() => (grouped = true)}>per category</button
		>
	</span>
	<label class="flex items-center gap-1"
		><input type="checkbox" bind:checked={activeOnly} /> active only</label
	>
</div>

<div class="mb-8 flex flex-col gap-6">
	{#if grouped}
		{#each groups as g (g.key)}
			<section>
				<h2 class="mb-1 text-lg font-semibold">
					{g.label} <span class="text-sm font-normal text-gray-500">{g.rows.length}</span>
				</h2>
				<SortTable rows={g.rows} {columns} key={(r) => r.name} bind:sort />
			</section>
		{/each}
	{:else}
		<SortTable rows={shown} {columns} key={(r) => r.name} bind:sort />
	{/if}
</div>

<h2 class="mb-2 text-xl font-semibold">Changes</h2>
{#if data.changes.length === 0}
	<p class="text-sm text-gray-500">
		No DLC switched on or off between the saves of this branch (compared from the first save read
		with the DLC list).
	</p>
{:else}
	<EventList events={data.changes} />
{/if}
