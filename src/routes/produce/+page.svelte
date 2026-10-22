<script lang="ts">
	import { colorOf } from '#lib/colors.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import { basePrice } from '#lib/market.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import {
		HORIZONS,
		producible,
		rankFor,
		sides,
		type ProduceRow,
		type ProduceView
	} from '#lib/produce.ts';
	import ResourceChips from '#lib/ResourceChips.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import { putSettings } from '#lib/settings.ts';
	import type { Column } from '#lib/sort.ts';
	import type { Resources } from '#lib/types.ts';
	import { NOT_TRADED } from '#lib/value.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const p = $derived(data.produce);
	// the view is the profile's: changed here, stored at once
	let view: ProduceView = $derived(data.view);
	const save = (v: ProduceView) => {
		view = v;
		void putSettings({ produceView: v });
	};

	const choices = $derived(p ? producible(p.options, p.order) : []);
	const resource = $derived(
		view.resource && choices.includes(view.resource) ? view.resource : (choices[0] ?? null)
	);
	const buy = $derived(resource && p?.market ? (p.market.buy[resource] ?? null) : null);
	const rows = $derived(
		p && resource ? rankFor(resource, p.options, view.weights, view.months, buy) : []
	);
	// what has no market price is valued by the viewer (1 trade each unless changed)
	const unpriced = $derived(
		[
			...new Set(
				(p?.options ?? []).flatMap((o) => [
					...Object.keys(o.cost),
					...Object.keys(o.upkeep),
					...Object.keys(o.output)
				])
			)
		]
			.filter((k) => basePrice(k) === null)
			.sort()
	);
	let sort = $state({ column: 'perUnit', desc: false });

	const KIND: Record<string, string> = {
		station: 'station',
		district: 'district',
		building: 'building',
		module: 'starbase module',
		starbase_building: 'starbase building',
		blocker: 'clear blocker',
		edict: 'edict'
	};
	const columns: Column<ProduceRow>[] = [
		{ id: 'label', label: 'Option', value: (r) => r.option.label, cell: label },
		{ id: 'where', label: 'Where', value: (r) => r.option.where },
		{
			id: 'count',
			label: '×',
			value: (r) => r.option.count,
			right: true,
			title: 'how many fit there'
		},
		{ id: 'gain', label: '+/month', value: (r) => r.gain, right: true, cell: gain },
		{
			id: 'cost',
			label: 'Cost',
			value: (r) => r.cost,
			cell: cost,
			title: 'once, in its resources'
		},
		{
			id: 'uses',
			label: 'Uses per month',
			value: (r) => r.uses,
			cell: uses,
			title: 'upkeep and inputs in other resources'
		},
		{
			id: 'also',
			label: 'Also yields',
			value: (r) => r.also || null,
			cell: also,
			title: 'what else it yields per month — not counted in its price'
		},
		{ id: 'pops', label: 'Pops', value: (r) => r.option.pops || null, right: true },
		{ id: 'days', label: 'Days', value: (r) => r.option.days || null, right: true },
		{
			id: 'perUnit',
			label: 'Trade per unit',
			value: (r) => r.perUnit,
			right: true,
			cell: perUnit,
			title: 'over the horizon: (cost + months × uses per month) ÷ (months × units)'
		},
		{
			id: 'payback',
			label: 'Beats buying after',
			value: (r) => r.payback,
			right: true,
			cell: payback,
			title: 'months until it has cost less than buying the same units on the market'
		},
		{ id: 'basis', label: 'Basis', value: (r) => r.option.basis, cell: basis }
	];
	const neg = (r: Resources) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, -v]));
</script>

