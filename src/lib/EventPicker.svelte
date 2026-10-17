<script lang="ts">
	import { colorOf } from './colors.ts';
	import { KINDS, type EventKind, type Milestone } from './milestones.ts';

	// Which milestone kinds to show: the kinds that occur, with how often, as checkboxes.
	let {
		events,
		shown,
		toggle
	}: { events: Milestone[]; shown: EventKind[]; toggle: (k: EventKind) => void } = $props();
	const counts = $derived(
		events.reduce((m, e) => m.set(e.kind, (m.get(e.kind) ?? 0) + 1), new Map<string, number>())
	);
</script>

<details class="relative text-sm font-normal">
	<summary class="cursor-pointer text-gray-500 select-none"
		>events{shown.length ? ` (${shown.length})` : ''}</summary
	>
	<div
		class="absolute right-0 z-40 mt-1 flex w-64 flex-col gap-0.5 rounded border border-gray-300 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900"
	>
		{#each KINDS.filter((k) => counts.has(k.kind)) as k (k.kind)}
			<label class="flex items-center gap-2"
				><input type="checkbox" checked={shown.includes(k.kind)} onchange={() => toggle(k.kind)} />
				<span class="inline-block h-2 w-2 rounded-full" style:background={colorOf(k.kind)}></span>
				<span class="flex-1">{k.label}</span>
				<span class="text-gray-500 tabular-nums">{counts.get(k.kind)}</span></label
			>
		{:else}
			<span class="text-gray-500">No events on this branch yet.</span>
		{/each}
	</div>
</details>
