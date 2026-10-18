<script lang="ts">
	import { colorOf } from './colors.ts';
	import type { Trait } from './colonyProfile.ts';
	import InfoPopup from './InfoPopup.svelte';
	import type { Explanation } from './types.ts';

	// A pro (👍) or con (👎): its effect, a dot in its resource's colour, ⏳ when temporary; where it
	// comes from on hover, and the source's popup when there is one.
	let { t, pro, explanation }: { t: Trait; pro: boolean; explanation?: Explanation } = $props();
</script>

<span
	class="inline-flex items-center gap-1 rounded border px-1 whitespace-nowrap {pro
		? 'border-green-600/40'
		: 'border-red-600/40'}"
	title={t.until ? `${t.detail}\ntemporary, until ${t.until}` : t.detail}
	><span class={pro ? 'text-green-600' : 'text-red-600'}>{pro ? '👍' : '👎'}</span
	>{#if t.resource && colorOf(t.resource)}<span
			class="inline-block size-2 rounded-full"
			style:background={colorOf(t.resource)}
		></span>{/if}<InfoPopup {explanation}>{t.label}</InfoPopup>{#if t.until}<span
			class="cursor-help"
			aria-label="temporary">⏳</span
		>{/if}</span
>
