<script lang="ts">
	import { resolve } from '$app/paths';
	import Chart from '#lib/Chart.svelte';
	import Flows from '#lib/Flows.svelte';
	import Jobs from '#lib/Jobs.svelte';
	import { automationSummary } from '#lib/automation.ts';
	import { budgetRows } from '#lib/flows.ts';
	import Resources from '#lib/Resources.svelte';
	import Upcoming from '#lib/Upcoming.svelte';
	import AutomationSummary from '#lib/panels/AutomationSummary.svelte';
	import Edicts from '#lib/panels/Edicts.svelte';
	import Expansion from '#lib/panels/Expansion.svelte';
	import Leaders from '#lib/panels/Leaders.svelte';
	import Score from '#lib/panels/Score.svelte';
	import Sectors from '#lib/panels/Sectors.svelte';
	import Ships from '#lib/panels/Ships.svelte';
	import SpeciesPanel from '#lib/panels/Species.svelte';
	import { colorOf } from '#lib/colors.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { gameYear } from '#lib/series.ts';
	import { announceBranch, followGame, postBranch } from '#lib/live.ts';
	import type { Colony } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.empty || data.isHead);

	// Planet pages in other panes follow the branch shown here.
	const shown = () => (data.empty || data.isHead ? null : data.tip);
	announceBranch(shown);
	$effect(() => postBranch(shown()));

	const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);

	const events = $derived(data.empty ? [] : data.upcoming);
	// Research per field (physics, society, engineering), then tradition, then agenda.
	const headerOrder = [
		'physics_research',
		'society_research',
		'engineering_research',
		'unity',
		'agenda'
	];
	const headerProgress = $derived(
		headerOrder.flatMap((tint) => events.filter((e) => e.tint === tint && e.total))
	);
	const headerLabel = (e: (typeof events)[number]) =>
		e.kind === 'research'
			? `next ${e.tint.replace('_research', '')} research`
			: e.kind === 'tradition'
				? 'next tradition'
				: 'agenda';
	const percent = (e: (typeof events)[number]) =>
		`${Math.min(100, Math.floor((100 * e.done!) / e.total!))}%`;
	const researchMarkers = $derived(
		events
			.filter((e) => e.kind === 'research')
			.map((e) => ({ x: gameYear(e.date), tint: e.tint, label: `${e.date.slice(0, 7)} ${e.what}` }))
	);

	// Stay on the same branch when opening a planet.
	const planetHref = (planetId: number) =>
		!data.empty && !data.isHead
			? resolve(`/planet/[id]?node=${data.tip}`, { id: String(planetId) })
			: resolve('/planet/[id]', { id: String(planetId) });

	const queue = (c: Colony) =>
		c.buildQueue.length === 0
			? '∅'
			: pretty(c.buildQueue[0].name) +
				(c.buildQueue.length > 1 ? ` (+${c.buildQueue.length - 1})` : '');
</script>

