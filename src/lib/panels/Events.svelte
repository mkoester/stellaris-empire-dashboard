<script lang="ts">
	import { chartEvents } from '../chartEvents.svelte.ts';
	import EventList from '../EventList.svelte';
	import EventPicker from '../EventPicker.svelte';
	import type { Milestone } from '../milestones.ts';
	import Panel from './Panel.svelte';

	// The campaign's milestones as a log; kinds picked like on a chart (the events tab searches all).
	let { events }: { events: Milestone[] } = $props();
	const picker = chartEvents(() => 'log');
	const shown = $derived(events.filter((e) => picker.shown.includes(e.kind)));
</script>

<Panel
	title="Events"
	note="Bigger events found by comparing consecutive saves, dated to the save that first shows them (up to a month late)."
>
	<div class="mb-2 flex justify-end"><EventPicker {events} {...picker} /></div>
	{#if shown.length === 0}
		<p class="text-sm text-gray-500">Pick the kinds to list under “events”.</p>
	{:else}
		<EventList events={shown} />
	{/if}
</Panel>
