<script lang="ts">
	import type { Route } from '../types.ts';
	import Panel from './Panel.svelte';

	// Fleets on the move or with destinations queued: where they are, where their orders end, and
	// the first unexplored system on the way — ships fly to its centre, so that is where to step in.
	// The save holds no arrival dates.
	let { fleets }: { fleets: { name: string; kind: string; route: Route }[] } = $props();

	// working where they are (0 jumps) is not underway
	const shown = $derived(
		fleets.filter((f) => f.route.moving || f.route.stops.some((s) => s.jumps !== 0))
	);
	const jumps = (n: number | null) => (n === null ? '? jumps' : n === 1 ? '1 jump' : `${n} jumps`);
</script>

<Panel title="Fleets underway">
	<table class="text-left text-sm">
		<thead>
			<tr class="border-b border-gray-300 dark:border-gray-700">
				<th class="p-1">Fleet</th>
				<th class="p-1">At</th>
				<th class="p-1">Unexplored on the way</th>
				<th class="p-1">Final destination</th>
			</tr>
		</thead>
		<tbody>
			{#each shown as f, i (i)}
				{@const unknown = f.route.stops.find((s) => s.unexplored)}
				{@const last = f.route.stops.at(-1)}
				<tr class="border-b border-gray-200 dark:border-gray-800">
					<td class="p-1 whitespace-nowrap">{f.name} <span class="text-gray-500">{f.kind}</span></td
					>
					<td class="p-1">{f.route.at}</td>
					<td class="p-1">
						{#if unknown}<span class="text-amber-600">⚠ {unknown.system}</span>
							<span class="text-gray-500">in {jumps(unknown.jumps)}</span>{/if}
					</td>
					<td class="p-1">
						{#if last}{last.system}
							<span class="text-gray-500">in {jumps(last.jumps)}</span>{:else}–{/if}
					</td>
				</tr>
			{:else}
				<tr><td class="p-1" colspan="4">none underway</td></tr>
			{/each}
		</tbody>
	</table>
</Panel>
