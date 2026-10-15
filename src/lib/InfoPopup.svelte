<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Explanation } from './types.ts';
	import ExplanationCard from './ExplanationCard.svelte';

	// Wraps a name: hovering it (or focusing it, e.g. a tap on a phone) shows what the game files
	// say about it. Without an explanation the name renders plain. Plain CSS, no popup library —
	// the planner's InfoPopup needs Skeleton UI, which this app does not use.
	let { explanation, children }: { explanation?: Explanation; children: Snippet } = $props();
</script>

{#if explanation}
	<span class="group relative inline-block">
		<span
			tabindex="0"
			role="button"
			class="cursor-help underline decoration-dotted underline-offset-2">{@render children()}</span
		>
		<span
			class="invisible absolute top-full left-0 z-50 mt-1 w-80 max-w-[90vw] rounded-lg border border-gray-300 bg-white p-2.5 text-left text-xs font-normal text-gray-900 opacity-0 shadow-xl transition-opacity delay-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
		>
			<ExplanationCard {explanation} />
		</span>
	</span>
{:else}
	{@render children()}
{/if}
