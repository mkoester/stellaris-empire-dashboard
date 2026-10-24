<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { colorOf } from './colors.ts';
	import { nameOf } from './format.ts';
	import InfoPopup from './InfoPopup.svelte';
	import type { Upcoming } from './events.ts';
	import SortTable from './SortTable.svelte';
	import type { Column } from './sort.ts';
	import type { Explanation } from './types.ts';

	// node: the save shown when not following the game, so colony links stay on that branch.
	let {
		events,
		node,
		explain = {},
		names = {}
	}: {
		events: Upcoming[];
		node: number | null;
		explain?: Record<string, Explanation>;
		names?: Record<string, string>;
	} = $props();

	const colonyHref = (planetId: number) =>
		node === null
			? resolve('/colony/[id]', { id: String(planetId) })
			: resolve(`/colony/[id]?node=${node}`, { id: String(planetId) });

	// "Only what the game doesn't tell me": research, traditions, agendas, elections and
	// construction with more queued come with game notifications; the ⚠ rows do not. A
	// per-viewer setting, remembered in this browser.
	const KEY = 'upcoming-only-unnotified';
	let onlyUnnotified = $state(false);
	onMount(() => {
		try {
			onlyUnnotified = localStorage.getItem(KEY) === '1';
		} catch {
			/* storage unavailable */
		}
	});
	const remember = () => {
		try {
			localStorage.setItem(KEY, onlyUnnotified ? '1' : '0');
		} catch {
			/* storage unavailable */
		}
	};
	const shown = $derived(onlyUnnotified ? events.filter((e) => e.act) : events);

	type Row = Upcoming & { i: number };
	const columns: Column<Row>[] = [
		{ id: 'due', label: 'Due', value: (e) => e.date, cell: due },
		{ id: 'in', label: 'In', value: (e) => e.months, cell: inCell, right: true },
		{ id: 'what', label: 'What', value: (e) => e.what, cell: what },
		{ id: 'kind', label: 'Kind', value: (e) => e.sub ?? e.kind, cell: kind },
		{ id: 'details', label: 'Details', value: (e) => e.detail ?? null, cell: details }
	];
	const inMonths = (m: number) =>
		m <= 0 ? 'now' : m < 1 ? `${Math.round(m * 30)} days` : `${Math.round(m)} mo`;
</script>

{#snippet due(e: Row)}<span class="whitespace-nowrap" title={e.exact ? 'exact' : 'estimated'}
		>{e.exact ? '' : '≈ '}{e.date}</span
	>{/snippet}
{#snippet inCell(e: Row)}<span class="whitespace-nowrap">{inMonths(e.months)}</span>{/snippet}
{#snippet what(e: Row)}<InfoPopup explanation={e.ref ? explain[e.ref] : undefined}
		>{e.kind === 'construction' ? nameOf(names, e.what) : e.what}</InfoPopup
	>{#if e.queuedAfter !== undefined}&nbsp;<span
			title="{e.queuedAfter} other item{e.queuedAfter === 1 ? '' : 's'} in the queue after it"
			>(+{e.queuedAfter})</span
		>{/if}{/snippet}
{#snippet kind(e: Row)}<span class="whitespace-nowrap opacity-75"
		>{#if e.act}<span title="the build slot runs idle then — the game sends no notification">⚠</span
			>{/if}
		{e.sub ?? e.kind}</span
	>{/snippet}
{#snippet details(e: Row)}<span style="color: CanvasText"
		>{#if e.planetId !== undefined}<a class="underline" href={colonyHref(e.planetId)}>{e.detail}</a
			>{:else}{e.detail}{/if}</span
	>{/snippet}

<label class="mb-1 block text-sm"
	><input type="checkbox" bind:checked={onlyUnnotified} onchange={remember} /> only what the game
	doesn't notify ({events.filter((e) => e.act).length} of {events.length})</label
>
{#if shown.length === 0}
	<p>Nothing scheduled.</p>
{:else}
	<div class="overflow-x-auto">
		<!-- the event in its game colour; the numbers in Details stay plain. ⚠ before the kind: a
		     build slot runs idle (the game does not notify). Construction with other items still
		     waiting when it is done is dimmed and counts them: "Medical Center (+2)". -->
		<SortTable
			rows={shown.map((e, i) => ({ ...e, i }))}
			{columns}
			key={(e) => e.i}
			rowClass={(e) => (e.queuedAfter ? 'opacity-50' : '')}
			rowStyle={(e) => `color: ${colorOf(e.tint)}`}
		/>
	</div>
{/if}
