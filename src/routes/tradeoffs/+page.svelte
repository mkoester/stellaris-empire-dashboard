<script lang="ts">
	import Chart from '#lib/Chart.svelte';
	import { colorOf } from '#lib/colors.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
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
		for (const [k, v] of Object.entries(defaultWeights(keys))) if (!(k in weights)) weights[k] = v;
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
</script>

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
		— a job's output per pop, a station's against its deposit. Values in energy at the market's base
		prices unless you change the weights. Not modelled: pop growth, housing, free building slots,
		storage caps, one build at a time per queue.
		{#if t.unmeasured.length}Jobs nobody works yet count as 0: {t.unmeasured.join(', ')}.{/if}
	</p>

	<section class="mb-6 grid gap-4 lg:grid-cols-2">
		<div>
			<h2 class="mb-1 font-semibold">Upcoming techs and traditions</h2>
			<p class="mb-1 text-xs text-gray-500">
				Tick one to apply what it changes from its month on (editable). Techs within reach are dated
				as if researched next in their field.
			</p>
			<div class="max-h-72 overflow-y-auto text-sm">
				{#each t.presets as p, i (i)}
					<label class="flex items-baseline gap-2 py-0.5">
						<input
							type="checkbox"
							checked={picked[i]?.on ?? false}
							onchange={(e) =>
								(picked[i] = { on: e.currentTarget.checked, month: picked[i]?.month ?? p.month })}
						/>
						<span class="flex-1"
							>{p.label} <span class="text-xs text-gray-500">({p.source})</span>
							<span class="text-xs">{p.changes.map(describe).join('; ')}</span></span
						>
						<span class="text-xs text-gray-500">month</span>
						<input
							class="w-14 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
							type="number"
							min="0"
							value={picked[i]?.month ?? p.month}
							oninput={(e) =>
								(picked[i] = { on: picked[i]?.on ?? false, month: Number(e.currentTarget.value) })}
						/>
					</label>
				{:else}
					<p class="text-gray-500">None of them changes what these options cost or yield.</p>
				{/each}
			</div>
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
			<h2 class="mt-4 mb-1 font-semibold">Weights (value of one unit, in energy)</h2>
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
			<table class="w-full text-left text-sm tabular-nums">
				<thead>
					<tr class="border-b border-gray-300 dark:border-gray-700">
						<th class="p-1">Build</th>
						<th class="p-1">Where</th>
						<th class="p-1 text-right">×</th>
						<th class="p-1">Cost</th>
						<th class="p-1">Per month</th>
						<th class="p-1 text-right" title="workers it needs / idle pops there">Pops</th>
						<th class="p-1 text-right">Days</th>
						<th class="p-1 text-right" title="output − upkeep, weighted">Value/mo</th>
						<th class="p-1 text-right">Payback</th>
					</tr>
				</thead>
				<tbody>
					{#each ranked as o (o.id)}
						<tr class="border-b border-gray-200 dark:border-gray-800">
							<td class="p-1">{o.label}</td>
							<td class="p-1">{o.where}</td>
							<td class="p-1 text-right">{o.count}</td>
							<td class="p-1"
								>{#each res(o.cost) as [k, v] (k)}<span class="mr-2 whitespace-nowrap"
										><span style:color={colorOf(k)}>{pretty(k)}</span> {fmt(v)}</span
									>{/each}</td
							>
							<td class="p-1"
								>{#each res(o.output) as [k, v] (k)}<span
										class="mr-2 whitespace-nowrap text-green-700"
										>+{fmt(v)} <span style:color={colorOf(k)}>{pretty(k)}</span></span
									>{/each}{#each res(o.upkeep) as [k, v] (k)}<span
										class="mr-2 whitespace-nowrap text-red-600"
										>−{fmt(v)} <span style:color={colorOf(k)}>{pretty(k)}</span></span
									>{/each}</td
							>
							<td class="p-1 text-right"
								>{#if o.colony !== null}{fmt(o.pops)} / {fmt(t.start.idle[o.colony] ?? 0)}{/if}</td
							>
							<td class="p-1 text-right">{fmt(o.days)}</td>
							<td class="p-1 text-right">{fmt(o.netValue)}</td>
							<td class="p-1 text-right font-semibold">{months1(o.payback)}</td>
						</tr>
					{:else}
						<tr><td class="p-1 text-gray-500" colspan="9">Nothing to build right now.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="grid gap-4 lg:grid-cols-2">
		{#key runs.map((r) => r.name).join('|')}
			<Chart title="Stockpile value by strategy (energy)" series={series((r) => r.value)} {range} />
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
