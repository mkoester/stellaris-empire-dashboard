<script lang="ts">
	import { colorOf, scaleColor } from '#lib/colors.ts';
	import { CONTACT_KINDS, KIND_LABELS, kindTypes } from '#lib/contacts.ts';
	import DiplomacyCircle from '#lib/DiplomacyCircle.svelte';
	import {
		CLUSTER_MODES,
		clusters,
		EDGE_KINDS,
		edgeKey,
		edgeLabel,
		edgeStyle,
		empireFacts,
		factsText,
		legendMatch,
		neighbours,
		pairOffsets,
		type DiploEdge,
		type DiploNode,
		type DiplomacyView,
		type EthicsChange,
		type Known,
		type LegendKey
	} from '#lib/diplomacy.ts';
	import EmpireName from '#lib/EmpireName.svelte';
	import EthicChip from '#lib/EthicChip.svelte';
	import { ethicDistance, ethicMark, opposingAxes, profile, sortEthics } from '#lib/ethics.ts';
	import { nameOf } from '#lib/format.ts';
	import GalaxyMap from '#lib/GalaxyMap.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import { putSettings } from '#lib/settings.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import type { Snippet } from 'svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	// the view is the profile's: changed here, stored at once
	let view: DiplomacyView = $derived(data.view);
	const save = (v: DiplomacyView) => {
		view = v;
		void putSettings({ diplomacyView: v });
	};
	const flip = <T,>(all: readonly T[], list: T[], x: T) =>
		all.filter((y) => (y === x) !== list.includes(y));

	const d = $derived(data.diplomacy);
	const nodes = $derived(
		(d?.nodes ?? []).filter(
			(n) => n.us || (view.kinds.includes(n.kind) && (!view.communicationsOnly || n.communications))
		)
	);
	const ids = $derived(new Set(nodes.map((n) => n.id)));
	const byId = $derived(new Map(nodes.map((n) => [n.id, n])));
	const edges = $derived(
		(d?.edges ?? []).filter(
			(e) => ids.has(e.from) && ids.has(e.to) && !view.hiddenEdges.includes(e.kind)
		)
	);
	const kindsPresent = $derived(new Set((d?.edges ?? []).map((e) => e.kind)));

	const ethicName = (e: string) => nameOf(data.names, e);
	// an ethics group is named by the ethics all its members hold
	const groups = $derived(
		(d ? clusters(d, nodes, edges, view.cluster, view, data.ethics) : []).map((g) => ({
			...g,
			label: g.label ?? (g.shared?.length ? g.shared.map(ethicName).join(' · ') : null)
		}))
	);
	const CLUSTER_LABELS = {
		blocs: 'blocs',
		opinion: 'mutual opinion',
		pacts: 'cooperation',
		ethics: 'ethics',
		federation: 'federation fit'
	};
	const CLUSTER_TITLES = {
		blocs: 'federations together, overlords with their subjects',
		opinion:
			'empires whose known opinions of each other average at least the number given (unknown opinions do not count)',
		pacts:
			'empires tied by pacts — defensive pacts weigh most; rivalries, closed borders and wars push apart (the relations shown count)',
		ethics:
			'empires whose known ethics are on average at most the number given steps apart: per axis, fanatic – regular – none – regular – fanatic, so authoritarian to egalitarian is 2 (ours). Gestalts only with gestalts; unknown ethics stay alone',
		federation:
			"≈ groups whose ethics would cost a federation at most the cohesion given, by the game's defines: −0.15 per unique ethic beyond 3, −0.5 per axis held at both poles (how the game counts a fanatic ethic is a guess: as its regular one). Unknown ethics stay alone"
	};

	// focus: one empire and its relations, the rest faded; a click on it again or Esc clears it
	let focus: number | null = $state(null);
	const lit = $derived(focus === null ? null : neighbours(edges, focus));

	// the legend: hovering an item lights what it stands for, a click keeps it lit (per viewer)
	let legendHover: LegendKey | null = $state(null);
	let legendPinned: LegendKey[] = $state([]);
	const pinLegend = (k: LegendKey) =>
		(legendPinned = legendPinned.includes(k)
			? legendPinned.filter((x) => x !== k)
			: [...legendPinned, k]);
	const highlight = $derived(
		legendMatch(
			legendHover && !legendPinned.includes(legendHover)
				? [...legendPinned, legendHover]
				: legendPinned,
			nodes,
			edges,
			data.ethics.axes
		)
	);
	const faded = (id: number) =>
		(lit !== null && !lit.has(id)) || (highlight !== null && !highlight.nodes.has(id));
	const edgeOpacity = (e: DiploEdge) => {
		if (highlight) return highlight.edges.has(edgeKey(e)) ? 1 : 0.06;
		if (focus === null) return e.stale ? 0.55 : 0.85;
		return e.from === focus || e.to === focus ? 1 : 0.06;
	};

	const stale = <T,>(k: Known<T> | null) => (k?.stale ? ` — unverified since ${k.asOf}` : '');
	// the oldest date one of an empire's facts was last verified, if any is stale
	const unverified = (n: DiploNode) =>
		[
			n.government,
			n.capital,
			n.federation,
			...(d?.edges ?? []).filter((e) => e.from === n.id || e.to === n.id)
		]
			.flatMap((k) => (k?.stale ? [k.asOf] : []))
			.sort()[0] ?? null;
	const opinionOf = (from: number, to: number) => d?.opinions[`${from}:${to}`] ?? null;
	const name = (id: number | null) => (id === null ? '–' : (byId.get(id)?.name ?? `empire ${id}`));

	// --- map
	const pos = $derived(new Map(data.systems.map((s) => [s.id, s])));

	// --- what we know of each empire: its tooltip, and on the graph its government and civics
	const facts = (n: DiploNode) =>
		d
			? empireFacts(n, d, {
					key: (k) => nameOf(data.names, k),
					empire: name,
					system: (id) => pos.get(id)?.name
				})
			: [];
	const tooltip = (n: DiploNode) => factsText(n.name, facts(n));
	const details = (n: DiploNode) => {
		const g = n.government;
		if (!g) return n.us ? [] : [{ text: 'government unknown', stale: false }];
		const type = g.value.governmentType ?? g.value.authority;
		return [
			type ? nameOf(data.names, type) : '',
			g.value.civics.map((k) => nameOf(data.names, k)).join(', ')
		].flatMap((text) => (text ? [{ text, stale: g.stale }] : []));
	};
	// the legend lists what our intel knows of (every empire with the cheat): an ethic once for
	// both its variants, every authority, the civics and origins seen
	const known = $derived((d?.nodes ?? []).filter((n) => !n.us));
	const regularOf = (e: string) => {
		const a = data.ethics.axes[e];
		if (!a || a.pos === 0) return e;
		return (
			Object.keys(data.ethics.axes).find(
				(k) => data.ethics.axes[k].axis === a.axis && data.ethics.axes[k].pos === Math.sign(a.pos) // the regular one: ±1
			) ?? e
		);
	};
	const byName = (ks: Iterable<string>) =>
		[...new Set(ks)].sort((a, b) => nameOf(data.names, a).localeCompare(nameOf(data.names, b)));
	const legendEthics = $derived(
		sortEthics(
			[...new Set(known.flatMap((n) => (n.government?.value.ethics ?? []).map(regularOf)))],
			data.ethics.axes
		)
	);
	const legendCivics = $derived(byName(known.flatMap((n) => n.government?.value.civics ?? [])));
	const legendOrigins = $derived(byName(known.flatMap((n) => (n.origin ? [n.origin.value] : []))));
	// how many empires on the graph an item lights
	const legendCount = (k: LegendKey) =>
		legendMatch([k], nodes, [], data.ethics.axes)?.nodes.size ?? 0;
	const legendEdges = $derived(EDGE_KINDS.filter((k) => edges.some((e) => e.kind === k)));
	const anyStale = $derived(edges.some((e) => e.stale) || nodes.some((n) => n.government?.stale));
	const capitalOf = (id: number) => {
		const c = data.capitals[id];
		return c === undefined ? undefined : pos.get(c);
	};
	const ownerOf = $derived(new Map(Object.entries(data.capitals).map(([e, s]) => [s, Number(e)])));
	const offMap = $derived(nodes.filter((n) => !capitalOf(n.id)));
	const offsets = $derived(pairOffsets(edges));

	// --- matrix
	const between = $derived.by(() => {
		const m = new Map<string, DiploEdge[]>();
		for (const e of edges) {
			const k = `${Math.min(e.from, e.to)}:${Math.max(e.from, e.to)}`;
			m.set(k, [...(m.get(k) ?? []), e]);
		}
		return m;
	});
	const pairEdges = (a: number, b: number) =>
		between.get(`${Math.min(a, b)}:${Math.max(a, b)}`) ?? [];
	const matrixRows = $derived(
		[...nodes].sort((a, b) => (a.us ? -1 : b.us ? 1 : a.name.localeCompare(b.name)))
	);
	const opinionColor = (v: number) => scaleColor(v, -200, 200);

	// --- ethics
	const axes = $derived(data.ethics.axes);
	const ethicsOf = (n: DiploNode) => sortEthics(n.government?.value.ethics ?? [], axes);
	const usNode = $derived(nodes.find((n) => n.us));
	// steps apart from our ethics; null where unknown, Infinity between a gestalt and the others
	const distance = (n: DiploNode) => {
		if (n.us || !n.government || !usNode?.government) return null;
		return ethicDistance(profile(ethicsOf(n), axes), profile(ethicsOf(usNode), axes)) ?? Infinity;
	};
	const distanceTitle = (n: DiploNode) => {
		if (!n.government || !usNode?.government) return '';
		const opp = opposingAxes(profile(ethicsOf(n), axes), profile(ethicsOf(usNode), axes));
		return opp.length ? `opposed to ours on ${opp.map((a) => AXIS_NAMES[a]).join(', ')}` : '';
	};
	const AXIS_NAMES = {
		col: 'authority (authoritarian–egalitarian)',
		xen: 'aliens (xenophobe–xenophile)',
		mil: 'war (militarist–pacifist)',
		spi: 'faith (spiritualist–materialist)'
	};
	const changes = $derived(
		Object.entries(data.ethicsHistory)
			.flatMap(([id, cs]) => cs.map((c) => ({ ...c, id: Number(id) })))
			.filter((c) => d?.nodes.some((n) => n.id === c.id))
			.sort((a, b) => b.by.localeCompare(a.by))
	);
	const changeText = (c: EthicsChange) =>
		`${c.from.map(ethicName).join(', ')} → ${c.to.map(ethicName).join(', ')}, between ${c.after} and ${c.by}`;

	// --- table
	const pacts = (n: DiploNode) =>
		edges.filter(
			(e) => (e.from === n.id || e.to === n.id) && !['war', 'subject', 'is_rival'].includes(e.kind)
		).length;
	const columns: Column<DiploNode>[] = $derived([
		{ id: 'name', label: 'Empire', value: (n) => n.name, cell: empire },
		{
			id: 'intel',
			label: 'Intel',
			value: (n) => n.intel,
			right: true,
			title:
				"our intel on them, 0–100: government shows from 10, rivals from 20, pacts and opinions from 50 (the game's intel levels)"
		},
		{
			id: 'ethics',
			label: 'Ethics',
			value: (n) => (n.government ? ethicsOf(n).map(ethicName).join(', ') : null),
			cell: gov
		},
		{
			id: 'distance',
			label: 'Ethics apart',
			value: distance,
			cell: dist,
			right: true,
			title:
				'steps between their ethics and ours over the four axes (0 = the same, 16 = every axis fanatic against fanatic); — a gestalt against a non-gestalt'
		},
		{
			id: 'federation',
			label: 'Federation',
			value: (n) => n.federation?.value ?? null,
			cell: fed
		},
		{
			id: 'overlord',
			label: 'Overlord',
			value: (n) => (n.overlord === null ? null : name(n.overlord))
		},
		{
			id: 'subjects',
			label: 'Subjects',
			value: (n) => nodes.filter((x) => x.overlord === n.id).length || null,
			right: true
		},
		{ id: 'pacts', label: 'Pacts', value: (n) => pacts(n) || null, right: true },
		{
			id: 'rivals',
			label: 'Rivals',
			value: (n) =>
				edges
					.filter((e) => e.kind === 'is_rival' && e.from === n.id)
					.map((e) => name(e.to))
					.join(', ') || null
		},
		{
			id: 'wars',
			label: 'Wars',
			value: (n) =>
				(d?.wars ?? []).filter((w) => [...w.attackers, ...w.defenders].includes(n.id)).length ||
				null,
			right: true
		},
		{
			id: 'opinionOfUs',
			label: 'Opinion of us',
			value: (n) =>
				n.us ? null : (opinionOf(n.id, nodes.find((x) => x.us)?.id ?? 0)?.value ?? null),
			right: true
		},
		{
			id: 'unverified',
			label: 'Unverified since',
			value: unverified,
			title: 'our intel no longer shows some of what we knew of it: shown as it was last seen'
		},
		{
			id: 'unmet',
			label: 'Unmet',
			value: (n) => n.unmet || null,
			right: true,
			title: 'relations with countries we have not met, not drawn'
		}
	]);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (focus = null)} />

