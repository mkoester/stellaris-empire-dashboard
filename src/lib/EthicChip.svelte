<script lang="ts">
	import { colorOf } from './colors.ts';
	import { ethicMark } from './ethics.ts';
	import InfoPopup from './InfoPopup.svelte';
	import type { EthicAxis, Explanation } from './types.ts';

	// One ethic: a dot in its pole's colour and its name (the short one with `short`), bold when
	// fanatic, amber when our intel no longer shows it; the ethic's popup when there is one.
	let {
		ethic,
		name,
		axes,
		stale = false,
		short = false,
		explanation
	}: {
		ethic: string;
		name: string;
		axes: Record<string, EthicAxis>;
		stale?: boolean;
		short?: boolean;
		explanation?: Explanation;
	} = $props();
	const mark = $derived(ethicMark(ethic, axes));
</script>

<span
	class="inline-flex items-center gap-1 rounded border px-1 whitespace-nowrap {stale
		? 'border-amber-500/60 text-amber-600'
		: 'border-gray-300 dark:border-gray-700'} {mark?.fanatic ? 'font-semibold' : ''}"
	title={short ? name : undefined}
	>{#if mark}<span class="inline-block size-2 rounded-full" style:background={colorOf(mark.color)}
		></span>{/if}<InfoPopup {explanation}>{short && mark ? mark.short : name}</InfoPopup></span
>
