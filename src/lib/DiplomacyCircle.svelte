<script lang="ts">
	import {
		edgeLabel,
		edgeStyle,
		neighbours,
		pairOffsets,
		type DiploEdge,
		type DiploNode
	} from './diplomacy.ts';

	// The diplomacy graph without geography: the empires on a circle — subjects beside their
	// overlord, federation members together — their relations as chords bent towards the centre.
	// A click on an empire focuses it (again: unfocus).
	let {
		nodes,
		edges,
		focus = $bindable(null)
	}: { nodes: DiploNode[]; edges: DiploEdge[]; focus?: number | null } = $props();

	const SIZE = 640;
	const R = 230;
	const C = SIZE / 2;
	const order = $derived.by(() => {
		const name = new Map(nodes.map((n) => [n.id, n.name]));
		// federation, then overlord before its subjects, then name
		const key = (n: DiploNode) =>
			[
				n.federation?.value ?? '￿',
				n.overlord === null ? n.name : (name.get(n.overlord) ?? ''),
				n.overlord === null ? '0' : '1',
				n.name
			].join('\u0000');
		return [...nodes].sort((a, b) => key(a).localeCompare(key(b)));
	});
	const at = $derived(
		new Map(
			order.map((n, i) => {
				const t = (i / order.length) * 2 * Math.PI - Math.PI / 2;
				return [n.id, { x: C + R * Math.cos(t), y: C + R * Math.sin(t), t }];
			})
		)
	);
	const offsets = $derived(pairOffsets(edges));
	const lit = $derived(focus === null ? null : neighbours(edges, focus));
	const chord = (e: DiploEdge, off: number) => {
		const p = at.get(e.from)!;
		const q = at.get(e.to)!;
		// the control point towards the centre, spread per parallel edge
		const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
		const k = 0.45 + off * 0.08;
		return `M${p.x},${p.y} Q${m.x + (C - m.x) * k},${m.y + (C - m.y) * k} ${q.x},${q.y}`;
	};
	const pick = (id: number) => (focus = focus === id ? null : id);
</script>

<svg
	viewBox="0 0 {SIZE} {SIZE}"
	class="mx-auto block w-full max-w-[640px]"
	role="img"
	aria-label="Relations between empires"
>
	<defs>
		<marker
			id="dip-arrow"
			viewBox="0 0 10 10"
			refX="10"
			refY="5"
			markerWidth="5"
			markerHeight="5"
			orient="auto-start-reverse"
		>
			<path d="M0,0 L10,5 L0,10 z" fill={edgeStyle('subject').color} />
		</marker>
	</defs>
	{#each edges as e, i (`${e.kind}:${e.from}:${e.to}`)}
		{#if at.has(e.from) && at.has(e.to)}
			{@const st = edgeStyle(e.kind)}
			<path
				d={chord(e, offsets[i])}
				fill="none"
				stroke={st.color}
				stroke-width={st.width}
				stroke-dasharray={e.stale ? '4 3' : undefined}
				marker-end={e.kind === 'subject' ? 'url(#dip-arrow)' : undefined}
				opacity={focus === null
					? e.stale
						? 0.55
						: 0.85
					: e.from === focus || e.to === focus
						? 1
						: 0.08}
				><title>{edgeLabel(e.kind)}{e.stale ? ` — unverified since ${e.asOf}` : ''}</title></path
			>
		{/if}
	{/each}
	{#each order as n (n.id)}
		{@const p = at.get(n.id)!}
		{@const right = Math.cos(p.t) >= 0}
		<g
			class="cursor-pointer"
			opacity={lit === null || lit.has(n.id) ? 1 : 0.2}
			role="button"
			tabindex="0"
			onclick={() => pick(n.id)}
			onkeydown={(e) => e.key === 'Enter' && pick(n.id)}
		>
			<circle
				cx={p.x}
				cy={p.y}
				r={n.us ? 9 : 7}
				fill={n.color ?? '#9ca3af'}
				stroke={focus === n.id ? '#0ea5e9' : 'currentColor'}
				stroke-width={focus === n.id ? 3 : 1}
			/>
			<text
				x={p.x + (right ? 12 : -12)}
				y={p.y + 4}
				text-anchor={right ? 'start' : 'end'}
				class="fill-current text-[12px] {n.us ? 'font-bold' : ''}">{n.name}</text
			>
		</g>
	{/each}
</svg>
