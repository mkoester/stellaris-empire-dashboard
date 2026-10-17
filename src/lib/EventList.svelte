<script lang="ts">
	import { colorOf } from './colors.ts';
	import type { Milestone } from './milestones.ts';

	// Milestones as a log, newest month first, each in its kind's colour.
	let { events }: { events: Milestone[] } = $props();
	const months = $derived(Map.groupBy(events.toReversed(), (e) => e.date.slice(0, 7)));
</script>

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
