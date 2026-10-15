<script lang="ts">
	import { automationSummary } from '../automation.ts';
	import { colorOf } from '../colors.ts';
	import { pretty } from '../format.ts';
	import Panel from './Panel.svelte';

	let { defaults, blocked }: { defaults: string[]; blocked: string[] } = $props();
</script>

<Panel title="Automation">
	<div>new colonies start with: <b>{automationSummary(defaults)}</b></div>
	<div>
		may not spend:
		{#each blocked as r (r)}
			<span class="mr-2" style:color={colorOf(r)}>{pretty(r)}</span>
		{:else}
			<b>nothing blocked</b>
		{/each}
	</div>
</Panel>
