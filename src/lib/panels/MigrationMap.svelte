<script lang="ts">
	import { fmt } from '../format.ts';
	import GalaxyMap from '../GalaxyMap.svelte';
	import type { Point } from '../mapView.ts';
	import type { Flow } from '../migration.ts';
	import type { KnownSystem, MigrationColony } from '../types.ts';
	import Panel from './Panel.svelte';

	// Variant 2: the colonies at their systems' galaxy positions over the known systems and their
	// hyperlanes (own systems tinted), arcs from sender to receiver, thickness ∝ pops/month.
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
	{#if rows.length === 0}
		<p class="text-gray-500">No colonies.</p>
	{:else}
		<GalaxyMap
			{systems}
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
