<script lang="ts">
	import AttractionSources from '#lib/AttractionSources.svelte';
	import Chart from '#lib/Chart.svelte';
	import { colorOf } from '#lib/colors.ts';
	import EthicChip from '#lib/EthicChip.svelte';
	import type { EthicRow } from '#lib/ethicsTab.ts';
	import FactionCard from '#lib/FactionCard.svelte';
	import GalaxyMap from '#lib/GalaxyMap.svelte';
	import type { MapWidth } from '#lib/mapView.ts';
	import {
		ETHIC_BASES,
		ethicCounts,
		ethicGroups,
		ethicStrength,
		ethicTerritories,
		intensity,
		lighter,
		NONE,
		UNKNOWN,
		type EthicBase
	} from '#lib/ethicsMap.ts';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// cut, not rounded, as the game's ethics tooltip (26.38 % shows as 26.3 %)
	const pct = (v: number) => `${(Math.floor(v * 1000 + 1e-9) / 10).toFixed(1)} %`;
	const signed = (v: number) => (v ? `${v > 0 ? '+' : ''}${v}` : '');
	// the chart lines in their ethic's colour, by name
	const lineColors = $derived(
		Object.fromEntries(
			Object.entries(data.ethicColors).flatMap(([name, c]) =>
				colorOf(c) ? [[name, colorOf(c)!]] : []
			)
		)
	);

	// the governing-ethics map: every ethic ticked to start; an empire in its strongest ticked one
	let ticked = $state(new Set<EthicBase>(ETHIC_BASES));
	// every ticked ethic an empire holds, in bands, or only its strongest
	let stripes = $state(true);
	const tick = (b: EthicBase) => {
		const next = new Set(ticked);
		if (next.has(b)) next.delete(b);
		else next.add(b);
		ticked = next;
	};
	const ethicMap = $derived(
		ethicTerritories(
			data.ethicsMap.territories,
			data.ethicsMap.empires,
			ticked,
			data.ethicsMap.colors,
			data.names,
			stripes
		)
	);
	const ethicTitles = $derived(
		Object.fromEntries(ethicMap.flatMap((t) => t.systems.map((id) => [id, t.label])))
	);
	const holding = $derived(ethicCounts(data.ethicsMap.empires));
	const baseName = (b: EthicBase) => data.names[`ethic_${b}`] ?? b;
	let mapWidth: MapWidth = $state('normal');
	// the table below (or beside) the map: by ethic, or by empire
	let tableBy = $state<'ethic' | 'empire'>('empire');
	// an empire under the pointer in the legend or the table: its systems lit, its ethics named
	let lit = $state<string | null>(null);
	const litTerritory = $derived(ethicMap.find((t) => t.key === lit) ?? null);
	const sysById = $derived(new Map(data.ethicsMap.systems.map((x) => [x.id, x])));
	const hasTerritory = $derived(new Set(ethicMap.map((t) => t.key)));
	const keyOf = (id: number) => `country:${id}`;
	const ethicColor = (key: string) => {
		const { base } = intensity(key);
		if (!base) return undefined;
		const c = data.ethicsMap.colors[base];
		return ethicStrength(key) >= 2 ? c : lighter(c);
	};
	const empireRows = $derived(
		[...data.ethicsMap.empires].sort(
			(a, b) =>
				Number(!a.ethics) - Number(!b.ethics) ||
				Number(!hasTerritory.has(keyOf(a.id))) - Number(!hasTerritory.has(keyOf(b.id))) ||
				a.name.localeCompare(b.name)
		)
	);
	const groups = $derived(ethicGroups(data.ethicsMap.empires));

	const columns: Column<EthicRow>[] = [
		{ id: 'ethic', label: 'Ethic', value: (r) => data.names[r.key] ?? r.key, cell: ethic },
		{ id: 'pops', label: 'Pops', value: (r) => r.pops, right: true },
		{
			id: 'share',
			label: 'Share',
			value: (r) => r.share,
			cell: share,
			right: true,
			title: 'of our pops with an ethic'
		},
		{
			id: 'attraction',
			label: 'Attraction',
			value: (r) => r.attraction,
			cell: attraction,
			right: true,
			title:
				"the game's Average Ethic Attraction (attraction-weighted pops per pop, the save's pops_ethics_attraction) and its share: where our pops are heading — above its pop share, an ethic gains pops"
		},
		{
			id: 'change',
			label: '±/month',
			value: (r) => r.change,
			cell: change,
			right: true,
			title: 'pops that took up (+) or left (−) the ethic last month'
		},
		{
			id: 'weight',
			label: '× ≈',
			value: (r) => r.weight,
			cell: weight,
			right: true,
			title:
				"the save's empire-wide ethics_attraction for the ethic — what it means is not yet checked against the game (≈)"
		}
	];

	type ColonyRow = (typeof data.colonies)[number];
	const shown = $derived(
		data.rows.filter((r) => data.colonies.some((c) => c.pops[r.key])).map((r) => r.key)
	);
	const colonyColumns = $derived<Column<ColonyRow>[]>([
		{ id: 'name', label: 'Colony', value: (c) => c.name },
		...shown.map((k) => ({
			id: k,
			label: data.names[k] ?? k,
			value: (c: ColonyRow) => c.pops[k] ?? 0,
			cell: colonyCell,
			right: true
		}))
	]);
