<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { newGoalId, planAction } from '#lib/settings.ts';
	import { goalKey, type Polarity, type Target } from './replay.ts';

	// "+ goal" beside anything a page lists: adds it to the planner at the node the page shows,
	// ✓ once planned. Inside a SortTable row that picks a system on click, so the click stays here.
	let {
		kind,
		target,
		polarity = 'want',
		title = 'add to the planner'
	}: { kind: string; target: Target; polarity?: Polarity; title?: string } = $props();

	const tip = $derived(page.data.tip as number | undefined);
	const planned = $derived(
		((page.data.plan?.keys as string[] | undefined) ?? []).includes(goalKey(kind, target))
	);
	let busy = $state(false);

	async function add(e: MouseEvent) {
		e.stopPropagation();
		if (tip === undefined || planned || busy) return;
		busy = true;
		try {
			await planAction(tip, [{ goal: newGoalId(), op: 'add', data: { kind, target, polarity } }]);
			await invalidateAll();
		} finally {
			busy = false;
		}
	}
</script>

{#if tip !== undefined}
	<button
		type="button"
		class="ml-1 rounded px-1 text-[11px] whitespace-nowrap {planned
			? 'text-green-600'
			: 'text-gray-400 hover:bg-gray-100 hover:text-current dark:hover:bg-gray-800'}"
		title={planned ? 'in the planner' : title}
		disabled={busy}
		onclick={add}>{planned ? '✓ planned' : '+ goal'}</button
	>
{/if}
