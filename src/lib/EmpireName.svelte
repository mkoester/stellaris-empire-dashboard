<script lang="ts">
	import { page } from '$app/state';
	import type { ContactKind } from './contacts.ts';
	import EmpireBadges from './EmpireBadges.svelte';

	// An empire's name with a swatch of its galaxy-map colour and its badges. Without `color`, the
	// colour the page's branch knows for that name (`empireColors`, from branch()); no swatch where
	// none is known.
	let {
		name,
		color,
		kind = null,
		nomadic = false,
		bold = true
	}: {
		name: string;
		color?: string | null;
		kind?: ContactKind | null;
		nomadic?: boolean;
		bold?: boolean;
	} = $props();
	const hex = $derived(
		color === undefined
			? ((page.data.empireColors as Record<string, string> | undefined)?.[name] ?? null)
			: color
	);
</script>

<span class="whitespace-nowrap"
	>{#if hex}<span
			class="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-gray-400 align-baseline dark:border-gray-600"
			style:background={hex}
			title="its colour on the galaxy map"
		></span>{/if}{#if bold}<b>{name}</b>{:else}{name}{/if}<EmpireBadges {kind} {nomadic} /></span
>
