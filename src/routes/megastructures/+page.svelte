<script lang="ts">
	import GalaxyMap from '#lib/GalaxyMap.svelte';
	import { followGame } from '#lib/live.ts';
	import { scoreFill, type Candidate, type Kind } from '#lib/megastructures.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	let kind: Kind = $state('quantum_catapult');
	let range = $state('mine'); // mine | 0…5 jumps beyond the border | all
	let fitting = $state(true);

	const k = $derived(data.kinds.find((x) => x.kind === kind)!);
	const inRange = (r: Candidate) =>
		range === 'all'
			? true
			: range === 'mine'
				? r.owned
				: r.beyond !== null && r.beyond <= Number(range);
	const rows = $derived(k.rows.filter((r) => inRange(r) && (!fitting || r.ok !== false)));
	const fill = $derived(scoreFill(rows, k.lowerIsBetter ?? false));
	const titles = $derived(
		Object.fromEntries(
			rows.map((r) => [
				r.systemId,
				r.ok ? `${k.name}: ${r.score ?? '✓'} ${r.detail}` : r.why.join(', ')
			])
		)
	);
	const byId = $derived(new Map(data.systems.map((s) => [s.id, s])));
	// best first whenever the structure changes; the headers re-sort from there
	let sort = $derived({ column: 'score', desc: !(k.lowerIsBetter ?? false) });

	const columns: Column<Candidate>[] = $derived([
		{ id: 'name', label: 'System', value: (r) => r.name },
		{
			id: 'owner',
			label: 'Owner',
			value: (r) =>
				r.owned ? 'us' : r.ownerId === null ? null : (data.owners[r.ownerId] ?? String(r.ownerId)),
			title: 'the station’s owner, where visited'
		},
		{
			id: 'beyond',
			label: 'Beyond',
			value: (r) => r.beyond,
			right: true,
			title: 'jumps beyond our border'
		},
		{
			id: 'score',
			label: 'Score',
			value: (r) => r.score,
			right: true,
			cell: score,
			title: k.score
		},
		{
			id: 'detail',
			label: 'Detail',
			value: (r) => (r.ok ? r.detail : r.why.join(', ')),
			cell: detail
		},
		{
			id: 'centre',
			label: 'Centre',
			value: (r) => r.centre,
			right: true,
			title: 'distance from the galaxy’s centre'
		}
	]);
</script>

{#snippet score(r: Candidate)}{r.ok === null ? '?' : (r.score ?? (r.ok ? '✓' : '–'))}{/snippet}
{#snippet detail(r: Candidate)}
	<span class={r.ok ? '' : 'text-gray-500'}>{r.ok ? r.detail : r.why.join(', ')}</span
	>{#if r.existing.length}<span class="text-gray-500"> · here: {r.existing.join(', ')}</span>{/if}
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Megastructures</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !data.seenAt}
	<p class="mb-4 text-sm text-amber-600">No galaxy read yet; it fills after the next save.</p>
{/if}

<div class="mb-4 flex flex-wrap items-center gap-1 text-sm">
	{#each data.kinds as x (x.kind)}
		<button
			class="rounded border px-2 py-0.5 {x.kind === kind
				? 'border-blue-500 font-semibold'
				: 'border-gray-300 dark:border-gray-700'} {x.available ? '' : 'opacity-50'}"
			onclick={() => (kind = x.kind)}>{x.name}</button
		>
	{/each}
</div>

<div class="mb-4 flex flex-wrap items-center gap-4 text-sm">
	<label class="flex items-center gap-1"
		>systems
		<select
			class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
			bind:value={range}
		>
			<option value="mine">mine</option>
			{#each [0, 1, 2, 3, 5] as n (n)}<option value={String(n)}>up to +{n} beyond the border</option
				>{/each}
			<option value="all">all</option>
		</select></label
	>
	<label class="flex items-center gap-1"
		><input type="checkbox" bind:checked={fitting} /> fitting only (and unknown)</label
	>
	<span class="text-gray-500"
		>{rows.filter((r) => r.ok).length} fit, {rows.filter((r) => r.ok === null).length} unknown</span
	>
</div>

<div class="flex flex-col gap-6">
	<Panel
		title={k.name}
		note="Score: {k.score}{k.lowerIsBetter
			? ' — lower is better'
			: ' — higher is better'}. Rules from 4.5.2 common/megastructures/{k.file}; building needs the system inside your borders (and the tech).{k.available
			? ''
			: k.machineAge
				? ' Needs The Machine Age, which this save does not have.'
				: ' Not with The Machine Age (this save has it): it replaces the Dyson Sphere with the Swarm.'} ? = not visited, its bodies unknown."
	>
		<GalaxyMap
			systems={data.systems}
			{fill}
			{titles}
			focus={[
				{
					label: 'candidates',
					points: rows.filter((r) => r.ok).flatMap((r) => byId.get(r.systemId) ?? [])
				}
			]}
			heightKey="megastructure-map-height"
			label="{k.name} sites"
		/>
		<p class="mt-1 mb-3 text-xs text-gray-500">
			Darker blue: better score among the systems shown.
		</p>
		<SortTable {rows} {columns} key={(r) => r.systemId} bind:sort />
	</Panel>
</div>
