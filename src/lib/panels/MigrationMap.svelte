<script lang="ts">
	import { fmt } from '../format.ts';
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
	const byId = $derived(new Map(systems.map((s) => [s.id, s])));

	const W = 640;
	const H = 420;
	const PAD = 40;
	const box = $derived.by(() => {
		const points = [...systems, ...rows];
		const xs = points.map((r) => r.x);
		const ys = points.map((r) => r.y);
		return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
	});
	const scale = $derived(
		Math.min(
			(W - 2 * PAD) / Math.max(box.x1 - box.x0, 1),
			(H - 2 * PAD) / Math.max(box.y1 - box.y0, 1)
		)
	);
	// the game draws save x growing to the left, y growing down (2207.03: Alpha Centauri x 11 sits
	// west of Sol x −6, Sirius x −30 east of it)
	const px = (x: number) => PAD + (box.x1 - x) * scale;
	const py = (y: number) => PAD + (y - box.y0) * scale;
	const senders = $derived([...new Set(flows.map((f) => f.from.ownerId))]);
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

<Panel
	title="Map"
	note="Colonies at their systems' map positions over the systems you know (yours tinted) and their hyperlanes; arcs from sender to receiver."
>
	{#if rows.length === 0}
		<p class="text-gray-500">No colonies.</p>
	{:else}
		<svg
			viewBox="0 0 {W} {H}"
			class="w-full max-w-3xl rounded border border-gray-200 dark:border-gray-800"
			role="img"
			aria-label="Migration map"
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
							x1={px(s.x)}
							y1={py(s.y)}
							x2={px(o.x)}
							y2={py(o.y)}
							class="stroke-gray-300 dark:stroke-gray-700"
							stroke-width="1"
						/>
					{/if}
				{/each}
			{/each}
			{#each systems as s (s.id)}
				<circle
					cx={px(s.x)}
					cy={py(s.y)}
					r="3"
					class={s.owned ? 'fill-blue-200 stroke-blue-400' : 'fill-gray-200 stroke-gray-400'}
					stroke-width="1"><title>{s.name}{s.owned ? ' (yours)' : ''}</title></circle
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
