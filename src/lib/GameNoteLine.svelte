<script lang="ts">
	import { RELEASES_PAGE, type GameNote } from '#lib/gameNote.ts';

	// A game the release was not built for (`#lib/gameNote.ts`): on /setup and above every page.
	let { note, class: cls = '' }: { note: GameNote; class?: string } = $props();
</script>

<p class="rounded border border-amber-400 px-3 py-1 {cls}">
	{note.text}
	{#if note.releases}
		<a class="underline" href="https://{RELEASES_PAGE}" target="_blank" rel="noreferrer">
			Releases on GitHub
		</a>
	{/if}
</p>
