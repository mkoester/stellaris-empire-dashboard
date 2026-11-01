<script lang="ts">
	import { followGame } from '#lib/live.ts';
	import Expansion from '#lib/panels/Expansion.svelte';
	import SettleDown from '#lib/panels/SettleDown.svelte';

	let { data } = $props();
	followGame(() => data.isHead);
</script>

{#if data.settle}
	<div class="mb-8">
		<SettleDown
			mode={data.settle.mode}
			requirements={data.settle.requirements}
			targets={data.settle.targets}
			outcome={data.settle.outcome}
			species={data.settle.species}
			defines={data.defines}
		/>
	</div>
{/if}

<Expansion
	planets={data.planets}
	date={data.date}
	view={data.view}
	species={data.species}
	defines={data.defines}
	canDetox={data.canDetox}
	habitats={data.habitats}
	rowLine={data.rowLine}
/>
