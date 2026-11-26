<script lang="ts">
	import type { Snippet } from 'svelte';
	import InfoPopup from './InfoPopup.svelte';
	import Painted from './Painted.svelte';
	import {
		MARKERS,
		branchLabels,
		displayList,
		duration,
		effectRef,
		effectText,
		ifHead,
		isChoice,
		markers,
		monthsParts,
		type Now,
		outcomeText,
		paints,
		prune,
		rewardBadges,
		rewards,
		techFlags,
		type Flag,
		type OutcomeNode
	} from './outcomes.ts';

	// What an anomaly, special project or dig site leads to: its markers, a one-line summary of the
	// rewards, and the whole tree on opening (`#lib/outcomes.ts`), every level folding on its own.
	// What this empire cannot get (`off`, a branch not `taken`; `resolve()`) is greyed and folded,
	// and left out of the markers and the summary. `chapter`: a dig site's next one — the ones
	// before it are done, greyed. `now`: what months of income and tech progress come to for us
	// now (≈, `Now` in #lib/outcomes.ts), and where each tech stands (researched, a permanent
	// option, in the plan: `techFlags()`). Beside the markers, tinted, what kinds of reward it
	// holds (`rewardBadges()`). Resources and tech areas in their colours, "L-Gate" in its badge's
	// violet (`Painted`); an `if` branch's heading names its condition (`ifHead()`).
	let {
		tree,
		chapter = null,
		now = null
	}: { tree: OutcomeNode[]; chapter?: number | null; now?: Now | null } = $props();

	const open = $derived(prune(tree));
	const kinds = $derived(markers(open));
	const badges = $derived(rewardBadges(open, now));
	const summary = $derived(rewards(open, now));
	const SHOWN = 3;
	const NOT_OURS = 'not for your empire';

	// a node with structure below it; a level holding only effects opens by itself
	const STRUCTURED = new Set(['event', 'random', 'if', 'later', 'chapter', 'project']);
	const flat = (l: OutcomeNode[]) => l.every((n) => !STRUCTURED.has(n.t));
	const brief = (l: OutcomeNode[]) => {
		const r = rewards(prune(l), now).map((x) => x.text);
		return r.length ? ` — ${r.slice(0, 2).join(' · ')}${r.length > 2 ? ' …' : ''}` : '';
	};
</script>

