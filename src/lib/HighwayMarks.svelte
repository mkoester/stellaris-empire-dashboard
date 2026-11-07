<script lang="ts">
	// The Ancient Highway on a map (`GalaxyMap`'s `layer`): gate pairs (portal → exit node) and
	// express links as lines — solid while usable, dashed while not —, portals by their gate's
	// stage and express stations as symbols above the system (#lib/highway.ts `highwayMarks()`).
	import { EXPRESS_COLOR, STAGE_COLOR, type HighwayLine, type HighwayMark } from './highway.ts';
	import type { Point } from './circle.ts';

	let {
		marks,
		lines,
		at,
		place
	}: {
		marks: HighwayMark[];
		lines: HighwayLine[];
		at: (p: { x: number; y: number }) => Point;
		place: Map<number, { x: number; y: number }>; // the map's systems by id
	} = $props();
</script>

{#each lines as l (`${l.kind}-${l.from}-${l.to}`)}
	{@const a = place.get(l.from)}
	{@const b = place.get(l.to)}
	{#if a && b}
		{@const p = at(a)}
		{@const q = at(b)}
		<line
			x1={p.x}
			y1={p.y}
			x2={q.x}
			y2={q.y}
			stroke={l.kind === 'express' ? EXPRESS_COLOR : STAGE_COLOR.repaired}
			stroke-width="1.5"
			stroke-dasharray={l.open ? undefined : '4 3'}
			opacity={l.open ? 0.9 : 0.45}><title>{l.title}</title></line
		>
	{/if}
{/each}
{#each marks as m (`${m.symbol}-${m.systemId}`)}
	{@const s = place.get(m.systemId)}
	{#if s}
		{@const p = at(s)}
		<text x={p.x + 6} y={p.y - 5} class="text-[12px] font-bold" fill={m.color}
			><title>{m.title}</title>{m.symbol}</text
		>
	{/if}
{/each}
