<script lang="ts">
	import { formatModifierValue, modifierColor, modifierLabel } from './modifiers.ts';
	import type { Explanation, Modifier } from './types.ts';

	let { explanation: e }: { explanation: Explanation } = $props();
</script>

{#snippet list(mods: Modifier[])}
	<ul class="space-y-0.5">
		{#each mods as m, i (i)}
			<li class="flex items-baseline gap-1.5">
				<span class="font-mono font-semibold {modifierColor(m)}">{formatModifierValue(m)}</span>
				<span class="opacity-75">{modifierLabel(m)}</span>
			</li>
		{/each}
	</ul>
{/snippet}

<span class="block space-y-1.5">
	<span class="block text-sm font-semibold">{e.title}</span>
	{#if e.facts.length}<span class="block opacity-60">{e.facts.join(' · ')}</span>{/if}
	{#if e.modifiers.length}{@render list(e.modifiers)}{/if}
	{#if e.text}<span class="block whitespace-pre-line opacity-75">{e.text}</span>{/if}
	{#if e.after}
		<span class="block opacity-60">{e.after.label}:</span>
		{@render list(e.after.modifiers)}
	{/if}
	{#if e.description}<span class="block italic opacity-60">{e.description}</span>{/if}
</span>
