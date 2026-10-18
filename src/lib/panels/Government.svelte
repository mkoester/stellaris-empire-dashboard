<script lang="ts">
	import type { EffectTotal } from '../effects.ts';
	import EffectTotals from '../EffectTotals.svelte';
	import InfoPopup from '../InfoPopup.svelte';
	import type { Explanation } from '../types.ts';
	import Panel from './Panel.svelte';

	// Government type, authority, ethics, civics and origin, each explained in a popup, and what
	// their modifiers add up to.
	let {
		government,
		explain = {}
	}: {
		government: {
			date: string;
			rows: { label: string; items: { id: string; name: string }[] }[];
			effects: EffectTotal[];
		} | null;
		explain?: Record<string, Explanation>;
	} = $props();
</script>

<Panel
	title="Government"
	note="Effects: the choices' flat modifiers summed. Effects that depend on conditions are in each choice's popup text."
>
	{#if !government}
		<p class="text-sm text-gray-500">Not in the saves read so far.</p>
	{:else}
		<table class="mb-3 text-left text-sm">
			<tbody>
				{#each government.rows as r (r.label)}
					<tr class="align-top">
						<th class="pr-3 pb-1 font-normal text-gray-500">{r.label}</th>
						<td class="pb-1">
							{#each r.items as i, n (i.id)}{n ? ', ' : ''}<InfoPopup explanation={explain[i.id]}
									>{i.name}</InfoPopup
								>{/each}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if government.effects.length}
			<h3 class="mb-1 text-sm font-semibold">Effects</h3>
			<EffectTotals effects={government.effects} />
		{/if}
	{/if}
</Panel>
