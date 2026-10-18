<script lang="ts">
	import { colorOf } from '#lib/colors.ts';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import ResearchTiers from '#lib/panels/ResearchTiers.svelte';
	import { AREAS } from '#lib/techTiers.ts';

	let { data } = $props();
	followGame(() => data.isHead);
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Technology</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<div class="grid gap-8 lg:grid-cols-2">
	<Panel
		title="Researching"
		note="Costs are base costs; the due date comes from the measured rate."
	>
		<table class="text-left text-sm">
			<tbody>
				{#each data.queues as q (q.area)}
					<tr class="border-b border-gray-100 dark:border-gray-900">
						<td class="p-1" style:color={colorOf(`${q.area}_research`)}>{q.area}</td>
						<td class="p-1"
							><InfoPopup explanation={data.explain[`tech:${q.key}`]}>{q.name}</InfoPopup></td
						>
						<td class="p-1 text-gray-500">{q.tier !== null ? `T${q.tier}` : ''}</td>
						<td class="p-1 text-right tabular-nums"
							>{Math.round(q.progress)}{q.cost ? ` / ${q.cost}` : ''}</td
						>
						<td class="p-1 text-gray-500">{q.due ? `due ${q.due.date}` : ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</Panel>

	<Panel title="On offer" note="The cards the game offers next, per field.">
		<table class="text-left text-sm">
			<tbody>
				{#each AREAS as area (area)}
					<tr class="align-top">
						<td class="p-1 pr-3" style:color={colorOf(`${area}_research`)}>{area}</td>
						<td class="p-1">
							{#each data.options[area] ?? [] as t, i (t.key)}{i ? ' · ' : ''}<InfoPopup
									explanation={data.explain[`tech:${t.key}`]}>{t.name}</InfoPopup
								><span class="text-gray-500">{t.tier !== null ? ` T${t.tier}` : ''}</span>{/each}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</Panel>

	<ResearchTiers tiers={data.tiers} />

	<Panel title="Researched ({data.researched.length})">
		{#each AREAS as area (area)}
			<div class="mb-2 text-sm">
				<span style:color={colorOf(`${area}_research`)}>{area}:</span>
				{#each data.researched.filter((t) => t.area === area) as t, i (t.key)}{i
						? ' · '
						: ''}<InfoPopup explanation={data.explain[`tech:${t.key}`]}>{t.name}</InfoPopup>{/each}
			</div>
		{/each}
	</Panel>
</div>
