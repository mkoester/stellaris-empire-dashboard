<script lang="ts">
	import { onMount } from 'svelte';
	import 'uplot/dist/uPlot.min.css';
	import type uPlot from 'uplot';
	import { colorOf } from './colors.ts';
	import { gameMonth, type Series } from './series.ts';

	/** A due date drawn on the chart: a line where it falls, or a note at the edge when beyond. */
	export type Marker = { x: number; tint: string; label: string };

	// yMin: a floor the value cannot go below (empire size starts at 50), so the axis does not
	// spend its height on impossible values.
	let {
		title,
		series,
		range,
		yMin,
		markers = [],
		right = []
	}: {
		title: string;
		series: Series;
		range: [number, number];
		yMin?: number;
		markers?: Marker[];
		right?: string[]; // lines drawn against a second y-axis on the right
	} = $props();

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
		ctx.save();
		ctx.font = `${11 * px}px sans-serif`;
		ctx.textBaseline = 'top';
		for (const m of markers) {
			const color = colorOf(m.tint) ?? '#888';
			ctx.fillStyle = ctx.strokeStyle = color;
			if (m.x <= max) {
				const x = u.valToPos(m.x, 'x', true);
				ctx.setLineDash([4 * px, 3 * px]);
				ctx.lineWidth = px;
				ctx.beginPath();
				ctx.moveTo(x, bbox.top);
				ctx.lineTo(x, bbox.top + bbox.height);
				ctx.stroke();
				ctx.textAlign = 'right';
				ctx.fillText(m.label, x - 3 * px, bbox.top + 2 * px);
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
					...(yMin === undefined
						? {}
						: { y: { range: (_u, _min, max) => [yMin, Math.max(max, yMin) * 1.1] } })
				},
				axes: [
					{
						incrs: [1 / 12, 2 / 12, 3 / 12, 6 / 12, 1, 2, 5, 10, 20, 50],
						values: (_u, ticks) => ticks.map(gameMonth)
					},
					{},
					...(right.length ? [{ scale: 'right', side: 1, grid: { show: false } }] : [])
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
					setCursor: [(u) => u.cursor.idx == null && showLatest(u)],
					draw: [(u) => drawMarkers(u, UPlot.pxRatio)]
				}
			};
			plot = new UPlot(opts, data(series), el);
		});
		const resize = new ResizeObserver(() => plot?.setSize({ width: el.clientWidth, height: 220 }));
		resize.observe(el);
		return () => {
			disposed = true;
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
	<h2 class="mb-1 font-semibold">{title}</h2>
	<div bind:this={el}></div>
</section>

<style>
	/* The x value is the game date, already in the page header; uPlot has no per-series opt-out. */
	section :global(.u-legend .u-series:first-child) {
		display: none;
	}
</style>
