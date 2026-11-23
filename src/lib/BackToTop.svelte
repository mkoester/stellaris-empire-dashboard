<script lang="ts">
	// "Back to the top" in the lower right corner, once the page is scrolled down (every tab; the
	// user's ask 2026-11-18). Shown past half a screen height: a short scroll needs no button.
	let y = $state(0);
	let h = $state(0);
</script>

<svelte:window bind:scrollY={y} bind:innerHeight={h} />

{#if h > 0 && y > h / 2}
	<button
		type="button"
		class="fixed right-4 bottom-4 z-40 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm shadow hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
		title="Back to the top"
		onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
	>
		↑ top
	</button>
{/if}
