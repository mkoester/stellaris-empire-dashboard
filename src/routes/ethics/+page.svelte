<script lang="ts">
	import Chart from '#lib/Chart.svelte';
	import { colorOf } from '#lib/colors.ts';
	import EthicChip from '#lib/EthicChip.svelte';
	import type { EthicRow } from '#lib/ethicsTab.ts';
	import FactionCard from '#lib/FactionCard.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
	const signed = (v: number) => (v ? `${v > 0 ? '+' : ''}${v}` : '');
	// the chart lines in their ethic's colour, by name
	const lineColors = $derived(
		Object.fromEntries(
			Object.entries(data.ethicColors).flatMap(([name, c]) =>
				colorOf(c) ? [[name, colorOf(c)!]] : []
			)
		)
	);

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
				"share of the attraction-weighted pops (the save's pops_ethics_attraction): where our pops are heading — above its share, an ethic gains pops"
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
	{#if r.held}<span class="text-xs text-gray-500" title="one of our governing ethics">ours</span
		>{/if}
	{#if r.dropped}<span
			class="text-xs text-amber-600"
			title="our governing ethic with the least attraction: embracing a faction of an ethic we do not hold removes it"
			>lost on the next new ethic</span
		>{/if}
{/snippet}
{#snippet share(r: EthicRow)}{pct(r.share)}{/snippet}
{#snippet attraction(r: EthicRow)}<span
		class={r.attraction > r.share + 0.005
			? 'text-green-700 dark:text-green-500'
			: r.attraction < r.share - 0.005
				? 'text-red-600'
				: ''}>{pct(r.attraction)}</span
	>{/snippet}
{#snippet change(r: EthicRow)}{signed(r.change)}{/snippet}
{#snippet weight(r: EthicRow)}{r.weight ?? ''}{/snippet}
{#snippet colonyCell(c: ColonyRow, id: string)}
	{#if c.pops[id]}{c.pops[id]}{#if c.change[id]}<span class="text-xs text-gray-500">
				({signed(c.change[id])})</span
			>{/if}{/if}
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
	{/if}
</div>