{#if data.empty}
	<h1 class="text-2xl font-bold">Empire dashboard</h1>
	<p>Waiting for the first save.</p>
{:else}
	<header class="mb-2 flex flex-col gap-1">
		<div class="flex flex-wrap items-baseline gap-x-4">
			<h1 class="text-2xl font-bold">{data.latest.empireName}</h1>
			<span class="text-lg">{data.latest.date}</span>
			{#if data.latest.score}
				<span
					>rank <b>{data.latest.score.rank}</b> · score <b>{fmt(data.latest.score.score)}</b></span
				>
			{/if}
			{#if data.latest.empireSize !== null}
				<span>empire size <b>{fmt(data.latest.empireSize)}</b></span>
			{/if}
			{#if data.latest.starbases}
				<span>starbases <b>{data.latest.starbases.used} / {data.latest.starbases.capacity}</b></span
				>
			{/if}
			{#if data.latest.envoys}
				<span title="envoys on an assignment / all envoys"
					>envoys working <b>{data.latest.envoys.used} / {data.latest.envoys.total}</b></span
				>
			{/if}
			{#if data.latest.navalUsed !== null}
				<span>naval capacity used <b>{fmt(data.latest.navalUsed)}</b></span>
			{/if}
			{#each headerProgress.filter((e) => e.kind === 'research') as e (e.tint)}
				{@render progress(e)}
			{/each}
			<a class="underline" href={resolve('/timeline')}>save graph</a>
			{#if !data.isHead}
				<a class="underline" href={resolve('/')}>back to the current game</a>
			{/if}
			{#if data.guessedLinks > 0}
				<span class="text-amber-600">
					{data.guessedLinks} branch point{data.guessedLinks > 1 ? 's' : ''} guessed — check the save
					graph
				</span>
			{/if}
		</div>
		<div class="flex flex-wrap items-baseline gap-x-4">
			{#each headerProgress.filter((e) => e.kind !== 'research') as e (e.tint)}
				{@render progress(e)}
			{/each}
		</div>
	</header>

	{#snippet progress(e: (typeof events)[number])}
		<span
			style:color={colorOf(e.tint)}
			title="{e.what}: {fmt(e.done!)} / {fmt(e.total!)}, ≈ {e.date}"
		>
			{headerLabel(e)} <b>{percent(e)}</b> ≈ {Math.round(e.months)} mo
		</span>
	{/snippet}

	<Resources
		stockpile={data.latest.stockpile}
		balance={data.latest.balance}
		orders={data.latest.marketOrders}
	/>

	<h2 class="mb-2 text-xl font-semibold">Upcoming</h2>
	<Upcoming events={data.upcoming} node={data.isHead ? null : data.tip} explain={data.explain} />

	<div class="mt-6 grid gap-4 lg:grid-cols-2">
		{#key data.tip}
			<Chart title="Empire size" series={data.charts.empireSize} range={data.xRange} yMin={50} />
			<Chart title="Pops" series={data.charts.pops} range={data.xRange} />
			<Chart title="Score and power" series={data.charts.score} range={data.xRange} />
			<Chart
				title="Research per month"
				series={data.charts.research}
				range={data.xRange}
				markers={researchMarkers}
			/>
			<Chart title="Net per month" series={data.charts.balance} range={data.xRange} />
			<Chart title="Stockpile" series={data.charts.stockpile} range={data.xRange} />
			<Chart title="Income per month" series={data.charts.income} range={data.xRange} />
		{/key}
	</div>

	<h2 class="mt-6 mb-2 text-xl font-semibold">Colonies</h2>
	<div class="overflow-x-auto">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-gray-300 dark:border-gray-700">
					<th class="p-1">Planet</th>
					<th class="p-1">Designation</th>
					<th class="p-1 text-right">Pops</th>
					<th class="p-1 text-right">Employed</th>
					<th class="p-1 text-right">Civilians</th>
					<th class="p-1 text-right">Open jobs</th>
					<th class="p-1 text-right">Stability</th>
					<th class="p-1 text-right">Happiness</th>
					<th class="p-1 text-right">Free housing</th>
					<th class="p-1 text-right">Free amenities</th>
					<th class="p-1 text-right">Districts</th>
					<th class="p-1 text-right">Build queue</th>
					<th class="p-1">Automation</th>
				</tr>
			</thead>
			<tbody>
				{#each data.latest.colonies as c (c.planetId + ':' + c.name)}
					<tr class="border-b border-gray-200 dark:border-gray-800">
						<td class="p-1">
							{#if c.planetId >= 0}
								<a class="underline" href={planetHref(c.planetId)}>{c.name}</a>
							{:else}
								{c.name}
							{/if}
						</td>
						<td class="p-1">{pretty(c.designation)}</td>
						<td class="p-1 text-right">{fmt(c.pops)}</td>
						<td class="p-1 text-right">{fmt(c.employed)}</td>
						<td class="p-1 text-right">{fmt(c.civilians)}</td>
						<td class="p-1 text-right">{fmt(c.openJobs)}</td>
						<td class="p-1 text-right">{fmt(c.stability)}</td>
						<td class="p-1 text-right">{pct(c.happiness)}</td>
						<td class="p-1 text-right">{fmt(c.freeHousing)}</td>
						<td class="p-1 text-right">{fmt(c.freeAmenities)}</td>
						<td class="p-1 text-right">{c.districts}</td>
						<td class="p-1 text-right">{queue(c)}</td>
						<td class="p-1"
							>{c.automation.enabled ? automationSummary(c.automation.settings) : 'off'}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- side by side once both fit (about 1250 px), stacked in a split-view half -->
	<div class="mt-6 grid items-start gap-6 2xl:grid-cols-2">
		<section>
			<h2 class="mb-2 text-xl font-semibold">Jobs</h2>
			<Jobs rows={data.empireJobs} explain={data.explain} />
		</section>
		<section>
			<h2 class="mb-2 text-xl font-semibold">Pops' resources per month</h2>
			<p class="mb-2 text-sm text-gray-500">
				What jobs produce and use, and what pops and buildings cost — the budget's planet and pop
				sources.
			</p>
			<Flows rows={budgetRows(data.latest.planetBudget ?? [])} />
		</section>
	</div>

	<div class="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
		{#if data.latest.score}<Score score={data.latest.score} />{/if}
		<Leaders leaders={data.latest.leaders ?? {}} />
		<Ships
			ships={data.latest.ships ?? []}
			fleets={data.latest.fleets ?? []}
			navalUsed={data.latest.navalUsed}
		/>
		<Edicts edicts={data.edicts} explain={data.explain} />
		<Sectors sectors={data.latest.sectors ?? []} />
		<AutomationSummary
			defaults={data.latest.defaultAutomation ?? []}
			blocked={data.latest.automationBlocked ?? []}
		/>
	</div>

	<div class="mt-6 grid items-start gap-6 2xl:grid-cols-2">
		<SpeciesPanel species={data.species} explain={data.explain} />
		<Expansion planets={data.expansion} />
	</div>
{/if}
