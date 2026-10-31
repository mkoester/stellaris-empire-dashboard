<script lang="ts">
	import GalaxyMap from '#lib/GalaxyMap.svelte';
	import { followGame } from '#lib/live.ts';
	import { LAYER_INFO, MAP_LAYERS, type MapFilter, type MapLayer } from '#lib/mapLayers.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import { putSettings } from '#lib/settings.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import { wanderlustName } from '#lib/wanderlust.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// the filter is the profile's: changed here, stored at once
	let filter: MapFilter = $derived(data.filter);
	const toggle = (l: MapLayer) => {
		filter = {
			hidden: filter.hidden.includes(l)
				? filter.hidden.filter((x) => x !== l)
				: [...filter.hidden, l]
		};
		void putSettings({ mapFilter: filter });
	};
	const on = (l: MapLayer) => !filter.hidden.includes(l);

	let hovered: number | null = $state(null);
	let selected: number | null = $state(null);
	let map: ReturnType<typeof GalaxyMap> | undefined = $state();

	// search by system name, the known systems offered as completions
	let query = $state('');
	const names = $derived(
		[...new Map(data.systems.filter((s) => s.known).map((s) => [s.name, s.id]))].sort(([a], [b]) =>
			a.localeCompare(b)
		)
	);
	const find = (q: string, prefix: boolean) => {
		const l = q.trim().toLowerCase();
		return l
			? (names.find(([n]) => n.toLowerCase() === l) ??
					(prefix ? names.find(([n]) => n.toLowerCase().startsWith(l)) : undefined))
			: undefined;
	};
	const go = (hit: [string, number] | undefined) => {
		if (!hit) return;
		query = hit[0];
		selected = hit[1];
		map?.show(hit[1]);
	};

	type Marker = (typeof data.markers)[number];
	const markers = $derived(data.markers.filter((m) => on(m.layer)));
	const count = (l: MapLayer) =>
		l === 'borders' ? data.territories.length : data.markers.filter((m) => m.layer === l).length;
	const byId = $derived(new Map(data.systems.map((s) => [s.id, s])));
	// several markers in one system: side by side
	const bySystem = $derived(
		markers.reduce(
			(m, x) => m.set(x.systemId, [...(m.get(x.systemId) ?? []), x]),
			new Map<number, Marker[]>()
		)
	);
	const titles = $derived(
		Object.fromEntries(
			[...bySystem].map(([id, list]) => [
				id,
				list.map((m) => `${m.label} (${m.detail})`).join('; ')
			])
		)
	);

	const columns: Column<Marker>[] = [
		{ id: 'layer', label: 'What', value: (r) => LAYER_INFO[r.layer].label, cell: what },
		{ id: 'label', label: 'Name', value: (r) => r.label },
		{ id: 'system', label: 'System', value: (r) => byId.get(r.systemId)?.name ?? null },
		{ id: 'detail', label: 'Detail', value: (r) => r.detail },
		{
			id: 'ongoing',
			label: 'Ongoing',
			value: (r) => (r.ongoing === undefined || r.ongoing === null ? null : r.ongoing ? 1 : 0),
			cell: ongoing,
			title: 'an envoy on the contact, an excavation running; – where the save does not tell'
		},
		{ id: 'progress', label: 'Progress', value: (r) => r.progress ?? null }
	];
</script>

{#snippet ongoing(r: Marker)}{r.ongoing ? '✓' : r.ongoing === false ? 'waiting' : '–'}{/snippet}
{#snippet what(r: Marker)}
	<span style:color={LAYER_INFO[r.layer].color}>{LAYER_INFO[r.layer].symbol}</span>
	{LAYER_INFO[r.layer].label}
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Map</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !data.seenAt}
	<p class="mb-4 text-sm text-amber-600">No galaxy read yet; it fills after the next save.</p>
{/if}

<div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
	<label class="flex items-center gap-1"
		>find system
		<input
			class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
			list="system-names"
			placeholder="name…"
			bind:value={query}
			oninput={() => go(find(query, false))}
			onkeydown={(e) => e.key === 'Enter' && go(find(query, true))}
		/></label
	>
	<datalist id="system-names">
		{#each names as [n, id] (id)}<option value={n}></option>{/each}
	</datalist>
</div>

<div class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
	{#each MAP_LAYERS as l (l)}
		<label class="flex items-center gap-1"
			><input type="checkbox" checked={on(l)} onchange={() => toggle(l)} />
			<span style:color={LAYER_INFO[l].color}>{LAYER_INFO[l].symbol}</span>
			{LAYER_INFO[l].label} <span class="text-gray-500">{count(l)}</span></label
		>
	{/each}
</div>

{#if data.wanderlust && on('wanderlust')}
	<p
		class="mb-3 text-sm"
		title="the arkship counts a target system once, on entering it; the game asks for 80 % of each category's systems"
	>
		<span style:color={LAYER_INFO.wanderlust.color}>{LAYER_INFO.wanderlust.symbol}</span>
		Wanderlust{#if data.wanderlust.complete}: every category explored{:else}:
			{#each data.wanderlust.categories as c, i (c.key)}{i ? ' · ' : ''}<span
					class={c.done ? 'text-green-700 dark:text-green-500' : ''}
					>{wanderlustName(c.key)} {c.seen} / {c.count}{c.done ? ' ✓' : ''}</span
				>{/each}{/if}
	</p>
{/if}

<div class="flex flex-col gap-6">
	<Panel
		title="Discovered galaxy"
		note="What your empire has found, in the systems it discovered. Borders: your empire and those you have communications with in their map colours; stations you saw but cannot name yet are guessed by shipset (dashed). Click a system to pick it."
	>
		<GalaxyMap
			systems={data.systems}
			territories={on('borders') ? data.territories : []}
			{titles}
			focus={[
				{
					label: 'markers',
					points: markers.flatMap((m) => byId.get(m.systemId) ?? [])
				}
			]}
			heightKey="galaxy-map-height"
			label="Galaxy map"
			bind:hovered
			bind:selected
			bind:this={map}
		>
			{#snippet layer(at)}
				{#each [...bySystem] as [id, list] (id)}
					{@const s = byId.get(id)}
					{#if s}
						{@const p = at(s)}
						{#each list as m, i (m.id)}
							<text
								class="pointer-events-none text-[13px] font-bold"
								x={p.x + 6 + i * 11}
								y={p.y - 5}
								fill={LAYER_INFO[m.layer].color}>{LAYER_INFO[m.layer].symbol}</text
							>
						{/each}
					{/if}
				{/each}
			{/snippet}
		</GalaxyMap>
	</Panel>

	<Panel title="Found" note="Hover or click a row to find it on the map.">
		{#if markers.length}
			<SortTable
				rows={markers}
				{columns}
				key={(r) => r.id}
				link={(r) => r.systemId}
				bind:hovered
				bind:selected
			/>
		{:else}<p class="text-sm text-gray-500">Nothing in the layers shown.</p>{/if}
	</Panel>
</div>
