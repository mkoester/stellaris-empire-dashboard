<script lang="ts">
	import { ROLE_BADGES } from './leaders.ts';

	// One role a leader can hold (#lib/leaders.ts ROLE_BADGES), as small coloured badges: the ruler
	// sits on the council too, so it shows both.
	let { kind }: { kind: string } = $props();
	const badges = $derived(
		(kind === 'ruler' ? ['ruler', 'council'] : [kind]).flatMap((k) => ROLE_BADGES[k] ?? [])
	);
</script>

{#each badges as badge (badge.short)}<span
		class="mr-0.5 inline-block rounded px-1 align-middle text-[10px] leading-4 font-semibold text-white"
		style:background={badge.color}
		title={badge.title}>{badge.short}</span
	>{/each}
