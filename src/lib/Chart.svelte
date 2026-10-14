<script lang="ts">
	import { onMount } from 'svelte';
	import 'uplot/dist/uPlot.min.css';
	import type uPlot from 'uplot';
	import type { Series } from './series.ts';

	let { title, series }: { title: string; series: Series } = $props();

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

	const data = (s: Series) => [s.x, ...Object.values(s.lines)] as uPlot.AlignedData;

	onMount(() => {
		let disposed = false;
		import('uplot').then(({ default: UPlot }) => {
			if (disposed) return;
			const opts: uPlot.Options = {
				width: el.clientWidth,
				height: 220,
				scales: { x: { time: false } },
				axes: [{ values: (_u, ticks) => ticks.map((t) => String(Math.floor(t))) }, {}],
				series: [
					{ label: 'year', value: (_u, v) => (v == null ? '' : v.toFixed(2)) },
					...Object.keys(series.lines).map((label, i) => ({
						label,
						stroke: palette[i % palette.length],
						width: 1.5
					}))
				]
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
