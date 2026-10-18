<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { resolve } from '$app/paths';
	import Chart from './Chart.svelte';
	import Flows from './Flows.svelte';
	import Jobs from './Jobs.svelte';
	import { automationSummary } from './automation.ts';
	import { budgetRows } from './flows.ts';
	import { openJobs } from './jobs.ts';
	import Resources from './Resources.svelte';
	import Upcoming from './Upcoming.svelte';
	import DistrictName from './DistrictName.svelte';
	import DistrictSummary from './DistrictSummary.svelte';
	import AutomationSummary from './panels/AutomationSummary.svelte';
	import Edicts from './panels/Edicts.svelte';
	import Modifiers from './panels/Modifiers.svelte';
	import Blockers from './panels/Blockers.svelte';
	import Events from './panels/Events.svelte';
	import Expansion from './panels/Expansion.svelte';
	import Government from './panels/Government.svelte';
	import Leaders from './panels/Leaders.svelte';
	import Migration from './panels/Migration.svelte';
	import FleetMovement from './panels/FleetMovement.svelte';
	import Traditions from './panels/Traditions.svelte';
	import CivilianShips from './panels/CivilianShips.svelte';
	import Score from './panels/Score.svelte';
	import ResearchTiers from './panels/ResearchTiers.svelte';
	import Sectors from './panels/Sectors.svelte';
	import Shipyards from './panels/Shipyards.svelte';
	import Starbases from './panels/Starbases.svelte';
	import Ships from './panels/Ships.svelte';
	import SpeciesPanel from './panels/Species.svelte';
	import { colorOf } from './colors.ts';
	import { fmt, nameOf, pretty } from './format.ts';
	import { gameYear } from './series.ts';
	import type { EmpireData } from './server/empire.ts';
	import type { PanelId } from './settings.ts';

	// One empire panel by id: the `all` tab lays them all out, a custom tab shows its pick.
	let { id, data }: { id: PanelId; data: EmpireData } = $props();

	const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);

	const events = $derived(data.upcoming);
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

	// Stay on the same branch when opening a colony.
	const colonyHref = (planetId: number) =>
		!data.isHead
			? resolve(`/colony/[id]?node=${data.tip}`, { id: String(planetId) })
			: resolve('/colony/[id]', { id: String(planetId) });

	const charts = $derived({
		'chart-empire-size': { title: 'Empire size', series: data.charts.empireSize, yMin: 50 },
		'chart-pops': { title: 'Pops', series: data.charts.pops },
		'chart-score': { title: 'Score and power', series: data.charts.score },
		'chart-agenda': { title: 'Council agenda', series: data.charts.agenda, right: ['per month'] },
		'chart-research': {
			title: 'Research per month',
			series: data.charts.research,
			markers: researchMarkers
		},
		'chart-balance': { title: 'Net per month', series: data.charts.balance },
		'chart-stockpile': { title: 'Stockpile', series: data.charts.stockpile },
		'chart-income': { title: 'Income per month', series: data.charts.income }
	} as Record<string, Omit<ComponentProps<typeof Chart>, 'range'>>);
</script>

