<script lang="ts">
	import { colorOf } from '#lib/colors.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import ResourceChips from '#lib/ResourceChips.svelte';
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
</script>

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
				<table class="text-sm">
					<thead>
						<tr class="text-left text-gray-500">
							<th class="pr-3">Colony</th>
							<th class="pr-3">Designation</th>
							{#each resources as r (r)}<th class="px-2 text-right" style:color={colorOf(r)}
									>{pretty(r)}</th
								>{/each}
							<th class="pl-3">Best at</th>
						</tr>
					</thead>
					<tbody>
						{#each e.colonies as c (c.planetId)}
							<tr class="border-t border-gray-200 dark:border-gray-800">
								<td class="pr-3" title={c.jobs.map((j) => data.jobNames[j] ?? j).join(', ')}
									>{c.name}</td
								>
								<td class="pr-3 text-gray-500">{pretty(c.designation.replace(/^col_/, ''))}</td>
								{#each resources as r (r)}
									<td
										class="px-2 text-right tabular-nums {c.ratio[r] === undefined
											? ''
											: tone(c.ratio[r])} {best[r] === c.planetId ? 'font-bold' : ''}"
										title={c.ratio[r] === undefined
											? ''
											: `${fmt(c.actual[r] ?? 0)} made, ${fmt(c.expected[r])} at the empire's mean`}
										>{c.ratio[r] === undefined ? '' : `${Math.round(c.ratio[r] * 100)} %`}</td
									>
								{/each}
								<td class="pl-3">
									{#each bestAt(c.planetId) as r (r)}<span class="mr-2" style:color={colorOf(r)}
											>{pretty(r)}</span
										>{/each}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
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
						<table class="w-full text-sm">
							<tbody>
								{#each g.sources as s (s.source.id)}
									<tr class="border-t border-gray-200 dark:border-gray-800">
										<td class="pr-2"
											>{s.source.label}{#if s.source.pops}<span class="text-xs text-gray-500">
													· {fmt(s.source.pops)} pops</span
												>{/if}</td
										>
										<td class="pr-2 text-right tabular-nums">{fmt(s.amount)}/mo</td>
										<td class="pr-2"><ResourceChips flows={neg(s.source.uses)} /></td>
										<td
											class="text-right tabular-nums {g.market !== null && s.perUnit < g.market
												? 'text-green-600'
												: ''}">{fmt(s.perUnit)}</td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/each}
			</div>
		</Panel>
	</div>
{/if}
