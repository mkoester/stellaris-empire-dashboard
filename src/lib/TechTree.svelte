<script lang="ts">
	import { page } from '$app/state';
	import { fmt, pretty } from './format.ts';
	import WantButtons from './planner/WantButtons.svelte';
	import type { Stance } from './techOffers.ts';
	import { leadsClosure, needsClosure, prereqs, treeLayout, type TreeTech } from './techTree.ts';
	import { AREAS } from './techTiers.ts';

	// The tech tree of one area at a time (#lib/techTree.ts), each tech coloured by where it stands
	// — researched, being researched, on offer, within reach, not yet — and by the planner (want,
	// later, avoid), with + want / − want on hover. A click focuses a tech: what it needs and what
	// it leads to stay lit, everything else fades.
	let {
		tree,
		researched,
		researching,
		onOffer,
		reach
	}: {
		tree: TreeTech[];
		researched: string[];
		researching: string[];
		onOffer: string[];
		reach: string[];
	} = $props();

	const COL = 176; // px per column
	const ROW = 46; // px per row
	const W = 152; // node width
	const H = 38; // node height

	let area = $state(AREAS[0]);
	let focus: 'all' | 'reach' | 'wanted' | 'path' = $state('all');
	let selected: string | null = $state(null);

	const layout = $derived(treeLayout(tree, area));
	const byKey = $derived(new Map(tree.map((t) => [t.key, t])));
	const pos = $derived(new Map(layout.nodes.map((n) => [n.key, n])));
	const done = $derived(new Set(researched));
	const now = $derived(new Set(researching));
	const offer = $derived(new Set(onOffer));
	const near = $derived(new Set(reach));
	const plan = $derived(
		new Map(
			(page.data.plan?.plannedTechs as [string, { stance: Stance }][] | undefined)?.map(
				([k, v]) => [k, v.stance]
			) ?? []
		)
	);
	const name = (k: string) => byKey.get(k)?.name ?? pretty(k.replace(/^tech_/, ''));

	// what stays lit: null lights everything
	const lit = $derived.by((): Set<string> | null => {
		if (focus === 'all') return null;
		if (focus === 'reach') return new Set([...reach, ...researching, ...onOffer]);
		if (focus === 'wanted') {
			const out = new Set<string>();
			for (const [k, s] of plan)
				if (s !== 'avoid') for (const x of needsClosure(byKey, k)) out.add(x);
			return out;
		}
		if (!selected) return null;
		return new Set([...needsClosure(byKey, selected), ...leadsClosure(byKey, selected)]);
	});
	const dim = (k: string) => lit !== null && !lit.has(k);

	const standing = (k: string) =>
		done.has(k)
			? 'researched'
			: now.has(k)
				? 'researching'
				: offer.has(k)
					? 'on offer'
					: near.has(k)
						? 'within reach'
						: 'not yet';
	const STYLE: Record<string, string> = {
		researched: 'border-gray-300 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800',
		researching: 'border-sky-600 bg-sky-100 dark:bg-sky-950 ring-2 ring-sky-500',
		'on offer': 'border-sky-500 bg-sky-50 dark:bg-sky-950 font-semibold',
		'within reach': 'border-green-500 bg-white dark:bg-gray-900',
		'not yet':
			'border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
	};
	const PLAN: Record<Stance, string> = {
		want: 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100',
		later: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
		avoid: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
	};

	const foreign = (t: TreeTech) =>
		prereqs(t).filter((p) => byKey.has(p) && byKey.get(p)!.area !== area);
	const title = (t: TreeTech) =>
		[
			`${t.name} — ${standing(t.key)}`,
			`tier ${t.tier ?? '–'}${t.cost === null ? '' : `, ${fmt(t.cost)} base cost`}${t.category ? `, ${pretty(t.category)}` : ''}`,
			t.rare ? 'rare' : '',
			t.dangerous ? 'dangerous' : '',
			t.needs.length ? `needs ${t.needs.map(name).join(', ')}` : '',
			...t.anyOf.map((g) => `needs one of ${g.map(name).join(', ')}`)
		]
			.filter(Boolean)
			.join('\n');
	const edge = (from: string, to: string) => {
		const a = pos.get(from)!;
		const b = pos.get(to)!;
		const x1 = a.col * COL + W;
		const y1 = a.row * ROW + H / 2;
		const x2 = b.col * COL;
		const y2 = b.row * ROW + H / 2;
		const mid = (x1 + x2) / 2;
		return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
	};
	const sel = $derived(selected ? byKey.get(selected) : undefined);
	const leadsTo = $derived(
		sel ? tree.filter((t) => prereqs(t).includes(sel.key)).map((t) => t.key) : []
	);
	const count = (a: string) => tree.filter((t) => t.area === a).length;
	const doneIn = (a: string) => tree.filter((t) => t.area === a && done.has(t.key)).length;
</script>

