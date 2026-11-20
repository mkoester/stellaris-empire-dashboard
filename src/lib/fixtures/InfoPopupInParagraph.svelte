<script lang="ts">
	import InfoPopup from '../InfoPopup.svelte';
	import type { Explanation } from '../types.ts';

	// InfoPopup is used inline, often inside a <p>: everything it renders must be phrasing content.
	let { explanation }: { explanation: Explanation } = $props();
</script>

<p>before <InfoPopup {explanation}>name</InfoPopup> after</p>
