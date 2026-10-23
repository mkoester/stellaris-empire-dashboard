<script lang="ts">
	import type { ContactKind } from './contacts.ts';
	import EmpireBadges from './EmpireBadges.svelte';

	// An empire's name with a swatch of its galaxy-map colour and its badges.
	let {
		name,
		color = null,
		kind = null,
		nomadic = false
	}: {
		name: string;
		color?: string | null;
		kind?: ContactKind | null;
		nomadic?: boolean;
	} = $props();
</script>

<span
	class="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-gray-400 align-baseline dark:border-gray-600"
	style:background={color ?? 'transparent'}
	title={color ? 'its colour on the galaxy map' : 'colour unknown'}
></span><b>{name}</b><EmpireBadges {kind} {nomadic} />
