<script lang="ts">
	import {
		COST_MAX,
		EMPIRE_SIZE,
		INCOME_SCALE,
		officeValue,
		type SiteRow
	} from '#lib/branchOffices.ts';
	import EmpireName from '#lib/EmpireName.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import SubjectCards from '#lib/SubjectCards.svelte';
	import type { ExternalBuildings } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const fmt = (v: number) => (Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(1));
	const us = $derived(data.latest?.countryId ?? null);
	const ours = $derived((data.external ?? []).filter((e) => e.holderId === us));
	const onOurs = $derived((data.external ?? []).filter((e) => e.holderId !== us));
	const names = (e: ExternalBuildings) =>
		e.buildings.map((b) => data.buildingNames[b] ?? b).join(', ') || '—';

	// a candidate's row: only what can open now unless "all" is ticked
	let all = $state(false);
	const shown = $derived(data.sites.filter((r) => all || (r.pact && r.office === null)));
	let sort = $state({ column: 'perInfluence', desc: true });
	const siteColumns: Column<SiteRow>[] = [
		{ id: 'name', label: 'Colony', value: (r) => r.name },
		{ id: 'owner', label: 'Owner', value: (r) => r.owner, cell: owner },
		{
			id: 'pact',
			label: 'Pact',
			value: (r) => (r.pact ? 1 : 0),
			cell: pact,
			title: 'a commercial pact with the owner — the game needs one'
		},
		{ id: 'trade', label: 'Trade', value: (r) => r.trade, title: 'the colony’s trade a month' },
		{
			id: 'value',
			label: 'Value ≈',
			value: (r) => r.value,
			cell: value,
			title: `≈ ${INCOME_SCALE} × the colony’s trade, before modifiers`
		},
		{ id: 'jumps', label: 'Jumps', value: (r) => r.jumps, title: 'from our capital' },
		{
			id: 'cost',
			label: 'Influence ≈',
			value: (r) => r.cost,
			title: `≈ 75 + 5 a jump from our capital, at most ${COST_MAX}`
		},
		{
			id: 'perInfluence',
			label: 'Trade per 100 influence ≈',
			value: (r) => r.perInfluence,
			cell: per
		},
		{ id: 'office', label: 'Office there', value: (r) => r.office ?? '' }
	];
</script>

{#snippet owner(r: SiteRow)}<EmpireName name={r.owner} />{/snippet}
{#snippet pact(r: SiteRow)}{r.pact ? '✓' : ''}{/snippet}
{#snippet value(r: SiteRow)}≈ {fmt(r.value)}{/snippet}
{#snippet per(r: SiteRow)}{r.perInfluence === null ? '?' : `≈ ${fmt(r.perInfluence)}`}{/snippet}

<div class="space-y-6">
	<h1 class="text-xl font-semibold">Subjects and branch offices</h1>
	<p class="text-sm text-gray-500">At the save of {data.seenAt ?? '—'}.</p>

	<Panel title="Subject agreements">
		{#if data.subjects.length}
			<SubjectCards subjects={data.subjects} diploNames={data.diploNames} />
		{:else}
			<p class="text-sm text-gray-500">
				No subject agreement — we are no one's overlord or subject.
			</p>
		{/if}
	</Panel>

	{#if data.external === null}
		<p class="text-sm text-gray-500">
			Branch offices and holdings show once a save is read again by this dashboard version (saves
			still on disk are, at the next start).
		</p>
	{:else}
		<Panel title="Our branch offices and holdings">
			{#if ours.length}
				<table class="text-sm">
					<thead class="text-left text-gray-500">
						<tr
							><th class="pr-4">Colony</th><th class="pr-4">Owner</th><th class="pr-4">Kind</th><th
								class="pr-4">Buildings</th
							><th>Value ≈</th></tr
						>
					</thead>
					<tbody>
						{#each ours as e (e.colonyId + e.kind)}
							<tr class="border-t border-gray-100 dark:border-gray-800">
								<td class="pr-4">{e.name}</td>
								<td class="pr-4"><EmpireName name={e.owner} /></td>
								<td class="pr-4">{e.kind === 'corporate' ? 'branch office' : 'holding'}</td>
								<td class="pr-4">{names(e)}</td>
								<td title="≈ {INCOME_SCALE} × the colony’s trade"
									>{e.kind === 'corporate' && e.trade !== null
										? `≈ ${fmt(officeValue(e.trade))} trade`
										: ''}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="text-sm text-gray-500">None.</p>
			{/if}
		</Panel>
		<Panel title="On our colonies">
			{#if onOurs.length}
				<table class="text-sm">
					<thead class="text-left text-gray-500">
						<tr
							><th class="pr-4">Colony</th><th class="pr-4">Whose</th><th class="pr-4">Kind</th><th
								>Buildings</th
							></tr
						>
					</thead>
					<tbody>
						{#each onOurs as e (e.colonyId + e.holder + e.kind)}
							<tr class="border-t border-gray-100 dark:border-gray-800">
								<td class="pr-4">{e.name}</td>
								<td class="pr-4"><EmpireName name={e.holder} /></td>
								<td class="pr-4">{e.kind === 'corporate' ? 'branch office' : 'holding'}</td>
								<td>{names(e)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="text-sm text-gray-500">None.</p>
			{/if}
		</Panel>
	{/if}

	{#if data.megacorp}
		<Panel
			title="Branch office planner"
			note="Where a new office brings the most trade for its influence. Estimated (≈): an office's income is half the colony's trade before modifiers; its cost 75 influence plus 5 a jump, counted from our capital. Each office adds {EMPIRE_SIZE} empire size; its buildings' output is not counted."
		>
			<label class="mb-2 block text-sm"
				><input type="checkbox" bind:checked={all} /> also colonies without a commercial pact or with
				an office already</label
			>
			<div class="text-sm">
				<SortTable rows={shown} columns={siteColumns} key={(r) => r.colonyId} bind:sort />
			</div>
		</Panel>
	{/if}
</div>
