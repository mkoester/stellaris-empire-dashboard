<script lang="ts">
	import { onMount } from 'svelte';
	import { expansionCounts, visible, type ExpansionRow, type ExpansionView } from '../expansion.ts';
	import { pretty } from '../format.ts';
	import Panel from './Panel.svelte';

	let { planets }: { planets: ExpansionRow[] } = $props();

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
					<th class="p-1">Modifier</th>
					<th class="p-1">Note</th>
				</tr>
			</thead>
			<tbody>
				{#each shown as p (p.planetId)}
					<tr
						class="border-b border-gray-200 dark:border-gray-800 {p.colonizable
							? ''
							: 'text-gray-500'}"
					>
						<td class="p-1">{p.name}</td>
						<td class="p-1">{p.className}</td>
						<td class="p-1 text-right">{p.size}</td>
						<td class="p-1">{p.system}</td>
						<td class="p-1 text-right">{p.jumps ?? '–'}</td>
						<td class="p-1">{p.modifier ? pretty(p.modifier.replace(/^pm_/, '')) : ''}</td>
						<td class="p-1">
							{p.candidate ? candidateLabel(p.candidate) : p.colonizable ? '' : 'not colonizable'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Panel>
