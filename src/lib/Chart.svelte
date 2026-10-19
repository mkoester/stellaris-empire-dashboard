<script lang="ts">
	import { onMount } from 'svelte';
	import 'uplot/dist/uPlot.min.css';
	import type uPlot from 'uplot';
	import { colorOf } from './colors.ts';
	import { gameMonth, type Series } from './series.ts';
	import { isDark, onThemeChange } from './theme.ts';
	import { chartEvents } from './chartEvents.svelte.ts';
	import EventPicker from './EventPicker.svelte';
	import type { Milestone } from './milestones.ts';

	/** A due date drawn on the chart: a line where it falls, or a note at the edge when beyond. */
	export type Marker = { x: number; tint: string; label: string };

	// yMin: a floor the value cannot go below (empire size starts at 50), so the axis does not
	// spend its height on impossible values.
	let {
		title,
		series,
		range,
		yMin,
		yMax,
		markers = [],
		right = [],
		events,
		scope = 'empire'
	}: {
		title: string;
		series: Series;
		range: [number, number];
		yMin?: number;
		yMax?: number; // a fixed top, e.g. 100 for percentages
		markers?: Marker[];
		right?: string[]; // lines drawn against a second y-axis on the right
		events?: Milestone[]; // milestones the viewer can switch on, per kind, for this chart
		scope?: 'empire' | 'colony'; // the choice is stored per `<scope>:<title>`, so all colonies share it
	} = $props();

	// Picked milestones: thin lines in their kind's colour, named on hover.
	const picker = chartEvents(() => `${scope}:${title}`);
	const visible = $derived((events ?? []).filter((e) => picker.shown.includes(e.kind)));
	let hovered: Milestone[] = $state([]);
	$effect(() => {
		void visible;
		plot?.redraw(false, false);
	});

	let el: HTMLDivElement;
	let plot: uPlot | undefined;

	const palette = [
		'#2a78d6',
		'#d6762a',
		'#2aa84a',
		'#c23b3b',
		'#8a4ad6',
		'#8c6d1f',
		'#d64a9b',
		'#3bb2c2',
		'#6b7280',
		'#a3a830',
		'#1f4f8c',
		'#8c1f4f'
	];

	// Lines with equal values (e.g. physics and engineering research at the start) would hide each
	// other: alternate solid, dashed and dotted so the one underneath still shows.
	const dashes = [undefined, [6, 4], [2, 3]];

	const data = (s: Series) => [s.x, ...Object.values(s.lines)] as uPlot.AlignedData;

	function drawMarkers(u: uPlot, px: number) {
		const { ctx, bbox } = u;
		const max = u.scales.x.max ?? range[1];
		let beyond = 0;
		// Labels sit left of their line; markers close together (three research fields due the same
		// month) would print over each other, so a label that would touch the one before moves down
		// a row. rowEnds: each row's rightmost label edge so far.
		const rowEnds: number[] = [];
		ctx.save();
		ctx.font = `${11 * px}px sans-serif`;
		ctx.textBaseline = 'top';
		for (const m of [...markers].sort((a, b) => a.x - b.x)) {
			const color = colorOf(m.tint) ?? '#888';
			ctx.fillStyle = ctx.strokeStyle = color;
			if (m.x <= max) {
				const x = u.valToPos(m.x, 'x', true);
				const right = x - 3 * px;
				const left = right - ctx.measureText(m.label).width;
				let row = rowEnds.findIndex((end) => left > end + 4 * px);
				if (row === -1) row = rowEnds.length;
				rowEnds[row] = right;
				ctx.setLineDash([4 * px, 3 * px]);
				ctx.lineWidth = px;
				ctx.beginPath();
				ctx.moveTo(x, bbox.top);
				ctx.lineTo(x, bbox.top + bbox.height);
				ctx.stroke();
				ctx.textAlign = 'right';
				ctx.fillText(m.label, right, bbox.top + (2 + 14 * row) * px);
			} else {
				ctx.textAlign = 'right';
				ctx.fillText(
					`${m.label} ▸`,
					bbox.left + bbox.width - 2 * px,
					bbox.top + (2 + 14 * beyond++) * px
				);
			}
		}
		ctx.restore();
	}

	const showLatest = (u: uPlot) => u.setLegend({ idx: u.data[0].length - 1 });

	function drawEvents(u: uPlot, px: number) {
		const { ctx, bbox } = u;
		const [min, max] = [u.scales.x.min ?? range[0], u.scales.x.max ?? range[1]];
		ctx.save();
		ctx.lineWidth = px;
		ctx.globalAlpha = 0.7;
		for (const e of visible) {
			if (e.x < min || e.x > max) continue;
			const x = Math.round(u.valToPos(e.x, 'x', true)) + 0.5;
			ctx.strokeStyle = colorOf(e.kind) ?? '#888';
			ctx.beginPath();
			ctx.moveTo(x, bbox.top);
			ctx.lineTo(x, bbox.top + bbox.height);
			ctx.stroke();
		}
		ctx.restore();
	}

	// The events whose line is within a few pixels of the cursor.
	function hover(u: uPlot) {
		const left = u.cursor.left;
		hovered =
			left === undefined || left < 0
				? []
				: visible.filter((e) => Math.abs(u.valToPos(e.x, 'x') - left) <= 4);
	}

	// The canvas draws axes itself (uPlot's default is black): colours by theme, read at each draw.
	const ink = () => (isDark() ? '#d1d5db' : '#374151');
	const rule = () => (isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)');
	const axis = { stroke: ink, grid: { stroke: rule }, ticks: { stroke: rule } };

	onMount(() => {
		let disposed = false;
		import('uplot').then(({ default: UPlot }) => {
			if (disposed) return;
			const opts: uPlot.Options = {
				width: el.clientWidth,
				height: 220,
				scales: {
					x: { time: false, range: () => range },
					// The right axis (e.g. open jobs) spans at least 0–50, so small changes stay small.
					right: { range: (_u, _min, max) => [0, Math.max(50, max)] },
					...(yMin === undefined && yMax === undefined
						? {}
						: {
								y: {
									range: (_u, min, max) => [yMin ?? min, yMax ?? Math.max(max, yMin ?? max) * 1.1]
								}
							})
				},
				axes: [
					{
						...axis,
						incrs: [1 / 12, 2 / 12, 3 / 12, 6 / 12, 1, 2, 5, 10, 20, 50],
						values: (_u, ticks) => ticks.map(gameMonth)
					},
					axis,
					...(right.length ? [{ ...axis, scale: 'right', side: 1, grid: { show: false } }] : [])
				],
				series: [
					{ label: 'date', value: (_u, v) => (v == null ? '' : gameMonth(v)) },
					...Object.keys(series.lines).map((label, i) => ({
						label: label.replaceAll('_', ' '),
						stroke: colorOf(label) ?? palette[i % palette.length],
						...(right.includes(label) ? { scale: 'right' } : {}),
						dash: dashes[i % dashes.length],
						width: 1.5,
						spanGaps: true
					}))
				],
				// uPlot shows "--" unless the cursor is over the chart; show the latest values instead.
				hooks: {
					ready: [showLatest],
					setData: [showLatest],
					setCursor: [(u) => u.cursor.idx == null && showLatest(u), hover],
					draw: [(u) => drawMarkers(u, UPlot.pxRatio), (u) => drawEvents(u, UPlot.pxRatio)]
				}
			};
			plot = new UPlot(opts, data(series), el);
		});
		const resize = new ResizeObserver(() => plot?.setSize({ width: el.clientWidth, height: 220 }));
		resize.observe(el);
		const unsubscribe = onThemeChange(() => plot?.redraw());
		return () => {
			disposed = true;
			unsubscribe();
			resize.disconnect();
			plot?.destroy();
		};
	});

	// New data with the same lines: update in place. Different lines: rebuild via the key block
	// in the parent, which remounts this component.
	$effect(() => {
		plot?.setData(data(series));
	});
</script>

<section class="rounded border border-gray-300 p-2 dark:border-gray-700">
	<div class="mb-1 flex items-baseline gap-2">
		<h2 class="flex-1 font-semibold">{title}</h2>
		{#if events}<EventPicker {events} shown={picker.shown} toggle={picker.toggle} />{/if}
	</div>
	{#if visible.length}
		<!-- one line reserved, so hovering does not move the chart -->
		<p class="h-4 truncate text-xs" title={hovered.map((e) => e.label).join('\n')}>
			{#if hovered.length}
				{hovered[0].date.slice(0, 7)} ·
				{#each hovered.slice(0, 4) as e, i (i)}<span style:color={colorOf(e.kind)}
						>{i ? ' · ' : ''}{e.label}</span
					>{/each}{hovered.length > 4 ? ` · +${hovered.length - 4} more` : ''}
			{/if}
		</p>
	{/if}
	<div bind:this={el}></div>
</section>

<style>
	/* The x value is the game date, already in the page header; uPlot has no per-series opt-out. */
	section :global(.u-legend .u-series:first-child) {
		display: none;
	}
</style>
