<script lang="ts">
	import { onMount } from 'svelte';
	import Chart from './Chart.svelte';
	import type { GrowthRow } from './growth.ts';
	import { projectColony, sumProjections, type Defines } from './growthProjection.ts';
	import { gameYear } from './series.ts';

	// Pops projected over a horizon the viewer picks (remembered per viewer), for the whole empire
	// or one colony (a picker when given several rows) — the growth tab and each colony page.
	let {
		rows,
		defines,
		date,
		years = $bindable(25)
	}: { rows: GrowthRow[]; defines: Defines; date: string; years?: number } = $props();

	const HORIZONS = [10, 25, 50, 75, 100, 150, 200];
	const KEY = 'growthProjectionYears';
	onMount(() => {
		try {
			const stored = Number(localStorage.getItem(KEY));
			if (HORIZONS.includes(stored)) years = stored;
		} catch {
			/* storage unavailable */
		}
	});
	const pick = (h: number) => {
		years = h;
		try {
			localStorage.setItem(KEY, String(h));
		} catch {
			/* storage unavailable */
		}
	};

	let focus = $state<number | null>(null); // a colony's planet id; null: all rows summed
	const months = $derived(years * 12);
	const start = $derived(gameYear(date));
	const chart = $derived.by(() => {
		const shown = rows.filter((r) => focus === null || r.planetId === focus);
		const p = sumProjections(
			shown.map((r) => projectColony(r, months, defines)),
			months
		);
		return {
			x: p.pops.map((_, m) => start + m / 12),
			lines: { pops: p.pops, 'from growth': p.bio, 'from assembly': p.mech }
		};
	});
</script>

<div class="mb-2 flex flex-wrap items-center gap-3 text-sm">
	<span class="flex flex-wrap gap-1">
		{#each HORIZONS as h (h)}<button
				class="rounded px-2 py-0.5 {years === h
					? 'bg-gray-200 font-semibold dark:bg-gray-700'
					: 'hover:bg-gray-100 dark:hover:bg-gray-800'}"
				onclick={() => pick(h)}>{h} years</button
			>{/each}
	</span>
	{#if rows.length > 1}
		<label
			>for <select class="rounded bg-transparent" bind:value={focus}>
				<option value={null}>the whole empire</option>
				{#each rows as r (r.planetId)}<option value={r.planetId}>{r.name}</option>{/each}
			</select></label
		>
	{/if}
</div>
<Chart title="Pops projected" series={chart} range={[start, start + years]} yMin={0} />
