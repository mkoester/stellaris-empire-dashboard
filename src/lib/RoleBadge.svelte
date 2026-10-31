<script lang="ts">
	import { ROLE_BADGES } from './leaders.ts';

	// One role a leader can hold (#lib/leaders.ts ROLE_BADGES), as a small coloured badge.
	let { kind }: { kind: string } = $props();
	const badge = $derived(ROLE_BADGES[kind]);
</script>

{#if badge}<span
		class="mr-0.5 inline-block rounded px-1 align-middle text-[10px] leading-4 font-semibold text-white"
		style:background={badge.color}
		title={badge.title}>{badge.short}</span
	>{/if}
