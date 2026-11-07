<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ContractMarks from '#lib/ContractMarks.svelte';
	import EmpireName from '#lib/EmpireName.svelte';
	import GalaxyMap from '#lib/GalaxyMap.svelte';
	import { CONTRACT_RANGES, KIND_INFO, WHY_LABEL, type ContractRow } from '#lib/contracts.ts';
	import { followGame } from '#lib/live.ts';
	import type { MapWidth } from '#lib/mapView.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import { putSettings } from '#lib/settings.ts';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);
	let width: MapWidth = $state('normal');
	let hovered: number | null = $state(null);

	const c = $derived(data.contracts);
	const byId = $derived(new Map(data.systems.map((s) => [s.id, s])));
	const system = (r: ContractRow) =>
		r.systemId === null ? null : (c.systemNames[r.systemId] ?? `system ${r.systemId}`);
	// the range decides which rows the server sends: store it, then load again
	const setRange = async (range: string) => {
		await putSettings({ contractView: { range } });
		await invalidateAll();
	};
	let sort = $state({ column: '', desc: false }); // ours first, then by days left

	const columns: Column<ContractRow>[] = [
		{ id: 'name', label: 'Contract', value: (r) => r.name, cell: nameCell },
		{ id: 'kind', label: 'Kind', value: (r) => r.kind, cell: kindCell },
		{ id: 'issuer', label: 'Issuer', value: (r) => r.issuerName, cell: issuerCell },
		{ id: 'operator', label: 'Taken by', value: (r) => r.operatorName, cell: operatorCell },
		{ id: 'system', label: 'System', value: system },
		{
			id: 'jumps',
			label: 'Beyond',
			value: (r) => r.jumps,
			right: true,
			title: 'jumps beyond our border, along known hyperlanes'
		},
		{
			id: 'state',
			label: 'State',
			value: (r) => (r.state === 'offered' ? (r.daysLeft ?? 0) : -1),
			cell: stateCell,
			title: 'offered: days left to accept; taken: since when'
		},
		{ id: 'why', label: 'Shown', value: (r) => r.why, cell: whyCell }
	];
</script>

{#snippet nameCell(r: ContractRow)}{r.name}{#if r.internal}<span class="text-gray-500">
			· internal</span
		>{/if}{#if r.special}<span class="text-gray-500"> · special</span>{/if}{/snippet}
{#snippet kindCell(r: ContractRow)}<span style:color={KIND_INFO[r.kind].color}
		>{KIND_INFO[r.kind].symbol}</span
	>{` ${r.kind}`}{/snippet}
{#snippet issuerCell(r: ContractRow)}<EmpireName name={r.issuerName} />{/snippet}
{#snippet operatorCell(r: ContractRow)}{#if r.operatorName}<EmpireName
			name={r.operatorName}
		/>{:else}<span class="text-gray-500">–</span>{/if}{/snippet}
{#snippet stateCell(r: ContractRow)}{#if r.state === 'offered'}offered{r.daysLeft === null
			? ''
			: `, ${r.daysLeft} days`}{:else}taken{r.accepted ? ` ${r.accepted}` : ''}{/if}{/snippet}
{#snippet whyCell(r: ContractRow)}<span
		class={r.why === 'spoiler'
			? 'text-amber-600'
			: r.why === 'cheat'
				? 'text-red-600'
				: 'text-gray-500'}>{WHY_LABEL[r.why]}</span
	>{/snippet}

{#snippet table()}
	<SortTable
		rows={c.rows}
		{columns}
		key={(r) => r.id}
		bind:sort
		link={(r) => r.systemId}
		bind:hovered
	/>
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Contracts</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !c.known}
	<p class="mb-4 text-sm text-amber-600">
		No contracts read yet: they fill after the next save (or a dashboard restart reads the saves on
		disk again).
	</p>
{:else}
	<p class="mb-4 max-w-4xl text-sm text-gray-600 dark:text-gray-400">
		{#if c.nomadic}
			As a nomad you see the contracts you took and the offers of empires you have communications
			with (an empire needs that to issue contracts to you).{data.spoilers
				? ' With the spoiler on: offers of empires you do not talk to.'
				: ''}
		{:else}
			You see the contracts you issued.{data.spoilers
				? ' With the spoiler on: other empires’ contracts within the range beyond your border.'
				: ''} Whether the game shows a settled empire other empires’ contracts is not checked yet.
		{/if}
		{data.all ? ' Cheat on: every contract in the galaxy.' : ''} Who may accept an offer (the game’s own
		conditions) is not in the save. As of {c.date}.
	</p>
{/if}

{#if c.known && !c.nomadic && data.spoilers && !data.all}
	<div class="mb-4 text-sm">
		<label class="flex items-center gap-1"
			>others’ contracts
			<select
				class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
				value={c.range}
				onchange={(e) => void setRange(e.currentTarget.value)}
			>
				{#each CONTRACT_RANGES as r (r)}<option value={r}
						>{r === 'mine'
							? 'in my systems'
							: r === 'all'
								? 'anywhere'
								: `up to +${r} beyond the border`}</option
					>{/each}
			</select></label
		>
	</div>
{/if}

<div class="flex flex-col gap-6">
	<Panel
		title="Contracts ({c.rows.length})"
		note="Symbols are ours: ⚔ military, ⚗ science, ⚒ resource, ⚖ diplomacy, ¤ other. A contract in a system not yet discovered is in the table, not on the map."
	>
		<GalaxyMap
			systems={data.systems}
			focus={[
				{
					label: 'contracts',
					points: data.marks.flatMap((m) => byId.get(m.systemId) ?? [])
				}
			]}
			heightKey="contracts-map-height"
			label="Contracts"
			territories={data.territories}
			bind:hovered
			bind:width
			beside={table}
		>
			{#snippet layer(at)}
				<ContractMarks marks={data.marks} {at} place={byId} />
			{/snippet}
		</GalaxyMap>
		{#if width !== 'side'}<div class="mt-3">{@render table()}</div>{/if}
	</Panel>
</div>
