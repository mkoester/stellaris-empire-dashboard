<script lang="ts">
	import type { ModRow } from '#lib/addons.ts';
	import EventList from '#lib/EventList.svelte';
	import { followGame } from '#lib/live.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	let activeOnly = $state(true);
	let tag = $state('');
	let sort = $state({ column: 'name', desc: false });

	const tags = $derived([...new Set(data.rows.flatMap((r) => r.tags))].sort());
	const shown = $derived(
		data.rows.filter((r) => (!activeOnly || r.active) && (tag === '' || r.tags.includes(tag)))
	);
	const count = $derived(data.rows.filter((r) => r.active).length);
	const yesNo = (v: boolean | null) => (v === null ? null : v ? 1 : 0);

	const columns: Column<ModRow>[] = [
		{ id: 'name', label: 'Mod', value: (r) => r.name, cell: name },
		{ id: 'version', label: 'Version', value: (r) => r.version },
		{
			id: 'supported',
			label: 'For game',
			value: (r) => r.supportedVersion,
			cell: supported,
			title: "the descriptor's supported_version; ⚠ where it does not cover the game version"
		},
		{ id: 'tags', label: 'Tags', value: (r) => r.tags.join(', ') },
		{
			id: 'updated',
			label: 'Updated',
			value: (r) => r.updated?.slice(0, 10) ?? null,
			title: "the workshop's last update (from the launcher)"
		},
		{
			id: 'active',
			label: 'Active',
			value: (r) => yesNo(r.active),
			cell: active,
			title: 'in the latest save'
		}
	];
	type Update = (typeof data.updates)[number] & { i: number };
	const updateColumns: Column<Update>[] = [
		{ id: 'seen', label: 'Seen', value: (u) => u.to.seenAt.slice(0, 10), cell: seen },
		{ id: 'mod', label: 'Mod', value: (u) => u.name, cell: modName },
		{ id: 'version', label: 'Version', value: (u) => u.to.version ?? null, cell: version },
		{ id: 'updated', label: 'Updated', value: (u) => u.to.updated ?? null, cell: updated }
	];
</script>

{#snippet seen(u: Update)}<span class="text-gray-500 tabular-nums">{u.to.seenAt.slice(0, 10)}</span
	>{/snippet}
{#snippet modName(u: Update)}<b>{u.name}</b>{/snippet}
{#snippet version(u: Update)}{#if u.from.version !== u.to.version}{u.from.version ?? '?'} → {u.to
			.version ?? '?'}{:else}{u.to.version ??
			''}{/if}{#if u.from.supportedVersion !== u.to.supportedVersion}
		<span class="text-gray-500"
			>for game {u.from.supportedVersion ?? '?'} → {u.to.supportedVersion ?? '?'}</span
		>{/if}{/snippet}
{#snippet updated(u: Update)}<span class="text-gray-500"
		>{u.to.updated ? `updated ${u.to.updated.slice(0, 10)}` : ''}{u.to.gameDate
			? ` · game ${u.to.gameDate}`
			: ''}</span
	>{/snippet}

{#snippet name(r: ModRow)}
	{#if r.steamId}<a
			class="hover:underline"
			href="https://steamcommunity.com/sharedfiles/filedetails/?id={r.steamId}"
			rel="external noreferrer"
			target="_blank">{r.name}</a
		>{:else}{r.name}{/if}{#if r.local && r.steamId}<span
			class="text-gray-500"
			title="a local copy ({r.file}) beside the workshop version"
		>
			· local</span
		>{/if}
{/snippet}
{#snippet supported(r: ModRow)}
	{r.supportedVersion ?? '–'}{#if r.supported === false}<span
			class="text-amber-600"
			title="does not claim to support {data.gameVersion}"
		>
			⚠</span
		>{/if}
{/snippet}
{#snippet active(r: ModRow)}{r.active === null ? '?' : r.active ? '✓' : '–'}{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Mods</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<p class="mb-4 max-w-3xl text-sm text-gray-500">
	{#if data.seenAt}{count} active in the save of {data.seenAt}{data.gameVersion
			? ` (${data.gameVersion})`
			: ''}.{:else}No save read since the mod list was added; it shows after the next one.{/if}
	Installed mods come from the launcher's descriptors in the Stellaris user folder.
</p>

<div class="mb-4 flex flex-wrap items-center gap-4 text-sm">
	<label class="flex items-center gap-1"
		><input type="checkbox" bind:checked={activeOnly} /> active only</label
	>
	<label class="flex items-center gap-1"
		>tag
		<select
			class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
			bind:value={tag}
		>
			<option value="">any</option>
			{#each tags as t (t)}<option value={t}>{t}</option>{/each}
		</select>
	</label>
	<span class="text-gray-500">{shown.length} of {data.rows.length}</span>
</div>

<div class="mb-8">
	<SortTable rows={shown} {columns} key={(r) => r.file ?? `save:${r.name}`} bind:sort />
</div>

<h2 class="mb-2 text-xl font-semibold">Changes</h2>
{#if data.changes.length === 0}
	<p class="text-sm text-gray-500">
		No mod switched on or off between the saves of this branch (compared from the first save read
		with the mod list).
	</p>
{:else}
	<EventList events={data.changes} />
{/if}

<h2 class="mt-6 mb-2 text-xl font-semibold">Updates</h2>
<p class="mb-2 max-w-3xl text-sm text-gray-500">
	Versions and workshop update times as the dashboard saw them at each start, since 2026-10-18. Many
	mods name no version; their update shows as a new update time only.
</p>
{#if data.updates.length === 0}
	<p class="text-sm text-gray-500">No mod updated between the dashboard's starts yet.</p>
{:else}
	<SortTable
		rows={data.updates.map((u, i) => ({ ...u, i }))}
		columns={updateColumns}
		key={(u) => u.i}
		sort={{ column: '', desc: false }}
	/>
{/if}
