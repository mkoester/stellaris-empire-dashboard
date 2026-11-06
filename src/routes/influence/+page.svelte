<script lang="ts">
	import Chart from '#lib/Chart.svelte';
	import { resourceBudget } from '#lib/flows.ts';
	import { fmt } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const signed = (n: number) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
	const tone = (n: number) => (n < 0 ? 'text-red-600' : n > 0 ? 'text-green-600' : 'text-gray-500');
	const month = $derived(
		data.budget ? resourceBudget(data.budget, 'influence', (s) => data.labels[s] ?? s) : null
	);
	const missed = $derived(data.uncollected.reduce((t, u) => t + u.amount, 0));
	type Row = NonNullable<typeof month>['rows'][number] & { i: number };
	const columns: Column<Row>[] = [
		{ id: 'source', label: 'Source', value: (r) => r.label },
		{ id: 'income', label: 'Income', value: (r) => r.income || null, cell: income, right: true },
		{
			id: 'expenses',
			label: 'Spending',
			value: (r) => r.expenses || null,
			cell: expenses,
			right: true
		},
		{ id: 'net', label: 'Net', value: (r) => r.net, cell: net, right: true }
	];
</script>

{#snippet income(r: Row)}{r.income ? fmt(r.income) : ''}{/snippet}
{#snippet expenses(r: Row)}{r.expenses ? fmt(r.expenses) : ''}{/snippet}
{#snippet net(r: Row)}<span class={tone(r.net)}>{signed(r.net)}</span>{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Influence</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<div class="grid items-start gap-4 lg:grid-cols-2">
	<!-- what the empire could have and does not -->
	<section class="rounded border border-gray-300 p-2 lg:col-span-2 dark:border-gray-700">
		<h2 class="mb-1 font-semibold">
			Not collected
			{#if missed > 0}<span class="text-amber-600">{signed(missed)} a month</span>{/if}
		</h2>
		{#if data.uncollected.length === 0}
			<p class="text-sm text-gray-500">Nothing: every source we can measure is at its maximum.</p>
		{:else}
			<ul class="space-y-1 text-sm">
				{#each data.uncollected as u (u.what)}
					<li>
						<span class="font-semibold text-amber-600 tabular-nums"
							>{u.estimated ? '≈ ' : ''}{signed(u.amount)}</span
						>
						{u.what} — <span class="text-gray-500">{u.how}</span>
					</li>
				{/each}
			</ul>
		{/if}
		{#if data.powerProjection}
			{@const pp = data.powerProjection}
			<p
				class="mt-2 text-xs text-gray-500"
				title="navy size = 2 × used naval capacity (fitted on 40 saves); coverage = navy size ÷ empire size, at most 100 %"
			>
				Power projection {fmt(pp.booked)} of {pp.floored ? '≈ ' : ''}{fmt(pp.max)}: naval coverage
				{Math.round(pp.coverage * 100)} % ({data.navalUsed} naval capacity used × 2 ÷ empire size
				{data.empireSize}){pp.floored ? ' — at the 10 % floor: no navy still pays 0.2' : ''}.
				Rivals: {data.rivals}.
				{#if data.max !== null}Stockpile {fmt(data.stockpile ?? 0)} of {fmt(data.max)}.{/if}
			</p>
		{/if}
	</section>

	{#key data.tip}
		<Chart
			title="Influence per month by source"
			series={data.series}
			extent={data.xExtent}
			events={data.milestones}
		/>
	{/key}

	<section class="rounded border border-gray-300 p-2 dark:border-gray-700">
		<h2 class="mb-1 font-semibold">
			This month
			{#if data.budgetDate}<span class="text-sm font-normal text-gray-500"
					>as of {data.budgetDate}</span
				>{/if}
		</h2>
		{#if month === null}
			<p class="text-sm text-gray-500">No save with a budget yet.</p>
		{:else}
			<SortTable
				rows={month.rows.map((r, i) => ({ ...r, i }))}
				{columns}
				key={(r) => r.i}
				sort={{ column: '', desc: false }}
			/>
			<table class="w-full text-left text-sm tabular-nums">
				<tbody>
					<tr class="border-t border-gray-300 font-semibold dark:border-gray-700">
						<td class="p-1">total</td>
						<td class="p-1 text-right">{fmt(month.total.income)}</td>
						<td class="p-1 text-right">{fmt(month.total.expenses)}</td>
						<td class="p-1 text-right {tone(month.total.net)}">{signed(month.total.net)}</td>
					</tr>
				</tbody>
			</table>
			{#if data.unbooked}
				{@const u = data.unbooked}
				<h3 class="mt-3 text-sm font-semibold">Spent outside the budget since {u.since}</h3>
				<p class="text-xs text-gray-500">
					claims, outposts, decisions, resolutions, … — the game books none of them monthly
				</p>
				<table class="w-full text-left text-sm tabular-nums">
					<tbody>
						{#each u.named as n, i (i)}
							<tr class="text-xs">
								<td class="p-1">{n.date} · {n.label}</td>
								<td class="p-1 text-right" title={n.approx ? 'base cost, before modifiers' : ''}
									>{n.approx ? '≈ ' : ''}{signed(n.amount)}</td
								>
							</tr>
						{/each}
						<tr
							class="text-xs {Math.abs(u.unexplained) >= 0.01 ? 'text-amber-600' : 'text-gray-500'}"
						>
							<td class="p-1">{data.lostAtCap ? 'lost at the storage cap' : 'unexplained'}</td>
							<td class="p-1 text-right"
								>{Math.abs(u.unexplained) >= 0.01 ? signed(u.unexplained) : '–'}</td
							>
						</tr>
					</tbody>
				</table>
			{/if}
		{/if}
	</section>
</div>
