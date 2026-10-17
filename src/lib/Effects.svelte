<script lang="ts">
	import { formatModifierValue, modifierColor, modifierLabel } from './modifiers.ts';
	import type { Explanation } from './types.ts';

	// What a modifier does, compact and inline: its effects, or the game's text when it has none.
	let { explanation: e }: { explanation: Explanation | undefined } = $props();
</script>

{#if e?.modifiers.length}
	<span class="text-xs">
		{#each e.modifiers as m, i (i)}<span class="mr-2 whitespace-nowrap"
				><span class="font-mono font-semibold {modifierColor(m)}">{formatModifierValue(m)}</span>
				<span class="opacity-75">{modifierLabel(m)}</span></span
			>{/each}
	</span>
{:else if e?.text}
	<span class="text-xs opacity-75">{e.text}</span>
{/if}
