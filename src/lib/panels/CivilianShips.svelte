<script lang="ts">
	import { fmt } from '../format.ts';
	import { idleState, orderLabel } from '../ships.ts';
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
</script>

<Panel
	title="Civilian ships"
	note="Due dates are estimates from progress between the last two saves."
>
	<table class="text-left text-sm">
		<thead>
			<tr class="border-b border-gray-300 dark:border-gray-700">
				<th class="p-1">Ship</th>
				<th class="p-1">Leader</th>
				<th class="p-1">Doing</th>
				<th class="p-1 text-right">Progress</th>
				<th class="p-1">Due</th>
				<th class="p-1">Then</th>
			</tr>
		</thead>
		<tbody>
			{#each ships as s (s.fleetId)}
				<tr class="border-b border-gray-200 align-top dark:border-gray-800">
					<td class="p-1 whitespace-nowrap">
						{s.name} <span class="text-gray-500">{s.kind.replaceAll('_', ' ')}</span>
						<div class="text-xs text-gray-500">
							{[
								s.stance,
								s.automation ? `automated: ${s.automation.join(', ') || 'nothing set'}` : 'manual'
							]
								.filter(Boolean)
								.join(' · ')}
						</div>
					</td>
					<td class="p-1">{s.leader ?? ''}</td>
					<td class="p-1">
						{#if s.order}{orderLabel(s.order)}{:else}
							{@const idle = idleState(s)}
							<span class={idle.act ? 'text-amber-600' : 'text-gray-500'}
								>{idle.act ? '⚠ ' : ''}{idle.text}</span
							>
						{/if}
					</td>
					<td class="p-1 text-right whitespace-nowrap">{progress(s)}</td>
					<td class="p-1 whitespace-nowrap">{due[s.fleetId] ?? ''}</td>
					<td class="p-1 text-gray-500">
						{s.queue.map(orderLabel).join(' · ') || (s.order ? 'nothing queued' : '')}
					</td>
				</tr>
			{:else}
				<tr><td class="p-1" colspan="6">none</td></tr>
			{/each}
		</tbody>
	</table>
</Panel>
