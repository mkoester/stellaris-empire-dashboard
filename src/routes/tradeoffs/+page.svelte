<script lang="ts">
	import Chart from '#lib/Chart.svelte';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { colorOf } from '#lib/colors.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import { gameYear } from '#lib/series.ts';
	import {
		defaultWeights,
		rank,
		simulate,
		strategies,
		type Change,
		type Knobs
	} from '#lib/tradeoffs.ts';
	import type { Resources } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const t = $derived(data.tradeoffs);

	// Knobs, per viewer and not stored: weights, which presets apply (and when), changes of one's
	// own, the horizon.
	const keys = $derived(
		[
			...new Set(
				(t?.options ?? []).flatMap((o) => [
					...Object.keys(o.cost),
					...Object.keys(o.output),
					...Object.keys(o.upkeep)
				])
			)
		].sort()
	);
	let weights = $state<Resources>({});
	$effect(() => {
		// the market's base price, else what a unit costs us (the jobs tab)
		for (const [k, v] of Object.entries(defaultWeights(keys)))
			if (!(k in weights)) weights[k] = data.values[k] ?? v;
	});
	let picked = $state<Record<number, { on: boolean; month: number }>>({});
	let own = $state<Change[]>([]);
	let months = $state(60);

	const presetChanges = $derived(
		(t?.presets ?? []).flatMap((p, i) =>
			picked[i]?.on ? p.changes.map((c) => ({ ...c, month: picked[i].month })) : []
		)
	);
	const knobs = $derived<Knobs>({
		weights,
		changes: [...presetChanges, ...own],
		months
	});
	const ranked = $derived(t ? rank(t.options, knobs) : []);
	const runs = $derived(
		t ? strategies(t.options, knobs.changes).map((s) => simulate(t.options, t.start, knobs, s)) : []
	);
	const x0 = $derived(t ? gameYear(t.date) : 0);
	const series = (pick: (r: (typeof runs)[number]) => number[]) => ({
		x: Array.from({ length: months + 1 }, (_, m) => x0 + m / 12),
		lines: Object.fromEntries(runs.map((r) => [r.name, pick(r)]))
	});
	const range = $derived<[number, number]>([x0, x0 + months / 12]);

	// the presets by where they come from, each group folded but the research queue
	const GROUPS_OF_PRESETS = [
		'research queue',
		'within reach',
		'next tradition',
		'ascension perk, if picked'
	];
	const groupOf = (p: { source: string }) =>
		GROUPS_OF_PRESETS.find((g) => p.source.startsWith(g)) ?? p.source;
	const GROUPS = [
		'station',
		'station_gatherers',
		'station_researchers',
		'district',
		'building',
		'jobs'
	];
	const addChange = () =>
		(own = [
			...own,
			{ label: 'my change', month: 12, target: 'output', groups: ['jobs'], pct: 0.1 }
		]);
	const describe = (c: Change) =>
		`${c.groups.map((g) => g.replace(/^(job|stratum):/, '')).join(', ')}${c.resource ? ` ${pretty(c.resource)}` : ''} ${c.target} ${c.pct > 0 ? '+' : '−'}${Math.round(Math.abs(c.pct) * 100)} %`;
	const res = (r: Resources) => Object.entries(r).filter(([, v]) => Math.abs(v) >= 0.01);
	const months1 = (n: number | null) => (n === null ? 'never' : `${fmt(n)} mo`);
	type Option = (typeof ranked)[number];
	const total = (r: Resources) => Object.values(r).reduce((n, v) => n + v, 0);
	const columns: Column<Option>[] = [
		{ id: 'build', label: 'Build', value: (o) => o.label },
		{ id: 'where', label: 'Where', value: (o) => o.where },
		{ id: 'count', label: '×', value: (o) => o.count, right: true },
		{ id: 'cost', label: 'Cost', value: (o) => total(o.cost), cell: cost },
		{
			id: 'flows',
			label: 'Per month',
			value: (o) => total(o.output) - total(o.upkeep),
			cell: flows
		},
		{
			id: 'pops',
			label: 'Pops',
			value: (o) => (o.colony === null ? null : o.pops),
			cell: pops,
			right: true,
			title: 'workers it needs / idle pops there'
		},
		{ id: 'days', label: 'Days', value: (o) => o.days, cell: days, right: true },
		{
			id: 'value',
			label: 'Value/mo',
			value: (o) => o.netValue,
			cell: value,
			right: true,
			title: 'output − upkeep, weighted'
		},
		{ id: 'payback', label: 'Payback', value: (o) => o.payback, cell: payback, right: true }
	];
