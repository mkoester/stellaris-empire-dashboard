<script lang="ts">
	import Panel from './Panel.svelte';

	// Each class's limit from `leaderLimits()` (#lib/leaders.ts): the base 3 plus the
	// `country_<class>_cap_add` of what the save shows held; the save does not hold the result.
	let {
		leaders,
		limits,
		idle = []
	}: {
		leaders: Record<string, number>;
		limits: Record<string, number>;
		idle?: { id: number; class: string; name: string }[];
	} = $props();
	const hired = $derived(
		Object.entries(leaders)
			.filter(([c]) => c !== 'envoy')
			.sort()
	);
</script>

<Panel title="Leaders">
	{#each hired as [cls, n] (cls)}
		{@const cap = limits[cls]}
		<div
			title="limit {cap ??
				'?'}: base 3 plus traditions, perks, civics, techs, edicts and modifiers; council traits, subject perks and conditional sources not counted"
		>
			{cls} <b class={cap !== undefined && n > cap ? 'text-red-600' : ''}>{n} / {cap ?? '?'}</b>
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
