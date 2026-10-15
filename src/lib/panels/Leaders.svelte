<script lang="ts">
	import Panel from './Panel.svelte';

	// Base capacity per class: @base_leader_cap = 3 (common/leader_classes, 4.5.2). Techs and
	// civics raise it (country_<class>_cap_add); the save does not hold the result.
	const BASE_CAP = 3;

	let {
		leaders,
		idle = []
	}: { leaders: Record<string, number>; idle?: { id: number; class: string; name: string }[] } =
		$props();
	const hired = $derived(
		Object.entries(leaders)
			.filter(([c]) => c !== 'envoy')
			.sort()
	);
</script>

<Panel title="Leaders">
	{#each hired as [cls, n] (cls)}
		<div title="base capacity {BASE_CAP}; modifiers not included">
			{cls} <b class={n > BASE_CAP ? 'text-red-600' : ''}>{n} / {BASE_CAP}</b>
		</div>
	{/each}
	{#each idle as l (l.id)}
		<div class="text-amber-600" title="hired, but without a ship, fleet, planet or council seat">
			⚠ idle {l.class}: {l.name}
		</div>
	{/each}
	<!-- envoys last and apart: they come with the government, nobody hires them -->
	{#if leaders.envoy}
		<div class="mt-3">envoy <b>{leaders.envoy}</b></div>
	{/if}
</Panel>
