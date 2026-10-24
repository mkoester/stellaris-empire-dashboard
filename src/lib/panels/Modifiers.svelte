<script lang="ts">
	import { byExpiry, timeLeft } from '../countryModifiers.ts';
	import Effects from '../Effects.svelte';
	import { pretty } from '../format.ts';
	import InfoPopup from '../InfoPopup.svelte';
	import SourceBadge from '../SourceBadge.svelte';
	import type { TimedModifier, Explanation } from '../types.ts';
	import Panel from './Panel.svelte';

	// Empire-wide effects from events, agendas, relics, …: `country.timed_modifier`. Named and
	// explained from the data DB's static modifiers; a key it does not know shows as the key.
	let {
		modifiers,
		date,
		explain = {}
	}: {
		modifiers: (TimedModifier & { name: string | null })[];
		date: string;
		explain?: Record<string, Explanation>;
	} = $props();
	const shown = $derived(byExpiry(modifiers.map((m) => ({ ...m, name: m.name ?? pretty(m.key) }))));
	// What set it, as far as the key tells: a council agenda's (`agenda_*`), a situation stage's
	// (`red_giant_stage_4`), else an event's, relic's, …
	const kind = (key: string) =>
		key.startsWith('agenda_') ? 'agenda' : /_stage_\d+$/.test(key) ? 'situation' : 'event';
</script>

<Panel title="Empire modifiers">
	{#each shown as m (m.key)}
		<div class="mb-1">
			<div class="flex justify-between gap-3">
				<span
					><SourceBadge kind={kind(m.key)} />
					<InfoPopup explanation={explain[`modifier:${m.key}`]}>{m.name}</InfoPopup></span
				>
				<span class="shrink-0 text-gray-500 tabular-nums" title={m.until ?? ''}
					>{m.until ? timeLeft(date, m.until) : 'permanent'}</span
				>
			</div>
			<Effects explanation={explain[`modifier:${m.key}`]} />
		</div>
	{:else}
		<div>none</div>
	{/each}
</Panel>
