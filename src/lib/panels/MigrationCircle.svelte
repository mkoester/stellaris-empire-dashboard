<script lang="ts">
	import { chord, circleSlots, placeOnCircle } from '../circle.ts';
	import { pairOffsets } from '../diplomacy.ts';
	import { fmt } from '../format.ts';
	import type { Flow } from '../migration.ts';
	import type { Arkship, MigrationColony } from '../types.ts';

	// The migration map without geography: our arkships on a circle in the order given (clockwise
	// from 12 o'clock), every other colony that migrates (ours on planets, treaty partners') in a
	// group after a gap, flows as chords bent towards the centre — thickness ∝ pops/month, dashed
	// where estimated, an arrowhead in the sender's colour.
	let {
		rows,
		flows,
		colors,
		arkships
	}: {
		rows: MigrationColony[];
		flows: Flow[];
		colors: Record<number, string>;
		arkships: Arkship[]; // in circle order
	} = $props();

	const W = 960;
	const H = 640;
	const R = 240;
	const C = { x: W / 2, y: H / 2 };
	const byColony = $derived(new Map(rows.map((r) => [r.colonyId, r])));
	const arks = $derived(
		arkships.flatMap((a) => {
			const r = byColony.get(a.colonyId);
			return r ? [{ row: r, ark: a }] : [];
		})
	);
	const others = $derived(
		rows
			.filter((r) => !arks.some((a) => a.row === r))
			.sort((a, b) => Number(b.own) - Number(a.own) || a.name.localeCompare(b.name))
	);
	const slots = $derived(
		circleSlots(
			[arks.map((a) => a.row.colonyId), others.map((r) => r.colonyId)].filter((g) => g.length)
		)
	);
	const at = $derived(placeOnCircle(slots, C, R));
	const capitalOf = $derived(new Set(arks.filter((a) => a.ark.capital).map((a) => a.row.colonyId)));
	const senders = $derived([...new Set(flows.map((f) => f.from.ownerId))]);
	const max = $derived(Math.max(1, ...flows.map((f) => f.pops)));
	const offsets = $derived(
		pairOffsets(flows.map((f) => ({ from: f.from.colonyId, to: f.to.colonyId })))
	);
</script>

{#if slots.length === 0}
	<p class="text-gray-500">No colonies.</p>
{:else}
	<svg viewBox="0 0 {W} {H}" class="w-full max-w-5xl" role="img" aria-label="Migration circle">
		<defs>
			{#each senders as ownerId (ownerId)}
				<marker
					id="circle-arrow-{ownerId}"
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
			{@const p = at.get(f.from.colonyId)}
			{@const q = at.get(f.to.colonyId)}
			{#if p && q}
				<path
					d={chord(p, q, C, offsets[i])}
					fill="none"
					stroke={colors[f.from.ownerId]}
					stroke-opacity="0.6"
					stroke-width={Math.max(2, (f.pops / max) * 10)}
					stroke-dasharray={f.estimated ? '6 4' : undefined}
					marker-end="url(#circle-arrow-{f.from.ownerId})"
					><title
						>{f.from.name} → {f.to.name}: {fmt(f.pops)} pops/month{f.estimated
							? ' (estimated)'
							: ''}</title
					></path
				>
			{/if}
		{/each}
		{#each slots as s, i (i)}
			{@const p = at.get(s.id)}
			{@const r = byColony.get(s.id)}
			{#if p && r}
				{@const right = Math.cos(p.t) >= 0}
				{#if capitalOf.has(r.colonyId)}
					<circle
						cx={p.x}
						cy={p.y}
						r="10"
						fill="none"
						class="stroke-violet-600 dark:stroke-violet-400"
						stroke-width="2"
					/>
				{/if}
				<circle cx={p.x} cy={p.y} r="6" fill={colors[r.ownerId]} stroke="white" stroke-width="2"
					><title
						>{r.name} ({r.owner}) · +{fmt(r.immigration)} / −{fmt(r.emigration)} last month</title
					></circle
				>
				<text
					x={p.x + (right ? 14 : -14)}
					y={p.y + 4}
					text-anchor={right ? 'start' : 'end'}
					class="text-[12px] {r.own ? 'fill-current' : 'fill-gray-500'}"
					>{r.name}{capitalOf.has(r.colonyId) ? ' (capital)' : ''}</text
				>
			{/if}
		{/each}
	</svg>
{/if}
