<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Designation from '#lib/Designation.svelte';
	import { fmt } from '#lib/format.ts';
	import { GROWTH_CAP, type GrowthRow } from '#lib/growth.ts';
	import { projectColony } from '#lib/growthProjection.ts';
	import GrowthProjection from '#lib/GrowthProjection.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const node = $derived(page.url.searchParams.get('node'));
	const href = (planetId: number) =>
		node === null
			? resolve('/colony/[id]', { id: String(planetId) })
			: resolve(`/colony/[id]?node=${node}`, { id: String(planetId) });
	let sort = $state({ column: 'growth', desc: true });

	const pct = (v: number | null) => (v === null ? '' : `${Math.round(v * 100)} %`);

	// The projection per colony over the horizon the chart's buttons pick (years).
	let years = $state(25);
	const months = $derived(years * 12);
	const projections = $derived(
		new Map(data.rows.map((r) => [r.planetId, projectColony(r, months, data.defines)]))
	);
	const later = (r: GrowthRow) => projections.get(r.planetId)?.pops[months] ?? null;
	const stops = (r: GrowthRow) => projections.get(r.planetId)?.stopsAt ?? null;
	const yearsOf = (m: number) => (m < 24 ? `${m} mo` : `${Math.round(m / 12)} y`);

	const columns: Column<GrowthRow>[] = $derived([
		{ id: 'name', label: 'Colony', value: (r) => r.name, cell: name },
		{
			id: 'designation',
			label: 'Designation',
			value: (r) => r.designation,
			cell: designation
		},
		{ id: 'pops', label: 'Pops', value: (r) => r.pops, right: true, cell: pops },
		{
			id: 'growth',
			label: 'Growth/mo',
			value: (r) => r.growth,
			right: true,
			cell: growth,
			title: `natural growth, the mean of the last saves (fractions are a chance in game); at most ${GROWTH_CAP}`
		},
		{
			id: 'assembly',
			label: 'Assembly/mo',
			value: (r) => r.assembly,
			right: true,
			cell: assembly,
			title:
				'pops assembled per month (a machine empire’s Replicators, robot assembly), the mean of the last saves — a machine world has no natural growth'
		},
		{
			id: 'per100',
			label: 'Months per 100',
			value: (r) => r.monthsPer100,
			right: true,
			cell: per100
		},
		{
			id: 'housing',
			label: 'Housing used',
			value: (r) => (r.housing && r.housingUsed !== null ? r.housingUsed / r.housing : null),
			right: true,
			cell: housing,
			title:
				'housing used of the total — capacity is this housing plus room from undeveloped districts'
		},
		{
			id: 'capacity',
			label: 'Capacity',
			value: (r) => r.capacity,
			right: true,
			cell: capacity,
			title:
				"the game's planet capacity: housing + 400 per free district slot (normal planets); growth is fastest at half of it"
		},
		{
			id: 'free',
			label: 'Free districts',
			value: (r) => r.free,
			right: true,
			cell: free,
			title:
				'district slots still free, queued districts counted as taken — each adds 400 capacity; + more behind blockers'
		},
		{
			id: 'hab',
			label: 'Hab.',
			value: (r) => r.habitability,
			right: true,
			cell: hab,
			title: 'habitability: below 100 % slows growth (it does not change the capacity)'
		},
		{
			id: 'later',
			label: `Pops in ${years} y`,
			value: later,
			right: true,
			cell: laterCell,
			title: 'projected: logistic growth at the measured speed plus assembly, today’s housing'
		},
		{
			id: 'stops',
			label: 'Stops in',
			value: stops,
			right: true,
			cell: stopsCell,
			title: 'when growth and assembly stop: overcrowded at 1.15 × today’s housing'
		},
		{ id: 'flags', label: 'Notes', value: (r) => r.flags.join(', '), cell: flags }
	]);
</script>

{#snippet name(r: GrowthRow)}<a class="hover:underline" href={href(r.planetId)}>{r.name}</a
	>{/snippet}
{#snippet designation(r: GrowthRow)}<span class="text-gray-500"
		><Designation key={r.designation} /></span
	>{/snippet}
{#snippet pops(r: GrowthRow)}{fmt(r.pops)}{/snippet}
{#snippet growth(r: GrowthRow)}{#if r.growth !== null}<span
			title="{r.samples} saves; latest {r.last ?? '–'}">{fmt(r.growth)}</span
		>{/if}{/snippet}
{#snippet assembly(r: GrowthRow)}{r.assembly === null ? '' : fmt(r.assembly)}{/snippet}
{#snippet per100(r: GrowthRow)}{r.monthsPer100 === null ? '' : fmt(r.monthsPer100)}{/snippet}
{#snippet housing(r: GrowthRow)}{#if r.housing !== null && r.housingUsed !== null}<span
			title="{fmt(r.housingUsed)} of {fmt(r.housing)}">{pct(r.housingUsed / r.housing)}</span
		>{/if}{/snippet}
{#snippet capacity(r: GrowthRow)}{#if r.capacity !== null}<span
			title="{fmt(r.housing ?? 0)} housing + {r.free} × 400{r.queued
				? ` (${r.queued} queued district${r.queued > 1 ? 's' : ''} counted as taken)`
				: ''}">{fmt(r.capacity)}</span
		>{/if}{/snippet}
{#snippet free(r: GrowthRow)}{r.free ?? ''}{#if r.blocked}<span class="text-gray-500">
			(+{r.blocked})</span
		>{/if}{/snippet}
{#snippet hab(r: GrowthRow)}{pct(r.habitability)}{/snippet}
{#snippet laterCell(r: GrowthRow)}{@const p = later(r)}{p === null ? '' : fmt(p)}{/snippet}
{#snippet stopsCell(r: GrowthRow)}{@const m = stops(r)}{m === null ? '' : yearsOf(m)}{/snippet}
{#snippet flags(r: GrowthRow)}<span class="text-xs">{r.flags.join(' · ')}</span>{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Pop growth</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<div class="flex flex-col gap-6">
	<Panel
		title="Projection"
		note="Biological growth follows the game's logistic rule at each colony's measured speed (so habitability, traits and every other modifier count): fastest at half the planet capacity, never under 10 % of it, at most {GROWTH_CAP} a month. Assembly (machines, robots) goes on at its measured rate. Both stop once the colony is overcrowded (1.15 × housing). Held at today's values: housing, capacity, districts and modifiers. Not modelled: new colonies, migration, new districts and buildings, techs — so this is what the colonies do if nothing changes."
	>
		<GrowthProjection
			rows={data.rows}
			defines={data.defines}
			date={data.growthDate ?? data.latest.date}
			bind:years
		/>
	</Panel>
	<Panel
		title="Growth per colony"
		note="Measured: natural growth per month, the mean of the colony's last saves (pop units; fractions are a chance in game). The game's rule (wiki, 4.5): 1/400 × (pops − pops² / planet capacity − 1), all species together at most {GROWTH_CAP}, times the species' growth speed — slow in a small colony, fastest at half the capacity, slow again near it. Planet capacity (not in the save) is housing + 400 per free district slot on normal planets; a queued district takes its slot at once, long before its housing arrives — queue districts just in time. More housing or free districts raise it; a colony at the cap gains nothing from more.{data.housingKnown
			? ''
			: ' Housing shows from the next save on.'}"
	>
		<SortTable rows={data.rows} {columns} key={(r) => r.planetId} bind:sort />
	</Panel>
</div>
