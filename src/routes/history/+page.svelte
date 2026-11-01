<script lang="ts">
	import FrameSlider from '#lib/FrameSlider.svelte';
	import GalaxyMap from '#lib/GalaxyMap.svelte';
	import { ownersAt, type HistoryEvent } from '#lib/history.ts';
	import { followGame } from '#lib/live.ts';
	import type { MapWidth } from '#lib/mapView.ts';
	import Panel from '#lib/panels/Panel.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	let picked: number | null = $state(null);
	let width: MapWidth = $state('normal'); // "wide + table": the events go beside the map
	const last = $derived(data.months.length - 1);
	const date = $derived(data.months[picked === null || picked > last ? last : picked] ?? '');
	const owners = $derived(ownersAt(data.history.changes, date));
	const fill = $derived(
		Object.fromEntries([...owners].map(([sys, owner]) => [sys, data.colors[owner] ?? '#888']))
	);
	const titles = $derived(
		Object.fromEntries(
			[...owners].map(([sys, owner]) => [sys, data.history.names[owner] ?? `empire ${owner}`])
		)
	);

	const KINDS: { kind: HistoryEvent['kind']; label: string }[] = [
		{ kind: 'colony', label: 'colonies' },
		{ kind: 'gained', label: 'systems gained' },
		{ kind: 'lost', label: 'systems lost' },
		{ kind: 'communications', label: 'communications' },
		{ kind: 'guardian', label: 'guardians' },
		{ kind: 'war', label: 'wars' }
	];
	let hidden: string[] = $state([]);
	const events = $derived(
		data.history.events
			.filter((e) => e.date <= date && !hidden.includes(e.kind))
			.slice()
			.reverse()
	);
	const knownNames = $derived(
		data.history.known.map((id) => data.history.names[id]).filter((n) => n !== undefined)
	);
</script>

{#snippet eventList()}
	{#if width === 'side'}<h2 class="mb-2 font-semibold">Events up to {date.slice(0, 7)}</h2>{/if}
	<div class="mb-2 flex flex-wrap gap-3 text-sm">
		{#each KINDS as k (k.kind)}
			<label
				><input
					type="checkbox"
					checked={!hidden.includes(k.kind)}
					onchange={(e) =>
						(hidden = e.currentTarget.checked
							? hidden.filter((x) => x !== k.kind)
							: [...hidden, k.kind])}
				/>
				{k.label}</label
			>
		{/each}
	</div>
	{#if events.length}
		<table class="text-sm">
			<tbody>
				{#each events as e, i (i)}
					<tr class="border-t border-gray-100 dark:border-gray-800">
						<td
							class="pr-4 text-gray-500 tabular-nums"
							title={e.exact ? 'the date the save holds' : 'by this date: between two saves'}
							>{e.exact ? '' : '≤ '}{e.date}</td
						>
						<td class="pr-4 text-gray-500">{e.kind}</td>
						<td>{e.text}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="text-sm text-gray-500">Nothing known up to then.</p>
	{/if}
{/snippet}

<div class="space-y-4">
	<h1 class="text-xl font-semibold">History</h1>
	<p class="max-w-3xl text-sm text-gray-500">
		{#if data.all}
			Everything the saves hold (cheat: ⚙ → History).
		{:else}
			What we know: our own history, that of the empires we have communications with now — all of
			it, back to the start —, the owners of systems we have been to, guardians' falls (common
			knowledge) and wars of empires we know.
			{#if knownNames.length > 1}Known now: {knownNames.join(', ')}.{/if}
		{/if}
		Before {data.history.start || 'the first save read'} only colonies (by their colonisation date) are
		known; a system with such a colony counts as its owner's since then.
	</p>

	<FrameSlider dates={data.months} bind:picked label="month the map and the events show" />

	<GalaxyMap
		systems={data.systems}
		{fill}
		{titles}
		heightKey="history-map-height"
		label="History map"
		bind:width
		beside={eventList}
	/>

	{#if width !== 'side'}
		<Panel title="Events up to {date.slice(0, 7)}">{@render eventList()}</Panel>
	{/if}
</div>
