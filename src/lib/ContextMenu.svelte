<script lang="ts" module>
	export type MenuItem = { label: string; title?: string; disabled?: boolean; action: () => void };
</script>

<script lang="ts">
	// A menu at the pointer (a right-click on the map): Esc, a click elsewhere or a pick close it.
	let {
		x,
		y,
		heading,
		items,
		onclose
	}: { x: number; y: number; heading?: string; items: MenuItem[]; onclose: () => void } = $props();

	let menu: HTMLDivElement | undefined = $state();
	// kept inside the window
	const left = $derived(Math.max(4, Math.min(x, (globalThis.innerWidth ?? 1e4) - 300)));
	const top = $derived(
		Math.max(4, Math.min(y, (globalThis.innerHeight ?? 1e4) - 40 - items.length * 26))
	);
</script>

<svelte:window
	onkeydown={(e) => e.key === 'Escape' && onclose()}
	onpointerdown={(e) => menu && !menu.contains(e.target as Node) && onclose()}
/>

<div
	bind:this={menu}
	role="menu"
	class="fixed z-50 w-72 rounded-lg border border-gray-300 bg-white py-1 text-sm shadow-xl dark:border-gray-600 dark:bg-gray-900"
	style:left="{left}px"
	style:top="{top}px"
>
	{#if heading}<div class="px-3 py-1 text-xs font-semibold text-gray-500">{heading}</div>{/if}
	{#each items as item, i (i)}
		<button
			type="button"
			role="menuitem"
			class="block w-full px-3 py-1 text-left hover:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-transparent dark:hover:bg-gray-800"
			title={item.title}
			disabled={item.disabled}
			onclick={() => {
				item.action();
				onclose();
			}}>{item.label}</button
		>
	{:else}
		<div class="px-3 py-1 text-gray-500">nothing to plan here</div>
	{/each}
</div>
