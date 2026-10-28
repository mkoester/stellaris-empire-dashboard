<script lang="ts">
	import EthicChip from './EthicChip.svelte';
	import { EMBRACE_SUPPORT, EMBRACE_UNITY, type Embrace } from './ethicsTab.ts';
	import type { FactionRow } from './government.ts';
	import SortTable from './SortTable.svelte';
	import type { Column } from './sort.ts';
	import { describe } from './triggers.ts';
	import type { EthicAxis, Explanation } from './types.ts';

	// One faction type: ours as the save shows it (support, approval, pops), what embracing it
	// takes, and its demands — ✓ met, ✗ not, ? the save cannot tell.
	let {
		f,
		anyFormed,
		axes,
		names,
		explain
	}: {
		f: FactionRow & { embrace: Embrace | null };
		anyFormed: boolean;
		axes: Record<string, EthicAxis>;
		names: Record<string, string>;
		explain: Record<string, Explanation>;
	} = $props();

	const effect = (v: number | null) =>
		v === null || Math.abs(v) < 0.01 ? null : `${v > 0 ? '+' : ''}${v}`;
	const mark = (v: boolean | null) => (v === null ? '?' : v ? '✓' : '✗');
	// rounded down, as the game's factions screen: 5.72 % shows as 5 %
	const pct = (v: number) => `${Math.floor(v * 100)} %`;

	type Demand = FactionRow['demands'][number] & { i: number };
	const demandColumns: Column<Demand>[] = [
		{
			id: 'met',
			label: 'Met',
			value: (d) => (d.met === null ? null : d.met ? 1 : 0),
			cell: met
		},
		{ id: 'demand', label: 'Demand', value: (d) => d.title, cell: demand }
	];
</script>

{#snippet met(d: Demand)}{mark(d.met)}{/snippet}
{#snippet demand(d: Demand)}
	<b>{d.met === false && d.unfulfilledTitle ? d.unfulfilledTitle : d.title}</b>
	{#if effect(d.fulfilled)}<span class="text-green-700 dark:text-green-500">
			{effect(d.fulfilled)} if met</span
		>{/if}
	{#if effect(d.unfulfilled)}<span class="text-red-600"> {effect(d.unfulfilled)} if not</span>{/if}
	{#if d.description}<div class="text-gray-500">{d.description}</div>{/if}
	<div class="text-xs text-gray-500">how: {describe(d.trigger)}</div>
{/snippet}

<section class="text-sm">
	<h3 class="mb-1 flex flex-wrap items-baseline gap-2 text-base font-semibold">
		{f.name}
		{#if f.ethic}<span class="text-sm font-normal"
				><EthicChip
					ethic={f.ethic}
					name={names[f.ethic] ?? f.ethic}
					{axes}
					explanation={explain[`ethic:${f.ethic}`]}
				/></span
			>{/if}
		{#if f.embrace?.promoted}<span class="text-sm font-normal text-green-700 dark:text-green-500"
				>promoted</span
			>{/if}
		{#if f.embrace?.suppressed}<span class="text-sm font-normal text-red-600">suppressed</span>{/if}
	</h3>
	{#if f.formed}
		<p class="mb-1 tabular-nums">
			support <b>{pct(f.formed.support)}</b> · approval
			<b class={f.formed.approval < 0.5 ? 'text-red-600' : 'text-green-600'}
				>{pct(f.formed.approval)}</b
			>{f.formed.pops !== null
				? ` · ${f.formed.pops} pops${f.formed.change ? ` (${f.formed.change > 0 ? '+' : ''}${f.formed.change})` : ''}`
				: ''}
		</p>
		{#if f.embrace}
			{@const e = f.embrace}
			<p
				class="mb-1"
				title="Embrace Faction shifts our ethics one step toward its ethic: {EMBRACE_UNITY} unity, support over {EMBRACE_SUPPORT *
					100} %, once per 10 years empire-wide; every other faction −35 % approval for 10 years"
			>
				{#if e.fanatic}<span class="text-gray-500"
						>embrace: we are already fanatic in its ethic</span
					>
				{:else}
					embrace: <span
						class={e.possible ? 'font-semibold text-green-700 dark:text-green-500' : ''}
						>{e.possible ? 'possible now' : 'not yet'}</span
					>
					· {mark(e.support)} support &gt; {EMBRACE_SUPPORT * 100} % · {mark(e.unity)}
					{EMBRACE_UNITY} unity{#if e.cooldownUntil}
						· ✗ cooldown until {e.cooldownUntil}{/if}
				{/if}
			</p>
		{/if}
	{:else if anyFormed}<p class="mb-1 text-gray-500">not formed</p>{/if}
	{#if f.description}<p class="mb-1 text-gray-500">{f.description}</p>{/if}
	<SortTable
		rows={f.demands.map((d, i) => ({ ...d, i }))}
		columns={demandColumns}
		key={(d) => d.i}
		sort={{ column: '', desc: false }}
	/>
</section>
