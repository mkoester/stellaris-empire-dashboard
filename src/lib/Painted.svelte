<script lang="ts">
	import { segments } from './outcomes.ts';

	// A text with its resource or tech area in colour and every "L-Gate" in the L-Gate badge's
	// violet (`segments()` in #lib/outcomes.ts): the frontier's outcome texts.
	let { text, marks = [] }: { text: string; marks?: { word: string; color: string }[] } = $props();
</script>

{#each segments(text, marks) as g, i (i)}{#if g.lgate}<span
			class="font-semibold text-violet-700 dark:text-violet-300"
		>
			{g.s}
		</span>{:else if g.color}<span style:color={g.color}>{g.s}</span>{:else}{g.s}{/if}{/each}
