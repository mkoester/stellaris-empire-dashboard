<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { fmt, nameOf, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import Shipyards from '#lib/panels/Shipyards.svelte';
	import QueueList from '#lib/QueueList.svelte';
	import { putSettings } from '#lib/settings.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import {
		freeSlots,
		isOutpost,
		shownStations,
		YARD_FILTERS,
		YARD_LABELS,
		type StarbaseView
	} from '#lib/starbases.ts';
	import type { Station } from '#lib/types.ts';
	import type { PartPlan, Suggestion } from '#lib/starbasePlanner.ts';
	import { SYSTEM_RANGES } from '#lib/systems.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const rows = $derived(shownStations(data.stations, data.view));
	const outposts = $derived(data.stations.filter(isOutpost).length);
	// the view is the profile's: store it, then load again
	const setView = async (patch: Partial<StarbaseView>) => {
		await putSettings({ starbaseView: { ...data.view, ...patch } });
		await invalidateAll();
	};

	const ranked = $derived((data.planner?.plans ?? []).filter((p) => p.best.length));
	const unranked = $derived((data.planner?.plans ?? []).filter((p) => !p.best.length));
	const sysName = (id: number) => data.planner?.systemNames[id] ?? `system ${id}`;
	const rangeLabel = (r: string) => (r === 'mine' ? 'my systems' : r === 'all' ? 'any' : `+${r}`);
	const planColumns: Column<PartPlan>[] = [
		{ id: 'part', label: 'Module / building', value: (p) => p.part.name, cell: partCell },
		{ id: 'kind', label: 'Kind', value: (p) => p.part.kind },
		{ id: 'system', label: 'Best system', value: (p) => sysName(p.best[0].systemId) },
		{ id: 'why', label: 'Why', value: (p) => p.best[0].reasons.join('; '), cell: whyCell },
		{ id: 'needs', label: 'First', value: (p) => p.best[0].needs.join(', ') || null },
		{ id: 'more', label: 'Systems', value: (p) => p.best.length, right: true }
	];
	const names = (keys: string[]) => keys.map((k) => nameOf(data.partNames, k)).join(', ') || null;
	const free = (s: Station) => freeSlots(s, data.slots);
	const freeLabel = (n: number | null, of: string) => (n === null ? '?' : n ? `${n} ${of}` : '');
	const columns: Column<Station>[] = [
		{ id: 'system', label: 'System', value: (s) => s.system },
		{ id: 'level', label: 'Level', value: (s) => pretty(s.level) },
		{ id: 'modules', label: 'Modules', value: (s) => names(s.modules) },
		{ id: 'buildings', label: 'Buildings', value: (s) => names(s.buildings) },
		{
			id: 'free',
			label: 'Free slots',
			value: (s) => {
				const f = free(s);
				return (f.modules ?? 0) + (f.buildings ?? 0);
			},
			cell: freeCell,
			right: true
		},
		{ id: 'queue', label: 'Queue', value: (s) => s.queue.length, cell: queueCell },
		{
			id: 'yard',
			label: 'Shipyard',
			value: (s) => (s.shipyard ? s.shipyard.queue.length : null),
			cell: yardCell
		}
	];
</script>

