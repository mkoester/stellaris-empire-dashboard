<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { keep, recall } from '#lib/browserStore.ts';

	// A titled section; every panel uses it so the page (and later tabs or a configurable
	// dashboard) can place them freely. `accent`: a colour for a stripe on its left edge.
	// `collapse`: a key under which the browser remembers it folded; the title then folds it.
	// `open` (bindable): whether it is unfolded — the page may unfold it (a link to a row inside).
	let {
		title,
		note,
		accent,
		collapse,
		open = $bindable(true),
		children
	}: {
		title: string;
		note?: string;
		accent?: string;
		collapse?: string;
		open?: boolean;
		children: Snippet;
	} = $props();

	const storeKey = $derived(collapse ? `panel-collapsed:${collapse}` : null);
	let mounted = $state(false);
	onMount(() => {
		if (storeKey) open = recall(storeKey) !== '1';
		mounted = true;
	});
	// remembered however it changed: its title, or the page unfolding it
	$effect(() => {
		if (mounted && storeKey) keep(storeKey, open ? '0' : '1');
	});
	const toggle = () => (open = !open);
</script>

<section class={accent ? 'border-l-4 pl-3' : undefined} style:border-color={accent}>
	{#if collapse}
		<h2 class="mb-2 text-xl font-semibold">
			<button
				type="button"
				class="cursor-pointer text-left hover:underline"
				aria-expanded={open}
				onclick={toggle}
				><span class="inline-block w-5 text-base text-gray-500">{open ? '▾' : '▸'}</span
				>{title}</button
			>
		</h2>
	{:else}
		<h2 class="mb-2 text-xl font-semibold">{title}</h2>
	{/if}
	{#if open}
		{#if note}<p class="mb-2 text-sm text-gray-500">{note}</p>{/if}
		{@render children()}
	{/if}
</section>
