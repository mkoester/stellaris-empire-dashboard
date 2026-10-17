<script lang="ts">
	import { onMount } from 'svelte';
	import { expansionCounts, visible, type ExpansionRow, type ExpansionView } from '../expansion.ts';
	import { nameOf, pretty } from '../format.ts';
	import PlanetDetails from '../PlanetDetails.svelte';
	import Panel from './Panel.svelte';

	let { planets, date }: { planets: ExpansionRow[]; date: string } = $props();

	// One row open at a time shows the planet's details.
	let open: number | null = $state(null);
	// "Farming 8 · Generator 8 · Mining 7": the capped district types
	const capsLine = (p: ExpansionRow) =>
		(p.details?.caps.types ?? [])
			.filter((t) => t.cap !== null && t.cap > 0)
			.map((t) => `${nameOf(p.details!.names, t.district).replace(/ District$/, '')} ${t.cap}`)
			.join(' · ');

	// The toggles are a per-viewer convenience, remembered in this browser.
	const KEY = 'expansion-view';
	let view: ExpansionView = $state({ candidates: false, all: false });
	onMount(() => {
		try {
			view = { ...view, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
		} catch {
			/* storage unavailable: defaults */
		}
	});
	const save = () => {
		try {
			localStorage.setItem(KEY, JSON.stringify(view));
		} catch {
			/* storage unavailable */
		}
	};

	const shown = $derived(planets.filter((p) => visible(p, view)));
	const counts = $derived(expansionCounts(planets));
	const candidateLabel = (c: string) =>
		c.startsWith('toxic') ? 'toxic: needs a perk, origin or civic' : 'terraforming candidate';
</script>

<Panel
	title="Expansion"
	note="Surveyed planets nobody owns, nearest first. Habitability is not shown."
>
	<div class="mb-2 flex flex-wrap gap-x-4 text-sm">
		<label
			><input type="checkbox" bind:checked={view.candidates} onchange={save} /> terraforming
			candidates ({counts.candidates})</label
		>
		<label
			><input type="checkbox" bind:checked={view.all} onchange={save} /> other uncolonizable ({counts.rest})</label
		>
	</div>
	{#if shown.length === 0}
		<p>No colonizable class among the surveyed planets — see the toggles.</p>
	{:else}
		<table class="text-left text-sm">
			<thead>
				<tr class="border-b border-gray-300 dark:border-gray-700">
					<th class="p-1">Planet</th>
					<th class="p-1">Class</th>
					<th class="p-1 text-right">Size</th>
					<th class="p-1">System</th>
					<th class="p-1 text-right">Jumps</th>
					<th class="p-1 text-right" title="district limit: size, less blockers">Districts</th>
					<th class="p-1">Caps</th>
					<th class="p-1 text-right">Blockers</th>
					<th class="p-1">Modifier</th>
					<th class="p-1">Note</th>
				</tr>
			</thead>
			<tbody>
				{#each shown as p (p.planetId)}
					<tr
						class="cursor-pointer border-b border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900 {p.colonizable
							? ''
							: 'text-gray-500'}"
						onclick={() => (open = open === p.planetId ? null : p.planetId)}
						title="details"
					>
						<td class="p-1">{p.name}</td>
						<td class="p-1">{p.className}</td>
						<td class="p-1 text-right">{p.size}</td>
						<td class="p-1">{p.system}</td>
						<td class="p-1 text-right">{p.jumps ?? '–'}</td>
						<td class="p-1 text-right">{p.details?.caps.limit ?? '–'}</td>
						<td class="p-1">{capsLine(p)}</td>
						<td class="p-1 text-right"
							>{p.planet?.deposits.filter((d) => p.details?.blockers.includes(d.key)).length ||
								''}</td
						>
						<td class="p-1">{p.modifier ? pretty(p.modifier.replace(/^pm_/, '')) : ''}</td>
						<td class="p-1">
							{p.candidate ? candidateLabel(p.candidate) : p.colonizable ? '' : 'not colonizable'}
						</td>
					</tr>
					{#if open === p.planetId && p.details}
						<tr class="border-b border-gray-200 dark:border-gray-800">
							<td colspan="10" class="p-2"><PlanetDetails {...p.details} {date} /></td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{/if}
</Panel>
