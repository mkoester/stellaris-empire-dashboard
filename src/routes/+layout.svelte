<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Empire dashboard</title>
</svelte:head>

<main class="mx-auto max-w-[96rem] p-4">
	{@render children()}
</main>
