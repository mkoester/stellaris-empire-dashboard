<script lang="ts">
	import { fmt } from '../format.ts';
	import { idleState, orderLabel } from '../ships.ts';
	import SortTable from '../SortTable.svelte';
	import type { Column } from '../sort.ts';
	import type { CivilianShip } from '../types.ts';
	import Panel from './Panel.svelte';

	// Science, construction and colony ships: the current order with its progress (of the total
	// where known) and due date (from Upcoming), and what is queued after it.
	// totals: what each ship's current order counts to (#lib/ships.ts orderTotal), by fleet id
	let {
		ships,
		due,
		totals
	}: { ships: CivilianShip[]; due: Record<number, string>; totals: Record<number, number | null> } =
		$props();

	const progress = (s: CivilianShip) => {
		const p = s.order?.progress;
		if (p == null) return '';
		const total = totals[s.fleetId];
		return total ? `${Math.min(100, Math.floor((100 * p) / total))}%` : fmt(p);
	};
	const share = (s: CivilianShip) => {
		const p = s.order?.progress;
		const total = totals[s.fleetId];
		return p == null ? null : total ? p / total : p;
	};
	const columns: Column<CivilianShip>[] = [
		{ id: 'ship', label: 'Ship', value: (s) => s.name, cell: ship },
		{ id: 'leader', label: 'Leader', value: (s) => s.leader ?? null },
		{
			id: 'doing',
			label: 'Doing',
			value: (s) => (s.order ? orderLabel(s.order) : idleState(s).text),
			cell: doing
		},
		{ id: 'progress', label: 'Progress', value: share, cell: progressCell, right: true },
		{ id: 'due', label: 'Due', value: (s) => due[s.fleetId] ?? null, cell: dueCell },
		{
			id: 'then',
			label: 'Then',
			value: (s) => s.queue.map(orderLabel).join(' · ') || null,
			cell: then
		}
	];
</script>

{#snippet ship(s: CivilianShip)}<span class="whitespace-nowrap"
		>{s.name} <span class="text-gray-500">{s.kind.replaceAll('_', ' ')}</span></span
	>
	<div class="text-xs text-gray-500">
		{[s.stance, s.automation ? `automated: ${s.automation.join(', ') || 'nothing set'}` : 'manual']
			.filter(Boolean)
			.join(' · ')}
	</div>{/snippet}
{#snippet doing(s: CivilianShip)}{#if s.order}{orderLabel(s.order)}{:else}
		{@const idle = idleState(s)}
		<span class={idle.act ? 'text-amber-600' : 'text-gray-500'}
			>{idle.act ? '⚠ ' : ''}{idle.text}</span
		>
	{/if}{/snippet}
{#snippet progressCell(s: CivilianShip)}<span class="whitespace-nowrap">{progress(s)}</span
	>{/snippet}
{#snippet dueCell(s: CivilianShip)}<span class="whitespace-nowrap">{due[s.fleetId] ?? ''}</span
	>{/snippet}
{#snippet then(s: CivilianShip)}<span class="text-gray-500"
		>{s.queue.map(orderLabel).join(' · ') || (s.order ? 'nothing queued' : '')}</span
	>{/snippet}

<Panel
	title="Civilian ships"
	note="Due dates are estimates from progress between the last two saves."
>
	{#if ships.length}
		<SortTable rows={ships} {columns} key={(s) => s.fleetId} sort={{ column: '', desc: false }} />
	{:else}<p class="text-sm">none</p>{/if}
</Panel>
