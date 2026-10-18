<script lang="ts">
	import { colorOf } from '#lib/colors.ts';
	import { pretty } from '#lib/format.ts';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { followGame } from '#lib/live.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import type { LeaderInfo } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	let envoys = $state(false);
	const rows = $derived(data.leaders.filter((l) => envoys || l.class !== 'envoy'));
	const envoyCount = $derived(data.leaders.filter((l) => l.class === 'envoy').length);

	const columns: Column<LeaderInfo>[] = [
		{ id: 'name', label: 'Leader', value: (r) => r.name, cell: name },
		{ id: 'class', label: 'Class', value: (r) => r.class, cell: cls },
		{ id: 'level', label: 'Level', value: (r) => r.level, right: true },
		{ id: 'age', label: 'Age', value: (r) => r.age, right: true },
		{ id: 'species', label: 'Species', value: (r) => r.species },
		{ id: 'job', label: 'Job', value: (r) => (r.job ? pretty(r.job) : null) },
		{ id: 'traits', label: 'Traits', value: (r) => r.traits.length, cell: traits }
	];
</script>

{#snippet name(r: LeaderInfo)}
	<b class="border-l-4 pl-1" style:border-color={colorOf(`class-${r.class}`)}>{r.name}</b
	>{#if r.ruler}<span class="text-gray-500"> · ruler</span>{:else if r.council}<span
			class="text-gray-500"
		>
			· council</span
		>{/if}
{/snippet}
{#snippet cls(r: LeaderInfo)}
	<span class="rounded px-1 text-xs text-white" style:background={colorOf(`class-${r.class}`)}
		>{r.class}</span
	>
{/snippet}
{#snippet traits(r: LeaderInfo)}
	{#each r.traits as t, i (t)}{i ? ' · ' : ''}<InfoPopup explanation={data.explain[`ltrait:${t}`]}
			>{data.explain[`ltrait:${t}`]?.title ?? pretty(t.replace(/^(leader_)?trait_/, ''))}</InfoPopup
		>{/each}
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Leaders</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if data.leaders.length}
	<label class="mb-3 flex items-center gap-1 text-sm"
		><input type="checkbox" bind:checked={envoys} /> show envoys ({envoyCount})</label
	>
	<SortTable {rows} {columns} key={(r) => r.id} />
{:else}
	<p class="text-sm text-amber-600">
		No save read since this tab exists; it fills after the next one.
	</p>
{/if}
