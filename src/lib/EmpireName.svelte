<script lang="ts">
	import { page } from '$app/state';
	import type { ContactKind } from './contacts.ts';
	import EmpireBadges from './EmpireBadges.svelte';

	// An empire's name with a swatch of its galaxy-map colour and its badges. Without `color`, the
	// colour the page's branch knows for that name (`empireColors`, from branch()); no swatch where
	// none is known. `wrap` lets a long name take more than one line (the contracts tab beside its
	// map, 2026-11-22); the swatch stays with the first word.
	let {
		name,
		color,
		kind = null,
		nomadic = false,
		bold = true,
		wrap = false
	}: {
		name: string;
		color?: string | null;
		kind?: ContactKind | null;
		nomadic?: boolean;
		bold?: boolean;
		wrap?: boolean;
	} = $props();
	const cut = $derived(wrap ? name.indexOf(' ') : -1);
	const first = $derived(cut < 0 ? name : name.slice(0, cut));
	const rest = $derived(cut < 0 ? '' : name.slice(cut));
	// a fallen hive's fragment: which splinter it is, whatever its name (`empireTags`, branch())
	const tag = $derived(
		(page.data.empireTags as Record<string, string> | undefined)?.[name] ?? null
	);
	const hex = $derived(
		color === undefined
			? ((page.data.empireColors as Record<string, string> | undefined)?.[name] ?? null)
			: color
	);
</script>

<span class={wrap ? '' : 'whitespace-nowrap'}
	><span class="whitespace-nowrap"
		>{#if hex}<span
				class="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-gray-400 align-baseline dark:border-gray-600"
				style:background={hex}
				title="its colour on the galaxy map"
			></span>{/if}{#if bold}<b>{first}</b>{:else}{first}{/if}</span
	>{#if rest}{#if bold}<b>{rest}</b>{:else}{rest}{/if}{/if}{#if tag}<span
			class="ml-1 rounded border border-gray-300 px-1 text-xs font-normal text-gray-500 dark:border-gray-700"
			title="one of the fragments of a shattered fallen hive empire">{tag}</span
		>{/if}<EmpireBadges {kind} {nomadic} /></span
>