{#if id === 'header'}
	<header class="flex flex-col gap-1">
		<!-- the game date always top right; everything else wraps to its left -->
		<div class="flex items-start gap-4">
			<div class="flex flex-1 flex-wrap items-baseline gap-x-4">
				<h1 class="text-2xl font-bold">{data.latest.empireName}</h1>
				{#if data.latest.score}
					<span
						>rank <b>{data.latest.score.rank}</b> · score
						<b>{fmt(data.latest.score.score)}</b></span
					>
				{/if}
				{#if data.latest.empireSize !== null}
					<span>empire size <b>{fmt(data.latest.empireSize)}</b></span>
				{/if}
				{#if data.latest.starbases}
					<span
						>starbases <b>{data.latest.starbases.used} / {data.latest.starbases.capacity}</b></span
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
			<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
		</div>
		<div class="flex flex-wrap items-baseline gap-x-4">
			{#each headerProgress.filter((e) => e.kind === 'research') as e (e.tint)}
				{@render progress(e)}
			{/each}
		</div>
		<div class="flex flex-wrap items-baseline gap-x-4">
			{#each headerProgress.filter((e) => e.kind !== 'research') as e (e.tint)}
				{@render progress(e)}
			{/each}
		</div>
	</header>
{:else if id === 'resources'}
	<Resources
		stockpile={data.latest.stockpile}
		balance={data.latest.balance}
		orders={data.latest.marketOrders}
		galactic={data.latest.market?.galactic}
	/>
{:else if id === 'upcoming'}
	<section>
		<h2 class="mb-2 text-xl font-semibold">Upcoming</h2>
		<Upcoming
			events={data.upcoming}
			node={data.isHead ? null : data.tip}
			explain={data.explain}
			names={data.names}
		/>
	</section>
{:else if id in charts}
	{#key data.tip}
		<Chart {...charts[id]} range={data.xRange} events={data.milestones} />
	{/key}
{:else if id === 'colonies'}
	<section>
		<h2 class="mb-2 text-xl font-semibold">Colonies</h2>
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-b border-gray-300 dark:border-gray-700">
						<th class="p-1">Colony</th>
						<th class="p-1">Designation</th>
						<th class="p-1 text-right">Pops</th>
						<th class="p-1 text-right" title="last month: growth, migration, …">±/mo</th>
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
						{@const jobs = openJobs(c)}
						<tr>
							<td class="p-1">
								{#if c.planetId >= 0}
									<a class="underline" href={colonyHref(c.planetId)}>{c.name}</a
									>{#if c.colonizing}&nbsp;<span
											class="text-xs text-green-700"
											title="being settled: complete at 100 colonists"
											>colonizing {fmt(c.pops)}/100</span
										>{/if}
								{:else}
									{c.name}
								{/if}
							</td>
							<td class="p-1">{pretty(c.designation)}</td>
							<td class="p-1 text-right">{fmt(c.pops)}</td>
							<td
								class="p-1 text-right {(c.growth?.net ?? 0) < 0
									? 'text-red-600'
									: (c.growth?.net ?? 0) > 0
										? 'text-green-600'
										: ''}"
								title={c.growth
									? Object.entries(c.growth.by)
											.map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
											.join(', ')
									: ''}>{c.growth ? (c.growth.net > 0 ? '+' : '') + fmt(c.growth.net) : ''}</td
							>
							<td class="p-1 text-right">{fmt(c.employed)}</td>
							<td class="p-1 text-right">{fmt(c.civilians)}</td>
							<td class="p-1 text-right">
								{fmt(jobs.open)}{#if jobs.reserved}&nbsp;<span
										class="cursor-help text-gray-500"
										title="{jobs.reserved} open enforcer job{jobs.reserved === 1
											? ''
											: 's'} not counted: crime automation fills them as needed"
										>({fmt(jobs.reserved)})</span
									>{/if}
							</td>
							<td class="p-1 text-right">{fmt(c.stability)}</td>
							<td class="p-1 text-right">{pct(c.happiness)}</td>
							<td class="p-1 text-right">{fmt(c.freeHousing)}</td>
							<td class="p-1 text-right">{fmt(c.freeAmenities)}</td>
							<td class="p-1 text-right">{c.districts}</td>
							<td class="p-1 text-right"
								>{#if c.buildQueue.length}<DistrictName
										name={nameOf(data.names, c.buildQueue[0].name)}
										color={data.colors[c.buildQueue[0].name]}
									/>{#if c.buildQueue.length > 1}&nbsp;(+{c.buildQueue.length -
											1}){/if}{:else}∅{/if}</td
							>
							<td class="p-1"
								>{c.automation.enabled ? automationSummary(c.automation.settings) : 'off'}</td
							>
						</tr>
						<!-- second row: districts built and the buildings per zone -->
						<tr class="border-b border-gray-200 text-xs dark:border-gray-800">
							<td></td>
							<td class="p-1 pb-2" colspan="14">
								<DistrictSummary
									districts={c.districtList}
									names={data.names}
									colors={data.colors}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{:else if id === 'events'}
	<Events events={data.milestones} />
{:else if id === 'jobs'}
	<section>
		<h2 class="mb-2 text-xl font-semibold">Jobs</h2>
		<Jobs rows={data.empireJobs} explain={data.explain} />
	</section>
{:else if id === 'pop-resources'}
	<section>
		<h2 class="mb-2 text-xl font-semibold">Pops' resources per month</h2>
		<p class="mb-2 text-sm text-gray-500">
			What jobs produce and use, and what pops and buildings cost — the budget's planet and pop
			sources.
		</p>
		<Flows rows={budgetRows(data.latest.planetBudget ?? [])} />
	</section>
{:else if id === 'score'}
	{#if data.latest.score}<Score score={data.latest.score} />{/if}
{:else if id === 'leaders'}
	<Leaders leaders={data.latest.leaders ?? {}} idle={data.latest.idleLeaders ?? []} />
{:else if id === 'ships'}
	<Ships
		ships={data.latest.ships ?? []}
		fleets={data.latest.fleets ?? []}
		navalUsed={data.latest.navalUsed}
	/>
{:else if id === 'edicts'}
	<Edicts edicts={data.edicts} explain={data.explain} />
{:else if id === 'blockers'}
	<Blockers hints={data.blockerHints.hints} names={data.blockerHints.names} />
{:else if id === 'modifiers'}
	<Modifiers modifiers={data.modifiers} date={data.latest.date} explain={data.explain} />
{:else if id === 'sectors'}
	<Sectors sectors={data.latest.sectors ?? []} />
{:else if id === 'migration'}
	<Migration colonies={data.latest.colonies} node={data.isHead ? null : data.tip} />
{:else if id === 'automation'}
	<AutomationSummary
		defaults={data.latest.defaultAutomation ?? []}
		blocked={data.latest.automationBlocked ?? []}
	/>
{:else if id === 'traditions'}
	<Traditions trees={data.trees} perks={data.perks} explain={data.explain} />
{:else if id === 'fleet-movement'}
	<FleetMovement
		fleets={[
			...(data.latest.fleets ?? []).map((f) => ({
				name: f.name,
				kind: 'military',
				route: f.route
			})),
			...(data.latest.civilianShips ?? []).map((s) => ({
				name: s.name,
				kind: s.kind.replaceAll('_', ' '),
				route: s.route
			}))
		]}
	/>
{:else if id === 'civilian-ships'}
	<CivilianShips
		ships={data.latest.civilianShips ?? []}
		totals={data.shipTotals}
		due={Object.fromEntries(
			data.upcoming.flatMap((e) =>
				e.fleetId !== undefined ? [[e.fleetId, (e.exact ? '' : '≈ ') + e.date]] : []
			)
		)}
	/>
{:else if id === 'starbases'}
	<Starbases stations={data.latest.stations ?? []} date={data.latest.date} />
{:else if id === 'shipyards'}
	<Shipyards
		stations={data.latest.stations ?? []}
		megas={data.latest.megaShipyards ?? []}
		researched={data.latest.progress?.researched ?? []}
		date={data.latest.date}
	/>
{:else if id === 'research-tiers'}
	<ResearchTiers tiers={data.tiers} />
{:else if id === 'government'}
	<Government government={data.government} explain={data.explain} />
{:else if id === 'species'}
	<SpeciesPanel species={data.species} explain={data.explain} />
{:else if id === 'expansion'}
	<Expansion planets={data.expansion} date={data.latest.date} />
{/if}

{#snippet progress(e: (typeof events)[number])}
	<span
		style:color={colorOf(e.tint)}
		title="{e.what}: {fmt(e.done!)} / {fmt(e.total!)}, ≈ {e.date}"
	>
		{headerLabel(e)} <b>{percent(e)}</b> ≈ {Math.round(e.months)} mo
	</span>
{/snippet}
