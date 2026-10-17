<script lang="ts">
	import { onMount } from 'svelte';
	import { fmt } from '../format.ts';
	import { fit, pan, toScreen, zoomAt, type Point, type View } from '../mapView.ts';
	import type { Flow } from '../migration.ts';
	import type { KnownSystem, MigrationColony } from '../types.ts';
	import Panel from './Panel.svelte';

	// Variant 2: the colonies at their systems' galaxy positions over the known systems and their
	// hyperlanes (own systems tinted), arcs from sender to receiver, thickness ∝ pops/month.
	// Full width, drawn in screen pixels: drag pans, the wheel zooms, the bottom edge resizes.
	let {
		rows,
		flows,
		colors,
		systems = []
	}: {
		rows: MigrationColony[];
		flows: Flow[];
		colors: Record<number, string>;
		systems?: KnownSystem[];
	} = $props();
	const byId = $derived(new Map(systems.map((s) => [s.id, s])));

	// The height is a per-viewer convenience, remembered in this browser.
	const KEY = 'migration-map-height';
	let height = $state(420);
	let w = $state(0);
	let h = $state(0);
	onMount(() => {
		try {
			height = Math.max(200, Number(localStorage.getItem(KEY)) || height);
		} catch {
			/* storage unavailable: default */
		}
	});
	$effect(() => {
		if (h === 0) return;
		try {
			localStorage.setItem(KEY, String(h));
		} catch {
			/* storage unavailable */
		}
	});

	// null = everything fitted, following the size; set by zoom, drag and the focus buttons
	let view: View | null = $state(null);
	const size = $derived({ w, h });
	const all = $derived<Point[]>([...systems, ...rows]);
	const whole = $derived(fit(all, size));
	const v = $derived(view ?? whole);
	const kMin = $derived(whole.k / 2);
	const at = (p: Point) => toScreen(v, size, p);

	const capital = $derived(systems.find((s) => s.capital));
	const empire = $derived(systems.filter((s) => s.owned));
	const colonies = $derived(rows.filter((r) => r.own));
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

	const senders = $derived([...new Set(flows.map((f) => f.from.ownerId))]);
	const max = $derived(Math.max(1, ...flows.map((f) => f.pops)));
	const arc = (f: Flow) => {
		const [a, b] = [at(f.from), at(f.to)];
		// bend to one side, so a flow back the other way does not cover this one
		const [mx, my] = [(a.x + b.x) / 2 - (b.y - a.y) * 0.25, (a.y + b.y) / 2 + (b.x - a.x) * 0.25];
		return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
	};
	// several colonies in one system: spread their labels
	const labelDy = (r: MigrationColony) =>
		rows.filter((o) => o.x === r.x && o.y === r.y).indexOf(r) * 14;

	const button =
		'rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40 dark:border-gray-700';
</script>

<Panel
	title="Map"
	note="Colonies at their systems' map positions over the systems you know (yours tinted) and their hyperlanes; arcs from sender to receiver. Drag to pan, scroll to zoom, drag the bottom edge to resize."
>
	{#if rows.length === 0}
		<p class="text-gray-500">No colonies.</p>
	{:else}
		<div class="mb-2 flex flex-wrap items-center gap-2 text-sm">
			<button class={button} disabled={!capital} onclick={() => capital && toCapital(capital)}
				>capital</button
			>
			<span class="ml-2 text-gray-500">fit</span>
			<button class={button} disabled={!empire.length} onclick={() => (view = fit(empire, size))}
				>my empire</button
			>
			<button
				class={button}
				disabled={!colonies.length}
				onclick={() => (view = fit(colonies, size))}>my colonies</button
			>
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
		>
			{#if w > 0 && h > 0}
				<svg
					width={w}
					height={h}
					class="block touch-none select-none {drag ? 'cursor-grabbing' : 'cursor-grab'}"
					role="img"
					aria-label="Migration map"
					{@attach wheel}
					onpointerdown={down}
					onpointermove={move}
					onpointerup={() => (drag = null)}
					onpointercancel={() => (drag = null)}
				>
					<!-- one arrowhead per sender colour, 14px whatever the arc's width; refX puts the tip at
					     the colony dot's edge (r 6 + stroke 2 = 8px ≈ 6 marker units) instead of under it -->
					<defs>
						{#each senders as ownerId (ownerId)}
							<marker
								id="arrow-{ownerId}"
								viewBox="0 0 10 10"
								refX="16"
								refY="5"
								markerWidth="14"
								markerHeight="14"
								markerUnits="userSpaceOnUse"
								orient="auto-start-reverse"
							>
								<path d="M 0 0 L 10 5 L 0 10 z" fill={colors[ownerId]} />
							</marker>
						{/each}
					</defs>
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
							r="3"
							class={s.owned ? 'fill-blue-200 stroke-blue-400' : 'fill-gray-200 stroke-gray-400'}
							stroke-width="1"
							><title>{s.name}{s.owned ? ' (yours)' : ''}{s.capital ? ', capital' : ''}</title
							></circle
						>
					{/each}
					{#each flows as f, i (i)}
						<path
							d={arc(f)}
							fill="none"
							stroke={colors[f.from.ownerId]}
							stroke-opacity="0.6"
							stroke-width={Math.max(2, (f.pops / max) * 10)}
							stroke-dasharray={f.estimated ? '6 4' : undefined}
							marker-end="url(#arrow-{f.from.ownerId})"
							><title
								>{f.from.name} → {f.to.name}: {fmt(f.pops)} pops/month{f.estimated
									? ' (estimated)'
									: ''}</title
							></path
						>
					{/each}
					{#each rows as r (r.colonyId)}
						<circle
							cx={at(r).x}
							cy={at(r).y}
							r="6"
							fill={colors[r.ownerId]}
							stroke="white"
							stroke-width="2"
							><title
								>{r.name} ({r.owner}) · +{fmt(r.immigration)} / −{fmt(r.emigration)} last month</title
							></circle
						>
						<text x={at(r).x + 10} y={at(r).y + 4 + labelDy(r)} class="fill-current text-[11px]"
							>{r.name}</text
						>
					{/each}
				</svg>
			{/if}
		</div>
	{/if}
</Panel>
