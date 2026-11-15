<script lang="ts">
	import InfoPopup from './InfoPopup.svelte';
	import {
		MARKERS,
		branchLabels,
		displayList,
		duration,
		effectRef,
		effectText,
		ifLabel,
		isChoice,
		markers,
		outcomeText,
		rewards,
		type OutcomeNode
	} from './outcomes.ts';

	// What an anomaly, special project or dig site leads to: its markers, a one-line summary of the
	// rewards, and the whole tree on opening (`#lib/outcomes.ts`). `chapter`: a dig site's next one.
	let { tree, chapter = null }: { tree: OutcomeNode[]; chapter?: number | null } = $props();

	const kinds = $derived(markers(tree));
	const summary = $derived(rewards(tree));
	const SHOWN = 3;
</script>

{#snippet list(l: OutcomeNode[])}
	<ul class="ml-3 list-none">
		{#each displayList(l) as n, i (i)}<li>{@render node(n)}</li>{/each}
	</ul>
{/snippet}

{#snippet leaf(n: OutcomeNode)}
	{@const text = effectText(n)}
	{@const ref = effectRef(n)}
	{#if text}{#if ref}<InfoPopup {ref}>{text}</InfoPopup>{:else if n.t === 'note'}<i>{text}</i
			>{:else}{text}{/if}{/if}
{/snippet}

{#snippet node(n: OutcomeNode)}
	{#if n.t === 'event'}
		<b>{n.title ?? n.id}</b>{#if n.delay}<span class="text-sky-600"
				>{` after ${duration(n.delay)}`}</span
			>{/if}
		{#if n.e.length}{@render list(n.e)}{/if}
		{@const pick = isChoice(n.o)}
		<ul class="ml-3 list-none">
			{#each n.o as o, i (i)}
				{#if pick || o.cond || o.e.length}
					<li>
						{#if pick || o.cond}<span class="text-blue-600"
								>{pick ? '▸ ' : ''}“{o.name ?? '…'}”</span
							>{#if o.cond}<span class="ml-1 text-amber-600">(if available)</span>{/if}{/if}
						{#if o.e.length}{@render list(o.e)}{:else if pick}<span class="ml-1 text-gray-400"
								>– nothing</span
							>{/if}
					</li>
				{/if}
			{/each}
		</ul>
	{:else if n.t === 'random'}
		{@const c = branchLabels(n.b)}
		{#each n.b as b, i (i)}
			<div>
				<span class="text-purple-600">{c[i]}</span>{#if b.e.length}{@render list(b.e)}{:else}<span
						class="text-gray-400">: nothing</span
					>{/if}
			</div>
		{/each}
	{:else if n.t === 'if'}
		{#each n.b as b, i (i)}
			<div>
				<span class="text-amber-600">{ifLabel(i, n.b.length, n.else)}</span
				>{#if b.length}{@render list(b)}{:else}<span class="ml-1 text-gray-400">nothing</span>{/if}
			</div>
		{/each}
		{#if !n.else}<div class="text-gray-400">otherwise: nothing</div>{/if}
	{:else if n.t === 'later'}
		<span class="text-sky-600">after {duration(n.days)}:</span>{@render list(n.e)}
	{:else if n.t === 'chapter'}
		<b class:text-green-700={chapter === n.n}
			>Chapter {n.n}{n.difficulty !== null ? ` (difficulty ${n.difficulty})` : ''}{chapter === n.n
				? ' ← next'
				: ''}</b
		>{@render list(n.e)}
	{:else if n.t === 'project'}
		→ {@render leaf(n)}{#if n.sub}{@render list(n.sub)}{/if}
	{:else}
		{@render leaf(n)}
	{/if}
{/snippet}

<span class="inline-flex flex-wrap gap-1 align-middle">
	{#each kinds as m (m)}
		<span
			class="rounded border px-1 text-[11px] leading-4"
			style:color={MARKERS[m].color}
			style:border-color={MARKERS[m].color}
			title={MARKERS[m].title}>{MARKERS[m].label}</span
		>
	{/each}
</span>
<details class="inline-block align-top">
	<summary class="cursor-pointer text-gray-500" title={outcomeText(tree, chapter)}
		>{summary.slice(0, SHOWN).join(' · ') || 'nothing that shows'}{summary.length > SHOWN
			? ` · +${summary.length - SHOWN} more`
			: ''}</summary
	>
	<div class="text-sm">{@render list(tree)}</div>
</details>