{#snippet partCell(p: PartPlan)}{p.part.name}{#if p.available === null || p.best[0].maybe}<span
			class="ml-1 text-amber-600"
			title="a condition the save cannot answer: check in game">?</span
		>{/if}{/snippet}
{#snippet whyCell(p: PartPlan)}{#each p.best[0].reasons as r, i (i)}<div>{r}</div>{/each}{/snippet}
{#snippet others(p: PartPlan)}{#if p.best.length > 1}<div class="text-xs text-gray-500">
			also: {#each p.best.slice(1) as s, i (s.systemId)}{i ? ' · ' : ''}{@render other(s)}{/each}
		</div>{/if}{/snippet}
{#snippet other(s: Suggestion)}<span
		title={[...s.reasons, ...s.needs.map((n) => `first: ${n}`)].join('\n')}
		>{sysName(s.systemId)}{s.needs.length ? ' *' : ''}</span
	>{/snippet}
{#snippet freeCell(s: Station)}{@const f = free(s)}<span class="whitespace-nowrap"
		>{[freeLabel(f.modules, 'mod.'), freeLabel(f.buildings, 'bld.')].filter(Boolean).join(' · ') ||
			'–'}</span
	>{/snippet}
{#snippet queueCell(s: Station)}<QueueList
		queue={s.queue}
		slots={s.slots}
		date={data.date}
	/>{/snippet}
{#snippet yardCell(s: Station)}{#if s.shipyard}<QueueList
			queue={s.shipyard.queue}
			slots={s.shipyard.slots}
			date={data.date}
		/>{:else}<span class="text-gray-500">–</span>{/if}{/snippet}

<div class="flex flex-wrap items-baseline gap-x-6 gap-y-1">
	<h1 class="text-2xl font-semibold">Starbases</h1>
	{#if data.capacity}
		<span class="text-sm" class:text-red-600={data.capacity.used > data.capacity.capacity}
			>starbase capacity {fmt(data.capacity.used)} / {fmt(data.capacity.capacity)}</span
		>
	{/if}
	<span class="ml-auto text-sm text-gray-500">{data.date}</span>
</div>

<div class="mt-4">
	<Panel
		title="Our starbases"
		note="Free slots are the level's less what is built; queued modules and buildings show in the queue."
	>
		<div class="mb-2 flex flex-wrap items-center gap-3 text-sm">
			<div class="flex gap-1" role="group" aria-label="shipyards">
				{#each YARD_FILTERS as f (f)}
					<button
						type="button"
						class="rounded border px-2 py-0.5 {data.view.yard === f
							? 'border-sky-600 bg-sky-50 dark:bg-sky-950'
							: 'border-gray-300 dark:border-gray-600'}"
						aria-pressed={data.view.yard === f}
						onclick={() => setView({ yard: f })}>{YARD_LABELS[f]}</button
					>
				{/each}
			</div>
			<label class="flex items-center gap-1"
				><input
					type="checkbox"
					checked={data.view.outposts}
					onchange={(e) => setView({ outposts: e.currentTarget.checked })}
				/>{`outposts (${outposts})`}</label
			>
		</div>
		{#if rows.length}
			<SortTable {rows} {columns} key={(s) => s.id} sort={{ column: '', desc: false }} />
		{:else}<p class="text-sm text-gray-500">none in this view</p>{/if}
	</Panel>
</div>

<div class="mt-6">
	<Panel
		title="Starbase planner"
		note="Where a module or building would do most, by its modifiers on the system's orbital deposits and our colonies there (resettlement, stability, governing ethics). Base values; the empire's conditions are checked, the system's only for the starbase level. * = something must happen first."
	>
		{#if data.planner}
			<div class="mb-2 flex flex-wrap items-center gap-2 text-sm">
				<label
					>Systems <select
						value={data.view.range}
						onchange={(e) => setView({ range: e.currentTarget.value })}
						class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-600"
					>
						{#each SYSTEM_RANGES as r (r)}<option value={r}>{rangeLabel(r)}</option>{/each}
					</select></label
				>
				<span class="text-gray-500">{data.planner.candidates} candidate systems</span>
			</div>
			{#if ranked.length}
				<SortTable
					rows={ranked}
					columns={planColumns}
					key={(p) => p.part.key}
					sort={{ column: '', desc: false }}
					below={others}
				/>
			{:else}<p class="text-sm text-gray-500">Nothing to suggest in these systems.</p>{/if}
			{#if unranked.length}
				<details class="mt-3 text-sm">
					<summary class="cursor-pointer text-gray-500"
						>{unranked.length} more the empire can build, not ranked (defences, trade, empire-wide effects
						…)</summary
					>
					<p class="mt-1">{unranked.map((p) => p.part.name).join(', ')}</p>
				</details>
			{/if}
		{:else}
			<p class="text-sm text-gray-500">
				The planner needs game data with starbase modifiers (extractor 2026-11-09).
			</p>
		{/if}
	</Panel>
</div>

<div class="mt-6">
	<Shipyards
		stations={data.stations}
		megas={data.megas}
		researched={data.researched}
		date={data.date}
	/>
</div>
