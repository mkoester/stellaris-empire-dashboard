<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ContractMarks from '#lib/ContractMarks.svelte';
	import EmpireName from '#lib/EmpireName.svelte';
	import GalaxyMap from '#lib/GalaxyMap.svelte';
	import {
		branchLine,
		COLONY_SUPPORT,
		CONTRACT_RANGES,
		KIND_INFO,
		WHY_LABEL
	} from '#lib/contracts.ts';
	import { followGame } from '#lib/live.ts';
	import type { MapWidth } from '#lib/mapView.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import { putSettings } from '#lib/settings.ts';
	import type { Column } from '#lib/sort.ts';
	import { fmt } from '#lib/format.ts';

	let { data } = $props();
	followGame(() => data.isHead);
	let width: MapWidth = $state('normal');
	let hovered: number | null = $state(null);

	type Row = (typeof data.contracts.rows)[number];
	const c = $derived(data.contracts);
	const byId = $derived(new Map(data.systems.map((s) => [s.id, s])));
	const system = (r: Row) =>
		r.systemId === null ? null : (c.systemNames[r.systemId] ?? `system ${r.systemId}`);
	// the range decides which rows the server sends: store it, then load again
	const setRange = async (range: string) => {
		await putSettings({ contractView: { range } });
		await invalidateAll();
	};
	let sort = $state({ column: '', desc: false }); // ours first, then by days left

	const word = (k: string) => k.replaceAll('_', ' ');
	const nearest = (r: Row) => (r.detail.needsArkship ? (r.detail.arkships[0] ?? null) : null);
	const work = (r: Row) => {
		const days = [...new Set(r.detail.projects.map((p) => p.days).filter((d) => d !== null))];
		return days.length === 1 && r.detail.steps ? r.detail.steps * (days[0] as number) : null;
	};
	const APPROX =
		'≈ at least: +10 % per contract you completed is counted; traditions, authority or leader traits that raise contract rewards (nomadic_contract_value_mult) are not';

	const columns: Column<Row>[] = [
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
		{
			id: 'reward',
			label: 'Reward',
			value: (r) => r.detail.trade,
			cell: rewardCell,
			right: true,
			title: 'what a full success pays, in trade'
		},
		{
			id: 'work',
			label: 'Work',
			value: work,
			cell: workCell,
			right: true,
			title: 'steps × days of each project, travel not counted'
		},
		{
			id: 'arkship',
			label: 'Nearest arkship',
			value: (r) => nearest(r)?.jumps ?? null,
			cell: arkshipCell,
			title: 'jumps along known hyperlanes from our nearest arkship'
		},
		{ id: 'why', label: 'Shown', value: (r) => r.why, cell: whyCell }
	];
</script>

