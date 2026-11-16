<script lang="ts">
	// Lines between systems and symbols above them on a map (`GalaxyMap`'s `layer`): a nomad's
	// waylines, solid where built and dashed where planned, and marks such as trouble spots.
	import type { Point } from './circle.ts';

	export type MapLine = { from: number; to: number; color: string; dashed: boolean; title: string };
	export type MapMark = { systemId: number; symbol: string; color: string; title: string };

	let {
		lines = [],
		marks = [],
		at,
		place
	}: {
		lines?: MapLine[];
		marks?: MapMark[];
		at: (p: { x: number; y: number }) => Point;
		place: Map<number, { x: number; y: number }>; // the map's systems by id
	} = $props();
</script>

{#each lines as l (`${l.from}-${l.to}`)}
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
			stroke={l.color}
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-dasharray={l.dashed ? '5 4' : undefined}
			opacity={l.dashed ? 0.6 : 0.9}><title>{l.title}</title></line
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
