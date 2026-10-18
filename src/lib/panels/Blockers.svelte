<script lang="ts">
	import BlockerHint from '../BlockerHint.svelte';
	import type { BlockerHint as Hint } from '../blockers.ts';
	import Panel from './Panel.svelte';

	// Blockers on the colonies, the most useful to clear first: clearable now, on colonies that have
	// hit their district limit, the bigger gain, the quicker clearing.
	let { hints, names }: { hints: Hint[]; names: Record<string, string> } = $props();
</script>

<Panel
	title="Blockers to clear"
	note="Clearing raises the colony's district limit; the hidden feature is already in its caps."
>
	{#each hints as h, i (i)}
		<div class="text-sm"><BlockerHint hint={h} {names} colony /></div>
	{:else}
		<div>none</div>
	{/each}
</Panel>
