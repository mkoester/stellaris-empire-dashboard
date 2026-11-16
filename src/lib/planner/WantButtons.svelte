<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { newGoalId, planAction } from '#lib/settings.ts';
	import type { Stance } from '#lib/techOffers.ts';

	// + want / − want for one tech, wherever it is shown (the tech tree): adds it to the planner
	// as wanted or as wanted later (the planner's own buttons, the user's ask 2026-11-16), switches
	// between the two, or takes it out again. What it needs first follows by itself (`techNeeds`).
	let { tech, label }: { tech: string; label: string } = $props();

	const planned = $derived(
		new Map(
			(page.data.plan?.plannedTechs as [string, { stance: Stance; goal: string }][] | undefined) ??
				[]
		).get(tech)
	);
	let busy = $state(false);

	async function run(changes: { goal: string; op: string; data?: Record<string, unknown> }[]) {
		const tip = page.data.tip as number | undefined;
		if (tip === undefined || busy) return;
		busy = true;
		try {
			await planAction(tip, changes);
			await invalidateAll();
		} finally {
			busy = false;
		}
	}
	const add = (polarity: 'want' | 'later') =>
		run([{ goal: newGoalId(), op: 'add', data: { kind: 'tech', target: { tech }, polarity } }]);
	const set = (polarity: 'want' | 'later') =>
		planned && run([{ goal: planned.goal, op: 'edit', data: { polarity } }]);
	const remove = () => planned && run([{ goal: planned.goal, op: 'remove' }]);

	const button =
		'rounded border px-1 text-[11px] leading-4 whitespace-nowrap disabled:opacity-50 border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800';
	const stop = (f: () => unknown) => (e: MouseEvent) => {
		e.stopPropagation();
		void f();
	};
</script>

{#if page.data.tip !== undefined}
	<span class="inline-flex gap-0.5">
		{#if !planned}
			<button
				type="button"
				class={button}
				disabled={busy}
				title="want {label}"
				onclick={stop(() => add('want'))}>+ want</button
			>
			<button
				type="button"
				class={button}
				disabled={busy}
				title="want {label} later: Upcoming says to pick another card while it is on offer"
				onclick={stop(() => add('later'))}>− want</button
			>
		{:else}
			{#if planned.stance === 'want'}
				<button
					type="button"
					class={button}
					disabled={busy}
					title="later: still wanted, but not yet"
					onclick={stop(() => set('later'))}>− want</button
				>
			{:else if planned.stance === 'later'}
				<button
					type="button"
					class={button}
					disabled={busy}
					title="want it now"
					onclick={stop(() => set('want'))}>+ want</button
				>
			{/if}
			<button
				type="button"
				class={button}
				disabled={busy}
				title="take {label} out of the planner"
				onclick={stop(remove)}>✕</button
			>
		{/if}
	</span>
{/if}
