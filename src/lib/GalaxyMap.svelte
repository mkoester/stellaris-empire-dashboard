<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import { autoRings, crossReach, ringRadii, sectors as sectorLines } from './quadrants.ts';
	import { claimRadius, outlines, REACH, type Site } from './borders.ts';
	import {
		fit,
		MAP_FULL_KEY,
		MAP_WIDTH_KEY,
		pan,
		parseMapWidth,
		toScreen,
		zoomAt,
		type MapWidth,
		type Point,
		type View
	} from './mapView.ts';
	import type { Territory } from './territories.ts';
	import { MAP_SHIPS, type MapShips, type OwnOnMap } from './mapLayers.ts';
	import type { Arkship } from './types.ts';
	import { specialStar, starTitle, STAR_LEGEND, type StarEffect } from './stars.ts';

	// A galaxy map in screen pixels: hyperlanes and systems (own ones tinted, or filled by `fill`),
	// with drag to pan, the wheel to zoom and the bottom edge to resize. What a page draws on top is
	// its `layer`, given the galaxy → screen transform; `extra` are more points to fit. `hovered`
	// (bindable) is the system under the pointer, here or in a table beside: it gets a ring. Binding
	// `selected` makes a click (not a drag) pick the system under the pointer, again to unpick; the
	// picked one keeps a ring of its own. `territories` are drawn as empire borders (#lib/borders.ts).
	// `own` (map and systems tabs) adds a nomad's "my waystations" in place of "my empire", the fit
	// "my stations and ships" and our ships drawn per system, which `ships` picks (`onShips` stores it).
	// Stars that change the fight in their system (#lib/stars.ts: pulsars, neutron stars, black
	// holes, …) get an icon left of the system, their effects as its hover, one legend entry below.
	// `arkships` (a nomad's) are drawn always, as a hexagon above their system, the capital ringed,
	// with a fit "my arkships".
	// "full window" lays the map over the whole browser window (Esc leaves it), for every map, per
	// viewer; `controls` (the page's own, e.g. the map tab's modes) go under the toolbar, so they
	// stay in reach there.
	// `beside` is the page's table of what the map shows: the page draws it below the map, and hands
	// it over to go beside the map when the viewer picks "wide + table" (`width`, bindable, tells it
	// which; without `beside` that choice is drawn as plain wide).
	type System = Point & {
		id: number;
		name: string;
		lanes: number[];
		owned?: boolean;
		capital?: boolean;
		known?: boolean; // false: an undiscovered star, drawn faint
		wormholes?: number[]; // where explored wormholes lead, drawn as dashed arcs
		lgates?: number[]; // an L-Gate's link to the L-Cluster, likewise
		star?: string; // star class: a special one gets an icon
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
		beside,
		controls,
		width = $bindable('normal'),
		territories = [],
		hovered = $bindable(null),
		selected = $bindable(),
		onsystemmenu,
		own,
		ships = 'off',
		onShips,
		arkships = []
	}: {
		systems: System[];
		fill?: Record<number, string>; // system id → colour, instead of the own/other tint
		titles?: Record<number, string>; // system id → hover text after the name
		extra?: Point[];
		focus?: { label: string; points: Point[] }[]; // "fit" buttons besides my empire / everything
		heightKey: string; // localStorage key for the height
		label?: string;
		layer?: Snippet<[(p: Point) => Point, number]>; // transform, scale (px per galaxy unit)
		beside?: Snippet;
		controls?: Snippet;
		width?: MapWidth;
		territories?: Territory[];
		hovered?: number | null;
		selected?: number | null;
		// a right-click on a system (the nearest within 8px), with the pointer's place in the window
		onsystemmenu?: (systemId: number, at: { x: number; y: number }) => void;
		own?: OwnOnMap;
		ships?: MapShips;
		onShips?: (v: MapShips) => void;
		arkships?: Arkship[];
	} = $props();
	const byId = $derived(new Map(systems.map((s) => [s.id, s])));
	const uid = $props.id(); // several maps on a page: their gradients' ids

	// Rings and sectors around the core (#lib/quadrants.ts): the profile's choice and the
	// campaign's radii come with the layout's data, so every map draws them alike.
	const quadrants = $derived(page.data.quadrants?.view.on ? page.data.quadrants : null);
	const radii = $derived(
		quadrants
			? ringRadii(
					quadrants.inner,
					quadrants.outer,
					quadrants.view.rings ?? autoRings(quadrants.inner, quadrants.outer)
				)
			: []
	);
	const cross = $derived(
		quadrants ? sectorLines(quadrants.view.sectors, quadrants.view.rotated) : null
	);
	// a bearing (clockwise from north) as a screen direction: north is up
	const dir = (deg: number) => ({
		x: Math.sin((deg * Math.PI) / 180),
		y: -Math.cos((deg * Math.PI) / 180)
	});

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
		// systems without a shown owner are cut out where they fall inside a territory
		const holes = systems.filter((s) => !ownerOf.has(s.id));
		return outlines(sites, lanes, REACH * claimRadius(systems), holes);
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
	// The width is one choice for every map, per viewer: in the page, the browser's full width
	// (`vw`, the window without its scrollbar), or that with the page's table beside the map.
	let vw = $state(0);
	// the whole browser window: one choice for every map, per viewer
	let fullWindow = $state(false);
	const full = $derived(!fullWindow && width !== 'normal' && vw > 0);
	const side = $derived(width === 'side' && beside !== undefined);
	// The table beside reaches the window's bottom, whatever the map's height, and scrolls on its
	// own; it sticks below the window's top edge once the page scrolls past it. Its table's header
	// stays in sight while it scrolls (the `[&_thead_th]` classes).
	const GAP = 16;
	let aside: HTMLElement | undefined = $state();
	let asideH = $state(0);
	const fitAside = () => {
		if (aside)
			asideH = Math.max(200, innerHeight - Math.max(aside.getBoundingClientRect().top, GAP) - GAP);
	};
	$effect(() => {
		if (side && aside) fitAside();
	});
	const setFullWindow = (on: boolean) => {
		fullWindow = on;
		try {
			localStorage.setItem(MAP_FULL_KEY, on ? '1' : '');
		} catch {
			/* storage unavailable */
		}
	};
	// the page behind does not scroll while the map covers it
	$effect(() => {
		if (!fullWindow) return;
		const html = document.documentElement;
		const before = html.style.overflow;
		html.style.overflow = 'hidden';
		return () => {
			html.style.overflow = before;
		};
	});
	const setWidth = (m: MapWidth) => {
		width = m;
		try {
			localStorage.setItem(MAP_WIDTH_KEY, m);
		} catch {
			/* storage unavailable */
		}
	};
	onMount(() => {
		try {
			height = Math.max(200, Number(localStorage.getItem(heightKey)) || height);
			width = parseMapWidth(localStorage.getItem(MAP_WIDTH_KEY));
			fullWindow = localStorage.getItem(MAP_FULL_KEY) === '1';
		} catch {
			/* storage unavailable: default */
		}
		const html = document.documentElement;
		const measure = () => (vw = html.clientWidth);
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(html);
		return () => ro.disconnect();
	});
	$effect(() => {
		// the full window's height is the window's, not a choice to remember
		if (fullWindow || outer === 0 || outer === height) return;
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
	const points = (ids: number[]) => ids.flatMap((id) => byId.get(id) ?? []);
	// a nomad's home is its waystations; everyone else's the systems it owns
	const home = $derived(
		own?.nomad
			? { label: 'my waystations', points: points(own.waystations) }
			: { label: 'my empire', points: systems.filter((s) => s.owned) }
	);
	const stationsAndShips = $derived(
		own ? points([...own.stations, ...own.ships.map((x) => x.systemId)]) : []
	);
	// our ships per system, as the viewer picked
	const shipsAt = $derived.by(() => {
		const at = new Map<number, string[]>();
		for (const x of own?.ships ?? [])
			if (ships === 'all' || (ships === 'fleets') === (x.kind === 'fleet'))
				at.set(x.systemId, [...(at.get(x.systemId) ?? []), x.name]);
		return ships === 'off' ? new Map<number, string[]>() : at;
	});
	// our arkships per system
	const arksAt = $derived.by(() => {
		const at = new Map<number, Arkship[]>();
		for (const a of arkships)
			if (a.systemId !== null) at.set(a.systemId, [...(at.get(a.systemId) ?? []), a]);
		return at;
	});
	const arkPoints = $derived(points([...arksAt.keys()]));
	const hexagon = (x: number, y: number, r: number) =>
		Array.from({ length: 6 }, (_, i) => {
			const t = (Math.PI / 3) * i - Math.PI / 2;
			return `${i ? 'L' : 'M'}${(x + r * Math.cos(t)).toFixed(1)},${(y + r * Math.sin(t)).toFixed(1)}`;
		}).join('') + 'Z';
	// systems whose star changes the fight there
	const specials = $derived(
		systems.flatMap((s) => {
			const star = specialStar(s.star);
			return star ? [{ s, star }] : [];
		})
	);
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
	// the left button pans and picks; the others (a right-click's menu) leave the view alone
	const down = (e: PointerEvent) => {
		if (e.button !== 0) return;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		drag = start = { x: e.clientX, y: e.clientY };
	};
	// the system nearest the pointer, within the 8px hover target
	const nearest = (e: MouseEvent) => {
		const r = (e.currentTarget as Element).getBoundingClientRect();
		const p = { x: e.clientX - r.left, y: e.clientY - r.top };
		let best: { id: number; d: number } | null = null;
		for (const s of systems) {
			const q = at(s);
			const d = Math.hypot(q.x - p.x, q.y - p.y);
			if (d <= 8 && (!best || d < best.d)) best = { id: s.id, d };
		}
		return best?.id ?? null;
	};
	const up = (e: PointerEvent) => {
		drag = null;
		if (e.button !== 0 || selected === undefined || !start) return;
		if (Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 4) return;
		const best = nearest(e);
		if (best !== null) selected = best === selected ? null : best;
	};
	const menu = (e: MouseEvent) => {
		if (!onsystemmenu) return;
		const id = nearest(e);
		if (id === null) return;
		e.preventDefault();
		onsystemmenu(id, { x: e.clientX, y: e.clientY });
	};
	const move = (e: PointerEvent) => {
		if (!drag) return;
		view = pan(v, e.clientX - drag.x, e.clientY - drag.y);
		drag = { x: e.clientX, y: e.clientY };
	};

	const button =
		'rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40 dark:border-gray-700';
	const widths: [MapWidth, string, string][] = [
		['normal', 'normal', 'the map in the page'],
		['wide', 'wide', 'the map across the whole window'],
		['side', 'wide + table', 'across the whole window, the table beside the map']
	];
	const offered = $derived(beside ? widths : widths.filter(([m]) => m !== 'side'));
</script>

<svelte:window
	onscroll={fitAside}
	onresize={fitAside}
	onkeydown={(e) => {
		if (fullWindow && e.key === 'Escape') setFullWindow(false);
	}}
/>

<!-- a special star's icon, centred on 0,0, about 12px across -->
{#snippet starIcon(effect: StarEffect, binary: boolean)}
	<circle r="6.5" class="fill-white/85 dark:fill-gray-950/85" />
	{#if effect === 'shields'}
		<g class="fill-none stroke-sky-500" stroke-width="1.3" stroke-linejoin="round">
			<path d="M0,-4.8L3.8,-3.3V0C3.8,2.6 2,4 0,5C-2,4 -3.8,2.6 -3.8,0V-3.3Z" />
			<path d="M-4.2,4.2L4.2,-4.2" />
		</g>
	{:else if effect === 'speed'}
		<path
			d="M-3.4,-4.4H3.4L-3.4,4.4H3.4Z"
			class="fill-amber-500/40 stroke-amber-500"
			stroke-width="1.3"
			stroke-linejoin="round"
		/>
	{:else if effect === 'escape'}
		<circle r="4.3" class="fill-gray-900 stroke-violet-500" stroke-width="1.6" />
		<circle r="1.4" class="fill-violet-300" />
	{:else}
		<g class="fill-none stroke-lime-600 dark:stroke-lime-400" stroke-width="1.3">
			<path d={hexagon(0, 0, 4.4)} stroke-linejoin="round" />
			<path d="M-4.2,4.2L4.2,-4.2" />
		</g>
	{/if}
	{#if binary}<circle cx="4.6" cy="-4.6" r="1.7" class="fill-orange-400" />{/if}
{/snippet}

{#snippet swatches()}
	{#if shown.length || specials.length}
		<div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
			{#if specials.length}
				<span
					class="flex items-center gap-1"
					title={`Stars that change the fight in their system (a dot: a binary system):\n${STAR_LEGEND.map((l) => l.title).join('\n')}`}
					><svg width="58" height="14" viewBox="-7 -7 58 14" aria-hidden="true"
						>{#each STAR_LEGEND as l, i (l.effect)}<g transform="translate({i * 14},0)"
								><title>{l.title}</title>{@render starIcon(l.effect, false)}</g
							>{/each}</svg
					>special stars</span
				>
			{/if}
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
{/snippet}

<!-- full width: centred on the window, as `main` is (mx-auto), whatever its max width -->
<!-- the whole window: fixed over the page, below its menus and popups (z-50) -->
<div
	class={fullWindow
		? 'fixed inset-0 z-40 flex flex-col bg-white p-3 dark:bg-gray-950'
		: full
			? 'px-4'
			: ''}
	style={full ? `width: ${vw}px; margin-inline: calc(50% - ${vw / 2}px)` : ''}
>
	<div class="mb-2 flex shrink-0 flex-wrap items-center gap-2 text-sm">
		<button class={button} disabled={!capital} onclick={() => capital && toCapital(capital)}
			>capital</button
		>
		<span class="ml-2 text-gray-500">fit</span>
		<button
			class={button}
			disabled={!home.points.length}
			onclick={() => (view = fit(home.points, size))}>{home.label}</button
		>
		{#if arkships.length}
			<button
				class={button}
				disabled={!arkPoints.length}
				onclick={() => (view = fit(arkPoints, size))}>my arkships</button
			>
		{/if}
		{#if own}
			<button
				class={button}
				disabled={!stationsAndShips.length}
				onclick={() => (view = fit(stationsAndShips, size))}>my stations and ships</button
			>
		{/if}
		<button class={button} disabled={!explored.length} onclick={() => (view = fit(explored, size))}
			>explored</button
		>
		{#each focus as f (f.label)}
			<button
				class={button}
				disabled={!f.points.length}
				onclick={() => (view = fit(f.points, size))}>{f.label}</button
			>
		{/each}
		<button class={button} onclick={() => (view = null)}>everything</button>
		<span class="ml-2 text-gray-500">zoom</span>
		<button class={button} onclick={() => zoomBy(1.5)} aria-label="zoom in">+</button>
		<button class={button} onclick={() => zoomBy(1 / 1.5)} aria-label="zoom out">−</button>
		{#if own}
			<label class="ml-2 flex items-center gap-1"
				>ships
				<select
					class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
					value={ships}
					onchange={(e) => onShips?.((e.currentTarget as HTMLSelectElement).value as MapShips)}
				>
					{#each MAP_SHIPS as o (o)}<option value={o}>{o}</option>{/each}
				</select>
			</label>
		{/if}
		{#if hasSectors}
			<label class="ml-2 flex items-center gap-1"
				><input type="checkbox" bind:checked={sectors} /> sectors</label
			>
		{/if}
		<span class="ml-2 text-gray-500">width</span>
		{#each offered as [m, text, title] (m)}
			{@const active = width === m || (m === 'wide' && width === 'side' && !side)}
			<button
				class="{button} {active ? 'bg-gray-200 dark:bg-gray-800' : ''}"
				aria-pressed={active}
				{title}
				onclick={() => setWidth(m)}>{text}</button
			>
		{/each}
		<button
			class="{button} {fullWindow ? 'bg-gray-200 dark:bg-gray-800' : ''}"
			aria-pressed={fullWindow}
			title={fullWindow ? 'back to the page (Esc)' : 'the map over the whole browser window'}
			onclick={() => setFullWindow(!fullWindow)}
			>{fullWindow ? '✕ full window' : '⛶ full window'}</button
		>
	</div>
	{#if controls}<div class="mb-2 shrink-0">{@render controls()}</div>{/if}
	<div
		class="{side ? 'grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''} {fullWindow
			? 'min-h-0 flex-1'
			: side
				? 'lg:items-start'
				: ''}"
	>
		<div class="min-w-0 {fullWindow ? 'flex h-full min-h-0 flex-col' : ''}">
			<div
				class="w-full overflow-hidden rounded border border-gray-200 dark:border-gray-800 {fullWindow
					? 'min-h-0 flex-1'
					: 'resize-y'}"
				style={fullWindow ? 'min-height: 200px' : `height: ${height}px; min-height: 200px`}
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
						oncontextmenu={menu}
						onpointercancel={() => (drag = null)}
					>
						{#if quadrants && cross}
							{@const c = at({ x: 0, y: 0 })}
							{@const [r0, r1] = [quadrants.inner * v.k, quadrants.outer * v.k]}
							{@const r2 = r1 + crossReach(quadrants.outer) * v.k}
							<g class="pointer-events-none text-gray-500" aria-hidden="true">
								<!-- the cross reaches past the outer ring, fading out -->
								<defs>
									<radialGradient
										id="{uid}-cross"
										gradientUnits="userSpaceOnUse"
										cx={c.x}
										cy={c.y}
										r={r2}
									>
										<stop offset={r1 / r2} stop-color="currentColor" />
										<stop offset="1" stop-color="currentColor" stop-opacity="0" />
									</radialGradient>
								</defs>
								{#each radii as r (r)}
									<circle
										cx={c.x}
										cy={c.y}
										r={r * v.k}
										fill="none"
										stroke="currentColor"
										stroke-opacity="0.13"
										stroke-width="6"
									/>
								{/each}
								{#each cross.lines.flatMap((b) => [b, b + 180]) as b (b)}
									{@const d = dir(b)}
									<line
										x1={c.x + d.x * r0}
										y1={c.y + d.y * r0}
										x2={c.x + d.x * r2}
										y2={c.y + d.y * r2}
										stroke="url(#{uid}-cross)"
										stroke-opacity="0.13"
										stroke-width="6"
									/>
								{/each}
								{#each cross.middles as m (m.deg)}
									{@const d = dir(m.deg)}
									<text
										x={c.x + d.x * (r1 + 14)}
										y={c.y + d.y * (r1 + 14)}
										fill="currentColor"
										fill-opacity="0.6"
										font-size="12"
										text-anchor="middle"
										dominant-baseline="middle">{m.name}</text
									>
								{/each}
							</g>
						{/if}
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
									>{s.name}{s.owned ? ' (yours)' : ''}{s.capital ? ', capital' : ''}{specialStar(
										s.star
									)
										? ` — ${starTitle(specialStar(s.star)!)}`
										: ''}{titles[s.id] ? ` — ${titles[s.id]}` : ''}</title
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
						{#each specials as { s, star } (s.id)}
							{@const p = at(s)}
							<g transform="translate({p.x - 12},{p.y})"
								><title>{s.name} — {starTitle(star)}</title>{@render starIcon(
									star.effect,
									star.binary
								)}</g
							>
						{/each}
						{#each [...shipsAt] as [id, names] (id)}
							{@const s = byId.get(id)}
							{#if s}
								{@const p = at(s)}
								<g class="fill-emerald-600 dark:fill-emerald-400"
									><title>{names.join('\n')}</title><path
										d="M{p.x - 4},{p.y + 9}l4,-7l4,7z"
										class="stroke-white dark:stroke-gray-900"
										stroke-width="0.75"
									/>{#if names.length > 1}<text
											class="text-[10px] font-semibold"
											x={p.x + 5}
											y={p.y + 10}>{names.length}</text
										>{/if}</g
								>
							{/if}
						{/each}
						{#each [...arksAt] as [id, arks] (id)}
							{@const s = byId.get(id)}
							{#if s}
								{@const p = at(s)}
								<g class="pointer-events-none fill-violet-600 dark:fill-violet-400"
									><title
										>{arks
											.map((a) => `${a.name}${a.capital ? ' (capital)' : ''}`)
											.join('\n')}</title
									>{#if arks.some((a) => a.capital)}<circle
											cx={p.x}
											cy={p.y - 10}
											r="8.5"
											fill="none"
											class="stroke-violet-600 dark:stroke-violet-400"
											stroke-width="1.5"
										/>{/if}<path
										d={hexagon(p.x, p.y - 10, 6)}
										class="stroke-white dark:stroke-gray-900"
										stroke-width="1"
									/>{#if arks.length > 1}<text
											class="text-[10px] font-semibold"
											x={p.x + 9}
											y={p.y - 7}>{arks.length}</text
										>{/if}</g
								>
							{/if}
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
			{@render swatches()}
		</div>
		{#if side}
			<aside
				class="overflow-auto {fullWindow
					? 'h-full'
					: 'lg:sticky lg:top-4 lg:h-(--side-h)'} [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-white dark:[&_thead_th]:bg-gray-950"
				style:--side-h="{asideH}px"
				bind:this={aside}
			>
				{@render beside?.()}
			</aside>
		{/if}
	</div>
</div>
