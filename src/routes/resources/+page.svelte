<script lang="ts">
	import Chart from '#lib/Chart.svelte';
	import { colorOf } from '#lib/colors.ts';
	import { resourceBudget } from '#lib/flows.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const signed = (n: number) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
	const tone = (n: number) => (n < 0 ? 'text-red-600' : n > 0 ? 'text-green-600' : 'text-gray-500');
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Resources</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<!-- per resource: its chart, and beside it the month by budget source -->
<div class="grid items-start gap-4 lg:grid-cols-2">
	{#each data.panels as p (p.key)}
		{@const color = colorOf(p.key)}
		{#key data.tip}
			<Chart
				title={pretty(p.key)}
				series={p.series}
				range={data.xRange}
				right={['per month']}
				rightFloor={0}
				colors={color ? { stockpile: color, 'per month': color } : {}}
				events={data.milestones}
			/>
		{/key}
		<section class="rounded border border-gray-300 p-2 dark:border-gray-700">
			<h2 class="mb-1 font-semibold">
				<span style:color>{pretty(p.key)}</span> per month
				{#if data.budgetDate}<span class="text-sm font-normal text-gray-500"
						>as of {data.budgetDate}</span
					>{/if}
			</h2>
			{#if data.budget === null}
				<p class="text-sm text-gray-500">No save with a budget yet.</p>
			{:else}
				{@const b = resourceBudget(data.budget, p.key)}
				{#if b.rows.length === 0}
					<p class="text-sm text-gray-500">Nothing earns or spends it.</p>
				{:else}
					<div class="max-h-64 overflow-y-auto">
						<table class="w-full text-left text-sm tabular-nums">
							<thead>
								<tr class="border-b border-gray-300 dark:border-gray-700">
									<th class="p-1">Source</th>
									<th class="p-1 text-right">Income</th>
									<th class="p-1 text-right">Spending</th>
									<th class="p-1 text-right">Net</th>
								</tr>
							</thead>
							<tbody>
								{#each b.rows as r, i (i)}
									<tr>
										<td class="p-1">{r.label}</td>
										<td class="p-1 text-right">{r.income ? fmt(r.income) : ''}</td>
										<td class="p-1 text-right">{r.expenses ? fmt(r.expenses) : ''}</td>
										<td class="p-1 text-right {tone(r.net)}">{signed(r.net)}</td>
									</tr>
								{/each}
								<tr class="border-t border-gray-300 font-semibold dark:border-gray-700">
									<td class="p-1">total</td>
									<td class="p-1 text-right">{fmt(b.total.income)}</td>
									<td class="p-1 text-right">{fmt(b.total.expenses)}</td>
									<td class="p-1 text-right {tone(b.total.net)}">{signed(b.total.net)}</td>
								</tr>
								{#if p.unbooked}
									{@const rest = p.unbooked.actual - p.unbooked.booked}
									<tr class="text-gray-500">
										<td class="p-1" colspan="3">stockpile change since {p.unbooked.since}</td>
										<td class="p-1 text-right">{signed(p.unbooked.actual)}</td>
									</tr>
									<tr
										class={p.unbooked.days.length ? 'text-amber-600' : 'text-gray-500'}
										title="construction, events, one-off market trades, decisions, income lost at the storage cap, … — the game books none of them in the budget"
									>
										<td class="p-1" colspan="3">not in the budget</td>
										<td class="p-1 text-right">{p.unbooked.days.length ? signed(rest) : '–'}</td>
									</tr>
									{#if p.unbooked.days.length > 1}
										{#each p.unbooked.days as d (d.date)}
											<tr class="text-xs text-amber-600">
												<td class="p-1 pl-4" colspan="3">{d.date}</td>
												<td class="p-1 text-right">{signed(d.amount)}</td>
											</tr>
										{/each}
									{/if}
								{/if}
							</tbody>
						</table>
					</div>
				{/if}
			{/if}
		</section>
	{/each}
</div>
