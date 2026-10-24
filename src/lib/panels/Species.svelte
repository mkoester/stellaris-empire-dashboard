<script lang="ts">
	import { fmt } from '../format.ts';
	import InfoPopup from '../InfoPopup.svelte';
	import type { TraitBudget } from '../species.ts';
	import SortTable from '../SortTable.svelte';
	import type { Column } from '../sort.ts';
	import type { Explanation } from '../types.ts';
	import Panel from './Panel.svelte';

	type Row = {
		id: string;
		name: string;
		className: string;
		pops: number;
		traits: { key: string; name: string }[];
		budget: TraitBudget | null;
	};
	let { species, explain = {} }: { species: Row[]; explain?: Record<string, Explanation> } =
		$props();
	const columns: Column<Row>[] = [
		{ id: 'name', label: 'Species', value: (s) => s.name },
		{ id: 'class', label: 'Class', value: (s) => s.className, cell: cls },
		{ id: 'pops', label: 'Pops', value: (s) => s.pops, cell: pops, right: true },
		{ id: 'traits', label: 'Traits', value: (s) => s.traits.length, cell: traits },
		{
			id: 'points',
			label: 'Points left',
			value: (s) => s.budget?.points ?? null,
			cell: points,
			right: true
		},
		{
			id: 'picks',
			label: 'Picks left',
			value: (s) => s.budget?.picks ?? null,
			cell: picks,
			right: true
		}
	];
</script>

{#snippet cls(s: Row)}<span class="text-gray-500">{s.className}</span>{/snippet}
{#snippet pops(s: Row)}{fmt(s.pops)}{/snippet}
{#snippet traits(s: Row)}{#each s.traits as t, i (t.key)}{i ? ', ' : ''}<InfoPopup
			explanation={explain[`trait:${t.key}`]}>{t.name}</InfoPopup
		>{/each}{/snippet}
{#snippet points(s: Row)}{s.budget ? `${s.budget.points} / ${s.budget.maxPoints}` : '?'}{/snippet}
{#snippet picks(s: Row)}{s.budget ? `${s.budget.picks} / ${s.budget.maxPicks}` : '?'}{/snippet}

<Panel
	title="Species"
	note="Trait points and picks left from the archetype's base budget; techs that raise it are not included."
>
	<SortTable rows={species} {columns} key={(s) => s.id} sort={{ column: 'pops', desc: true }} />
</Panel>
