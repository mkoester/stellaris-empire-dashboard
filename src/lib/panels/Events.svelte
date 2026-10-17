<script lang="ts">
	import { chartEvents } from '../chartEvents.svelte.ts';
	import { colorOf } from '../colors.ts';
	import EventPicker from '../EventPicker.svelte';
	import type { Milestone } from '../milestones.ts';
	import Panel from './Panel.svelte';

	// The campaign's milestones as a log, newest month first; kinds picked like on a chart.
	let { events }: { events: Milestone[] } = $props();
	const picker = chartEvents(() => 'log');
	const months = $derived(
		Map.groupBy(events.filter((e) => picker.shown.includes(e.kind)).toReversed(), (e) =>
			e.date.slice(0, 7)
		)
	);
</script>

<Panel
	title="Events"
	note="Bigger events found by comparing consecutive saves, dated to the save that first shows them (up to a month late)."
>
	<div class="mb-2 flex justify-end"><EventPicker {events} {...picker} /></div>
	{#if months.size === 0}
		<p class="text-sm text-gray-500">Pick the kinds to list under “events”.</p>
	{:else}
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			{#each months as [month, list] (month)}
				<dt class="text-gray-500 tabular-nums">{month}</dt>
				<dd>
					{#each list as e, i (i)}
						<div style:color={colorOf(e.kind)}>{e.label}</div>
					{/each}
				</dd>
			{/each}
		</dl>
	{/if}
</Panel>