{#snippet label(r: ProduceRow)}{r.option.label}
	<span class="text-xs text-gray-500">{KIND[r.option.kind] ?? r.option.kind}</span>{/snippet}
{#snippet gain(r: ProduceRow)}<span style:color={colorOf(resource ?? '')}>{fmt(r.gain)}</span
	>{/snippet}
{#snippet cost(r: ProduceRow)}<ResourceChips flows={neg(r.option.cost)} />{/snippet}
{#snippet uses(r: ProduceRow)}<ResourceChips
		flows={neg(sides(r.option, resource ?? '').uses)}
	/>{/snippet}
{#snippet also(r: ProduceRow)}<ResourceChips
		flows={sides(r.option, resource ?? '').also}
	/>{/snippet}
{#snippet perUnit(r: ProduceRow)}<span
		class={buy !== null && r.perUnit < buy ? 'font-semibold text-green-600' : ''}
		>{fmt(r.perUnit)}</span
	>{/snippet}
{#snippet payback(r: ProduceRow)}{r.payback === null ? '' : `${fmt(r.payback)} mo`}{/snippet}
{#snippet basis(r: ProduceRow)}<span
		class="text-xs text-gray-500"
		title={r.option.basis === 'measured'
			? 'output measured from your budget'
			: r.option.basis === 'base'
				? 'the game files’ value, before your modifiers'
				: 'its modifier’s share of what you yield today'}>{r.option.basis}</span
	>{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Produce</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !p}
	<p>No full save with a budget yet.</p>
{:else}
	<div class="mb-3 flex flex-wrap items-center gap-1 text-sm">
		{#each choices as r (r)}
			<button
				class="rounded border px-2 py-0.5 {r === resource
					? 'border-blue-500 font-semibold'
					: 'border-gray-300 dark:border-gray-700'}"
				style:color={colorOf(r)}
				onclick={() => save({ ...view, resource: r })}>{pretty(r)}</button
			>
		{/each}
	</div>
	<div class="mb-4 flex flex-wrap items-center gap-4 text-sm">
		<label class="flex items-center gap-1"
			>horizon
			<select
				class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
				value={view.months}
				onchange={(e) => save({ ...view, months: Number(e.currentTarget.value) })}
			>
				{#each HORIZONS as m (m)}<option value={m}>{m / 12} years</option>{/each}
			</select></label
		>
		{#if resource}
			<span>
				Market: {#if buy !== null}<strong>{fmt(buy)}</strong> trade per {pretty(resource)}, fee {Math.round(
						(p.market?.fee ?? 0) * 100
					)} % included ({p.market?.galactic ? 'galactic' : 'internal'} market){:else}<span
						class="text-gray-500">{pretty(resource)} is not sold on the market</span
					>{/if}
			</span>
		{/if}
	</div>

	<div class="flex flex-col gap-6">
		<Panel
			title={resource ? `More ${pretty(resource)}` : 'Nothing to produce'}
			note="As of {p.date}. Each option at its cost now (base costs scaled by what your queued items cost) and its output measured from your budget — a job's output per working pop, a station's or starbase module's against its base value; edicts as their modifier's share of what you yield today (the game adds multipliers, so this is an upper bound). Trade per unit: what it costs in trade per unit over the horizon — its cost plus what it uses per month, other resources at market base prices; what else it yields is shown beside it, not subtracted. Below the market's price it is green. Starbase options are the types you have built before; buildings too.{p
				.unmeasured.length
				? ` Jobs nobody works yet count as 0: ${p.unmeasured.join(', ')}.`
				: ''}"
		>
			<SortTable {rows} {columns} key={(r) => r.option.id} bind:sort />
			{#if !rows.length}<p class="text-sm text-gray-500">No option adds it right now.</p>{/if}
		</Panel>

		{#if unpriced.length}
			<Panel
				title="Values without a market price"
				note="Trade per unit of what the market does not sell, for the columns above (1 unless changed). Stored with the profile."
			>
				<div class="flex flex-wrap gap-4 text-sm">
					{#each unpriced as k (k)}
						<label class="flex items-center gap-1"
							><span style:color={colorOf(k)}>{pretty(k)}</span>
							<input
								class="w-16 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
								type="number"
								min="0"
								step="0.5"
								value={view.weights[k] ?? NOT_TRADED}
								onchange={(e) =>
									save({
										...view,
										weights: { ...view.weights, [k]: Number(e.currentTarget.value) }
									})}
							/></label
						>
					{/each}
				</div>
			</Panel>
		{/if}
	</div>
{/if}
