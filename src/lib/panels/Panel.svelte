<script lang="ts">
	import type { Snippet } from 'svelte';

	// A titled section; every panel uses it so the page (and later tabs or a configurable
	// dashboard) can place them freely. `accent`: a colour for a stripe on its left edge.
	let {
		title,
		note,
		accent,
		children
	}: { title: string; note?: string; accent?: string; children: Snippet } = $props();
</script>

<section class={accent ? 'border-l-4 pl-3' : undefined} style:border-color={accent}>
	<h2 class="mb-2 text-xl font-semibold">{title}</h2>
	{#if note}<p class="mb-2 text-sm text-gray-500">{note}</p>{/if}
	{@render children()}
</section>
