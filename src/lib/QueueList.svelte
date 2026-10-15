<script lang="ts">
	import { fromDays, scheduleQueue, toDays } from './events.ts';
	import { fmt, pretty } from './format.ts';
	import type { QueueItem } from './types.ts';

	// A build queue with due dates: `slots` items at once, in queue order (as in Upcoming).
	let { queue, slots, date }: { queue: QueueItem[]; slots: number; date: string } = $props();

	const plan = $derived(scheduleQueue(queue, slots));
</script>

{#if queue.length === 0}
	<span class="text-gray-500">∅</span>
{:else}
	{#each queue as item, i (i)}
		<div class="whitespace-nowrap {plan[i].startsNow ? '' : 'text-gray-500'}">
			{pretty(item.name)}{item.design ? ` "${item.design}"` : ''}
			<span class="text-gray-500"
				>{fmt(item.progress)}/{fmt(item.needed)} · {fromDays(toDays(date) + plan[i].doneIn)}</span
			>
		</div>
	{/each}
{/if}
