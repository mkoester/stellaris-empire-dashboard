<script lang="ts">
	import type { Snippet } from 'svelte';

	// A titled section; every panel uses it so the page (and later tabs or a configurable
	// dashboard) can place them freely.
	let { title, note, children }: { title: string; note?: string; children: Snippet } = $props();
</script>

<section>
	<h2 class="mb-2 text-xl font-semibold">{title}</h2>
	{#if note}<p class="mb-2 text-sm text-gray-500">{note}</p>{/if}
	{@render children()}
</section>
