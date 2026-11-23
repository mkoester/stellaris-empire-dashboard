<script lang="ts">
	// Lines between systems and symbols above them on a map (`GalaxyMap`'s `layer`): a nomad's
	// waylines, solid where built and dashed where planned, marks such as trouble spots, and small
	// labels under a star (a site's value), and dots sized by a value.
	import type { Point } from './circle.ts';

	export type MapLine = { from: number; to: number; color: string; dashed: boolean; title: string };
	export type MapMark = { systemId: number; symbol: string; color: string; title: string };
	export type MapLabel = { systemId: number; text: string; title: string };
	export type MapDot = { systemId: number; r: number; color: string; title: string }; // r in px

	let {
		lines = [],
		marks = [],
		labels = [],
		dots = [],
		at,
		place
	}: {
		lines?: MapLine[];
		marks?: MapMark[];
		labels?: MapLabel[]; // small text under the star
		dots?: MapDot[]; // a translucent disc on the star, e.g. sized by a value
		at: (p: { x: number; y: number }) => Point;
		place: Map<number, { x: number; y: number }>; // the map's systems by id
	} = $props();
</script>

{#each dots as d (d.systemId)}
	{@const s = place.get(d.systemId)}
	{#if s}
		{@const p = at(s)}
		<circle cx={p.x} cy={p.y} r={d.r} fill={d.color} fill-opacity="0.55" stroke={d.color}>
			<title>{d.title}</title>
		</circle>
	{/if}
{/each}
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
			opacity={l.dashed ? 0.6 : 0.9}
		>
			<title>{l.title}</title>
		</line>
	{/if}
{/each}
{#each marks as m (`${m.symbol}-${m.systemId}`)}
	{@const s = place.get(m.systemId)}
	{#if s}
		{@const p = at(s)}
		<text x={p.x + 6} y={p.y - 5} class="text-[12px] font-bold" fill={m.color}>
			<title>{m.title}</title>{m.symbol}
		</text>
	{/if}
{/each}
{#each labels as l (l.systemId)}
	{@const s = place.get(l.systemId)}
	{#if s}
		{@const p = at(s)}
		<text
			x={p.x}
			y={p.y + 13}
			text-anchor="middle"
			class="fill-gray-700 text-[9px] tabular-nums dark:fill-gray-300"
		>
			<title>{l.title}</title>{l.text}
		</text>
	{/if}
{/each}