</script>

{#snippet cost(o: Option)}{#each res(o.cost) as [k, v] (k)}<span class="mr-2 whitespace-nowrap"
			><span style:color={colorOf(k)}>{pretty(k)}</span> {fmt(v)}</span
		>{/each}{/snippet}
{#snippet flows(o: Option)}{#each res(o.output) as [k, v] (k)}<span
			class="mr-2 whitespace-nowrap text-green-700"
			>+{fmt(v)} <span style:color={colorOf(k)}>{pretty(k)}</span></span
		>{/each}{#each res(o.upkeep) as [k, v] (k)}<span class="mr-2 whitespace-nowrap text-red-600"
			>−{fmt(v)} <span style:color={colorOf(k)}>{pretty(k)}</span></span
		>{/each}{/snippet}
{#snippet pops(o: Option)}{#if o.colony !== null && t}{fmt(o.pops)} / {fmt(
			t.start.idle[o.colony] ?? 0
		)}{/if}{/snippet}
{#snippet days(o: Option)}{fmt(o.days)}{/snippet}
{#snippet value(o: Option)}{fmt(o.netValue)}{/snippet}
{#snippet payback(o: Option)}<b>{months1(o.payback)}</b>{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Trade-offs</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !t}
	<p>No full save with a budget yet.</p>
{:else}
	<p class="mb-4 max-w-4xl text-sm text-gray-500">
		Exploratory. What you can build now, as of {t.date}: stations at surveyed deposits in your
		systems, districts where a colony has room, buildings you have built before. Costs are the
		game's base costs (scaled by what your queued items cost), outputs are measured from your budget
		— a job's output per pop, a station's against its deposit. Values in trade at the market's base
		prices unless you change the weights. Not modelled: pop growth, housing, free building slots,
		storage caps, one build at a time per queue.
		{#if t.unmeasured.length}Jobs nobody works yet count as 0: {t.unmeasured.join(', ')}.{/if}
	</p>

	<section class="mb-6 grid gap-4 lg:grid-cols-2">
		<div>
			<h2 class="mb-1 font-semibold">Upcoming techs, traditions and perks</h2>
			<p class="mb-1 text-xs text-gray-500">
				Tick one to apply what it changes from its month on (editable). Techs within reach are dated
				as if researched next in their field.
			</p>
			{#each GROUPS_OF_PRESETS as g (g)}
				{@const shown = t.presets.map((p, i) => ({ p, i })).filter(({ p }) => groupOf(p) === g)}
				{#if shown.length}
					<details class="text-sm" open={g === 'research queue'}>
						<summary class="cursor-pointer text-gray-500">{g} ({shown.length})</summary>
						{#each shown as { p, i } (i)}
							<label class="flex items-baseline gap-2 py-0.5">
								<input
									type="checkbox"
									checked={picked[i]?.on ?? false}
									onchange={(e) =>
										(picked[i] = {
											on: e.currentTarget.checked,
											month: picked[i]?.month ?? p.month
										})}
								/>
								<span class="flex-1"
									><InfoPopup explanation={data.explain[p.ref]}>{p.label}</InfoPopup>
									<span class="text-xs text-gray-500">({p.source})</span>
									<span class="text-xs">{p.changes.map(describe).join('; ')}</span></span
								>
								<span class="text-xs text-gray-500">month</span>
								<input
									class="w-14 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
									type="number"
									min="0"
									value={picked[i]?.month ?? p.month}
									oninput={(e) =>
										(picked[i] = {
											on: picked[i]?.on ?? false,
											month: Number(e.currentTarget.value)
										})}
								/>
							</label>
						{/each}
					</details>
				{/if}
			{/each}
			{#if !t.presets.length}
				<p class="text-sm text-gray-500">None of them changes what these options cost or yield.</p>
			{/if}
		</div>
		<div>
			<h2 class="mb-1 font-semibold">Your own changes</h2>
			{#each own as c, i (i)}
				<div class="flex flex-wrap items-baseline gap-2 py-0.5 text-sm">
					<select
						class="rounded border border-gray-300 bg-transparent dark:border-gray-700"
						bind:value={c.target}
					>
						<option value="cost">cost</option>
						<option value="upkeep">upkeep</option>
						<option value="output">output</option>
					</select>
					of
					<select
						class="rounded border border-gray-300 bg-transparent dark:border-gray-700"
						value={c.groups[0]}
						onchange={(e) => (c.groups = [e.currentTarget.value])}
					>
						{#each GROUPS as g (g)}<option value={g}>{g.replaceAll('_', ' ')}</option>{/each}
					</select>
					<input
						class="w-16 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
						type="number"
						step="5"
						value={Math.round(c.pct * 100)}
						oninput={(e) => (c.pct = Number(e.currentTarget.value) / 100)}
					/>
					% from month
					<input
						class="w-14 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
						type="number"
						min="0"
						bind:value={c.month}
					/>
					<button class="text-red-600" onclick={() => (own = own.filter((_, j) => j !== i))}
						>✕</button
					>
				</div>
			{/each}
			<button class="mt-1 rounded border px-2 text-sm" onclick={addChange}>+ change</button>
			<h2 class="mt-4 mb-1 font-semibold">Weights (value of one unit, in trade)</h2>
			<div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
				{#each keys as k (k)}
					<label class="whitespace-nowrap"
						><span style:color={colorOf(k)}>{pretty(k)}</span>
						<input
							class="w-14 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
							type="number"
							step="0.5"
							min="0"
							bind:value={weights[k]}
						/></label
					>
				{/each}
				<label class="whitespace-nowrap"
					>horizon (months)
					<input
						class="w-16 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
						type="number"
						min="6"
						max="240"
						bind:value={months}
					/></label
				>
			</div>
		</div>
	</section>

	<section class="mb-6">
		<h2 class="mb-1 font-semibold">Ranked by payback</h2>
		<div class="overflow-x-auto">
			{#if ranked.length}
				<SortTable rows={ranked} {columns} key={(o) => o.id} sort={{ column: '', desc: false }} />
			{:else}<p class="text-sm text-gray-500">Nothing to build right now.</p>{/if}
		</div>
	</section>

	<section class="grid gap-4 lg:grid-cols-2">
		{#key runs.map((r) => r.name).join('|')}
			<Chart title="Stockpile value by strategy (trade)" series={series((r) => r.value)} {range} />
			<Chart title="Net income value per month by strategy" series={series((r) => r.net)} {range} />
		{/key}
	</section>
	<section class="mt-4 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
		{#each runs as r (r.name)}
			<details>
				<summary
					>{r.name}: <b>{fmt(r.value.at(-1) ?? 0)}</b> after {months} months, net
					<b>{fmt(r.net.at(-1) ?? 0)}</b>/mo · {r.bought.length} built</summary
				>
				<ul class="ml-4 text-xs">
					{#each r.bought as b, i (i)}<li>month {b.month}: {b.label}</li>{/each}
				</ul>
			</details>
		{/each}
	</section>
{/if}
