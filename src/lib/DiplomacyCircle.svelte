<script lang="ts">
	import { colorOf } from './colors.ts';
	import { ethicMark, sortEthics } from './ethics.ts';
	import type { EthicAxis } from './types.ts';
	import {
		edgeLabel,
		type Cluster,
		edgeStyle,
		neighbours,
		pairOffsets,
		type DiploEdge,
		type DiploNode
	} from './diplomacy.ts';

	// The diplomacy graph without geography: the empires on a circle by group (`groups`, from
	// `clusters()`), a gap and an arc between groups, their relations as chords bent towards the
	// centre. Each name carries its known ethics' short names, coloured by pole (faint when
	// unverified). A click on an empire focuses it (again: unfocus).
	let {
		nodes,
		edges,
		groups,
		axes = {},
		focus = $bindable(null)
	}: {
		nodes: DiploNode[];
		edges: DiploEdge[];
		groups: Cluster[];
		axes?: Record<string, EthicAxis>;
		focus?: number | null;
	} = $props();
	const marks = (n: DiploNode) =>
		sortEthics(n.government?.value.ethics ?? [], axes).flatMap((e) => ethicMark(e, axes) ?? []);

	// wide enough for the names beside the circle
	const W = 1040;
	const H = 720;
	const R = 270;
	const C = { x: W / 2, y: H / 2 };
	const byId = $derived(new Map(nodes.map((n) => [n.id, n])));
	// slots around the circle: every empire one, a gap of one between groups
	const slots = $derived.by(() => {
		const out: { id: number; group: number }[] = [];
		groups.forEach((g, gi) => {
			const ns = g.ids.flatMap((id) => byId.get(id) ?? []);
			// within a group: overlords before subjects, then by name
			ns.sort(
				(a, b) =>
					Number(a.overlord !== null) - Number(b.overlord !== null) || a.name.localeCompare(b.name)
			);
			for (const n of ns) out.push({ id: n.id, group: gi });
			if (groups.length > 1) out.push({ id: -1, group: -1 });
		});
		return out;
	});
	const angle = (i: number) => (i / slots.length) * 2 * Math.PI - Math.PI / 2;
	const at = $derived(
		new Map(
			slots.flatMap((s, i) =>
				s.id === -1
					? []
					: [
							[
								s.id,
								{ x: C.x + R * Math.cos(angle(i)), y: C.y + R * Math.sin(angle(i)), t: angle(i) }
							]
						]
			)
		)
	);
	// an arc inside the circle along each group of two or more, named on hover where it has a name
	const arcs = $derived(
		groups.flatMap((g, gi) => {
			const is = slots.flatMap((s, i) => (s.group === gi ? [i] : []));
			if (is.length < 2) return [];
			const [a, b] = [angle(is[0] - 0.4), angle(is.at(-1)! + 0.4)];
			const r = R - 14;
			const p = (t: number) => `${C.x + r * Math.cos(t)},${C.y + r * Math.sin(t)}`;
			return [
				{
					key: gi,
					d: `M${p(a)} A${r},${r} 0 ${b - a > Math.PI ? 1 : 0} 1 ${p(b)}`,
					label: g.label ?? `${is.length} empires`
				}
			];
		})
	);
	const offsets = $derived(pairOffsets(edges));
	const lit = $derived(focus === null ? null : neighbours(edges, focus));
	const chord = (e: DiploEdge, off: number) => {
		const p = at.get(e.from)!;
		const q = at.get(e.to)!;
		// the control point towards the centre, spread per parallel edge
		const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
		const k = 0.45 + off * 0.08;
		return `M${p.x},${p.y} Q${m.x + (C.x - m.x) * k},${m.y + (C.y - m.y) * k} ${q.x},${q.y}`;
	};
	const pick = (id: number) => (focus = focus === id ? null : id);
</script>

<svg
	viewBox="0 0 {W} {H}"
	class="mx-auto block w-full max-w-[1040px]"
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
	{#each arcs as a (a.key)}
		<path d={a.d} fill="none" stroke="currentColor" stroke-width="4" opacity="0.25"
			><title>{a.label}</title></path
		>
	{/each}
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
	{#each nodes.filter((n) => at.has(n.id)) as n (n.id)}
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
				class="fill-current text-[12px] {n.us ? 'font-bold' : ''}"
				>{n.name}{#each marks(n) as m, i (i)}<tspan
						dx={i ? 3 : 6}
						class="text-[10px] {m.fanatic ? 'font-bold' : 'font-normal'}"
						fill={colorOf(m.color)}
						opacity={n.government?.stale ? 0.5 : 1}>{m.short}</tspan
					>{/each}</text
			>
		</g>
	{/each}
</svg>
