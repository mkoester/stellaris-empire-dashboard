<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { headingId } from './pageNav.ts';

	// A small bar of the page's section headings (every `h2` in `main`: the panels' titles and the
	// pages' own), sticky under the tabs, to jump to one; shown only on a page taller than the
	// window, with two headings or more (the user's ask 2026-11-26, beside "↑ top"). The section
	// being read is marked. Read from the DOM, so it follows panels folding, live reloads and
	// every tab without a page telling it anything.
	let bar = $state<HTMLElement>();
	let heads = $state<{ id: string; text: string }[]>([]);
	let fits = $state(true);
	let current = $state<string | null>(null);

	const headings = () =>
		[...document.querySelectorAll<HTMLElement>('main h2')].filter(
			(h) => !h.closest('[popover]') && !h.closest('[data-page-nav]') && h.offsetParent !== null
		);

	const offset = () => (bar?.offsetHeight ?? 0) + 8;

	function read() {
		const used = new Set<string>();
		const next = headings().map((h) => {
			// the fold arrow of a collapsible panel is not part of its name
			const text = (h.textContent ?? '').replace(/^[▾▸]\s*/, '').trim();
			if (!h.id)
				h.id = headingId(text, (id) => used.has(id) || document.getElementById(id) !== null);
			used.add(h.id);
			h.style.scrollMarginTop = `${offset()}px`;
			return { id: h.id, text };
		});
		// unchanged: no new array, so the bar's own DOM does not change and wake the observer again
		if (JSON.stringify(next) !== JSON.stringify(heads)) heads = next;
		fits = document.documentElement.scrollHeight <= window.innerHeight + 4;
		spy();
	}

	// the last heading above the bar's lower edge is the section being read
	function spy() {
		const line = offset() + 4;
		let at: string | null = null;
		for (const h of headings()) if (h.getBoundingClientRect().top <= line) at = h.id;
		current = at ?? heads[0]?.id ?? null;
	}

	let frame = 0;
	const later = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(read);
	};

	onMount(() => {
		const main = document.querySelector('main');
		const watch = new MutationObserver(later);
		if (main) watch.observe(main, { childList: true, subtree: true });
		const size = new ResizeObserver(later);
		size.observe(document.body);
		later();
		return () => {
			watch.disconnect();
			size.disconnect();
			cancelAnimationFrame(frame);
		};
	});
	afterNavigate(later);

	const jump = (id: string) =>
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
</script>

<svelte:window onscroll={spy} />

{#if heads.length > 1 && !fits}
	<nav
		bind:this={bar}
		data-page-nav
		aria-label="Sections of this page"
		class="sticky top-0 z-30 -mx-4 mb-3 flex gap-x-3 overflow-x-auto border-b border-gray-200 bg-white/95 px-4 py-1 text-xs whitespace-nowrap backdrop-blur dark:border-gray-800 dark:bg-gray-950/95"
	>
		{#each heads as h (h.id)}
			<button
				type="button"
				class="cursor-pointer hover:underline {current === h.id
					? 'font-semibold text-gray-900 dark:text-gray-100'
					: 'text-gray-500'}"
				aria-current={current === h.id ? 'location' : undefined}
				onclick={() => jump(h.id)}
			>
				{h.text}
			</button>
		{/each}
	</nav>
{/if}
