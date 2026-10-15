<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Chart from '#lib/Chart.svelte';
	import Flows from '#lib/Flows.svelte';
	import Jobs from '#lib/Jobs.svelte';
	import Districts from '#lib/panels/Districts.svelte';
	import PlanetInfo from '#lib/panels/PlanetInfo.svelte';
	import { automationRows } from '#lib/automation.ts';
	import { net } from '#lib/flows.ts';
	import { fmt, nameOf, pretty } from '#lib/format.ts';
	import { followBranch, followGame } from '#lib/live.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// Follow the empire page in another pane to whatever save it shows.
	followBranch((node) => {
		if (node === (data.isHead ? null : data.tip)) return;
		const id = String(data.planetId);
		goto(
			node === null
				? resolve('/planet/[id]', { id })
				: resolve(`/planet/[id]?node=${node}`, { id }),
			{ replace: true, reset: false }
		);
	});

	// Due dates of this planet's queue, from the shared upcoming list (same order as the queue).
	const done = $derived(
		data.upcoming
			.filter((e) => e.planetId === data.planetId)
			.map((e) => (e.exact ? '' : '≈ ') + e.date)
	);

	const back = $derived(resolve(data.isHead ? '/' : `/?node=${data.tip}`));
</script>

<!-- the game date always top right, as on the empire page -->
<header class="mb-4 flex items-start gap-4">
	<div class="flex flex-1 flex-wrap items-baseline gap-x-4">
		<h1 class="text-2xl font-bold">{data.name}</h1>
		{#if data.colony}
			<span>{pretty(data.colony.designation)}</span>
		{/if}
		<a class="underline" href={back}>empire</a>
	</div>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !data.colony}
	<p class="mb-4">Not one of your colonies at this point of the game.</p>
{:else}
	<h2 class="mb-2 text-xl font-semibold">Build queue</h2>
	{#if data.colony.buildQueue.length === 0}
		<p class="mb-4">Empty.</p>
	{:else}
		<table class="mb-4 text-left text-sm">
			<tbody>
				{#each data.colony.buildQueue as item, i (i)}
					<tr class="border-b border-gray-200 dark:border-gray-800">
						<td class="p-1">{nameOf(data.names, item.name)}</td>
						<td class="p-1 text-gray-500">{pretty(item.kind)}</td>
						<td class="p-1 text-right">{fmt(item.progress)} / {fmt(item.needed)}</td>
						<td class="p-1 text-right">{done[i] ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
{/if}

<div class="grid gap-4 lg:grid-cols-2">
	{#key data.tip}
		<Chart title="Pops" series={data.charts.pops} range={data.xRange} right={['open jobs']} />
		<Chart title="Stability" series={data.charts.stability} range={data.xRange} />
		<Chart
			title="Happiness %"
			series={data.charts.happiness}
			range={data.xRange}
			yMin={0}
			yMax={100}
		/>
		<Chart title="Free housing and amenities" series={data.charts.free} range={data.xRange} />
		<Chart title="Districts" series={data.charts.districts} range={data.xRange} />
	{/key}
</div>

{#if data.colony}
	<div class="mt-6 grid items-start gap-6 lg:grid-cols-[auto_1fr]">
		<PlanetInfo
			colony={data.colony}
			names={data.names}
			blockers={data.blockers}
			classNames={data.classNames}
		/>
		<Districts districts={data.colony.districtList} names={data.names} />
	</div>

	<h2 class="mt-6 mb-2 text-xl font-semibold">Jobs</h2>
	<Jobs rows={data.jobRows} explain={data.explain} />

	<h2 class="mt-6 mb-2 text-xl font-semibold">Resources per month</h2>
	<Flows
		rows={[
			{ label: 'output', flows: data.colony.produces },
			{ label: 'upkeep', flows: net({}, data.colony.upkeep) },
			{ label: 'net', flows: net(data.colony.produces, data.colony.upkeep), strong: true }
		]}
	/>

	<h2 class="mt-6 mb-2 text-xl font-semibold">Automation</h2>
	{#if !data.colony.automation.enabled}
		<p>Off.</p>
	{:else}
		<ul>
			{#each automationRows(data.colony.automation.settings) as r (r.key)}
				<li class={r.on ? '' : 'text-gray-500'}>{r.on ? '☑' : '☐'} {r.name}</li>
			{/each}
		</ul>
	{/if}
{/if}
