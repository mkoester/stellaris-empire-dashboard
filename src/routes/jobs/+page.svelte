<script lang="ts">
	import { colorOf } from '#lib/colors.ts';
	import Designation from '#lib/Designation.svelte';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import ResourceChips from '#lib/ResourceChips.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import { byTopBar } from '#lib/resourceGroups.ts';
	import { marketValue } from '#lib/unitCosts.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const e = $derived(data.economy);
	const neg = (r: Record<string, number>) =>
		Object.fromEntries(Object.entries(r).map(([k, v]) => [k, -v]));

	// per resource, its sources cheapest first
	const byResource = $derived(
		e
			? [...new Set(e.costs.map((c) => c.resource))].sort(byTopBar).map((resource) => ({
					resource,
					value: e.values[resource] ?? null,
					market: marketValue(resource),
					sources: e.costs
						.filter((c) => c.resource === resource)
						.sort((a, b) => a.perUnit - b.perUnit)
				}))
			: []
	);

	// colonies × resources: the resources some colony's jobs make, and per resource the best colony
	const resources = $derived(
		e ? [...new Set(e.colonies.flatMap((c) => Object.keys(c.ratio)))].sort(byTopBar) : []
	);
	const best = $derived(
		Object.fromEntries(
			resources.map((r) => {
				const ranked = (e?.colonies ?? [])
					.filter((c) => c.ratio[r] !== undefined && c.expected[r] >= 1)
					.sort((a, b) => b.ratio[r] - a.ratio[r]);
				return [r, ranked[0]?.planetId ?? null];
			})
		)
	);
	const tone = (ratio: number) =>
		ratio >= 1.1 ? 'text-green-600' : ratio <= 0.9 ? 'text-red-600' : '';
	const bestAt = (planetId: number) => resources.filter((r) => best[r] === planetId);

	type ColonyRow = NonNullable<typeof e>['colonies'][number];
	const colonyColumns: Column<ColonyRow>[] = $derived([
		{ id: 'name', label: 'Colony', value: (c) => c.name, cell: colonyName },
		{
			id: 'designation',
			label: 'Designation',
			value: (c) => pretty(c.designation),
			cell: designation
		},
		...resources.map((r) => ({
			id: r,
			label: pretty(r),
			color: colorOf(r) ?? undefined,
			value: (c: ColonyRow) => c.ratio[r] ?? null,
			cell: ratio,
			right: true
		})),
		{
			id: 'best',
			label: 'Best at',
			value: (c) => bestAt(c.planetId).length || null,
			cell: bestCell
		}
	]);
	type Source = NonNullable<typeof e>['costs'][number];
	const sourceColumns = (market: number | null): Column<Source>[] => [
		{ id: 'source', label: 'Source', value: (s) => s.source.label, cell: sourceName },
		{ id: 'amount', label: 'Made', value: (s) => s.amount, cell: amount, right: true },
		{
			id: 'uses',
			label: 'Uses',
			value: (s) => Object.keys(s.source.uses).length || null,
			cell: uses
		},
		{
			id: 'perUnit',
			label: 'Per unit',
			value: (s) => s.perUnit,
			cell: market === null ? perUnit : perUnitMarket,
			right: true,
			title: 'trade per unit'
		}
	];
	const marketOf = (s: Source) => marketValue(s.resource);
</script>

{#snippet colonyName(c: ColonyRow)}<span title={c.jobs.map((j) => data.jobNames[j] ?? j).join(', ')}
		>{c.name}</span
	>{/snippet}
{#snippet designation(c: ColonyRow)}<span class="text-gray-500"
		><Designation key={c.designation} /></span
	>{/snippet}
{#snippet ratio(c: ColonyRow, r: string)}{#if c.ratio[r] !== undefined}<span
			class="{tone(c.ratio[r])} {best[r] === c.planetId ? 'font-bold' : ''}"
			title="{fmt(c.actual[r] ?? 0)} made, {fmt(c.expected[r])} at the empire's mean"
			>{Math.round(c.ratio[r] * 100)} %</span
		>{/if}{/snippet}
{#snippet bestCell(c: ColonyRow)}{#each bestAt(c.planetId) as r (r)}<span
			class="mr-2"
			style:color={colorOf(r)}>{pretty(r)}</span
		>{/each}{/snippet}
{#snippet sourceName(s: Source)}{s.source.label}{#if s.source.pops}<span
			class="text-xs text-gray-500"
		>
			· {fmt(s.source.pops)} pops</span
		>{/if}{/snippet}
{#snippet amount(s: Source)}{fmt(s.amount)}/mo{/snippet}
{#snippet uses(s: Source)}<ResourceChips flows={neg(s.source.uses)} />{/snippet}
{#snippet perUnit(s: Source)}{fmt(s.perUnit)}{/snippet}
{#snippet perUnitMarket(s: Source)}<span
		class={s.perUnit < (marketOf(s) ?? -Infinity) ? 'text-green-600' : ''}>{fmt(s.perUnit)}</span
	>{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Jobs</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !e}
	<p>No full save with a budget yet.</p>
{:else}
	<div class="flex flex-col gap-6">
		<Panel
			title="How well each colony works its jobs"
			note="As of {e.date}. Per colony and resource: what it makes against what its filled jobs make at the empire's mean per pop — 100 % is average; above it the colony's designation, features and buildings work for that resource, so its jobs for it belong there. A colony's output also counts flat building output, which reads as higher. Bold: the best colony for that resource (of those making at least 1 a month)."
		>
			<div class="overflow-x-auto">
				<SortTable
					rows={e.colonies}
					columns={colonyColumns}
					key={(c) => c.planetId}
					sort={{ column: '', desc: false }}
				/>
			</div>
		</Panel>

		<Panel
			title="What a unit costs us"
			note="Per resource, each source's running cost per unit: a job's inputs and its workers' upkeep (their stratum's upkeep per pop), a station's or module's upkeep, in trade — not what building it cost, nor building and district upkeep. A source making several resources splits its cost by their value. What the market sells is valued at its base price; everything else at the mean of what its sources cost per unit — the value the systems, produce and trade-offs tabs use."
		>
			<div class="grid gap-4 lg:grid-cols-2">
				{#each byResource as g (g.resource)}
					<div>
						<h2 class="mb-1 font-semibold">
							<span style:color={colorOf(g.resource)}>{pretty(g.resource)}</span>
							<span class="text-sm font-normal text-gray-500"
								>{#if g.market !== null}market {fmt(g.market)} trade per unit{:else}worth {fmt(
										g.value ?? 1
									)} trade per unit (what it costs us){/if}</span
							>
						</h2>
						<SortTable
							rows={g.sources}
							columns={sourceColumns(g.market)}
							key={(s) => s.source.id}
							sort={{ column: 'perUnit', desc: false }}
						/>
					</div>
				{/each}
			</div>
		</Panel>
	</div>
{/if}