<div class="mb-2 flex flex-wrap items-center gap-3 text-sm">
	<span class="flex gap-1">
		{#each AREAS as a (a)}
			<button
				type="button"
				class="rounded px-2 py-0.5 {a === area
					? 'bg-sky-600 text-white'
					: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'}"
				onclick={() => (area = a)}
			>
				{`${a} ${doneIn(a)}/${count(a)}`}
			</button>
		{/each}
	</span>
	<label class="flex items-center gap-1">
		show
		<select
			class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
			bind:value={focus}
		>
			<option value="all">everything</option>
			<option value="reach">within reach and on offer</option>
			<option value="wanted">wanted, with what they need</option>
			<option value="path">the clicked tech's path</option>
		</select>
	</label>
	<span class="flex flex-wrap gap-2 text-xs text-gray-500">
		{#each Object.keys(STYLE) as s (s)}<span class="rounded border px-1 {STYLE[s]}">
				{s}
			</span>{/each}
		{#each Object.keys(PLAN) as s (s)}<span class="rounded px-1 {PLAN[s as Stance]}">
				{s}
			</span>{/each}
	</span>
</div>

{#if sel}
	<div class="mb-2 rounded border border-gray-200 p-2 text-sm dark:border-gray-800">
		<div class="flex flex-wrap items-baseline gap-2">
			<span class="font-semibold">{sel.name}</span>
			<span class="text-gray-500">
				{`${sel.area}, tier ${sel.tier ?? '–'}${sel.cost === null ? '' : `, ${fmt(sel.cost)}`} — ${standing(sel.key)}`}
			</span>
			<WantButtons tech={sel.key} label={sel.name} />
			<button
				type="button"
				class="ml-auto text-xs text-gray-500 hover:text-current"
				onclick={() => (selected = null)}
			>
				close
			</button>
		</div>
		{#if prereqs(sel).length}<p>
				<span class="text-gray-500">Needs:</span>
				{#each prereqs(sel) as p, i (p)}{#if i},
					{/if}<button
						type="button"
						class="hover:underline {done.has(p) ? 'text-gray-500' : ''}"
						onclick={() => {
							selected = p;
							area = byKey.get(p)?.area ?? area;
						}}
					>
						{name(p)}{done.has(p) ? ' ✓' : ''}
					</button>{/each}
			</p>{/if}
		{#if leadsTo.length}<p>
				<span class="text-gray-500">Leads to:</span>
				{#each leadsTo as p, i (p)}{#if i},
					{/if}<button
						type="button"
						class="hover:underline"
						onclick={() => {
							selected = p;
							area = byKey.get(p)?.area ?? area;
						}}
					>
						{name(p)}
					</button>{/each}
			</p>{/if}
	</div>
{/if}

<div class="max-h-[80vh] overflow-auto rounded border border-gray-200 dark:border-gray-800">
	<div
		class="relative"
		style:width="{layout.cols * COL}px"
		style:height="{Math.max(1, layout.rows) * ROW}px"
	>
		<svg
			class="pointer-events-none absolute inset-0"
			width={layout.cols * COL}
			height={layout.rows * ROW}
		>
			{#each layout.edges as e (`${e.from}>${e.to}`)}
				<path
					d={edge(e.from, e.to)}
					fill="none"
					class={dim(e.from) || dim(e.to)
						? 'stroke-gray-200 dark:stroke-gray-800'
						: done.has(e.from)
							? 'stroke-gray-400'
							: 'stroke-sky-500'}
					stroke-width="1.2"
					stroke-dasharray={e.any ? '3 3' : undefined}
				/>
			{/each}
		</svg>
		{#each layout.nodes as t (t.key)}
			{@const s = standing(t.key)}
			{@const p = plan.get(t.key)}
			<div
				class="group absolute flex flex-col justify-center overflow-hidden rounded border px-1 text-[11px] leading-tight {STYLE[
					s
				]} {selected === t.key ? 'outline-2 outline-amber-500' : ''} {dim(t.key)
					? 'opacity-25'
					: ''}"
				style:left="{t.col * COL}px"
				style:top="{t.row * ROW}px"
				style:width="{W}px"
				style:height="{H}px"
				title={title(t)}
				role="button"
				tabindex="0"
				onclick={() => (selected = selected === t.key ? null : t.key)}
				onkeydown={(e) => {
					if (e.key === 'Enter') selected = selected === t.key ? null : t.key;
				}}
			>
				<span class="truncate">{t.name}</span>
				<span class="flex items-center gap-1 text-[10px] text-gray-500">
					<span>{`T${t.tier ?? '–'}`}</span>
					{#if t.rare}<span class="text-purple-600" title="rare">★</span>{/if}
					{#if t.dangerous}<span class="text-red-600" title="dangerous">⚠</span>{/if}
					{#if foreign(t).length}<span title="needs {foreign(t).map(name).join(', ')}">
							{`↖ ${[...new Set(foreign(t).map((k) => byKey.get(k)?.area))].join(', ')}`}
						</span>{/if}
					{#if p}<span class="rounded px-0.5 {PLAN[p]}">{p}</span>{/if}
					{#if s !== 'researched'}
						<span class="ml-auto hidden group-hover:inline-flex">
							<WantButtons tech={t.key} label={t.name} />
						</span>
					{/if}
				</span>
			</div>
		{/each}
	</div>
</div>
