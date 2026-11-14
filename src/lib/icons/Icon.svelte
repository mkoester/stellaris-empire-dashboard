<script lang="ts">
	import { ICONS, type IconName } from './icons.ts';

	// One of our own icons (#lib/icons/icons.ts), in the text colour; decorative, so hidden from
	// screen readers — the name next to it says what it is.
	let { name, class: cls = 'size-5' }: { name: IconName; class?: string } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	class="inline-block shrink-0 {cls}"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	>{#each ICONS[name] as d, i (i)}<path {d} />{/each}</svg
>