{#snippet nameCell(r: Row)}{r.name}{#if r.internal}<span class="text-gray-500">
			· internal</span
		>{/if}{#if r.special}<span class="text-gray-500"> · special</span>{/if}{/snippet}
{#snippet kindCell(r: Row)}<span style:color={KIND_INFO[r.kind].color}
		>{KIND_INFO[r.kind].symbol}</span
	>{` ${r.kind}`}{/snippet}
{#snippet issuerCell(r: Row)}<EmpireName name={r.issuerName} />{/snippet}
{#snippet operatorCell(r: Row)}{#if r.operatorName}<EmpireName name={r.operatorName} />{:else}<span
			class="text-gray-500">–</span
		>{/if}{/snippet}
{#snippet stateCell(r: Row)}{#if r.state === 'offered'}offered{r.daysLeft === null
			? ''
			: `, ${r.daysLeft} days`}{:else}taken{r.accepted ? ` ${r.accepted}` : ''}{/if}{/snippet}
{#snippet whyCell(r: Row)}<span
		class={r.why === 'spoiler'
			? 'text-amber-600'
			: r.why === 'cheat'
				? 'text-red-600'
				: 'text-gray-500'}>{WHY_LABEL[r.why]}</span
	>{/snippet}

{#snippet rewardCell(r: Row)}{#if r.detail.trade !== null}<span title={APPROX}
			>≈{r.detail.trade.toFixed(2)}</span
		>{:else}<span class="text-gray-500">–</span>{/if}{/snippet}
{#snippet workCell(r: Row)}{#if work(r) !== null}{work(r)} days{:else if r.detail.steps}{r.detail
			.steps} steps{:else}<span class="text-gray-500">–</span>{/if}{/snippet}
{#snippet arkshipCell(r: Row)}{#if !r.detail.needsArkship}<span class="text-gray-500"
			>no arkship needed</span
		>{:else if nearest(r)}{nearest(r)?.name}{nearest(r)?.jumps === null
			? ' · no known route'
			: ` · ${nearest(r)?.jumps} jumps`}{:else}<span class="text-gray-500">none</span
		>{/if}{/snippet}
{#snippet details(r: Row)}
	{@const d = r.detail}
	<details class="text-sm">
		<summary class="cursor-pointer text-gray-500">details</summary>
		{#if !d.detailed}
			<p class="mt-1 text-amber-600">
				This data DB has no contract details yet: they come with the extractor of 2026-11-18.
			</p>
		{:else}
			<dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
				<dt class="text-gray-500">What to do</dt>
				<dd>
					{d.description ?? '–'}
					{#each d.projects as p (p.key)}<div>
							{p.name}: {p.days ?? '?'} days, needs {p.needs.join(', ') || 'nothing named'}
						</div>
						{#if p.arkshipBranches}<div
								class="text-gray-500"
								title={(['science', 'military', 'civilian'] as const)
									.map((k) => `${k}: ${COLONY_SUPPORT[k]}`)
									.join('\n')}
							>
								{branchLine(d.arkships)}
							</div>{/if}{/each}
					{#if d.steps && d.steps > 1}<div>{d.steps} steps, one project each</div>{/if}
					{#if d.missingTechs.length}<div class="text-amber-600">
							needs {d.missingTechs.join(', ')}, not researched
						</div>{/if}
				</dd>
				<dt class="text-gray-500">Reward</dt>
				<dd>
					{#if d.reward.length}<span title={APPROX}
							>{d.reward
								.map((l) => `${l.scaled ? '≈' : ''}${fmt(l.amount)} ${word(l.resource)}`)
								.join(' + ')}</span
						>{d.trust ? ` · +${d.trust} trust` : ''}{d.opinion
							? ` · +${d.opinion} opinion`
							: ''}{#if d.partial.length}<div class="text-gray-500">
								partial success: {d.partial
									.map((l) => `${fmt(l.amount)} ${word(l.resource)}`)
									.join(' + ')}
							</div>{/if}
					{:else}–{/if}
				</dd>
				<dt class="text-gray-500">Cost / risk</dt>
				<dd>
					No resources: the arkship is busy for the trip and the work.{d.timeToComplete
						? ` ${d.timeToComplete} days to finish once accepted.`
						: ''}{d.failedOpinion !== null
						? ` Failing or cancelling: ${d.failedOpinion} opinion with ${r.issuerName}.`
						: ''}
				</dd>
				<dt class="text-gray-500">Your arkships</dt>
				<dd>
					{#if !d.needsArkship}Not an arkship's job (see what to do).
					{:else if !d.arkships.length}None.
					{:else}{d.arkships
							.map(
								(a) =>
									`${a.name} (${a.kind}${a.capital ? ', capital' : ''}): ${a.jumps === null ? 'no known route' : `${a.jumps} jumps`}`
							)
							.join(' · ')}{/if}
					<div class="text-gray-500">Jumps only: how many days a jump takes is not read yet.</div>
				</dd>
			</dl>
		{/if}
	</details>
{/snippet}

{#snippet table()}
	<SortTable
		rows={c.rows}
		{columns}
		key={(r) => r.id}
		bind:sort
		link={(r) => r.systemId}
		bind:hovered
		below={details}
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
