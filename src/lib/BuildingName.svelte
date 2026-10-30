<script lang="ts">
	import { page } from '$app/state';
	import { pretty } from './format.ts';
	import InfoPopup from './InfoPopup.svelte';
	import type { Explanation } from './types.ts';

	// A building by the game's name, with a popup on what it costs, makes and does — from the page's
	// branch (`buildings`, from branch(): every building on our colonies or in their queues) or the
	// page's own `explain`.
	let { key, name }: { key: string; name?: string } = $props();
	const explanation = $derived(
		(page.data.buildings as Record<string, Explanation> | undefined)?.[`building:${key}`] ??
			(page.data.explain as Record<string, Explanation> | undefined)?.[`building:${key}`]
	);
</script>

<InfoPopup {explanation}>{name ?? explanation?.title ?? pretty(key)}</InfoPopup>
