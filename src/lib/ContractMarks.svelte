<script lang="ts">
	// Contracts on a map (`GalaxyMap`'s `layer`): each kind's symbol left above the system, the
	// contracts in its hover. The map tab draws them as markers of its own instead.
	import { KIND_INFO, type ContractMark } from './contracts.ts';
	import type { Point } from './circle.ts';

	let {
		marks,
		at,
		place
	}: {
		marks: ContractMark[];
		at: (p: { x: number; y: number }) => Point;
		place: Map<number, { x: number; y: number }>; // the map's systems by id
	} = $props();
</script>

{#each marks as m (m.systemId)}
	{@const s = place.get(m.systemId)}
	{#if s}
		{@const p = at(s)}
		<text x={p.x - 6} y={p.y - 5} text-anchor="end" class="text-[12px] font-bold"
			><title>{m.title}</title>{#each m.kinds as k (k)}<tspan fill={KIND_INFO[k].color}
					>{KIND_INFO[k].symbol}</tspan
				>{/each}</text
		>
	{/if}
{/each}
