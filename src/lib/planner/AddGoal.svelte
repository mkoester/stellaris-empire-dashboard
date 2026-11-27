<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { newGoalId, planAction } from '#lib/settings.ts';
	import { goalKey, type Polarity, type Target } from './replay.ts';

	// "+ goal" beside anything a page lists: adds it to the planner at the node the page shows,
	// ✓ once planned, with ✕ to take it out again. Inside a SortTable row that picks a system on
	// click, so the click stays here.
	let {
		kind,
		target,
		polarity = 'want',
		title = 'add to the planner'
	}: { kind: string; target: Target; polarity?: Polarity; title?: string } = $props();

	const tip = $derived(page.data.tip as number | undefined);
	const key = $derived(goalKey(kind, target));
	const planned = $derived(((page.data.plan?.keys as string[] | undefined) ?? []).includes(key));
	const id = $derived((page.data.plan?.ids as Record<string, string> | undefined)?.[key]);
	// a kind this empire cannot have (a nomad's outposts and colonies): no button
	const offered = $derived(
		!((page.data.plan?.unavailable as string[] | undefined) ?? []).includes(kind)
	);
	let busy = $state(false);

	async function run(changes: { goal: string; op: string; data?: Record<string, unknown> }[]) {
		if (tip === undefined || busy) return;
		busy = true;
		try {
			await planAction(tip, changes);
			await invalidateAll();
		} finally {
			busy = false;
		}
	}
	function add(e: MouseEvent) {
		e.stopPropagation();
		if (!planned) void run([{ goal: newGoalId(), op: 'add', data: { kind, target, polarity } }]);
	}
	function remove(e: MouseEvent) {
		e.stopPropagation();
		if (id) void run([{ goal: id, op: 'remove' }]);
	}
</script>

{#if tip !== undefined && offered}
	<button
		type="button"
		class="ml-1 rounded px-1 text-[11px] whitespace-nowrap {planned
			? 'text-green-600'
			: 'text-gray-400 hover:bg-gray-100 hover:text-current dark:hover:bg-gray-800'}"
		title={planned ? 'in the planner' : title}
		disabled={busy}
		onclick={add}
	>
		{planned ? '✓ planned' : '+ goal'}
	</button>{#if planned && id}<button
			type="button"
			class="rounded px-1 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
			title="take it out of the planner"
			disabled={busy}
			onclick={remove}
		>
			✕
		</button>{/if}
{/if}
