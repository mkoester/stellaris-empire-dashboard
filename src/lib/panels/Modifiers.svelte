<script lang="ts">
	import { byExpiry, timeLeft } from '../countryModifiers.ts';
	import { pretty } from '../format.ts';
	import InfoPopup from '../InfoPopup.svelte';
	import type { CountryModifier, Explanation } from '../types.ts';
	import Panel from './Panel.svelte';

	// Empire-wide effects from events, agendas, relics, …: `country.timed_modifier`. Named and
	// explained from the data DB's static modifiers; a key it does not know shows as the key.
	let {
		modifiers,
		date,
		explain = {}
	}: {
		modifiers: (CountryModifier & { name: string | null })[];
		date: string;
		explain?: Record<string, Explanation>;
	} = $props();
	const shown = $derived(byExpiry(modifiers.map((m) => ({ ...m, name: m.name ?? pretty(m.key) }))));
</script>

<Panel title="Empire modifiers">
	{#each shown as m (m.key)}
		<div class="flex justify-between gap-3">
			<InfoPopup explanation={explain[`modifier:${m.key}`]}>{m.name}</InfoPopup>
			<span class="shrink-0 text-gray-500 tabular-nums" title={m.until ?? ''}
				>{m.until ? timeLeft(date, m.until) : 'permanent'}</span
			>
		</div>
	{:else}
		<div>none</div>
	{/each}
</Panel>
