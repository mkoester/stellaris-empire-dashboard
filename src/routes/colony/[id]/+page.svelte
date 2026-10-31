<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Chart from '#lib/Chart.svelte';
	import Flows from '#lib/Flows.svelte';
	import Jobs from '#lib/Jobs.svelte';
	import Designation from '#lib/Designation.svelte';
	import DistrictName from '#lib/DistrictName.svelte';
	import ColonyStabilityRoom from '#lib/ColonyStabilityRoom.svelte';
	import ColonyWellbeing from '#lib/ColonyWellbeing.svelte';
	import GrowthProjection from '#lib/GrowthProjection.svelte';
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
				? resolve('/colony/[id]', { id })
				: resolve(`/colony/[id]?node=${node}`, { id }),
			{ replace: true, reset: false }
		);
	});

	// Due dates of this planet's queue, from the shared upcoming list (same order as the queue).
	const done = $derived(
		data.upcoming
			.filter((e) => e.planetId === data.planetId)
			.map((e) => (e.exact ? '' : '≈ ') + e.date)
	);

	// Chart events: the empire's, but of the colony events only this planet's.
	const planetEvents = $derived(
		data.milestones.filter((e) => e.planetId === undefined || e.planetId === data.planetId)
	);

	const settled = $derived(
		data.upcoming.find((e) => e.kind === 'colonization' && e.planetId === data.planetId)
	);

	// The colonies tab: pick another colony, staying on the branch shown.
	const open = (id: string) =>
		goto(
			data.isHead
				? resolve('/colony/[id]', { id })
				: resolve(`/colony/[id]?node=${data.tip}`, { id })
		);
</script>

<!-- the game date always top right, as on the empire page -->
<header class="mb-4 flex items-start gap-4">
	<div class="flex flex-1 flex-wrap items-baseline gap-x-4">
		<h1 class="text-2xl font-bold">
			<select
				class="rounded bg-transparent"
				value={data.planetId}
				onchange={(e) => open(e.currentTarget.value)}
				aria-label="colony shown"
			>
				{#if !data.colonies.some((c) => c.planetId === data.planetId)}
					<option value={data.planetId}>{data.name}</option>
				{/if}
				{#each data.colonies as c (c.planetId)}<option value={c.planetId}>{c.name}</option>{/each}
			</select>
		</h1>
		{#if data.colony}
			<span><Designation key={data.colony.designation} /></span>
			{#if data.colony.colonizing}
				<!-- being settled: complete at 100 colonists; due date from Upcoming -->
				<span class="text-green-700" title={settled?.detail ?? ''}>
					colonizing <b>{fmt(data.colony.pops)} / 100</b>{settled
						? ` · done ${settled.exact ? '' : '≈ '}${settled.date}`
						: ''}
				</span>
			{/if}
		{/if}
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
						<td class="p-1"
							><DistrictName
								name={nameOf(data.names, item.name)}
								color={data.colors[item.name]}
							/></td
						>
						<td class="p-1 text-gray-500">{pretty(item.kind)}</td>
						<td class="p-1 text-right">{fmt(item.progress)} / {fmt(item.needed)}</td>
						<td class="p-1 text-right">{done[i] ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
{/if}

{#if data.colony}
	<!-- beside it while the colony is at the stability cap: what is spent there for nothing -->
	<div class="grid items-start gap-x-4 lg:grid-cols-2">
		<ColonyWellbeing colony={data.colony} rules={data.wellbeing} gestalt={data.gestalt} />
		{#if data.colony.stability >= data.wellbeing.maxStability}
			<ColonyStabilityRoom
				colony={data.colony}
				rules={data.wellbeing}
				gestalt={data.gestalt}
				uncapped={data.uncapped}
				levers={data.levers}
				explain={data.explain}
			/>
		{/if}
	</div>
{/if}

<div class="grid gap-4 lg:grid-cols-2">
	{#key data.tip}
		{#if data.growth.rows.length && data.growth.date}
			<!-- growth and assembly at the measured speed, as on the growth tab -->
			<div>
				<GrowthProjection
					rows={data.growth.rows}
					defines={data.growth.defines}
					date={data.growth.date}
				/>
			</div>
		{/if}
		<Chart
			title="Pops"
			series={data.charts.pops}
			extent={data.xExtent}
			events={planetEvents}
			scope="colony"
			right={['open jobs']}
		/>
		<Chart
			title="Stability"
			series={data.charts.stability}
			extent={data.xExtent}
			events={planetEvents}
			scope="colony"
			right={['over 100']}
			rightFloor={10}
		/>
		<Chart
			title="Pops per month: growth and migration"
			series={data.charts.growth}
			extent={data.xExtent}
			events={planetEvents}
			scope="colony"
		/>
		<Chart
			title="Happiness %"
			series={data.charts.happiness}
			extent={data.xExtent}
			events={planetEvents}
			scope="colony"
			yMin={0}
			yMax={100}
		/>
		<Chart
			title="Free housing and amenities"
			series={data.charts.free}
			extent={data.xExtent}
			events={planetEvents}
			scope="colony"
		/>
		<Chart
			title="Districts"
			series={data.charts.districts}
			extent={data.xExtent}
			events={planetEvents}
			scope="colony"
		/>
	{/key}
</div>

{#if data.colony}
	<div class="mt-6 grid items-start gap-6 lg:grid-cols-[auto_1fr]">
		<PlanetInfo
			colony={data.colony}
			names={data.names}
			blockers={data.blockers}
			classNames={data.classNames}
			details={data.details}
			hints={data.blockerHints}
			date={data.latest.date}
		/>
		<Districts districts={data.colony.districtList} names={data.names} colors={data.colors} />
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
