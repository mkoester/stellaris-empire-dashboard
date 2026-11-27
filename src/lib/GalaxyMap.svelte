<script lang="ts">
	import { flushSync, onMount, type Snippet } from 'svelte';
	import { keep, recall } from './browserStore.ts';
	import { page } from '$app/state';
	import { autoRings, crossReach, ringRadii, sectors as sectorLines } from './quadrants.ts';
	import { claimRadius, outlines, REACH, type Site } from './borders.ts';
	import {
		fit,
		MAP_FULL_KEY,
		MAP_STARS_KEY,
		MAP_WIDTH_KEY,
		mapStars,
		pan,
		parseMapWidth,
		toScreen,
		zoomAt,
		type MapWidth,
		type Point,
		type View
	} from './mapView.ts';
	import type { Territory } from './territories.ts';
	import { DEFAULT_MAP_OWN, MAP_OWN_INFO, type MapOwn, type OwnOnMap } from './mapLayers.ts';
	import { putSettings } from './settings.ts';
	import type { Arkship } from './types.ts';
	import { specialStar, starTitle, STAR_LEGEND, type StarEffect } from './stars.ts';

	// A galaxy map in screen pixels: hyperlanes and systems (own ones tinted, or filled by `fill`),
	// with drag to pan, the wheel to zoom and the bottom edge to resize. What a page draws on top is
	// its `layer`, given the galaxy → screen transform; `extra` are more points to fit. `hovered`
	// (bindable) is the system under the pointer, here or in a table beside: it gets a ring. Binding
	// `selected` makes a click (not a drag) pick the system under the pointer, again to unpick; the
	// picked one keeps a ring of its own. `territories` are drawn as empire borders (#lib/borders.ts).
	// Our own comes with the layout's data (`ownMap`, every map alike; `own`/`arkships` override
	// it): a nomad's "my waystations" in place of "my empire", the fit "my stations and ships", and
	// drawn per system our colonies and arkships, military fleets and civilian ships — each a
	// switch in the toolbar, the profile's (`mapOwn`), the same on every map.
	// Stars that change the fight in their system (#lib/stars.ts: pulsars, neutron stars, black
	// holes, …) get an icon left of the system, their effects as its hover, one legend entry below;
	// the toolbar's "special stars" hides them (per browser, every map; ⚙'s default until then).
	// `arkships` (a nomad's) are drawn with the colonies, as a hexagon above their system, the
	// capital ringed, with a fit "my arkships"; a system with colonies of ours gets a ring.
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
		square = false,
		label = 'Galaxy map',
		layer,
		beside,
		controls,
		width = $bindable('normal'),
		territories = [],
		hovered = $bindable(null),
		selected = $bindable(),
		onsystemmenu,
		onlegendhover,
		own: ownProp,
		arkships: arkshipsProp
	}: {
		systems: System[];
		fill?: Record<number, string>; // system id → colour, instead of the own/other tint
		titles?: Record<number, string>; // system id → hover text after the name
		extra?: Point[];
		focus?: { label: string; points: Point[] }[]; // "fit" buttons besides my empire / everything
		heightKey: string; // localStorage key for the height
		// the map is the page's last element: as high as it is wide, until the viewer drags it
		square?: boolean;
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
		// the pointer on a territory's line in the legend (its key), and off it (null)
		onlegendhover?: (key: string | null) => void;
		own?: OwnOnMap;
		arkships?: Arkship[];
	} = $props();
	const own: OwnOnMap | undefined = $derived(ownProp ?? page.data.ownMap?.own);
	const arkships: Arkship[] = $derived(arkshipsProp ?? page.data.ownMap?.arkships ?? []);
	// which of our own to draw: the profile's, changed here at once (every map, so stored)
	let ownOn: MapOwn = $derived(page.data.mapOwn ?? DEFAULT_MAP_OWN);
	const setOwn = (k: keyof MapOwn, on: boolean) => {
		ownOn = { ...ownOn, [k]: on };
		putSettings({ mapOwn: ownOn }).catch((e) => console.error(e));
	};
	const byId = $derived(new Map(systems.map((s) => [s.id, s])));
	const uid = $props.id(); // several maps on a page: their gradients' ids
	// a striped territory's bands (`Territory.stripes`): px wide in the map's units
	const STRIPE = 6;
	const stripeStops = (cs: string[]) =>
		cs.map((c, i) => `${c} ${i * 3}px ${(i + 1) * 3}px`).join(', ');

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

	// The height is a per-viewer convenience, remembered in this browser once the viewer drags the
	// box's bottom edge, so a new default reaches everyone else: one for the map in the page (normal,
	// wide), one for "wide + table". Only a drag is kept — a mode switch or leaving the full window
	// also changes the size, and once stored the full window's height in place of the chosen one.
	// A map that is the page's last element (`square` in the page, and always in "wide + table") is
	// by default as high as it is wide where the window has room for that, else it reaches the
	// window's bottom (the user's asks 2026-11-15 and 2026-11-17: square on a window too low for it
	// pushed the legend out of sight). Those heights are
	// stored under keys of their own (`<heightKey>-square`, `<heightKey>-side-square`): a height
	// dragged before is not taken over.
	const DEFAULT_H = 630;
	let chosen: { page: number | null; side: number | null } = $state({ page: null, side: null });
	let fillH = $state(0);
	let box: HTMLElement | undefined = $state();
	let root: HTMLElement | undefined = $state();
	let column: HTMLElement | undefined = $state();
	let w = $state(0);
	let h = $state(0);
	// The width is one choice for every map, per viewer: in the page, the browser's full width
	// (`vw`, the window without its scrollbar), or that with the page's table beside the map.
	let vw = $state(0);
	// the whole browser window: one choice for every map, per viewer
	let fullWindow = $state(false);
	const full = $derived(!fullWindow && width !== 'normal' && vw > 0);
	const side = $derived(width === 'side' && beside !== undefined);
	const mode = $derived(side ? 'side' : 'page');
	const keyOf = (m: 'page' | 'side') =>
		m === 'side' ? `${heightKey}-side-square` : square ? `${heightKey}-square` : heightKey;
	let boxW = $state(0); // the box's width, border included, as its height is set
	const last = $derived(side || square);
	const lastH = $derived(
		boxW > 0 && fillH > 0 ? Math.min(boxW, fillH) : boxW > 0 ? boxW : DEFAULT_H
	);
	let dragH: number | null = $state(null); // while the bottom edge is dragged
	const height = $derived(
		dragH ?? (side ? (chosen.side ?? lastH) : (chosen.page ?? (square ? lastH : DEFAULT_H)))
	);
	// the room the window has for the box: the whole map in sight, its controls above and its
	// legend below, once scrolled to
	const fitFill = () => {
		if (!box || !column || !root) return;
		const b = box.getBoundingClientRect();
		const above = b.top - root.getBoundingClientRect().top;
		const below = column.getBoundingClientRect().bottom - b.bottom;
		fillH = Math.max(200, Math.floor(innerHeight - above - below - 2 * GAP));
	};
	$effect(() => {
		if (last && box && column && root) fitFill();
	});
	// The bottom edge is a handle of its own, not the browser's resize corner: near the window's
	// bottom the drag scrolls the page along, the map growing into the room it makes (the user's
	// ask 2026-11-17: a map at the page's end could only grow to the window's edge per drag).
	const EDGE = 48; // px from the window's bottom where the page starts to scroll
	let grab = 0; // the pointer's distance above the box's bottom edge when pressed
	let pointerY = 0;
	let startH = 0;
	let scrolling = 0; // the requestAnimationFrame of the scroll-along
	const fitDrag = () => {
		if (box) dragH = Math.max(200, Math.round(pointerY + grab - box.getBoundingClientRect().top));
	};
	const scrollAlong = () => {
		const into = pointerY - (innerHeight - EDGE);
		if (dragH === null || into <= 0) {
			scrolling = 0;
			return;
		}
		const step = Math.ceil(Math.min(into, EDGE) / 3); // faster the deeper into the edge
		dragH += step;
		flushSync(); // the page is longer now: room to scroll into
		scrollBy(0, step);
		scrolling = requestAnimationFrame(scrollAlong);
	};
	const startResize = (e: PointerEvent) => {
		if (!box) return;
		e.preventDefault();
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		grab = box.getBoundingClientRect().bottom - e.clientY;
		pointerY = e.clientY;
		dragH = startH = box.offsetHeight;
	};
	const moveResize = (e: PointerEvent) => {
		if (dragH === null) return;
		pointerY = e.clientY;
		fitDrag();
		if (!scrolling) scrolling = requestAnimationFrame(scrollAlong);
	};
	const endResize = () => {
		if (dragH === null) return;
		cancelAnimationFrame(scrolling);
		scrolling = 0;
		if (dragH !== startH) {
			chosen = { ...chosen, [mode]: dragH };
			keep(keyOf(mode), String(dragH));
		}
		dragH = null;
	};
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
		keep(MAP_FULL_KEY, on ? '1' : '');
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
		keep(MAP_WIDTH_KEY, m);
	};
	onMount(() => {
		const stored = (m: 'page' | 'side') => {
			const px = Number(recall(keyOf(m)));
			return px > 0 ? Math.max(200, px) : null;
		};
		chosen = { page: stored('page'), side: stored('side') };
		// this browser's pick, else ⚙'s default width
		width = parseMapWidth(recall(MAP_WIDTH_KEY), page.data.mapDefaults?.width);
		fullWindow = recall(MAP_FULL_KEY) === '1';
		starsOn = mapStars(recall(MAP_STARS_KEY), page.data.mapDefaults?.stars ?? true);
		const html = document.documentElement;
		const measure = () => {
			vw = html.clientWidth;
			if (last) fitFill();
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(html);
		return () => ro.disconnect();
	});

	// null = the start fitted (⚙'s map fit), following the size; set by zoom, drag and the focus
	// buttons
	let view: View | null = $state(null);
	const size = $derived({ w, h });
	const whole = $derived(fit([...systems, ...extra], size));
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
			if (x.kind === 'fleet' ? ownOn.fleets : ownOn.civilian)
				at.set(x.systemId, [...(at.get(x.systemId) ?? []), x.name]);
		return at;
	});
	// our colonies and arkships per system, unless the viewer hid them
	const coloniesAt = $derived(ownOn.colonies ? (own?.colonies ?? []) : []);
	const arksAt = $derived.by(() => {
		const at = new Map<number, Arkship[]>();
		for (const a of ownOn.colonies ? arkships : [])
			if (a.systemId !== null) at.set(a.systemId, [...(at.get(a.systemId) ?? []), a]);
		return at;
	});
	// what there is to switch: arkships count as colonies
	const ownKinds = $derived(
		(Object.keys(MAP_OWN_INFO) as (keyof MapOwn)[]).filter((k) =>
			k === 'colonies'
				? (own?.colonies.length ?? 0) > 0 || arkships.length > 0
				: (own?.ships ?? []).some((x) => (x.kind === 'fleet') === (k === 'fleets'))
		)
	);
	const arkPoints = $derived(points([...arksAt.keys()]));
	const hexagon = (x: number, y: number, r: number) =>
		Array.from({ length: 6 }, (_, i) => {
			const t = (Math.PI / 3) * i - Math.PI / 2;
			return `${i ? 'L' : 'M'}${(x + r * Math.cos(t)).toFixed(1)},${(y + r * Math.sin(t)).toFixed(1)}`;
		}).join('') + 'Z';
	// systems whose star changes the fight there, unless the viewer hid them
	let starsOn = $state(true);
	const setStars = (on: boolean) => {
		starsOn = on;
		keep(MAP_STARS_KEY, on ? '1' : '0');
	};
	const anySpecial = $derived(systems.some((s) => specialStar(s.star)));
	const specials = $derived(
		(starsOn ? systems : []).flatMap((s) => {
			const star = specialStar(s.star);
			return star ? [{ s, star }] : [];
		})
	);
	const explored = $derived(systems.filter((s) => s.known !== false));
	// what a page opens on (⚙ Display, per profile: explored, my empire or everything), following
	// the size; "everything" picked follows it too; an empty set shows everything
	let all = $state(false);
	const startFit = $derived(page.data.mapDefaults?.fit ?? 'explored');
	const opening = $derived(
		all || startFit === 'everything' ? [] : startFit === 'empire' ? home.points : explored
	);
	const v = $derived(view ?? (opening.length ? fit(opening, size) : whole));
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
	onresize={() => {
		fitAside();
		if (last) fitFill();
	}}
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
				>
					<svg width="58" height="14" viewBox="-7 -7 58 14" aria-hidden="true">
						{#each STAR_LEGEND as l, i (l.effect)}<g transform="translate({i * 14},0)">
								<title>{l.title}</title>{@render starIcon(l.effect, false)}
							</g>{/each}
					</svg>special stars
				</span>
			{/if}
			{#each shown as t (t.key)}
				<span
					class="flex items-center gap-1"
					role="presentation"
					onpointerenter={() => onlegendhover?.(t.key)}
					onpointerleave={() => onlegendhover?.(null)}
				>
					<span
						class="inline-block h-2.5 w-2.5 rounded-sm border"
						style:background={t.stripes?.length
							? `repeating-linear-gradient(45deg, ${stripeStops(t.stripes)})`
							: t.color}
						style:border-style={t.guess ? 'dashed' : 'solid'}
					></span>{t.label}
				</span>
			{/each}
		</div>
	{/if}
{/snippet}

<!-- full width: centred on the window, as `main` is (mx-auto), whatever its max width -->
<!-- the whole window: fixed over the page, below its menus and popups (z-50) -->
<div
	bind:this={root}
	class={fullWindow
		? 'fixed inset-0 z-40 flex flex-col bg-white p-3 dark:bg-gray-950'
		: full
			? 'px-4'
			: ''}
	style={full ? `width: ${vw}px; margin-inline: calc(50% - ${vw / 2}px)` : ''}
>
	<div class="mb-2 flex shrink-0 flex-wrap items-center gap-2 text-sm">
		<button class={button} disabled={!capital} onclick={() => capital && toCapital(capital)}>
			capital
		</button>
		<span class="ml-2 text-gray-500">fit</span>
		<button
			class={button}
			disabled={!home.points.length}
			onclick={() => (view = fit(home.points, size))}
		>
			{home.label}
		</button>
		{#if arkships.length}
			<button
				class={button}
				disabled={!arkPoints.length}
				onclick={() => (view = fit(arkPoints, size))}
			>
				my arkships
			</button>
		{/if}
		{#if own}
			<button
				class={button}
				disabled={!stationsAndShips.length}
				onclick={() => (view = fit(stationsAndShips, size))}
			>
				my stations and ships
			</button>
		{/if}
		<button class={button} disabled={!explored.length} onclick={() => (view = fit(explored, size))}>
			explored
		</button>
		{#each focus as f (f.label)}
			<button
				class={button}
				disabled={!f.points.length}
				onclick={() => (view = fit(f.points, size))}
			>
				{f.label}
			</button>
		{/each}
		<button
			class={button}
			onclick={() => {
				view = null;
				all = true;
			}}
		>
			everything
		</button>
		<span class="ml-2 text-gray-500">zoom</span>
		<button class={button} onclick={() => zoomBy(1.5)} aria-label="zoom in">+</button>
		<button class={button} onclick={() => zoomBy(1 / 1.5)} aria-label="zoom out">−</button>
		{#each ownKinds as k (k)}
			<label
				class="ml-2 flex items-center gap-1"
				title="my {MAP_OWN_INFO[k]} — on every map of this profile"
			>
				<input
					type="checkbox"
					checked={ownOn[k]}
					onchange={(e) => setOwn(k, e.currentTarget.checked)}
				/>
				{`my ${MAP_OWN_INFO[k]}`}
			</label>
		{/each}
		{#if anySpecial}
			<label
				class="ml-2 flex items-center gap-1"
				title="icons for pulsars, neutron stars, black holes and other stars that change the fight in their system — on every map in this browser"
			>
				<input
					type="checkbox"
					checked={starsOn}
					onchange={(e) => setStars(e.currentTarget.checked)}
				/> special stars
			</label>
		{/if}
		{#if hasSectors}
			<label class="ml-2 flex items-center gap-1">
				<input type="checkbox" bind:checked={sectors} /> sectors
			</label>
		{/if}
		<span class="ml-2 text-gray-500">width</span>
		{#each offered as [m, text, title] (m)}
			{@const active = width === m || (m === 'wide' && width === 'side' && !side)}
			<button
				class="{button} {active ? 'bg-gray-200 dark:bg-gray-800' : ''}"
				aria-pressed={active}
				{title}
				onclick={() => setWidth(m)}
			>
				{text}
			</button>
		{/each}
		<button
			class="{button} {fullWindow ? 'bg-gray-200 dark:bg-gray-800' : ''}"
			aria-pressed={fullWindow}
			title={fullWindow ? 'back to the page (Esc)' : 'the map over the whole browser window'}
			onclick={() => setFullWindow(!fullWindow)}
		>
			{fullWindow ? '✕ full window' : '⛶ full window'}
		</button>
	</div>
	{#if controls}<div class="mb-2 shrink-0">{@render controls()}</div>{/if}
	<div
		class="{side ? 'grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''} {fullWindow
			? 'min-h-0 flex-1'
			: side
				? 'lg:items-start'
				: ''}"
	>
		<div class="min-w-0 {fullWindow ? 'flex h-full min-h-0 flex-col' : ''}" bind:this={column}>
			<div
				bind:this={box}
				class="relative w-full overflow-hidden rounded border border-gray-200 dark:border-gray-800 {fullWindow
					? 'min-h-0 flex-1'
					: ''}"
				style={fullWindow ? 'min-height: 200px' : `height: ${height}px; min-height: 200px`}
				bind:clientWidth={w}
				bind:offsetWidth={boxW}
				bind:clientHeight={h}
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
										dominant-baseline="middle"
									>
										{m.name}
									</text>
								{/each}
							</g>
						{/if}
						{#each [...territoryOutlines] as [key, rs], n (key)}
							{@const t = territoryOf.get(key)!}
							{@const striped = (t.stripes?.length ?? 0) > 1}
							{#if striped}
								<!-- one band per colour, diagonal, as wide on screen at any zoom -->
								<defs>
									<pattern
										id="{uid}-stripes-{n}"
										patternUnits="userSpaceOnUse"
										width={STRIPE * t.stripes!.length}
										height={STRIPE * t.stripes!.length}
										patternTransform="rotate(45)"
									>
										{#each t.stripes! as c, i (i)}
											<rect
												x={i * STRIPE}
												y="0"
												width={STRIPE}
												height={STRIPE * t.stripes!.length}
												fill={c}
											/>
										{/each}
									</pattern>
								</defs>
							{/if}
							<path
								class="pointer-events-none"
								d={rings(rs)}
								fill={striped ? `url(#${uid}-stripes-${n})` : t.color}
								fill-opacity={striped ? '0.3' : '0.16'}
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
								stroke-dasharray="5 4"
							>
								<title>{via} {a.name} – {b.name}</title>
							</path>
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
							>
								<title>
									{s.name}{s.owned ? ' (yours)' : ''}{s.capital ? ', capital' : ''}{specialStar(
										s.star
									)
										? ` — ${starTitle(specialStar(s.star)!)}`
										: ''}{titles[s.id] ? ` — ${titles[s.id]}` : ''}
								</title>
							</circle>
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
							<g transform="translate({p.x - 12},{p.y})">
								<title>{s.name} — {starTitle(star)}</title>{@render starIcon(
									star.effect,
									star.binary
								)}
							</g>
						{/each}
						{#each coloniesAt as c (c.systemId)}
							{@const s = byId.get(c.systemId)}
							{#if s}
								{@const p = at(s)}
								<g class="fill-sky-600 dark:fill-sky-400">
									<title>{c.names.join('\n')}</title><circle
										cx={p.x}
										cy={p.y}
										r="6"
										fill="none"
										class="stroke-sky-600 dark:stroke-sky-400"
										stroke-width="1.25"
									/>{#if c.names.length > 1}<text
											class="text-[9px] font-semibold"
											x={p.x + 6}
											y={p.y - 4}
										>
											{c.names.length}
										</text>{/if}
								</g>
							{/if}
						{/each}
						{#each [...shipsAt] as [id, names] (id)}
							{@const s = byId.get(id)}
							{#if s}
								{@const p = at(s)}
								<g class="fill-emerald-600 dark:fill-emerald-400">
									<title>{names.join('\n')}</title><path
										d="M{p.x - 4},{p.y + 9}l4,-7l4,7z"
										class="stroke-white dark:stroke-gray-900"
										stroke-width="0.75"
									/>{#if names.length > 1}<text
											class="text-[10px] font-semibold"
											x={p.x + 5}
											y={p.y + 10}
										>
											{names.length}
										</text>{/if}
								</g>
							{/if}
						{/each}
						{#each [...arksAt] as [id, arks] (id)}
							{@const s = byId.get(id)}
							{#if s}
								{@const p = at(s)}
								<g class="pointer-events-none fill-violet-600 dark:fill-violet-400">
									<title>
										{arks.map((a) => `${a.name}${a.capital ? ' (capital)' : ''}`).join('\n')}
									</title>{#if arks.some((a) => a.capital)}<circle
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
											y={p.y - 7}
										>
											{arks.length}
										</text>{/if}
								</g>
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
									y={p.y - 12}
								>
									{byId.get(selected)!.name}
								</text>
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
								y={p.y - 10}
							>
								{byId.get(hovered)!.name}
							</text>
						{/if}
					</svg>
				{/if}
				{#if !fullWindow}
					<!-- the bottom edge: drag to resize; near the window's bottom the page scrolls along -->
					<div
						class="group absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize touch-none items-end justify-center"
						role="separator"
						aria-orientation="horizontal"
						aria-label="map height"
						title="drag to change the map's height"
						onpointerdown={startResize}
						onpointermove={moveResize}
						onpointerup={endResize}
						onpointercancel={endResize}
					>
						<span
							class="mb-0.5 h-1 w-10 rounded-full bg-gray-300 group-hover:bg-gray-500 dark:bg-gray-700 dark:group-hover:bg-gray-500 {dragH !==
							null
								? 'bg-gray-500'
								: ''}"
						></span>
					</div>
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
