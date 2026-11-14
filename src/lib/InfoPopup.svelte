<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Explanation } from './types.ts';
	import ExplanationCard from './ExplanationCard.svelte';
	import { placePopup } from './popup.ts';

	// Wraps a name: hovering it (or focusing it, e.g. a tap on a phone) shows what the game files
	// say about it. Without an explanation the name renders plain. No popup library — the planner's
	// InfoPopup needs Skeleton UI, which this app does not use. The card is a popover in the top
	// layer, placed next to the name in viewport coordinates: a panel that scrolls (Upcoming, wide
	// tables) cannot cut it off, as it did while it was positioned inside the panel (the user's
	// catch, 2026-11-06).
	// `ref` (`tech:<key>`, …) instead of `explanation`: the card is fetched on first open
	// (`/api/explain`), for names a page does not carry the card of.
	let {
		explanation,
		ref,
		children
	}: { explanation?: Explanation; ref?: string; children: Snippet } = $props();
	let fetched = $state<Explanation | 'loading' | 'missing' | null>(null);
	const shown = $derived(explanation ?? (typeof fetched === 'object' ? fetched : null));
	const fetchCard = async () => {
		if (explanation || !ref || fetched !== null) return;
		fetched = 'loading';
		try {
			const r = await fetch(`/api/explain?ref=${encodeURIComponent(ref)}`);
			fetched = r.ok ? ((await r.json()) as Explanation) : 'missing';
		} catch {
			fetched = 'missing';
		}
		// the card's height changed: place it again
		requestAnimationFrame(place);
	};

	let anchor = $state<HTMLElement>();
	let card = $state<HTMLElement>();
	let timer: ReturnType<typeof setTimeout> | undefined;

	const place = () => {
		if (!anchor || !card) return;
		const { top, left } = placePopup(
			anchor.getBoundingClientRect(),
			{ width: card.offsetWidth, height: card.offsetHeight },
			{ width: window.innerWidth, height: window.innerHeight }
		);
		card.style.top = `${top}px`;
		card.style.left = `${left}px`;
	};
	const hide = () => {
		document.removeEventListener('scroll', onScroll, true);
		if (card?.matches(':popover-open')) card.hidePopover();
	};
	// scrolling the card itself (a long one) keeps it open
	const onScroll = (e: Event) => {
		if (!card?.contains(e.target as Node)) hide();
	};
	const open = () => {
		void fetchCard();
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (!card || card.matches(':popover-open')) return;
			card.showPopover();
			place();
			// any scroll — the page's or a panel's — would leave it behind: close it
			document.addEventListener('scroll', onScroll, true);
		}, 150);
	};
	// a moment to move the pointer from the name onto the card
	const close = () => {
		clearTimeout(timer);
		timer = setTimeout(hide, 120);
	};
</script>

{#if explanation || ref}
	<span
		class="inline-block"
		role="presentation"
		onmouseenter={open}
		onmouseleave={close}
		onfocusin={open}
		onfocusout={close}
	>
		<span
			bind:this={anchor}
			tabindex="0"
			role="button"
			class="cursor-help underline decoration-dotted underline-offset-2">{@render children()}</span
		>
		<span
			bind:this={card}
			popover="manual"
			class="m-0 w-80 max-w-[90vw] overflow-auto rounded-lg border border-gray-300 bg-white p-2.5 text-left text-xs font-normal text-gray-900 shadow-xl dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
			style="position: fixed; inset: auto; max-height: 80vh"
		>
			{#if shown}<ExplanationCard explanation={shown} />{:else}<span class="opacity-60"
					>{fetched === 'missing' ? 'Nothing known about it.' : 'Loading…'}</span
				>{/if}
		</span>
	</span>
{:else}
	{@render children()}
{/if}
