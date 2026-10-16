<script lang="ts">
	import { fmt } from '../format.ts';
	import type { Flow } from '../migration.ts';
	import Panel from './Panel.svelte';

	// Variant 1: last month as a flow diagram — senders left, receivers right, band width ∝ pops.
	let { flows, colors }: { flows: Flow[]; colors: Record<number, string> } = $props();

	const W = 640;
	const ROW = 34;
	const BAND_MAX = 26;
	const senders = $derived([...new Map(flows.map((f) => [f.from.colonyId, f.from])).values()]);
	const receivers = $derived([...new Map(flows.map((f) => [f.to.colonyId, f.to])).values()]);
	const max = $derived(Math.max(1, ...flows.map((f) => f.pops)));
	const height = $derived(Math.max(senders.length, receivers.length, 1) * ROW + 16);
	const y = (list: { colonyId: number }[], id: number) =>
		16 + list.findIndex((c) => c.colonyId === id) * ROW + ROW / 2;
	const band = (f: Flow) => {
		const y1 = y(senders, f.from.colonyId);
		const y2 = y(receivers, f.to.colonyId);
		return `M 190 ${y1} C ${W / 2} ${y1}, ${W / 2} ${y2}, ${W - 190} ${y2}`;
	};
</script>

<Panel title="Flow last month" note="Who sends pops to whom. Bands of estimated pairs are dashed.">
	{#if flows.length === 0}
		<p class="text-gray-500">No migration last month.</p>
	{:else}
		<svg
			viewBox="0 0 {W} {height}"
			class="w-full max-w-3xl"
			role="img"
			aria-label="Migration flows last month"
		>
			{#each flows as f, i (i)}
				<path
					d={band(f)}
					fill="none"
					stroke={colors[f.from.ownerId]}
					stroke-opacity="0.45"
					stroke-width={Math.max(2, (f.pops / max) * BAND_MAX)}
					stroke-dasharray={f.estimated ? '6 4' : undefined}
					><title
						>{f.from.name} → {f.to.name}: {fmt(f.pops)} pops/month{f.estimated
							? ' (estimated)'
							: ''}</title
					></path
				>
			{/each}
			{#each senders as s (s.colonyId)}
				<rect
					x="180"
					y={y(senders, s.colonyId) - 12}
					width="10"
					height="24"
					rx="2"
					fill={colors[s.ownerId]}
				/>
				<text
					x="172"
					y={y(senders, s.colonyId)}
					text-anchor="end"
					dominant-baseline="middle"
					class="fill-current text-[12px]"
					>{s.name} <tspan class="opacity-60">−{fmt(s.emigration)}</tspan></text
				>
			{/each}
			{#each receivers as r (r.colonyId)}
				<rect
					x={W - 190}
					y={y(receivers, r.colonyId) - 12}
					width="10"
					height="24"
					rx="2"
					fill={colors[r.ownerId]}
				/>
				<text
					x={W - 172}
					y={y(receivers, r.colonyId)}
					dominant-baseline="middle"
					class="fill-current text-[12px]"
					>{r.name} <tspan class="opacity-60">+{fmt(r.immigration)}</tspan></text
				>
			{/each}
		</svg>
	{/if}
</Panel>
