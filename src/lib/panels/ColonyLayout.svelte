<script lang="ts">
	import BuildingName from '../BuildingName.svelte';
	import { nameOf } from '../format.ts';
	import Icon from '../icons/Icon.svelte';
	import { iconFor } from '../icons/icons.ts';
	import type { ColonyDistrict } from '../types.ts';

	// A colony's districts as cards, the way the game's planet view lays them out: per district its
	// icon, colour and count (of its cap, where known), inside it each zone with its buildings as
	// tiles. Free building slots are not in the save, so no empty slot is drawn.
	let {
		districts,
		names,
		colors,
		caps = {},
		categories = {}
	}: {
		districts: ColonyDistrict[];
		names: Record<string, string>;
		colors: Record<string, string>;
		caps?: Record<string, number | null>; // district → its cap on this planet
		categories?: Record<string, string | null>; // building → data DB category
	} = $props();

	type Zone = ColonyDistrict['zones'][number];
	// whether a zone's j-th building works: of a type with N disabled, the first N are shown off
	// (as the table, and as #lib/buildings.ts counts them)
	const activeAt = (z: Zone, j: number) => {
		const b = z.buildings[j];
		const off = (z.disabled ?? []).filter((d) => d === b).length;
		return z.buildings.slice(0, j + 1).filter((x) => x === b).length > off;
	};
</script>

<div class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
	{#each districts as d, i (`${d.type}:${i}`)}
		{@const cap = caps[d.type]}
		<section
			class="district rounded-md border border-l-4 border-gray-200 p-2 dark:border-gray-700"
			style:--c={colors[d.type] ?? 'currentColor'}
			style:border-left-color={colors[d.type]}
		>
			<header class="flex items-center gap-2">
				<span class="tint"><Icon name={iconFor(d.type)} class="size-6" /></span>
				<span class="font-semibold">{nameOf(names, d.type)}</span>
				<span class="ml-auto text-sm text-gray-500 tabular-nums"
					>×{d.built}{cap != null ? ` / ${cap}` : ''}</span
				>
			</header>
			{#if !d.zones.length}
				<p class="mt-1 text-xs text-gray-500 italic">no zone</p>
			{/if}
			{#each d.zones as z, k (k)}
				<div class="mt-2">
					<div class="flex items-center gap-1 text-xs text-gray-500">
						<Icon name={iconFor(z.type)} class="size-3.5" />{nameOf(names, z.type)}
					</div>
					{#if z.buildings.length}
						<ul class="mt-1 flex flex-wrap gap-1">
							{#each z.buildings as b, j (j)}
								{@const on = activeAt(z, j)}
								<li
									class="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-sm dark:border-gray-700 dark:bg-gray-800"
									class:opacity-50={!on}
									class:line-through={!on}
									title={on ? undefined : 'disabled'}
								>
									<Icon name={iconFor(b, categories[b])} class="size-4" /><BuildingName
										key={b}
										name={nameOf(names, b)}
									/>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="mt-1 text-xs text-gray-500 italic">no buildings yet</p>
					{/if}
				</div>
			{/each}
		</section>
	{/each}
</div>

<style>
	.tint {
		color: color-mix(in oklab, var(--c) 70%, black);
	}
	:global(.dark) .tint {
		color: color-mix(in oklab, var(--c) 85%, white);
	}
</style>
