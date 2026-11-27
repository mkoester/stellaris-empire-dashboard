<script lang="ts">
	import { formatModifierValue, modifierColor, modifierLabel, modifierTint } from './modifiers.ts';
	import ResourceChips from './ResourceChips.svelte';
	import type { Modifier, Resources } from './types.ts';

	// What a Grand Archive specimen gives once exhibited and active (#lib/archive.ts
	// `specimenGives()`): its modifiers — the value green/red, the label in its resource's colour —
	// and its resources a month. `on` false: it gives nothing now, all grey.
	let {
		bonuses,
		produces,
		on = true
	}: {
		bonuses: (Modifier & { condition: string | null; applies: boolean | null })[];
		produces: Resources;
		on?: boolean;
	} = $props();
</script>

{#if bonuses.length || Object.keys(produces).length}
	<span class="inline-flex flex-wrap items-baseline gap-x-2" class:text-gray-400={!on}>
		{#each bonuses as b (`${b.key}|${b.condition}`)}
			<span
				class="whitespace-nowrap"
				class:opacity-60={b.applies === null}
				title={b.applies === null ? `only if ${b.condition} — the save does not tell` : ''}
			>
				<span class="font-mono font-semibold {on ? modifierColor(b) : ''}">
					{formatModifierValue(b)}
				</span><span style:color={on ? modifierTint(b.key) : undefined}>
					{` ${modifierLabel(b)}${b.applies === null ? ' (?)' : ''}`}
				</span>
			</span>
		{/each}
		{#if Object.keys(produces).length}
			<span class="whitespace-nowrap" class:opacity-50={!on} class:grayscale={!on}>
				<ResourceChips flows={produces} sign={1} /><span class="ml-1">a month</span>
			</span>
		{/if}
	</span>
{/if}
