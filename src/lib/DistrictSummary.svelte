<script lang="ts">
	import { nameOf } from './format.ts';
	import type { ColonyDistrict } from './types.ts';

	// One line per colony: each district type built (×n) and, per zone, how many buildings it holds.
	// Free district and building slots are computed by the game and not in the save.
	let { districts, names }: { districts: ColonyDistrict[]; names: Record<string, string> } =
		$props();

	const short = (key: string) => nameOf(names, key).replace(/ District$/, '');
</script>

{#each districts.filter((d) => d.built > 0 || d.zones.length) as d, i (d.type)}
	{i ? ' · ' : ''}<span class="whitespace-nowrap">{short(d.type)} <b>×{d.built}</b></span
	>{#if d.zones.length}&nbsp;<span class="text-gray-500"
			>({d.zones.map((z) => `${nameOf(names, z.type)} ${z.buildings.length}`).join(', ')})</span
		>{/if}
{:else}
	<span class="text-gray-500">no districts</span>
{/each}
