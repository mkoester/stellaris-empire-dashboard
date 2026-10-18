<script lang="ts">
	import { followGame } from '#lib/live.ts';
	import Expansion from '#lib/panels/Expansion.svelte';

	let { data } = $props();
	followGame(() => data.isHead);
</script>

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