{#snippet legendItem(k: LegendKey, label: string, swatch?: Snippet, count?: number)}
	<button
		class="flex items-center gap-1 rounded border px-2 py-0.5 {legendPinned.includes(k)
			? 'border-sky-500 ring-1 ring-sky-500'
			: 'border-gray-300 dark:border-gray-700'} {count === 0 ? 'opacity-50' : ''}"
		title="hover: light it up in the graph; click: keep it lit{count === undefined
			? ''
			: ` — ${count} on the graph`}"
		onmouseenter={() => (legendHover = k)}
		onmouseleave={() => (legendHover = null)}
		onfocus={() => (legendHover = k)}
		onblur={() => (legendHover = null)}
		onclick={() => pinLegend(k)}
		>{@render swatch?.()}{label}{#if count}<span class="text-gray-500">{count}</span>{/if}</button
	>
{/snippet}
{#snippet empire(n: DiploNode)}
	<span class="cursor-help" title={tooltip(n)}
		><EmpireName name={n.name} color={n.color} kind={n.kind} nomadic={n.nomadic} /></span
	>
{/snippet}
{#snippet gov(n: DiploNode)}
	{#if n.government}
		{@const hist = data.ethicsHistory[n.id] ?? []}
		<span
			class="inline-flex flex-wrap items-center gap-1"
			title={[n.government.value.governmentType, n.government.value.authority]
				.flatMap((k) => (k ? [nameOf(data.names, k)] : []))
				.join(', ') + stale(n.government)}
			>{#each ethicsOf(n) as e (e)}<EthicChip
					ethic={e}
					name={ethicName(e)}
					{axes}
					stale={n.government.stale}
					explanation={data.explain[`ethic:${e}`]}
				/>{/each}{#if hist.length}<span
					class="cursor-help text-xs text-sky-600"
					title={`ethics changed, as our intel saw:\n${hist.map(changeText).join('\n')}`}
					>↻{hist.length > 1 ? hist.length : ''}</span
				>{/if}</span
		>
	{:else}<span class="text-gray-400" title="our intel does not reach their government">unknown</span
		>{/if}
{/snippet}
{#snippet dist(n: DiploNode)}
	{@const v = distance(n)}
	{#if v === null}–{:else if v === Infinity}<span
			class="text-gray-500"
			title="a gestalt consciousness and an empire of ethics: no common scale">—</span
		>{:else}<span title={distanceTitle(n)} style:color={scaleColor(-v, -8, 0)}>{v}</span>{/if}
{/snippet}
{#snippet fed(n: DiploNode)}
	{#if n.federation}<span
			class={n.federation.stale ? 'text-amber-600' : ''}
			title={stale(n.federation)}>{n.federation.value}</span
		>{:else}–{/if}
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Diplomacy</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{d?.date ?? data.latest.date}</span>
</header>

{#if !d}
	<p class="text-sm text-amber-600">
		No save read since this tab exists; it fills after the next one.
	</p>
{:else}
	<p class="mb-3 text-sm text-gray-500">
		{#if data.cheat}<span class="text-red-600"
				>Cheat on (⚙): every empire and relation, whatever our intel.</span
			>
		{:else}What our intel shows: an empire's government from intel 10, its rivals and federation
			from 20, its pacts and opinions from 50 — through either side of a pact. Subjects and wars
			count as public. What intel showed once but no longer does is kept as last seen,
			<span class="text-amber-600">unverified since</span> then (dashed lines).{/if}
		Click an empire to show it and its relations alone; Esc clears.
	</p>

	<div class="mb-4 flex flex-col gap-2 text-sm">
		<div class="flex flex-wrap items-center gap-4">
			<label class="flex items-center gap-1"
				><input
					type="checkbox"
					checked={view.communicationsOnly}
					onchange={(e) => save({ ...view, communicationsOnly: e.currentTarget.checked })}
				/> with communications only</label
			>
			<span class="flex items-center gap-1"
				>graph
				{#each ['circle', 'map'] as const as l (l)}
					<button
						class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700 {view.layout ===
						l
							? 'font-semibold'
							: 'opacity-60'}"
						onclick={() => save({ ...view, layout: l })}>{l}</button
					>
				{/each}
			</span>
			<span class="text-gray-500">{nodes.length} of {d.nodes.length}</span>
		</div>
		<div class="flex flex-wrap items-center gap-1">
			<span class="text-gray-500">show:</span>
			{#each CONTACT_KINDS as k (k)}
				<label
					class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700 {view.kinds.includes(
						k
					)
						? ''
						: 'opacity-40'}"
					title={kindTypes(k).join(', ') || 'every other country type'}
					><input
						type="checkbox"
						class="sr-only"
						checked={view.kinds.includes(k)}
						onchange={() => save({ ...view, kinds: flip(CONTACT_KINDS, view.kinds, k) })}
					/>{KIND_LABELS[k]}</label
				>
			{/each}
		</div>
		<div class="flex flex-wrap items-center gap-1">
			<span class="text-gray-500">relations:</span>
			<button
				class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700"
				onclick={() => save({ ...view, hiddenEdges: [] })}>all</button
			>
			<button
				class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700"
				onclick={() => save({ ...view, hiddenEdges: [...EDGE_KINDS] })}>none</button
			>
			{#each EDGE_KINDS.filter((k) => kindsPresent.has(k)) as k (k)}
				{@const st = edgeStyle(k)}
				<label
					class="flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700 {view.hiddenEdges.includes(
						k
					)
						? 'opacity-40'
						: ''}"
					><input
						type="checkbox"
						class="sr-only"
						checked={!view.hiddenEdges.includes(k)}
						onchange={() => save({ ...view, hiddenEdges: flip(EDGE_KINDS, view.hiddenEdges, k) })}
					/><span class="inline-block w-4" style:border-top="{st.width}px solid {st.color}"></span>
					{edgeLabel(k)}</label
				>
			{/each}
		</div>
	</div>

	<Panel title="Relations graph">
		<div class="mb-3 flex flex-col gap-1 text-xs">
			<div class="flex flex-wrap items-center gap-1">
				<span class="w-16 text-gray-500">relations</span>
				{#each legendEdges as k (k)}
					{@const st = edgeStyle(k)}
					{#snippet line()}<span
							class="inline-block w-4"
							style:border-top="{st.width}px solid {st.color}"
						></span>{/snippet}
					{@render legendItem(`edge:${k}`, edgeLabel(k), line)}
				{/each}
				{#if anyStale}
					{#snippet dashed()}<span class="inline-block w-4 border-t-2 border-dashed border-gray-500"
						></span>{/snippet}
					{@render legendItem('stale', 'unverified', dashed)}
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-1">
				<span class="w-16 text-gray-500">ethics</span>
				{#each legendEthics as e (e)}
					{#snippet dot()}<span
							class="inline-block size-2 rounded-full"
							style:background={colorOf(ethicMark(e, axes)?.color ?? '')}
						></span>{/snippet}
					{@const k: LegendKey = `ethics:${e}`}
					{@render legendItem(k, ethicName(e), dot, legendCount(k))}
				{/each}
			</div>
			<div class="flex flex-wrap items-center gap-1">
				<span class="w-16 text-gray-500">authorities</span>
				{#each data.authorities as a (a)}
					{@const k: LegendKey = `authority:${a}`}
					{@render legendItem(k, nameOf(data.names, a), undefined, legendCount(k))}
				{/each}
			</div>
			<div class="flex flex-wrap items-center gap-1">
				<span class="w-16 text-gray-500" title="the civics our intel has shown">civics</span>
				{#each legendCivics as c (c)}
					{@const k: LegendKey = `civic:${c}`}
					{@render legendItem(k, nameOf(data.names, c), undefined, legendCount(k))}
				{:else}<span class="text-gray-500">none known yet</span>{/each}
			</div>
			<div class="flex flex-wrap items-center gap-1">
				<span class="w-16 text-gray-500" title="the origins our intel has shown (from intel 40)"
					>origins</span
				>
				{#each legendOrigins as o (o)}
					{@const k: LegendKey = `origin:${o}`}
					{@render legendItem(k, nameOf(data.names, o), undefined, legendCount(k))}
				{:else}<span class="text-gray-500">none known yet (from intel 40)</span>{/each}
			</div>
			<div class="flex flex-wrap items-center gap-1">
				{#if legendPinned.length}
					<button
						class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700"
						onclick={() => (legendPinned = [])}>clear</button
					>
				{/if}
				<label class="ml-auto flex items-center gap-1"
					><input
						type="checkbox"
						checked={view.details}
						onchange={(e) => save({ ...view, details: e.currentTarget.checked })}
					/> government and civics on the graph</label
				>
			</div>
		</div>
		{#if view.layout === 'map'}
			<GalaxyMap
				systems={data.systems}
				territories={data.territories}
				focus={[
					{
						label: 'capitals',
						points: nodes.flatMap((n) => capitalOf(n.id) ?? [])
					}
				]}
				heightKey="diplomacy-map-height"
				label="Relations on the galaxy map"
				bind:selected={
					() => (focus === null ? null : (data.capitals[focus] ?? null)),
					(id) => (focus = id === null || id === undefined ? null : (ownerOf.get(id) ?? null))
				}
			>
				{#snippet layer(at)}
					{#each edges as e, i (`${e.kind}:${e.from}:${e.to}`)}
						{@const a = capitalOf(e.from)}
						{@const b = capitalOf(e.to)}
						{#if a && b}
							{@const p = at(a)}
							{@const q = at(b)}
							{@const len = Math.hypot(q.x - p.x, q.y - p.y) || 1}
							{@const o = {
								x: (-(q.y - p.y) / len) * offsets[i] * 4,
								y: ((q.x - p.x) / len) * offsets[i] * 4
							}}
							{@const st = edgeStyle(e.kind)}
							<line
								class="pointer-events-none"
								x1={p.x + o.x}
								y1={p.y + o.y}
								x2={q.x + o.x}
								y2={q.y + o.y}
								stroke={st.color}
								stroke-width={st.width}
								stroke-dasharray={e.stale ? '4 3' : undefined}
								opacity={edgeOpacity(e)}
							/>
						{/if}
					{/each}
					{#each nodes as n (n.id)}
						{@const c = capitalOf(n.id)}
						{#if c}
							{@const p = at(c)}
							<g class="pointer-events-none" opacity={faded(n.id) ? 0.2 : 1}>
								<circle
									cx={p.x}
									cy={p.y}
									r={n.us ? 8 : 6}
									fill={n.color ?? '#9ca3af'}
									stroke={focus === n.id ? '#0ea5e9' : 'currentColor'}
									stroke-width={focus === n.id ? 3 : 1}
								/>
								<text x={p.x + 10} y={p.y + 4} class="fill-current text-[12px] font-semibold"
									>{n.name}{#if view.details}{#each details(n) as l, i (i)}<tspan
												x={p.x + 10}
												dy={i ? 11 : 13}
												class="text-[10px] font-normal {l.stale
													? 'fill-amber-600'
													: 'fill-gray-500'}">{l.text}</tspan
											>{/each}{/if}</text
								>
							</g>
						{/if}
					{/each}
				{/snippet}
			</GalaxyMap>
			{#if offMap.length}
				<p class="mt-2 text-sm">
					<span class="text-gray-500">capital unknown, not on the map:</span>
					{#each offMap as n (n.id)}
						<button
							class="ml-1 rounded border border-gray-300 px-1 dark:border-gray-700 {faded(n.id)
								? 'opacity-30'
								: ''} {focus === n.id ? 'ring-2 ring-sky-500' : ''}"
							onclick={() => (focus = focus === n.id ? null : n.id)}>{n.name}</button
						>
					{/each}
				</p>
			{/if}
		{:else}
			<div class="mb-2 flex flex-wrap items-center gap-2 text-sm">
				<span class="text-gray-500">group by</span>
				{#each CLUSTER_MODES as m (m)}
					<button
						class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700 {view.cluster ===
						m
							? 'font-semibold'
							: 'opacity-60'}"
						title={CLUSTER_TITLES[m]}
						onclick={() => save({ ...view, cluster: m })}>{CLUSTER_LABELS[m]}</button
					>
				{/each}
				{#if view.cluster === 'opinion'}
					<label class="flex items-center gap-1"
						>at least
						<input
							type="number"
							step="25"
							class="w-20 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
							value={view.threshold}
							onchange={(e) => save({ ...view, threshold: Number(e.currentTarget.value) || 0 })}
						/></label
					>
				{:else if view.cluster === 'ethics'}
					<label class="flex items-center gap-1"
						>at most
						<input
							type="number"
							step="1"
							min="0"
							class="w-16 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
							value={view.ethicsDistance}
							onchange={(e) =>
								save({ ...view, ethicsDistance: Number(e.currentTarget.value) || 0 })}
						/> steps apart</label
					>
				{:else if view.cluster === 'federation'}
					<label class="flex items-center gap-1"
						>cohesion at least ≈
						<input
							type="number"
							step="0.05"
							max="0"
							class="w-20 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
							value={view.cohesionFloor}
							onchange={(e) => save({ ...view, cohesionFloor: Number(e.currentTarget.value) || 0 })}
						/></label
					>
				{/if}
			</div>
			<DiplomacyCircle
				{nodes}
				{edges}
				{groups}
				{axes}
				{tooltip}
				{highlight}
				details={view.details ? details : undefined}
				bind:focus
			/>
			{#if groups.some((g) => g.ids.length > 1)}
				<ul class="mt-2 text-sm">
					{#each groups.filter((g) => g.ids.length > 1) as g, i (g.ids.join())}
						<li>
							<span class="text-gray-500"
								>{g.label ??
									`group ${i + 1}`}{#if view.cluster === 'federation' && g.penalty !== undefined}
									<span
										title="what their ethics would cost a federation's cohesion (≈, the defines)"
										>(cohesion ≈ {g.penalty.toFixed(2)})</span
									>{/if}:</span
							>
							{#each g.ids as id, j (id)}{j ? ', ' : ''}<button
									class="cursor-pointer hover:underline {faded(id) ? 'opacity-30' : ''}"
									style:color={byId.get(id)?.color ?? undefined}
									onclick={() => (focus = focus === id ? null : id)}>{byId.get(id)?.name}</button
								>{/each}
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</Panel>

	<Panel
		title="Matrix"
		note="Row to column: the row's opinion of the column (tinted) and the relations between them. Grey ? = our intel does not show it; amber = unverified since the date in the tooltip."
	>
		<div class="overflow-x-auto">
			<table class="text-xs tabular-nums">
				<thead>
					<tr>
						<th></th>
						{#each matrixRows as c (c.id)}
							<th class="p-1 align-bottom {faded(c.id) ? 'opacity-20' : ''}">
								<button
									class="rotate-180 cursor-pointer whitespace-nowrap [writing-mode:vertical-rl] {focus ===
									c.id
										? 'text-sky-600'
										: ''}"
									style:color={focus === c.id ? undefined : (c.color ?? undefined)}
									title={tooltip(c)}
									onclick={() => (focus = focus === c.id ? null : c.id)}>{c.name}</button
								>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each matrixRows as r (r.id)}
						<tr class={faded(r.id) ? 'opacity-20' : ''}>
							<th class="pr-2 text-left whitespace-nowrap">
								<button
									class="cursor-pointer {focus === r.id ? 'text-sky-600' : ''}"
									onclick={() => (focus = focus === r.id ? null : r.id)}
									><EmpireName name={r.name} color={r.color} /></button
								>
							</th>
							{#each matrixRows as c (c.id)}
								{#if r.id === c.id}
									<td class="bg-gray-100 dark:bg-gray-800"></td>
								{:else}
									{@const o = opinionOf(r.id, c.id)}
									{@const es = pairEdges(r.id, c.id)}
									<td
										class="border border-gray-200 p-1 text-center dark:border-gray-800 {o?.stale ||
										es.some((e) => e.stale)
											? 'border-dashed border-amber-500'
											: ''} {faded(c.id) ? 'opacity-20' : ''}"
										title={[
											o
												? `${r.name}'s opinion of ${c.name}: ${o.value}${stale(o)}`
												: `${r.name}'s opinion of ${c.name}: unknown`,
											...es.map(
												(e) =>
													`${edgeLabel(e.kind)}${e.kind === 'subject' || e.kind === 'is_rival' ? ` (${name(e.from)} → ${name(e.to)})` : ''}${e.stale ? ` — unverified since ${e.asOf}` : ''}`
											)
										].join('\n')}
									>
										{#if o}<div style:color={opinionColor(o.value)}>{o.value}</div>{:else}<div
												class="text-gray-400"
											>
												?
											</div>{/if}
										{#each es as e (`${e.kind}:${e.from}`)}<span
												class="mx-px font-semibold"
												style:color={edgeStyle(e.kind).color}>{edgeStyle(e.kind).short}</span
											>{/each}
									</td>
								{/if}
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Panel>

	<Panel title="Empires">
		<SortTable
			rows={nodes}
			{columns}
			key={(n) => n.id}
			link={(n) => n.id}
			bind:selected={focus}
			rowClass={(n) => (faded(n.id) ? 'opacity-30' : '')}
		/>
	</Panel>

	{#if changes.length}
		<Panel
			title="Ethics changes seen"
			note="An empire's ethics change by embracing a faction (at most once per 10 years). Dated between the last save our intel showed the old ethics and the first that showed the new."
		>
			<ul class="text-sm">
				{#each changes as c (`${c.id}:${c.by}`)}
					{@const n = d.nodes.find((x) => x.id === c.id)}
					<li class="flex flex-wrap items-center gap-1 {faded(c.id) ? 'opacity-30' : ''}">
						{#if n}<EmpireName name={n.name} color={n.color} />{/if}:
						{#each sortEthics(c.from, axes) as e (e)}<EthicChip
								ethic={e}
								name={ethicName(e)}
								{axes}
							/>{/each}→
						{#each sortEthics(c.to, axes) as e (e)}<EthicChip
								ethic={e}
								name={ethicName(e)}
								{axes}
								explanation={data.explain[`ethic:${e}`]}
							/>{/each}
						<span class="text-gray-500">between {c.after} and {c.by}</span>
					</li>
				{/each}
			</ul>
		</Panel>
	{/if}

	{#if d.wars.length}
		<Panel title="Wars">
			<ul class="text-sm">
				{#each d.wars as w (w.id)}
					<li
						class={lit && ![...w.attackers, ...w.defenders].some((id) => id === focus)
							? 'opacity-30'
							: ''}
					>
						<b>{w.name}</b>
						<span class="text-gray-500">since {w.start ?? '?'}</span>:
						{w.attackers.map(name).join(', ')} against {w.defenders.map(name).join(', ')}
					</li>
				{/each}
			</ul>
		</Panel>
	{/if}
{/if}