{#snippet list(l: OutcomeNode[], depth: number)}
	<ul class="ml-3 list-none">
		{#each displayList(l) as n, i (i)}<li>{@render node(n, depth)}</li>{/each}
	</ul>
{/snippet}

{#snippet leaf(n: OutcomeNode)}
	{@const text = effectText(n, now)}
	{@const ref = effectRef(n)}
	{#if n.t === 'months'}{@const m = monthsParts(n, now)}<Painted
			text={m.main}
			marks={paints(n, now)}
		/>{#if m.now}<span title="≈ at this month's gross income">
				{m.now}
			</span>{/if}<span class="text-gray-400">{m.bounds}</span>{:else if text}{#if ref}<InfoPopup
				{ref}
			>
				<Painted {text} marks={paints(n, now)} />
			</InfoPopup>{:else if n.t === 'note'}<i>
				<Painted {text} />
			</i>{:else if n.t === 'clear_deposits'}<span
				class="cursor-help underline decoration-dotted underline-offset-2"
				title="every deposit on the planet, blockers and features, is removed (clear_deposits)"
			>
				{text}
			</span>{:else}<Painted
				{text}
				marks={paints(n, now)}
			/>{/if}{/if}{#each techFlags(n, now) as f (f.label)}<span class="ml-1">
			{@render chip(f, false)}
		</span>{/each}
{/snippet}

{#snippet chip(f: Flag, tinted: boolean)}<span
		class="rounded border px-1 text-[11px] leading-4 whitespace-nowrap"
		style:color={f.color}
		style:border-color={tinted ? 'transparent' : f.color}
		style:background-color={tinted ? `${f.color}26` : undefined}
		title={f.title}
	>
		{f.label}
	</span>{/snippet}

<!-- a foldable level: its heading, a short summary of what is in it, its body -->
{#snippet fold(head: Snippet, body: OutcomeNode[], depth: number, off: boolean, why: string | null)}
	<details
		open={!off && (depth === 0 || flat(body))}
		class={off ? 'opacity-50' : ''}
		title={off ? `${NOT_OURS}${why ? `: ${why}` : ''}` : undefined}
	>
		<summary class="cursor-pointer">
			{@render head()}<span class="text-gray-400">
				{#if off}{` (${NOT_OURS})`}{:else}<Painted text={brief(body)} />{/if}
			</span>
		</summary>
		{@render list(body, depth + 1)}
	</details>
{/snippet}

{#snippet node(n: OutcomeNode, depth: number)}
	{#if n.t === 'event'}
		{#snippet head()}<b><Painted text={n.title ?? n.id} /></b>{#if n.delay}<span
					class="text-sky-600"
				>
					{` after ${duration(n.delay)}`}
				</span>{/if}{/snippet}
		{@const pick = isChoice(n.o)}
		<details
			open={!n.off && depth === 0}
			class={n.off ? 'opacity-50' : ''}
			title={n.off ? `${NOT_OURS}${n.why ? `: ${n.why}` : ''}` : undefined}
		>
			<summary class="cursor-pointer">
				{@render head()}<span class="text-gray-400">
					{#if n.off}{` (${NOT_OURS})`}{:else}<Painted text={brief([n])} />{/if}
				</span>
			</summary>
			{#if n.e.length}{@render list(n.e, depth + 1)}{/if}
			<ul class="ml-3 list-none">
				{#each n.o as o, i (i)}
					{#if pick || o.cond || o.e.length}
						<li>
							{#if pick || o.cond}
								{#snippet optionHead()}<span class="text-blue-600">
										{pick ? '▸ ' : ''}“{o.name ?? '…'}”
									</span>{#if o.cond && !o.off}<span class="ml-1 text-amber-600">
											(if available)
										</span>{/if}{/snippet}
								{#if o.e.length}{@render fold(
										optionHead,
										o.e,
										depth + 1,
										!!o.off,
										o.why ?? null
									)}{:else}<span class={o.off ? 'opacity-50' : ''}>
										{@render optionHead()}<span class="ml-1 text-gray-400">– nothing</span>
									</span>{/if}
							{:else}{@render list(o.e, depth + 1)}{/if}
						</li>
					{/if}
				{/each}
			</ul>
		</details>
	{:else if n.t === 'random'}
		{@const c = branchLabels(n.b)}
		{#each n.b as b, i (i)}
			{#snippet branchHead()}<span class="text-purple-600">{c[i]}</span>{/snippet}
			{#if b.e.length}{@render fold(branchHead, b.e, depth, !!b.off, null)}{:else}<div
					class={b.off ? 'opacity-50' : ''}
				>
					{@render branchHead()}<span class="text-gray-400">: nothing</span>
				</div>{/if}
		{/each}
	{:else if n.t === 'if'}
		{#each n.b as b, i (i)}
			{@const off = n.taken?.[i] === false}
			{@const h = ifHead(n, i)}
			{#snippet branchIf()}<span class="text-amber-600" title={h.title || undefined}>
					{h.label}
				</span>{#if h.note}<span class="text-gray-400">{h.note}</span>{/if}{/snippet}
			{#if b.length}{@render fold(branchIf, b, depth, off, n.heads?.[i]?.why ?? null)}{:else}<div
					class={off ? 'opacity-50' : ''}
				>
					{@render branchIf()}<span class="ml-1 text-gray-400">nothing</span>
				</div>{/if}
		{/each}
		{#if !n.else}<div class="text-gray-400">otherwise: nothing</div>{/if}
	{:else if n.t === 'later'}
		{#snippet laterHead()}<span class="text-sky-600">after {duration(n.days)}:</span>{/snippet}
		{@render fold(laterHead, n.e, depth, false, null)}
	{:else if n.t === 'chapter'}
		{@const done = chapter !== null && n.n < chapter}
		{#snippet chapterHead()}<b class:text-green-700={chapter === n.n}>
				Chapter {n.n}{n.difficulty !== null ? ` (difficulty ${n.difficulty})` : ''}{chapter === n.n
					? ' ← next'
					: done
						? ' (done)'
						: ''}
			</b>{/snippet}
		<details open={!done && (depth === 0 || flat(n.e))} class={done ? 'opacity-50' : ''}>
			<summary class="cursor-pointer">
				{@render chapterHead()}<span class="text-gray-400"><Painted text={brief(n.e)} /></span>
			</summary>
			{@render list(n.e, depth + 1)}
		</details>
	{:else if n.t === 'project'}
		{#snippet projectHead()}→ {@render leaf(n)}{/snippet}
		{#if n.sub?.length}{@render fold(
				projectHead,
				n.sub,
				depth + 1,
				false,
				null
			)}{:else}{@render projectHead()}{/if}
	{:else}
		{@render leaf(n)}
	{/if}
{/snippet}

<span class="inline-flex flex-wrap gap-1 align-middle">
	{#each kinds as m (m)}{@render chip(MARKERS[m], false)}{/each}
	{#each badges as b (b.label)}{#if b.ref}<InfoPopup ref={b.ref}>
				{@render chip(b, true)}
			</InfoPopup>{:else}{@render chip(b, true)}{/if}{/each}
</span>
<!-- each reward with its popup; the whole tree as text on what follows them -->
<details class="inline-block align-top">
	<summary class="cursor-pointer text-gray-500">
		{#each summary.slice(0, SHOWN) as r, i (i)}{#if i}<span class="mx-1">
					·
				</span>{/if}{#if r.ref}<InfoPopup ref={r.ref}>
					<Painted text={r.text} marks={paints(r.n, now)} />
				</InfoPopup>{:else}<Painted text={r.text} marks={paints(r.n, now)} />{/if}{/each}<span
			class="ml-1"
			title={outcomeText(open, chapter, now)}
		>
			{!summary.length
				? open.length
					? 'nothing that shows'
					: NOT_OURS
				: summary.length > SHOWN
					? `· +${summary.length - SHOWN} more`
					: '…'}
		</span>
	</summary>
	<div class="text-sm">{@render list(tree, 0)}</div>
</details>
