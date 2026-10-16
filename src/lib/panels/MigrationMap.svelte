<script lang="ts">
	import { fmt } from '../format.ts';
	import type { Flow } from '../migration.ts';
	import type { MigrationColony } from '../types.ts';
	import Panel from './Panel.svelte';

	// Variant 2: the colonies at their systems' galaxy positions, arcs from sender to receiver,
	// thickness ∝ pops/month. Only the systems involved are drawn; the frame fits them.
	let {
		rows,
		flows,
		colors
	}: { rows: MigrationColony[]; flows: Flow[]; colors: Record<number, string> } = $props();

	const W = 640;
	const H = 360;
	const PAD = 60;
	const box = $derived.by(() => {
		const xs = rows.map((r) => r.x);
		const ys = rows.map((r) => r.y);
		return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
	});
	const scale = $derived(
		Math.min(
			(W - 2 * PAD) / Math.max(box.x1 - box.x0, 1),
			(H - 2 * PAD) / Math.max(box.y1 - box.y0, 1)
		)
	);
	const px = (x: number) => PAD + (x - box.x0) * scale;
	const py = (y: number) => PAD + (y - box.y0) * scale;
	const max = $derived(Math.max(1, ...flows.map((f) => f.pops)));
	const arc = (f: Flow) => {
		const [x1, y1, x2, y2] = [px(f.from.x), py(f.from.y), px(f.to.x), py(f.to.y)];
		// bend to one side, so a flow back the other way does not cover this one
		const [mx, my] = [(x1 + x2) / 2 - (y2 - y1) * 0.25, (y1 + y2) / 2 + (x2 - x1) * 0.25];
		return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
	};
	// several colonies in one system: spread their labels
	const labelDy = (r: MigrationColony) =>
		rows.filter((o) => o.x === r.x && o.y === r.y).indexOf(r) * 14;
</script>

<Panel title="Map" note="Colonies at their systems' map positions; arcs from sender to receiver.">
	{#if rows.length === 0}
		<p class="text-gray-500">No colonies.</p>
	{:else}
		<svg
			viewBox="0 0 {W} {H}"
			class="w-full max-w-3xl rounded border border-gray-200 dark:border-gray-800"
			role="img"
			aria-label="Migration map"
		>
			<defs>
				<marker
					id="arrow"
					viewBox="0 0 10 10"
					refX="9"
					refY="5"
					markerWidth="5"
					markerHeight="5"
					orient="auto-start-reverse"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
				</marker>
			</defs>
			{#each flows as f, i (i)}
				<path
					d={arc(f)}
					fill="none"
					stroke={colors[f.from.ownerId]}
					stroke-opacity="0.6"
					stroke-width={Math.max(2, (f.pops / max) * 10)}
					stroke-dasharray={f.estimated ? '6 4' : undefined}
					marker-end="url(#arrow)"
					class="text-gray-600"
					><title
						>{f.from.name} → {f.to.name}: {fmt(f.pops)} pops/month{f.estimated
							? ' (estimated)'
							: ''}</title
					></path
				>
			{/each}
			{#each rows as r (r.colonyId)}
				<circle
					cx={px(r.x)}
					cy={py(r.y)}
					r="6"
					fill={colors[r.ownerId]}
					stroke="white"
					stroke-width="2"
					><title
						>{r.name} ({r.owner}) · +{fmt(r.immigration)} / −{fmt(r.emigration)} last month</title
					></circle
				>
				<text x={px(r.x) + 10} y={py(r.y) + 4 + labelDy(r)} class="fill-current text-[11px]"
					>{r.name}</text
				>
			{/each}
		</svg>
	{/if}
</Panel>