</script>

{#snippet ethic(r: EthicRow)}
	<EthicChip
		ethic={r.key}
		name={data.names[r.key] ?? r.key}
		axes={data.axes}
		explanation={data.explain[`ethic:${r.key}`]}
	/>
	{#if r.held}<span class="text-xs text-gray-500" title="one of our governing ethics">
			ours
		</span>{/if}
	{#if r.dropped}<span
			class="text-xs text-amber-600"
			title="our governing ethic with the least attraction: embracing a faction of an ethic we do not hold removes it"
		>
			lost on the next new ethic
		</span>{/if}
{/snippet}
{#snippet share(r: EthicRow)}{pct(r.share)}{/snippet}
{#snippet attraction(r: EthicRow)}<span
		class={r.attraction > r.share + 0.005
			? 'text-green-700 dark:text-green-500'
			: r.attraction < r.share - 0.005
				? 'text-red-600'
				: ''}
	>
		{(Math.floor(r.average * 100 + 1e-9) / 100).toFixed(2)} ({pct(r.attraction)})
	</span>{/snippet}
{#snippet change(r: EthicRow)}{signed(r.change)}{/snippet}
{#snippet weight(r: EthicRow)}{r.weight ?? ''}{/snippet}
{#snippet colonyCell(c: ColonyRow, id: string)}
	{#if c.pops[id]}{c.pops[id]}{#if c.change[id]}<span class="text-xs text-gray-500">
				({signed(c.change[id])})
			</span>{/if}{/if}
{/snippet}

<div class="flex flex-col gap-8">
	<Panel
		title="Our pops' ethics"
		note={data.gestalt
			? 'A gestalt consciousness has one ethic, and its drones never take another: no attraction, no factions.'
			: data.rows.length
				? `As of ${data.seenAt}, sorted by attraction. Embracing a faction shifts our ethics one step toward its ethic; adding an ethic we do not hold removes our governing ethic with the least attraction — unless we hold a fanatic one, which is demoted instead.`
				: 'No save read with the ethics yet — they come with the next save (and with every save still on disk).'}
	>
		{#if data.rows.length}
			<SortTable rows={data.rows} {columns} key={(r) => r.key} sort={{ column: '', desc: false }} />
		{/if}
	</Panel>

	{#if !data.gestalt}
		<div class="grid gap-4 lg:grid-cols-2">
			<Chart
				title="Share of pops by ethic (%)"
				series={data.charts.pops}
				extent={data.xExtent}
				colors={lineColors}
				yMin={0}
			/>
			<Chart
				title="Attraction by ethic (%)"
				series={data.charts.attraction}
				extent={data.xExtent}
				colors={lineColors}
				yMin={0}
			/>
		</div>

		{#if data.colonies.length}
			<Panel
				title="Where they live"
				note="Pops per ethic on each colony, and (in brackets) last month's change."
			>
				<SortTable
					rows={data.colonies}
					columns={colonyColumns}
					key={(c) => c.planetId}
					sort={{ column: '', desc: false }}
				/>
			</Panel>
		{/if}

		<Panel
			title="Factions"
			note={(data.anyFormed
				? 'Our factions with their support and approval, what embracing each takes, and what each demands'
				: 'No faction has formed yet: that takes 10 years and another species met, then 500 pops of one ethic and 3 % of all.') +
				(data.factionTypes
					? ' — the faction types the switches in ⚙ add too: ✓ met, ✗ not, ? cannot be told from the save, and how to meet it.'
					: data.anyFormed
						? ': ✓ met, ✗ not, ? cannot be told from the save, and how to meet it.'
						: ' The faction types and their demands show with the switches in ⚙ (cheating).')}
		>
			{#if data.anyFormed}
				<div class="mb-4 grid gap-4 lg:grid-cols-2">
					<Chart
						title="Faction support (%)"
						series={data.charts.support}
						extent={data.xExtent}
						yMin={0}
					/>
					<Chart
						title="Faction approval (%)"
						series={data.charts.approval}
						extent={data.xExtent}
						yMin={0}
					/>
				</div>
			{/if}
			<div class="grid gap-6 lg:grid-cols-2">
				{#each data.factions as f (f.key)}
					<FactionCard
						{f}
						anyFormed={data.anyFormed}
						axes={data.axes}
						names={data.names}
						explain={data.explain}
					/>
				{/each}
			</div>
		</Panel>

		<Panel
			title="What draws pops to each ethic"
			note="Every source of ethic attraction in the game files, by ethic, then the governing ethics' attraction (it holds our current ethics) and how fast pops shift: the ethic's own rules (empire-wide factors and the reasons the game's tooltip names) and every modifier — ✓ applies to us (×N: N built, or on N colonies), ✗ not, ? the save cannot tell; and how to change it: green now (edicts, policies, buildings, designations, leaders, agendas, promoting or suppressing a faction), amber slowly (traditions, perks, a reform), grey not. Not covered: the jobs that add governing-ethics attraction on their planet (bureaucrats, enforcers, telepaths)."
		>
			<AttractionSources groups={data.sources} axes={data.axes} explain={data.explain} />
		</Panel>
	{/if}

	{#snippet empireName(e: (typeof data.ethicsMap.empires)[number], key: string | null)}<span
			class="cursor-default {hasTerritory.has(keyOf(e.id)) ? '' : 'text-gray-500'} {lit ===
			keyOf(e.id)
				? 'bg-yellow-100 dark:bg-yellow-900/40'
				: ''}"
			role="presentation"
			title={hasTerritory.has(keyOf(e.id)) ? undefined : 'none of its systems known'}
			onpointerenter={() => (lit = keyOf(e.id))}
			onpointerleave={() => (lit = null)}
		>
			{e.name}{#if key && intensity(key).level}<span class="ml-1 text-xs text-gray-500">
					{intensity(key).level}
				</span>{/if}
		</span>{/snippet}
	{#snippet ethicTable()}
		<div class="mb-2 flex items-center gap-2 text-sm">
			<span class="text-gray-500">list</span>
			{#each ['empire', 'ethic'] as const as m (m)}
				<button
					class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700 {tableBy === m
						? 'bg-gray-200 dark:bg-gray-800'
						: ''}"
					aria-pressed={tableBy === m}
					onclick={() => (tableBy = m)}
				>
					by {m}
				</button>
			{/each}
		</div>
		{#if tableBy === 'empire'}
			<table class="text-sm">
				<thead>
					<tr class="border-b border-gray-300 text-left dark:border-gray-700">
						<th class="pr-4">Empire</th><th>Governing ethics</th>
					</tr>
				</thead>
				<tbody>
					{#each empireRows as e (e.id)}
						<tr class="border-b border-gray-100 align-top dark:border-gray-900">
							<td class="pr-4">{@render empireName(e, null)}</td><td>
								{#if e.ethics}{#each [...e.ethics].sort((a, b) => ethicStrength(b) - ethicStrength(a)) as k (k)}<span
											class="mr-1 rounded px-1 text-xs whitespace-nowrap"
											style:background-color={`${ethicColor(k)}40`}
											style:border="1px solid {ethicColor(k)}"
										>
											{data.names[k] ?? k}
										</span>{/each}{#if e.stale}<span class="text-xs text-gray-500">
											{` unverified since ${e.asOf}`}
										</span>{/if}{:else}<span class="text-gray-500">unknown</span>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<table class="text-sm">
				<thead>
					<tr class="border-b border-gray-300 text-left dark:border-gray-700">
						<th class="pr-4">Ethic</th><th class="pr-4 text-right">Empires</th><th>Who</th>
					</tr>
				</thead>
				<tbody>
					{#each groups as g (g.base)}
						<tr
							class="border-b border-gray-100 align-top dark:border-gray-900 {ticked.has(g.base)
								? ''
								: 'opacity-50'}"
						>
							<td class="pr-4 whitespace-nowrap">
								<span
									class="inline-block h-2.5 w-2.5 rounded-sm"
									style:background={data.ethicsMap.colors[g.base]}
								></span>
								{baseName(g.base)}
							</td><td class="pr-4 text-right tabular-nums">{g.empires.length}</td><td>
								{#each g.empires as x, i (x.e.id)}{#if i}<span class="mr-1 text-gray-400">
											,
										</span>{/if}{@render empireName(x.e, x.key)}{:else}<span class="text-gray-500">
										none known
									</span>{/each}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
		<p class="mt-1 text-xs text-gray-500">
			Hover an empire to light it on the map; grey: none of its systems known.
		</p>
	{/snippet}

	<Panel
		title="Governing ethics in the galaxy"
		note="Every empire whose borders you know, in the colour of its strongest ticked ethic — fanatic in full, plain lighter — or striped in all its ticked ethics (a fanatic one twice as wide); grey with none of them (dark) or when your intel does not show its ethics (light; it needs communications or intel 10). Hover a system for the owner's ethics, an empire in the legend or the table to light it; dashed where your intel no longer confirms them. The game has no such map mode."
	>
		<GalaxyMap
			systems={data.ethicsMap.systems}
			territories={ethicMap}
			titles={ethicTitles}
			heightKey="ethics-map-height"
			square
			bind:width={mapWidth}
			beside={ethicTable}
			onlegendhover={(k) => (lit = k)}
			label="Governing ethics map"
		>
			{#snippet layer(at)}
				{#if litTerritory}
					{@const pts = litTerritory.systems.flatMap((id) => {
						const x = sysById.get(id);
						return x ? [at(x)] : [];
					})}
					{#each pts as p, i (i)}
						<circle cx={p.x} cy={p.y} r="7" fill="none" stroke="currentColor" stroke-width="2" />
					{/each}
					{#if pts.length}
						<text
							x={pts.reduce((a, p) => a + p.x, 0) / pts.length}
							y={Math.min(...pts.map((p) => p.y)) - 14}
							text-anchor="middle"
							class="fill-current stroke-white text-xs font-semibold dark:stroke-gray-950"
							paint-order="stroke"
							stroke-width="4"
						>
							{litTerritory.label}
						</text>
					{/if}
				{/if}
			{/snippet}
			{#snippet controls()}
				<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
					{#each ETHIC_BASES as b (b)}
						<label class="flex items-center gap-1" title="{holding[b]} empires you know hold it">
							<input type="checkbox" checked={ticked.has(b)} onchange={() => tick(b)} />
							<span
								class="inline-block h-2.5 w-2.5 rounded-sm"
								style:background={data.ethicsMap.colors[b]}
							></span>
							<span
								class="inline-block h-2.5 w-2.5 rounded-sm"
								style:background={lighter(data.ethicsMap.colors[b])}
							></span>
							{baseName(b)} <span class="text-gray-500">{holding[b]}</span>
						</label>
					{/each}
					<button
						class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700"
						onclick={() => (ticked = new Set(ETHIC_BASES))}
					>
						all
					</button>
					<button
						class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700"
						onclick={() => (ticked = new Set())}
					>
						none
					</button>
					<label
						class="flex items-center gap-1"
						title="every ticked ethic an empire holds, in bands; off: its strongest only"
					>
						<input type="checkbox" bind:checked={stripes} /> stripes
					</label>
					<span class="flex items-center gap-1 text-gray-500">
						<span class="inline-block h-2.5 w-2.5 rounded-sm" style:background={NONE}></span>
						none ticked
						<span class="ml-2 inline-block h-2.5 w-2.5 rounded-sm" style:background={UNKNOWN}
						></span>
						unknown
					</span>
				</div>
				{#if !data.ethicsMap.read}<p class="mt-1 text-sm text-amber-600">
						No diplomacy read yet: every empire shows grey until the next save.
					</p>{/if}
			{/snippet}
		</GalaxyMap>
		{#if mapWidth !== 'side'}<div class="mt-3">{@render ethicTable()}</div>{/if}
	</Panel>
</div>
