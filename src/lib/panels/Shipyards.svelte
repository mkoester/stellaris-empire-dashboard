<script lang="ts">
	import { pretty } from '../format.ts';
	import QueueList from '../QueueList.svelte';
	import { CAPITAL_SHIPS, capitalYardMissing, megaShipyardDone, megaStage } from '../shipyards.ts';
	import type { MegaShipyard, Station } from '../types.ts';
	import Panel from './Panel.svelte';

	// Every place that builds ships: starbases with a shipyard and Mega Shipyards. A starbase with
	// a shipyard appears here and under Starbases.
	let {
		stations,
		megas,
		researched,
		date
	}: { stations: Station[]; megas: MegaShipyard[]; researched: string[]; date: string } = $props();

	const yards = $derived(stations.filter((s) => s.shipyard));
	const techFor = (canBuild: boolean) =>
		CAPITAL_SHIPS.map((c) => ({
			...c,
			ok: canBuild && researched.includes(c.tech),
			hasTech: researched.includes(c.tech)
		}));
</script>

{#snippet capital(missing: string[])}
	{#if missing.length}
		<span class="text-gray-500" title="capital ships need: {missing.join(', ')}"
			>no capital ships</span
		>
	{:else}
		{#each techFor(true) as c (c.size)}
			<span class="mr-2 {c.ok ? '' : 'text-gray-500'}" title={c.ok ? '' : `needs ${pretty(c.tech)}`}
				>{c.ok ? '✓' : '✗'} {c.size}</span
			>
		{/each}
	{/if}
{/snippet}

<Panel
	title="Shipyards"
	note="Build capacity = ships built at once. Capital ships need the yard below and their tech."
>
	<table class="text-left text-sm">
		<thead>
			<tr class="border-b border-gray-300 dark:border-gray-700">
				<th class="p-1">Shipyard</th>
				<th class="p-1 text-right">Capacity</th>
				<th class="p-1">Capital ships</th>
				<th class="p-1">Queue</th>
			</tr>
		</thead>
		<tbody>
			{#each yards as s (s.id)}
				<tr class="border-b border-gray-200 align-top dark:border-gray-800">
					<td class="p-1">{s.system} <span class="text-gray-500">{pretty(s.level)}</span></td>
					<td class="p-1 text-right">{s.shipyard!.slots}</td>
					<td class="p-1">
						{@render capital(capitalYardMissing(s))}
						{#if capitalYardMissing(s).length}
							<div class="text-xs text-gray-500">needs {capitalYardMissing(s).join(', ')}</div>
						{/if}
					</td>
					<td class="p-1"
						><QueueList queue={s.shipyard!.queue} slots={s.shipyard!.slots} {date} /></td
					>
				</tr>
			{/each}
			{#each megas as m (m.id)}
				<tr class="border-b border-gray-200 align-top dark:border-gray-800">
					<td class="p-1"
						>{m.system} <span class="text-gray-500">Mega Shipyard, {megaStage(m.type)}</span></td
					>
					<td class="p-1 text-right">{m.queue ? m.slots : '?'}</td>
					<td class="p-1"
						>{@render capital(megaShipyardDone(m) ? [] : ['the Mega Shipyard complete'])}</td
					>
					<td class="p-1">
						{#if m.queue}<QueueList queue={m.queue} slots={m.slots} {date} />{:else}<span
								class="text-gray-500">queue not found</span
							>{/if}
					</td>
				</tr>
			{/each}
			{#if yards.length === 0 && megas.length === 0}
				<tr><td class="p-1" colspan="4">none</td></tr>
			{/if}
		</tbody>
	</table>
</Panel>
