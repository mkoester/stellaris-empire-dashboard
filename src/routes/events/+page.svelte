<script lang="ts">
	import { colorOf } from '#lib/colors.ts';
	import EventList from '#lib/EventList.svelte';
	import { followGame } from '#lib/live.ts';
	import { KINDS, type EventKind } from '#lib/milestones.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// Filters live in the page: text, kinds (all on until switched off), one colony.
	let query = $state('');
	let hidden: EventKind[] = $state([]);
	let colony: number | null = $state(null);

	const present = $derived(KINDS.filter((k) => data.milestones.some((e) => e.kind === k.kind)));
	const count = (kind: EventKind) => data.milestones.filter((e) => e.kind === kind).length;
	const toggle = (kind: EventKind) =>
		(hidden = hidden.includes(kind) ? hidden.filter((k) => k !== kind) : [...hidden, kind]);
	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.milestones.filter(
			(e) =>
				!hidden.includes(e.kind) &&
				(colony === null || e.planetId === colony) &&
				(q === '' || e.label.toLowerCase().includes(q) || e.date.includes(q))
		);
	});

	const button =
		'rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40 dark:border-gray-700';
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Events</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<p class="mb-4 max-w-3xl text-sm text-gray-500">
	Bigger events found by comparing consecutive saves, dated to the save that first shows them (up to
	a month late).
</p>

<div class="mb-4 flex flex-col gap-2 text-sm">
	<div class="flex flex-wrap items-center gap-2">
		<input
			type="search"
			placeholder="search, e.g. “Sirius” or “2205”"
			class="w-72 rounded border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
			bind:value={query}
		/>
		<select
			class="rounded border border-gray-300 bg-transparent px-1 py-1 dark:border-gray-700"
			value={colony ?? ''}
			onchange={(e) => (colony = e.currentTarget.value ? Number(e.currentTarget.value) : null)}
			aria-label="colony"
		>
			<option value="">all colonies and the empire</option>
			{#each data.colonies as c (c.planetId)}<option value={c.planetId}>{c.name}</option>{/each}
		</select>
		<span class="text-gray-500">{shown.length} of {data.milestones.length}</span>
	</div>
	<div class="flex flex-wrap items-center gap-1">
		<button class={button} onclick={() => (hidden = [])}>all</button>
		<button class={button} onclick={() => (hidden = present.map((k) => k.kind))}>none</button>
		{#each present as k (k.kind)}
			<label
				class="flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700 {hidden.includes(
					k.kind
				)
					? 'opacity-40'
					: ''}"
				><input
					type="checkbox"
					class="sr-only"
					checked={!hidden.includes(k.kind)}
					onchange={() => toggle(k.kind)}
				/><span class="inline-block h-2 w-2 rounded-full" style:background={colorOf(k.kind)}></span>
				{k.label} <span class="text-gray-500 tabular-nums">{count(k.kind)}</span></label
			>
		{/each}
	</div>
</div>

{#if shown.length === 0}
	<p class="text-gray-500">No event matches.</p>
{:else}
	<EventList events={shown} />
{/if}
