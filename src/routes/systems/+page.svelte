<script lang="ts">
	import Chart from '#lib/Chart.svelte';
	import { fmt, nameOf, pretty } from '#lib/format.ts';
	import GalaxyMap from '#lib/GalaxyMap.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import ResourceChips from '#lib/ResourceChips.svelte';
	import { gameYear } from '#lib/series.ts';
	import SortTable from '#lib/SortTable.svelte';
	import { putSettings } from '#lib/settings.ts';
	import type { Column } from '#lib/sort.ts';
	import {
		breakEven,
		netValue,
		PROJECTION_MONTHS,
		projection,
		SYSTEM_RANGES,
		type SystemView
	} from '#lib/systems.ts';
	import type { Resources } from '#lib/types.ts';
	import { valueOf } from '#lib/value.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// the view is the profile's: changed here, stored at once
	let view: SystemView = $derived(data.view);
	const save = (v: SystemView) => {
		view = v;
		void putSettings({ systemView: v });
	};
	let hovered: number | null = $state(null);
	const getSelected = () => view.selected;
	const setSelected = (id: number | null | undefined) => save({ ...view, selected: id ?? null });

	type Row = (typeof data.rows)[number];
	// values in trade at the market's base prices (research, unity, influence count 1)
	const trade = (r: Resources) => valueOf(r, {});
	const money = (r: Row) => (r.money ? (view.colonies ? r.money.colonies : r.money.plain) : null);
	const totals = (r: Row) => {
		const m = money(r);
		const last = m?.points.at(-1);
		if (!m || !last) return null;
		const invested = trade(last.invested);
		const earned = trade(last.earned);
		const net = netValue(m.flow, {});
		return {
			invested,
			earned,
			net,
			since: m.points[0].date,
			even: breakEven(invested, earned, net)
		};
	};
	const inRange = (r: Row) =>
		view.range === 'all'
			? true
			: view.range === 'mine'
				? r.owned
				: r.owned || (r.beyond !== null && r.beyond <= Number(view.range));
	const rows = $derived(data.rows.filter(inRange));
	const byId = $derived(new Map(data.systems.map((s) => [s.id, s])));

	// the map: our systems by net value per month, green earning, red costing
	const fill = $derived(
		Object.fromEntries(
			rows.flatMap((r) => {
				const t = totals(r);
				if (!t) return [];
				const strength = Math.min(1, Math.abs(t.net) / 20);
				const tone =
					t.net >= 0 ? ['#c7e9c0', '#74c476', '#238b45'] : ['#fcbba1', '#fb6a4a', '#cb181d'];
				return [[r.systemId, tone[Math.min(2, Math.floor(strength * 3))]]];
			})
		)
	);
	const titles = $derived(
		Object.fromEntries(
			rows.map((r) => {
				const t = totals(r);
				return [r.systemId, t ? `${r.name}: ${fmt(t.net)} trade/month` : r.name];
			})
		)
	);
	let sort = $state({ column: 'net', desc: true });

	const columns: Column<Row>[] = [
		{ id: 'name', label: 'System', value: (r) => r.name },
		{ id: 'sector', label: 'Sector', value: (r) => r.sector },
		{
			id: 'beyond',
			label: 'Beyond',
			value: (r) => r.beyond,
			right: true,
			title: 'jumps beyond our border'
		},
		{ id: 'starbase', label: 'Starbase', value: (r) => r.level, cell: starbase },
		{ id: 'stations', label: 'Stations', value: (r) => r.stations || null, right: true },
		{ id: 'colonies', label: 'Colonies', value: (r) => r.colonies || null, right: true },
		{
			id: 'deposits',
			label: 'Deposits',
			value: (r) => trade(r.facts.deposits) || null,
			cell: deposits,
			title: 'what the bodies’ deposits yield, before modifiers'
		},
		{
			id: 'since',
			label: 'Since',
			value: (r) => totals(r)?.since ?? null,
			title: 'first save showing it ours'
		},
		{
			id: 'invested',
			label: 'Invested',
			value: (r) => totals(r)?.invested ?? null,
			right: true,
			title: 'one-offs + upkeep so far, in trade'
		},
		{
			id: 'earned',
			label: 'Earned',
			value: (r) => totals(r)?.earned ?? null,
			right: true,
			title: 'output so far, in trade'
		},
		{
			id: 'net',
			label: 'Net/mo',
			value: (r) => totals(r)?.net ?? null,
			right: true,
			title: 'output − upkeep per month, in trade'
		},
		{
			id: 'even',
			label: 'Break-even',
			value: (r) => totals(r)?.even ?? null,
			right: true,
			cell: even,
			title: 'months until earned catches up with invested'
		}
	];

	const selected = $derived(data.rows.find((r) => r.systemId === view.selected) ?? null);
	const sel = $derived(selected ? money(selected) : null);
	const chart = $derived.by(() => {
		if (!sel?.points.length) return null;
		const pts = sel.points;
		const last = pts.at(-1)!;
		const x0 = gameYear(last.date);
		const ahead = projection(last, sel.flow, view.months, x0);
		const past = pts.map((p) => gameYear(p.date));
		const pad = (n: number) => Array<number | null>(n).fill(null);
		return {
			range: [past[0], x0 + view.months / 12] as [number, number],
			series: {
				x: [...past, ...ahead.map((p) => p.x)],
				lines: {
					invested: [...pts.map((p) => trade(p.invested)), ...pad(ahead.length)],
					earned: [...pts.map((p) => trade(p.earned)), ...pad(ahead.length)],
					'invested (projected)': [
						...pad(pts.length - 1),
						trade(last.invested),
						...ahead.map((p) => trade(p.invested))
					],
					'earned (projected)': [
						...pad(pts.length - 1),
						trade(last.earned),
						...ahead.map((p) => trade(p.earned))
					]
				}
			}
		};
	});
