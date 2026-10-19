<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { claimRadius, outlines, REACH, type Site } from './borders.ts';
	import { fit, pan, toScreen, zoomAt, type Point, type View } from './mapView.ts';
	import type { Territory } from './territories.ts';

	// A galaxy map in screen pixels: hyperlanes and systems (own ones tinted, or filled by `fill`),
	// with drag to pan, the wheel to zoom and the bottom edge to resize. What a page draws on top is
	// its `layer`, given the galaxy → screen transform; `extra` are more points to fit. `hovered`
	// (bindable) is the system under the pointer, here or in a table beside: it gets a ring. Binding
	// `selected` makes a click (not a drag) pick the system under the pointer, again to unpick; the
	// picked one keeps a ring of its own. `territories` are drawn as empire borders (#lib/borders.ts).
	type System = Point & {
		id: number;
		name: string;
		lanes: number[];
		owned?: boolean;
		capital?: boolean;
		known?: boolean; // false: an undiscovered star, drawn faint
		wormholes?: number[]; // where explored wormholes lead, drawn as dashed arcs
		lgates?: number[]; // an L-Gate's link to the L-Cluster, likewise
	};
	let {
		systems,
		fill = {},
		titles = {},
		extra = [],
		focus = [],
		heightKey,
		label = 'Galaxy map',
		layer,
		territories = [],
		hovered = $bindable(null),
		selected = $bindable()
	}: {
		systems: System[];
		fill?: Record<number, string>; // system id → colour, instead of the own/other tint
		titles?: Record<number, string>; // system id → hover text after the name
		extra?: Point[];
		focus?: { label: string; points: Point[] }[]; // "fit" buttons besides my empire / everything
		heightKey: string; // localStorage key for the height
		label?: string;
		layer?: Snippet<[(p: Point) => Point, number]>; // transform, scale (px per galaxy unit)
		territories?: Territory[];
		hovered?: number | null;
		selected?: number | null;
	} = $props();
	const byId = $derived(new Map(systems.map((s) => [s.id, s])));

	// our territory split into its sectors: a per-viewer switch, off by default
	let sectors = $state(false);
	const hasSectors = $derived(territories.some((t) => t.parts?.length));
	const shown = $derived(sectors ? territories.flatMap((t) => t.parts ?? [t]) : territories);
	// the outlines only change with the systems and owners, not with panning
	const ownerOf = $derived(new Map(shown.flatMap((t) => t.systems.map((id) => [id, t] as const))));
	// only owned systems claim space, along the lanes between systems of one owner too; the radius
	// follows how dense the galaxy is (#lib/borders.ts)
	const territoryOutlines = $derived.by(() => {
		const sites: Site[] = systems.flatMap((s) => {
			const t = ownerOf.get(s.id);
			return t ? [{ id: s.id, x: s.x, y: s.y, owner: t.key }] : [];
		});
		const byKey = new Map(sites.map((s) => [s.id, s]));
		const lanes = sites.flatMap((s) =>
			(byId.get(s.id)?.lanes ?? []).flatMap((to): [Site, Site][] => {
				const o = byKey.get(to);
				return o && o.owner === s.owner && s.id < to ? [[s, o]] : [];
			})
		);
		return outlines(sites, lanes, REACH * claimRadius(systems));
	});
	const territoryOf = $derived(new Map(shown.map((t) => [t.key, t])));
	const rings = (rs: Point[][]) => rs.map(path).join(' ');
	// each wormhole once (both ends list each other), bent so it does not hide a lane; L-Gates
	// list their link at the gate only
	const wormholes = $derived(
		systems.flatMap((s) => [
			...(s.wormholes ?? []).flatMap((to) => {
				const o = byId.get(to);
				return o && (s.id < to || !(o.wormholes ?? []).includes(s.id))
					? [[s, o, 'wormhole'] as const]
					: [];
			}),
			...(s.lgates ?? []).flatMap((to) => {
				const o = byId.get(to);
				return o ? [[s, o, 'L-Gate'] as const] : [];
			})
		])
	);
	const arc = (a: Point, b: Point) => {
		const [p, q] = [at(a), at(b)];
		const m = { x: (p.x + q.x) / 2 - (q.y - p.y) * 0.2, y: (p.y + q.y) / 2 + (q.x - p.x) * 0.2 };
		return `M${p.x},${p.y}Q${m.x},${m.y} ${q.x},${q.y}`;
	};
	const path = (poly: Point[]) =>
		poly.length ? `M${poly.map((p) => `${at(p).x},${at(p).y}`).join('L')}Z` : '';

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
	const explored = $derived(systems.filter((s) => s.known !== false));
	// at least close enough to tell the capital's neighbours apart (~100px between systems)
	const toCapital = (c: Point) => (view = { cx: c.x, cy: c.y, k: Math.max(v.k, 5) });
	/** Centres a system, zoomed in as for the capital (a page's search uses it). */
	export const show = (id: number) => {
		const s = byId.get(id);
		if (s) toCapital(s);
	};
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
	let start: Point | null = null; // where the pointer went down: a click moves less than 4px
	const down = (e: PointerEvent) => {
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		drag = start = { x: e.clientX, y: e.clientY };
	};
	const up = (e: PointerEvent) => {
		drag = null;
		if (selected === undefined || !start) return;
		if (Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 4) return;
		// the system nearest the pointer, within the 8px hover target
		const r = (e.currentTarget as Element).getBoundingClientRect();
		const p = { x: e.clientX - r.left, y: e.clientY - r.top };
		let best: { id: number; d: number } | null = null;
		for (const s of systems) {
			const q = at(s);
			const d = Math.hypot(q.x - p.x, q.y - p.y);
			if (d <= 8 && (!best || d < best.d)) best = { id: s.id, d };
		}
		if (best) selected = best.id === selected ? null : best.id;
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
	<button class={button} disabled={!explored.length} onclick={() => (view = fit(explored, size))}
		>explored</button
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
	{#if hasSectors}
		<label class="ml-2 flex items-center gap-1"
			><input type="checkbox" bind:checked={sectors} /> sectors</label
		>
	{/if}
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
			onpointerup={up}
			onpointercancel={() => (drag = null)}
		>
			{#each [...territoryOutlines] as [key, rs] (key)}
				{@const t = territoryOf.get(key)!}
				<path
					class="pointer-events-none"
					d={rings(rs)}
					fill={t.color}
					fill-opacity="0.16"
					fill-rule="evenodd"
					stroke={t.color}
					stroke-width="1.5"
					stroke-linejoin="round"
					stroke-dasharray={t.guess ? '4 3' : undefined}
				/>
			{/each}
			{#each systems as s (s.id)}
				{#each new Set(s.lanes) as to (to)}
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
			{#each wormholes as [a, b, via] (`${via}:${a.id}-${b.id}`)}
				<path
					class="pointer-events-none {via === 'wormhole'
						? 'stroke-fuchsia-500'
						: 'stroke-cyan-500'}"
					d={arc(a, b)}
					fill="none"
					stroke-width="1.5"
					stroke-dasharray="5 4"><title>{via} {a.name} – {b.name}</title></path
				>
			{/each}
			{#each systems as s (s.id)}
				<!-- a wider invisible target, so a 3px system is easy to point at -->
				<circle
					role="presentation"
					cx={at(s).x}
					cy={at(s).y}
					r="8"
					fill="transparent"
					onpointerenter={() => (hovered = s.id)}
					onpointerleave={() => (hovered = null)}
					><title
						>{s.name}{s.owned ? ' (yours)' : ''}{s.capital ? ', capital' : ''}{titles[s.id]
							? ` — ${titles[s.id]}`
							: ''}</title
					></circle
				>
				<circle
					cx={at(s).x}
					cy={at(s).y}
					r={fill[s.id] ? 4 : s.known === false ? 2 : 3}
					opacity={s.known === false && !fill[s.id] ? 0.5 : 1}
					fill={fill[s.id]}
					class="pointer-events-none {fill[s.id]
						? 'stroke-white dark:stroke-gray-900'
						: s.owned
							? 'fill-blue-200 stroke-blue-400'
							: 'fill-gray-200 stroke-gray-400'}"
					stroke-width="1"
				/>
			{/each}
			{@render layer?.(at, v.k)}
			{#if selected !== undefined && selected !== null && byId.get(selected)}
				{@const p = at(byId.get(selected)!)}
				<circle
					class="pointer-events-none stroke-sky-500"
					cx={p.x}
					cy={p.y}
					r="14"
					fill="none"
					stroke-width="3"
				/>
				{#if selected !== hovered}
					<text
						class="pointer-events-none fill-current text-xs font-semibold"
						x={p.x + 16}
						y={p.y - 12}>{byId.get(selected)!.name}</text
					>
				{/if}
			{/if}
			{#if hovered !== null && byId.get(hovered)}
				{@const p = at(byId.get(hovered)!)}
				<circle
					class="pointer-events-none stroke-amber-500"
					cx={p.x}
					cy={p.y}
					r="11"
					fill="none"
					stroke-width="3"
				/>
				<text
					class="pointer-events-none fill-current text-xs font-semibold"
					x={p.x + 14}
					y={p.y - 10}>{byId.get(hovered)!.name}</text
				>
			{/if}
		</svg>
	{/if}
</div>
{#if shown.length}
	<div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
		{#each shown as t (t.key)}
			<span class="flex items-center gap-1"
				><span
					class="inline-block h-2.5 w-2.5 rounded-sm border"
					style:background={t.color}
					style:border-style={t.guess ? 'dashed' : 'solid'}
				></span>{t.label}</span
			>
		{/each}
	</div>
{/if}
