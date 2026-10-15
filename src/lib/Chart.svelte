<script lang="ts">
	import { onMount } from 'svelte';
	import 'uplot/dist/uPlot.min.css';
	import type uPlot from 'uplot';
	import { gameMonth, type Series } from './series.ts';

	// yMin: a floor the value cannot go below (empire size starts at 50), so the axis does not
	// spend its height on impossible values.
	let {
		title,
		series,
		range,
		yMin
	}: { title: string; series: Series; range: [number, number]; yMin?: number } = $props();

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
					...(yMin === undefined
						? {}
						: { y: { range: (_u, _min, max) => [yMin, Math.max(max, yMin) * 1.1] } })
				},
				axes: [
					{
						incrs: [1 / 12, 2 / 12, 3 / 12, 6 / 12, 1, 2, 5, 10, 20, 50],
						values: (_u, ticks) => ticks.map(gameMonth)
					},
					{}
				],
				series: [
					{ label: 'date', value: (_u, v) => (v == null ? '' : gameMonth(v)) },
					...Object.keys(series.lines).map((label, i) => ({
						label: label.replaceAll('_', ' '),
						stroke: palette[i % palette.length],
						dash: dashes[i % dashes.length],
						width: 1.5,
						spanGaps: true
					}))
				],
				// uPlot shows "--" unless the cursor is over the chart; show the latest values instead.
				hooks: {
					ready: [showLatest],
					setData: [showLatest],
					setCursor: [(u) => u.cursor.idx == null && showLatest(u)]
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
