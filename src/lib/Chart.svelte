<script lang="ts">
	import { onMount } from 'svelte';
	import 'uplot/dist/uPlot.min.css';
	import type uPlot from 'uplot';
	import { colorOf } from './colors.ts';
	import {
		DEFAULT_WINDOW,
		START_YEAR,
		gameMonth,
		panWindow,
		spanWindow,
		windowRange,
		zoomWindow,
		type Series
	} from './series.ts';
	import { timeWindow } from './timeWindow.svelte.ts';
	import { isDark, onThemeChange } from './theme.ts';
	import { chartEvents } from './chartEvents.svelte.ts';
	import EventPicker from './EventPicker.svelte';
	import type { Milestone } from './milestones.ts';

	/** A due date drawn on the chart: a line where it falls, or a note at the edge when beyond. */
	export type Marker = { x: number; tint: string; label: string };

	// yMin: a floor the value cannot go below (empire size starts at 50), so the axis does not
	// spend its height on impossible values. A history chart passes its `extent` (first and last
	// save) and shows the window all history charts share; a projection passes its own `range`.
	let {
		title,
		series,
		range,
		extent,
		yMin,
		yMax,
		markers = [],
		right = [],
		rightFloor = 50,
		colors = {},
		events,
		scope = 'empire'
	}: {
		title: string;
		series: Series;
		range?: [number, number];
		extent?: [number, number];
		yMin?: number;
		yMax?: number; // a fixed top, e.g. 100 for percentages
		markers?: Marker[];
		right?: string[]; // lines drawn against a second y-axis on the right
		rightFloor?: number; // the right axis spans at least 0 to this
		colors?: Record<string, string>; // a line's colour by label, before the resource colours
		events?: Milestone[]; // milestones the viewer can switch on, per kind, for this chart
		scope?: 'empire' | 'colony'; // the choice is stored per `<scope>:<title>`, so all colonies share it
	} = $props();

	const xr = $derived<[number, number]>(
		extent ? windowRange(extent, timeWindow.value) : (range ?? [START_YEAR, START_YEAR + 1])
	);

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
		const max = u.scales.x.max ?? xr[1];
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
		const [min, max] = [u.scales.x.min ?? xr[0], u.scales.x.max ?? xr[1]];
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

	let UPlot: typeof uPlot | undefined;
	let built = ''; // the lines the plot was built with

	const lineKey = (s: Series, r: string[]) => JSON.stringify([Object.keys(s.lines), r]);

	function build(UPlot: typeof uPlot) {
		plot?.destroy();
		built = lineKey(series, right);
		const opts: uPlot.Options = {
			width: el.clientWidth,
			height: 220,
			scales: {
				x: { time: false, range: () => xr },
				// The right axis (e.g. open jobs) spans at least 0–rightFloor, so small changes stay
				// small; below 0 only for a line that goes there (a resource's net per month).
				right: {
					range: (_u, min, max) => [Math.min(0, min), Math.max(rightFloor, max)]
				},
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
					stroke: colors[label] ?? colorOf(label) ?? palette[i % palette.length],
					...(right.includes(label) ? { scale: 'right' } : {}),
					dash: dashes[i % dashes.length],
					width: 1.5,
					spanGaps: true
				}))
			],
			// A history chart: dragging selects the stretch to zoom to — for every history chart, so
			// uPlot's own zoom and its double-click reset stay off.
			cursor: extent
				? {
						drag: { x: true, y: false, setScale: false },
						bind: { dblclick: () => null } as unknown as uPlot.Cursor.Bind
					}
				: {},
			// uPlot shows "--" unless the cursor is over the chart; show the latest values instead.
			hooks: {
				setSelect: [select],
				ready: [showLatest],
				setData: [showLatest],
				setCursor: [(u) => u.cursor.idx == null && showLatest(u), hover],
				draw: [(u) => drawMarkers(u, UPlot.pxRatio), (u) => drawEvents(u, UPlot.pxRatio)]
			}
		};
		plot = new UPlot(opts, data(series), el);
	}

	function select(u: uPlot) {
		if (!extent || u.select.width < 4) return;
		const from = u.posToVal(u.select.left, 'x');
		const to = u.posToVal(u.select.left + u.select.width, 'x');
		u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
		timeWindow.set(spanWindow(extent, from, to));
	}

	// Ctrl (⌘) + wheel zooms around the cursor, Shift + wheel moves; the plain wheel scrolls the page.
	function wheel(e: WheelEvent) {
		if (!extent || !plot || !(e.ctrlKey || e.metaKey || e.shiftKey)) return;
		e.preventDefault();
		const delta = e.deltaY || e.deltaX;
		if (!delta) return;
		if (e.shiftKey) {
			timeWindow.set(panWindow(timeWindow.value, extent, Math.sign(delta) * (xr[1] - xr[0]) * 0.1));
		} else {
			const at = plot.posToVal(e.clientX - plot.over.getBoundingClientRect().left, 'x');
			timeWindow.set(zoomWindow(timeWindow.value, extent, delta > 0 ? 1.25 : 0.8, at));
		}
	}

	const reset = () => extent && timeWindow.set(DEFAULT_WINDOW);

	onMount(() => {
		let disposed = false;
		el.addEventListener('wheel', wheel, { passive: false });
		el.addEventListener('dblclick', reset);
		import('uplot').then(({ default: loaded }) => {
			if (disposed) return;
			UPlot = loaded;
			build(loaded);
		});
		const resize = new ResizeObserver(() => plot?.setSize({ width: el.clientWidth, height: 220 }));
		resize.observe(el);
		const unsubscribe = onThemeChange(() => plot?.redraw());
		return () => {
			disposed = true;
			el.removeEventListener('wheel', wheel);
			el.removeEventListener('dblclick', reset);
			unsubscribe();
			resize.disconnect();
			plot?.destroy();
		};
	});

	// New data with the same lines: update in place. Different lines: build the plot anew — the
	// parent's key block (a new tip) does not catch them all: a save merging into the log month
	// before it keeps the tip and may add lines (the log month has no income or expenses).
	// Read series and range before touching plot: on the first run plot does not exist yet (uPlot
	// loads async), and `plot?.setData(data(series))` would skip reading them — the effect would
	// then never rerun (the growth tab's horizon buttons changed nothing).
	$effect(() => {
		const d = data(series);
		const [min, max] = xr;
		const key = lineKey(series, right);
		if (!plot || !UPlot) return;
		if (key !== built) build(UPlot);
		else plot.setData(d);
		plot.setScale('x', { min, max });
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
	<div
		bind:this={el}
		title={extent
			? 'drag: zoom to a stretch · Ctrl+wheel: zoom · Shift+wheel: move · double-click: the default window — for every chart'
			: undefined}
	></div>
</section>

<style>
	/* The x value is the game date, already in the page header; uPlot has no per-series opt-out. */
	section :global(.u-legend .u-series:first-child) {
		display: none;
	}
</style>
