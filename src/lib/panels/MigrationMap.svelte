<script lang="ts">
	import { fmt } from '../format.ts';
	import GalaxyMap from '../GalaxyMap.svelte';
	import type { Point } from '../mapView.ts';
	import {
		ARKSHIP_ORDERS,
		arkshipOrder,
		type ArkshipOrder,
		type Flow,
		type MigrationView
	} from '../migration.ts';
	import type { Territory } from '../territories.ts';
	import type { Arkship, KnownSystem, MigrationColony } from '../types.ts';
	import MigrationCircle from './MigrationCircle.svelte';
	import Panel from './Panel.svelte';

	// Variant 2: the colonies at their systems' galaxy positions over the known systems and their
	// hyperlanes (own systems tinted), arcs from sender to receiver, thickness ∝ pops/month; our
	// arkships marked where they are. `view` switches to the circle (`MigrationCircle`), our
	// arkships in `view.order`; `onView` stores a change.
	let {
		rows,
		flows,
		colors,
		systems = [],
		territories = [],
		arkships = [],
		firstSeen = {},
		view = { layout: 'map', order: 'age' },
		onView
	}: {
		rows: MigrationColony[];
		flows: Flow[];
		colors: Record<number, string>;
		systems?: KnownSystem[];
		territories?: Territory[];
		arkships?: Arkship[];
		firstSeen?: Record<number, string>;
		view?: MigrationView;
		onView?: (v: MigrationView) => void;
	} = $props();
	const ORDER_LABEL: Record<ArkshipOrder, string> = {
		age: 'oldest → newest',
		size: 'by size, biggest first',
		name: 'alphabetically'
	};
	const button = 'rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700';
	const colonies = $derived(rows.filter((r) => r.own));

	const senders = $derived([...new Set(flows.map((f) => f.from.ownerId))]);
	const max = $derived(Math.max(1, ...flows.map((f) => f.pops)));
	const arc = (at: (p: Point) => Point, f: Flow) => {
		const [a, b] = [at(f.from), at(f.to)];
		// bend to one side, so a flow back the other way does not cover this one
		const [mx, my] = [(a.x + b.x) / 2 - (b.y - a.y) * 0.25, (a.y + b.y) / 2 + (b.x - a.x) * 0.25];
		return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
	};
	// several colonies in one system: spread their labels
	const labelDy = (r: MigrationColony) =>
		rows.filter((o) => o.x === r.x && o.y === r.y).indexOf(r) * 14;
</script>

<Panel
	title="Map"
	note="Colonies at their systems' map positions over the systems you know (yours tinted) and their hyperlanes; arcs from sender to receiver. Drag to pan, scroll to zoom, drag the bottom edge to resize."
>
	<div class="mb-2 flex flex-wrap items-center gap-2 text-sm">
		{#each ['map', 'circle'] as const as l (l)}
			<button
				class="{button} {view.layout === l ? 'bg-gray-200 dark:bg-gray-800' : ''}"
				aria-pressed={view.layout === l}
				onclick={() => onView?.({ ...view, layout: l })}>{l}</button
			>
		{/each}
		{#if view.layout === 'circle' && arkships.length > 1}
			<label class="ml-2 flex items-center gap-1"
				>arkships clockwise
				<select
					class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
					value={view.order}
					onchange={(e) =>
						onView?.({
							...view,
							order: (e.currentTarget as HTMLSelectElement).value as ArkshipOrder
						})}
				>
					{#each ARKSHIP_ORDERS as o (o)}<option value={o}>{ORDER_LABEL[o]}</option>{/each}
				</select>
			</label>
		{/if}
	</div>
	{#if view.layout === 'circle'}
		<MigrationCircle
			{rows}
			{flows}
			{colors}
			arkships={arkshipOrder(arkships, view.order, firstSeen)}
		/>
	{:else if rows.length === 0 && systems.length === 0}
		<p class="text-gray-500">No colonies.</p>
	{:else}
		<GalaxyMap
			{systems}
			{territories}
			{arkships}
			extra={rows}
			focus={[{ label: 'my colonies', points: colonies }]}
			heightKey="migration-map-height-v2"
			label="Migration map"
		>
			{#snippet layer(at)}
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
				{#each flows as f, i (i)}
					<path
						d={arc(at, f)}
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
			{/snippet}
		</GalaxyMap>
	{/if}
</Panel>
