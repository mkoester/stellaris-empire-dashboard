<script lang="ts">
	import { untrack } from 'svelte';
	import ColonyTable from '#lib/ColonyTable.svelte';
	import { colorOf } from '#lib/colors.ts';
	import {
		bySector,
		COLUMNS,
		filterRows,
		netResources,
		NO_FILTERS,
		sectorColors,
		sectorName,
		sortRows,
		totals,
		type ColonyView
	} from '#lib/colonyTable.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import { putSettings } from '#lib/settings.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// The view (mode, sort, filters, columns) is stored server-side and saved on every change.
	let view: ColonyView = $state(untrack(() => structuredClone(data.view)));
	let saved = JSON.stringify(untrack(() => data.view));
	$effect(() => {
		const now = JSON.stringify(view);
		if (now === saved) return;
		saved = now;
		const t = setTimeout(() => putSettings({ colonyView: $state.snapshot(view) }), 400);
		return () => clearTimeout(t);
	});

	const shown = $derived(sortRows(filterRows(data.rows, view.filters), view.sort));
	const netKeys = $derived(netResources(data.rows));
	const colors = $derived(sectorColors(data.rows));
	const node = $derived(data.isHead ? null : data.tip);
	const onSort = (column: string) =>
		(view.sort =
			view.sort.column === column
				? { column, desc: !view.sort.desc }
				: { column, desc: column !== 'name' && column !== 'sector' && column !== 'designation' });

	const sectors = $derived([...new Set(data.rows.map(sectorName))]);
	const designations = $derived([...new Set(data.rows.map((r) => r.designation))].sort());
	const suited = $derived(
		[
			...new Set(data.rows.flatMap((r) => r.profile.suits.slice(0, 2).map((s) => s.resource)))
		].sort()
	);
	const filtered = $derived(JSON.stringify(view.filters) !== JSON.stringify(NO_FILTERS));
	const signed = (v: number) => (v > 0 ? '+' : '') + fmt(v);
</script>

<div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
	<span class="inline-flex overflow-hidden rounded border border-gray-300 dark:border-gray-700">
		{#each [['all', 'all'], ['sector', 'per sector']] as const as [mode, label] (mode)}
			<button
				class="px-2 py-0.5 {view.mode === mode ? 'bg-blue-600 text-white' : ''}"
				onclick={() => (view.mode = mode)}>{label}</button
			>
		{/each}
	</span>
	<input
		class="w-36 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
		placeholder="name …"
		bind:value={view.filters.text}
	/>
	{#snippet select(
		label: string,
		options: string[],
		get: () => string,
		set: (v: string) => void,
		show = (o: string) => o
	)}
		<label
			>{label}
			<select
				class="rounded border border-gray-300 bg-transparent dark:border-gray-700"
				value={get()}
				onchange={(e) => set(e.currentTarget.value)}
			>
				<option value="">any</option>
				{#each options as o (o)}<option value={o}>{show(o)}</option>{/each}
			</select></label
		>
	{/snippet}
	{@render select(
		'sector',
		sectors,
		() => view.filters.sector,
		(v) => (view.filters.sector = v)
	)}
	{@render select(
		'designation',
		designations,
		() => view.filters.designation,
		(v) => (view.filters.designation = v),
		pretty
	)}
	{@render select(
		'suits',
		suited,
		() => view.filters.suits,
		(v) => (view.filters.suits = v),
		pretty
	)}
	<label><input type="checkbox" bind:checked={view.filters.attention} /> needs attention</label>
	<label><input type="checkbox" bind:checked={view.filters.freeDistricts} /> free districts</label>
	<label><input type="checkbox" bind:checked={view.filters.blockers} /> blockers</label>
	{#if filtered}
		<button class="underline" onclick={() => (view.filters = { ...NO_FILTERS })}
			>clear filters</button
		>
	{/if}
	<details class="relative">
		<summary class="cursor-pointer">columns</summary>
		<div
			class="absolute z-40 mt-1 grid w-56 gap-0.5 rounded border border-gray-300 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900"
		>
			{#each COLUMNS as c (c.id)}
				<label
					><input
						type="checkbox"
						checked={view.columns.includes(c.id)}
						onchange={(e) =>
							(view.columns = e.currentTarget.checked
								? COLUMNS.map((x) => x.id).filter((id) => id === c.id || view.columns.includes(id))
								: view.columns.filter((id) => id !== c.id))}
					/>
					{c.label}</label
				>
			{/each}
		</div>
	</details>
	<span class="text-gray-500">{shown.length} of {data.rows.length} colonies · {data.date}</span>
</div>

<p class="mb-3 text-xs text-gray-500">
	👍 pros and 👎 cons: district caps, the planet's features and modifiers, blockers, habitability —
	hover for the source. <span class="text-amber-600">⚠</span> the designation does not fit what the
	planet suits. <span class="font-bold text-red-600">!</span> needs attention. ⏳ temporary (a planet
	modifier with an end date) — counted, and shown apart: 6 (5+1) is 5 lasting and 1 temporary.
</p>

{#snippet table(rows: typeof shown, marked: boolean)}
	<ColonyTable
		{rows}
		columns={view.columns}
		{netKeys}
		sort={view.sort}
		{onSort}
		sectorColors={marked ? colors : null}
		names={data.names}
		colors={data.colors}
		explain={data.explain}
		{node}
		rowLine={data.rowLine}
	/>
{/snippet}

{#if view.mode === 'all'}
	{@render table(shown, sectors.length > 1)}
{:else}
	{#each bySector(shown) as g (g.sector)}
		{@const t = totals(g.rows)}
		<section class="mb-6">
			<h2
				class="mb-1 flex flex-wrap items-baseline gap-x-3 border-l-4 pl-2 text-lg font-semibold"
				style:border-color={colors[g.sector]}
			>
				{g.sector}
				<span class="text-sm font-normal text-gray-500"
					>{g.rows.length} colon{g.rows.length === 1 ? 'y' : 'ies'} · {fmt(t.pops)} pops</span
				>
				<span class="flex flex-wrap gap-x-2 text-sm font-normal tabular-nums">
					{#each netKeys.filter((k) => t.net[k]) as k (k)}
						<span title="net {pretty(k)} per month"
							><span style:color={colorOf(k)}>{pretty(k)}</span>
							<span class={t.net[k] < 0 ? 'text-red-600' : ''}>{signed(t.net[k])}</span></span
						>
					{/each}
				</span>
			</h2>
			{@render table(g.rows, false)}
		</section>
	{:else}
		<p>No colony matches.</p>
	{/each}
{/if}
{#if view.mode === 'all' && !shown.length}<p>No colony matches.</p>{/if}
