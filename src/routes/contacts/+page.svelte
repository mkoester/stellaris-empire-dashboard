<script lang="ts">
	import {
		CONTACT_COLUMNS,
		shown,
		type ContactColumn,
		type ContactRow,
		type ContactView
	} from '#lib/contacts.ts';
	import { nameOf, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import { putSettings } from '#lib/settings.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// the view is the profile's: changed here, stored at once
	let view: ContactView = $derived(data.view);
	const save = (v: ContactView) => {
		view = v;
		void putSettings({ contactView: v });
	};
	const types = $derived([...new Set(data.rows.map((r) => r.country?.type ?? ''))].sort());
	const rows = $derived(shown(data.rows, view));
	const yesNo = (v: boolean) => (v ? 1 : 0);

	const ALL: Record<ContactColumn, Column<ContactRow>> = {
		type: { id: 'type', label: 'Type', value: (r) => (r.country ? pretty(r.country.type) : null) },
		ethics: {
			id: 'ethics',
			label: 'Ethics',
			value: (r) =>
				r.communications
					? (r.country?.ethics.map((e) => nameOf(data.names, e)).join(', ') ?? null)
					: null,
			title: 'known after communications'
		},
		government: {
			id: 'government',
			label: 'Government',
			value: (r) =>
				r.communications && r.country?.governmentType
					? nameOf(data.names, r.country.governmentType)
					: null
		},
		communications: {
			id: 'communications',
			label: 'Comms',
			value: (r) => yesNo(r.communications),
			cell: comms
		},
		opinion: { id: 'opinion', label: 'Opinion', value: (r) => r.opinion, right: true },
		trust: { id: 'trust', label: 'Trust', value: (r) => r.trust, right: true },
		threat: { id: 'threat', label: 'Threat', value: (r) => r.threat, right: true },
		border: {
			id: 'border',
			label: 'Border',
			value: (r) => r.borderRange,
			right: true,
			title: 'border range; – not bordering'
		},
		firstContact: {
			id: 'firstContact',
			label: 'First contact',
			value: (r) => r.firstContact?.stage ?? null,
			cell: fc
		}
	};
	const columns: Column<ContactRow>[] = $derived([
		{ id: 'name', label: 'Empire', value: (r) => r.name, cell: name },
		...view.columns.map((c) => ALL[c])
	]);
	const toggle = <T,>(list: T[], x: T) =>
		list.includes(x) ? list.filter((y) => y !== x) : [...list, x];
</script>

{#snippet name(r: ContactRow)}
	<b>{r.name}</b>{#if r.hostile}<span class="text-red-600"> · hostile</span>{/if}
{/snippet}
{#snippet comms(r: ContactRow)}{r.communications ? '✓' : '–'}{/snippet}
{#snippet fc(r: ContactRow)}{r.firstContact
		? `${pretty(r.firstContact.stage)}, ${r.firstContact.clues} clues`
		: '–'}{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Contacts</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<div class="mb-4 flex flex-col gap-2 text-sm">
	<div class="flex flex-wrap items-center gap-4">
		<label class="flex items-center gap-1"
			><input
				type="checkbox"
				checked={view.communicationsOnly}
				onchange={(e) => save({ ...view, communicationsOnly: e.currentTarget.checked })}
			/> with communications only</label
		>
		<label class="flex items-center gap-1"
			>hostile
			<select
				class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
				value={view.hostile}
				onchange={(e) =>
					save({ ...view, hostile: e.currentTarget.value as ContactView['hostile'] })}
			>
				<option value="any">any</option><option value="hostile">only</option><option
					value="peaceful">not</option
				>
			</select></label
		>
		<span class="text-gray-500">{rows.length} of {data.rows.length}</span>
	</div>
	<div class="flex flex-wrap items-center gap-1">
		<span class="text-gray-500">types:</span>
		{#each types as t (t)}
			<label
				class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700 {view.hiddenTypes.includes(
					t
				)
					? 'opacity-40'
					: ''}"
				><input
					type="checkbox"
					class="sr-only"
					checked={!view.hiddenTypes.includes(t)}
					onchange={() => save({ ...view, hiddenTypes: toggle(view.hiddenTypes, t) })}
				/>{pretty(t || '?')}</label
			>
		{/each}
	</div>
	<div class="flex flex-wrap items-center gap-1">
		<span class="text-gray-500">columns:</span>
		{#each CONTACT_COLUMNS as c (c)}
			<label
				class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700 {view.columns.includes(
					c
				)
					? ''
					: 'opacity-40'}"
				><input
					type="checkbox"
					class="sr-only"
					checked={view.columns.includes(c)}
					onchange={() =>
						save({
							...view,
							columns: CONTACT_COLUMNS.filter((x) => (x === c) !== view.columns.includes(x))
						})}
				/>{ALL[c].label}</label
			>
		{/each}
	</div>
</div>

{#if data.seenAt}
	<SortTable {rows} {columns} key={(r) => r.countryId} />
{:else}
	<p class="text-sm text-amber-600">
		No save read since this tab exists; it fills after the next one.
	</p>
{/if}