</script>

{#snippet starbase(r: Row)}
	{#if r.level}{pretty(r.level)}<span class="text-gray-500"
			>{r.modules.length + r.buildings.length
				? ` +${r.modules.length + r.buildings.length}`
				: ''}</span
		>{:else if !r.owned}<span class="text-gray-500">{r.ownerId === null ? '' : 'other'}</span>{/if}
{/snippet}
{#snippet deposits(r: Row)}<ResourceChips flows={r.facts.deposits} />{/snippet}
{#snippet even(r: Row)}{@const t = totals(r)}{t === null
		? ''
		: t.even === null
			? 'never'
			: t.even === 0
				? '✓'
				: `${t.even} mo`}{/snippet}
{#snippet numCell(v: number | null)}{v === null ? '' : fmt(v)}{/snippet}
{#snippet investedCell(r: Row)}{@render numCell(totals(r)?.invested ?? null)}{/snippet}
{#snippet earnedCell(r: Row)}{@render numCell(totals(r)?.earned ?? null)}{/snippet}
{#snippet netCell(r: Row)}{@const t = totals(r)}<span class={t && t.net < 0 ? 'text-red-600' : ''}
		>{t ? fmt(t.net) : ''}</span
	>{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Systems</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !data.seenAt}
	<p class="mb-4 text-sm text-amber-600">No galaxy read yet; it fills after the next save.</p>
{/if}

<div class="mb-4 flex flex-wrap items-center gap-4 text-sm">
	<label class="flex items-center gap-1"
		>systems
		<select
			class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
			value={view.range}
			onchange={(e) => save({ ...view, range: e.currentTarget.value })}
		>
			{#each SYSTEM_RANGES as r (r)}<option value={r}
					>{r === 'mine' || r === 'all' ? r : `mine and up to +${r} beyond the border`}</option
				>{/each}
		</select></label
	>
	<label class="flex items-center gap-1"
		><input
			type="checkbox"
			checked={view.colonies}
			onchange={(e) => save({ ...view, colonies: e.currentTarget.checked })}
		/> include colonies</label
	>
	<label class="flex items-center gap-1"
		>projection
		<select
			class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
			value={view.months}
			onchange={(e) => save({ ...view, months: Number(e.currentTarget.value) })}
		>
			{#each PROJECTION_MONTHS as m (m)}<option value={m}>{m} months</option>{/each}
		</select></label
	>
</div>

<div class="flex flex-col gap-6">
	<Panel
		title="Our systems"
		note="Invested: the outpost (alloys, and influence estimated from the jumps to our nearest system), starbase upgrades, modules and buildings, stations, plus their upkeep. Earned: what stations and starbase modules and buildings produce. Monthly amounts are the budget's totals split over the systems by their base values; what the first save already showed is priced from the game files and marked 'before history'. Values in trade at market base prices.{data.hasBudget
			? ''
			: ' The latest save has no budget: base values, before modifiers.'}{data.hasStations
			? ''
			: ' Stations show from the next save on.'}"
	>
		<GalaxyMap
			systems={data.systems}
			{fill}
			{titles}
			focus={[
				{
					label: 'ours',
					points: rows.filter((r) => r.owned).flatMap((r) => byId.get(r.systemId) ?? [])
				}
			]}
			heightKey="systems-map-height"
			label="systems"
			territories={data.territories}
			bind:hovered
			bind:selected={getSelected, setSelected}
		/>
		<SortTable
			{rows}
			columns={columns.map((c) =>
				c.id === 'invested'
					? { ...c, cell: investedCell }
					: c.id === 'earned'
						? { ...c, cell: earnedCell }
						: c.id === 'net'
							? { ...c, cell: netCell }
							: c
			)}
			key={(r) => r.systemId}
			bind:sort
			link={(r) => r.systemId}
			bind:hovered
			bind:selected={getSelected, setSelected}
		/>
	</Panel>

	{#if selected}
		<Panel title={selected.name}>
			<div class="grid gap-4 text-sm lg:grid-cols-2">
				<div>
					<h2 class="mb-1 font-semibold">What we know</h2>
					<p>
						{pretty(selected.facts.star.replace(/^sc_/, ''))} star{#if selected.facts.bodies !== null},
							{selected.facts.bodies} bodies ({selected.facts.colonized} colonized){:else}, not
							visited{/if}{#if selected.facts.anomalies}, {selected.facts.anomalies} anomalies{/if}{#if selected.facts.freeDeposits},
							{selected.facts.freeDeposits} surveyed deposits without a station{/if}
					</p>
					<p>Deposits: <ResourceChips flows={selected.facts.deposits} /></p>
					{#if selected.facts.megastructures.length}<p>
							Megastructures: {selected.facts.megastructures.map(pretty).join(', ')}
						</p>{/if}
					{#if selected.facts.bypasses.length}<p>
							Bypasses: {selected.facts.bypasses.map(pretty).join(', ')}
						</p>{/if}
					{#if selected.level}<p>
							Starbase: {pretty(selected.level)}{[...selected.modules, ...selected.buildings].length
								? ` — ${[...selected.modules, ...selected.buildings].map((k) => nameOf(data.names, k)).join(', ')}`
								: ''}
						</p>{/if}
				</div>
				{#if sel}
					<div>
						<h2 class="mb-1 font-semibold">Per month now</h2>
						<p>Output: <ResourceChips flows={sel.flow.income} sign={1} /></p>
						<p>
							Upkeep: <ResourceChips
								flows={Object.fromEntries(Object.entries(sel.flow.upkeep).map(([k, v]) => [k, -v]))}
								sign={-1}
							/>
						</p>
						<h2 class="mt-3 mb-1 font-semibold">Paid once</h2>
						<ul>
							{#each sel.spends as s, i (i)}
								<li>
									<span class="text-gray-500 tabular-nums">{s.date}</span>
									{nameOf(data.names, s.label.replace(/ \(.*\)$/, ''))}{s.label.match(
										/ \(.*\)$/
									)?.[0] ?? ''}{s.approx ? '*' : ''}:
									<ResourceChips
										flows={Object.fromEntries(Object.entries(s.cost).map(([k, v]) => [k, -v]))}
									/>
								</li>
							{:else}
								<li class="text-gray-500">nothing recorded</li>
							{/each}
						</ul>
						<p class="mt-1 text-xs text-gray-500">
							* game-file prices before modifiers, or an estimate (outpost influence)
						</p>
					</div>
				{/if}
			</div>
			{#if chart}
				<div class="mt-4">
					<Chart
						title="Invested vs. earned, cumulative (trade)"
						series={chart.series}
						range={chart.range}
						colors={{
							invested: '#c23b3b',
							earned: '#2aa84a',
							'invested (projected)': '#e8a0a0',
							'earned (projected)': '#9fd8ad'
						}}
					/>
				</div>
			{/if}
		</Panel>
	{/if}
</div>
