<script lang="ts">
	import { page } from '$app/state';
	import { pretty } from './format.ts';
	import InfoPopup from './InfoPopup.svelte';
	import type { Explanation } from './types.ts';

	// A colony's designation by the game's name, with a popup on what it specialises in and the
	// job bonus it grants — from the page's branch (`designations`, from branch()).
	let { key }: { key: string } = $props();
	const explanation = $derived(
		(page.data.designations as Record<string, Explanation> | undefined)?.[`designation:${key}`]
	);
</script>

<InfoPopup {explanation}>{explanation?.title ?? pretty(key)}</InfoPopup>
