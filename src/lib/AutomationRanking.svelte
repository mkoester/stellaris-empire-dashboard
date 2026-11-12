<script lang="ts">
	import { resolve } from '$app/paths';
	import AutomationLine from './AutomationLine.svelte';
	import { fmt } from './format.ts';
	import { perEnergy } from './jobAutomation.ts';
	import type { AutomationRank } from './server/whatIfs.ts';
	import SortTable from './SortTable.svelte';
	import type { Column } from './sort.ts';

	// Where an automation building takes over or adds the most workforce per energy a month, over
	// every colony (⚙ What-ifs, a spoiler; #lib/jobAutomation.ts). ≈ throughout.
	let { rows, node }: { rows: AutomationRank[]; node: number | null } = $props();

	const href = (planetId: number) =>
		node === null
			? resolve('/colony/[id]', { id: String(planetId) })
			: resolve(`/colony/[id]?node=${node}`, { id: String(planetId) });
	const columns: Column<AutomationRank>[] = [
		{ id: 'colony', label: 'Colony', value: (r) => r.colony, cell: colonyCell },
		{
			id: 'workforce',
			label: 'Workforce',
			title: 'freed for other jobs plus open positions filled',
			value: (r) => r.option.freed + r.option.filled,
			right: true
		},
		{
			id: 'energy',
			label: 'Energy / month',
			title: 'the building’s upkeep plus each automated job’s',
			value: (r) => r.option.upkeep.energy ?? 0,
			right: true
		},
		{
			id: 'per',
			label: 'Per energy',
			value: (r) => perEnergy(r.option),
			cell: perCell,
			right: true
		},
		{ id: 'what', label: 'What-if', value: (r) => r.option.name, cell: whatCell }
	];
</script>

{#snippet colonyCell(r: AutomationRank)}<a class="underline" href={href(r.planetId)}>{r.colony}</a
	>{/snippet}
{#snippet perCell(r: AutomationRank)}{fmt(perEnergy(r.option))}{/snippet}
{#snippet whatCell(r: AutomationRank)}<AutomationLine o={r.option} />{/snippet}

{#if rows.length}
	<section class="mt-6">
		<h2 class="mb-1 text-lg font-semibold">Where district automation pays most</h2>
		<p class="mb-1 text-xs text-gray-500">
			≈ the next automation building per colony and job line the empire can build now, by workforce
			taken over or added per energy a month; free building slots unknown.
		</p>
		<SortTable
			{rows}
			{columns}
			key={(r) => `${r.planetId}:${r.option.key}`}
			sort={{ column: '', desc: false }}
		/>
	</section>
{/if}
