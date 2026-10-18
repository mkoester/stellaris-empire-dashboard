<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { fit, pan, toScreen, zoomAt, type Point, type View } from './mapView.ts';

	// A galaxy map in screen pixels: hyperlanes and systems (own ones tinted, or filled by `fill`),
	// with drag to pan, the wheel to zoom and the bottom edge to resize. What a page draws on top is
	// its `layer`, given the galaxy → screen transform; `extra` are more points to fit.
	type System = Point & {
		id: number;
		name: string;
		lanes: number[];
		owned?: boolean;
		capital?: boolean;
	};
	let {
		systems,
		fill = {},
		titles = {},
		extra = [],
		focus = [],
		heightKey,
		label = 'Galaxy map',
		layer
	}: {
		systems: System[];
		fill?: Record<number, string>; // system id → colour, instead of the own/other tint
		titles?: Record<number, string>; // system id → hover text after the name
		extra?: Point[];
		focus?: { label: string; points: Point[] }[]; // "fit" buttons besides my empire / everything
		heightKey: string; // localStorage key for the height
		label?: string;
		layer?: Snippet<[(p: Point) => Point, number]>; // transform, scale (px per galaxy unit)
	} = $props();
	const byId = $derived(new Map(systems.map((s) => [s.id, s])));

	// The height is a per-viewer convenience, remembered in this browser once the viewer resizes
	// (the outer height then differs from the one set), so a new default reaches everyone else.
	let height = $state(630);
	let outer = $state(0);
	let w = $state(0);
	let h = $state(0);
	onMount(() => {
		try {
			height = Math.max(200, Number(localStorage.getItem(heightKey)) || height);
		} catch {
			/* storage unavailable: default */
		}
	});
	$effect(() => {
		if (outer === 0 || outer === height) return;
		try {
			localStorage.setItem(heightKey, String(outer));
		} catch {
			/* storage unavailable */
		}
	});

	// null = everything fitted, following the size; set by zoom, drag and the focus buttons
	let view: View | null = $state(null);
	const size = $derived({ w, h });
	const whole = $derived(fit([...systems, ...extra], size));
	const v = $derived(view ?? whole);
	const kMin = $derived(whole.k / 2);
	const at = (p: Point) => toScreen(v, size, p);

	const capital = $derived(systems.find((s) => s.capital));
	const empire = $derived(systems.filter((s) => s.owned));
	// at least close enough to tell the capital's neighbours apart (~100px between systems)
	const toCapital = (c: Point) => (view = { cx: c.x, cy: c.y, k: Math.max(v.k, 5) });
	const zoomBy = (factor: number) => (view = zoomAt(v, size, { x: w / 2, y: h / 2 }, factor, kMin));

	const wheel = (node: SVGSVGElement) => {
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const r = node.getBoundingClientRect();
			const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines → pixels
			view = zoomAt(
				v,
				size,
				{ x: e.clientX - r.left, y: e.clientY - r.top },
				Math.exp(-dy / 500),
				kMin
			);
		};
		node.addEventListener('wheel', onWheel, { passive: false });
		return () => node.removeEventListener('wheel', onWheel);
	};
	let drag: Point | null = $state(null);
	const down = (e: PointerEvent) => {
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		drag = { x: e.clientX, y: e.clientY };
	};
	const move = (e: PointerEvent) => {
		if (!drag) return;
		view = pan(v, e.clientX - drag.x, e.clientY - drag.y);
		drag = { x: e.clientX, y: e.clientY };
	};

	const button =
		'rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40 dark:border-gray-700';
</script>

<div class="mb-2 flex flex-wrap items-center gap-2 text-sm">
	<button class={button} disabled={!capital} onclick={() => capital && toCapital(capital)}
		>capital</button
	>
	<span class="ml-2 text-gray-500">fit</span>
	<button class={button} disabled={!empire.length} onclick={() => (view = fit(empire, size))}
		>my empire</button
	>
	{#each focus as f (f.label)}
		<button class={button} disabled={!f.points.length} onclick={() => (view = fit(f.points, size))}
			>{f.label}</button
		>
	{/each}
	<button class={button} onclick={() => (view = null)}>everything</button>
	<span class="ml-2 text-gray-500">zoom</span>
	<button class={button} onclick={() => zoomBy(1.5)} aria-label="zoom in">+</button>
	<button class={button} onclick={() => zoomBy(1 / 1.5)} aria-label="zoom out">−</button>
</div>
<div
	class="w-full resize-y overflow-hidden rounded border border-gray-200 dark:border-gray-800"
	style="height: {height}px; min-height: 200px"
	bind:clientWidth={w}
	bind:clientHeight={h}
	bind:offsetHeight={outer}
>
	{#if w > 0 && h > 0}
		<svg
			width={w}
			height={h}
			class="block touch-none select-none {drag ? 'cursor-grabbing' : 'cursor-grab'}"
			role="img"
			aria-label={label}
			{@attach wheel}
			onpointerdown={down}
			onpointermove={move}
			onpointerup={() => (drag = null)}
			onpointercancel={() => (drag = null)}
		>
			{#each systems as s (s.id)}
				{#each s.lanes as to (to)}
					{@const o = byId.get(to)}
					{#if o}
						<line
							x1={at(s).x}
							y1={at(s).y}
							x2={at(o).x}
							y2={at(o).y}
							class="stroke-gray-300 dark:stroke-gray-700"
							stroke-width="1"
						/>
					{/if}
				{/each}
			{/each}
			{#each systems as s (s.id)}
				<circle
					cx={at(s).x}
					cy={at(s).y}
					r={fill[s.id] ? 4 : 3}
					fill={fill[s.id]}
					class={fill[s.id]
						? 'stroke-white dark:stroke-gray-900'
						: s.owned
							? 'fill-blue-200 stroke-blue-400'
							: 'fill-gray-200 stroke-gray-400'}
					stroke-width="1"
					><title
						>{s.name}{s.owned ? ' (yours)' : ''}{s.capital ? ', capital' : ''}{titles[s.id]
							? ` — ${titles[s.id]}`
							: ''}</title
					></circle
				>
			{/each}
			{@render layer?.(at, v.k)}
		</svg>
	{/if}
</div>
