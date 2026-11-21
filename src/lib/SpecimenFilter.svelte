<script lang="ts">
	import { colorOf } from './colors.ts';
	import { pretty } from './format.ts';
	import { byTopBar } from './resourceGroups.ts';

	// The bonus filter of the archive and trade tabs: one toggle per kind of bonus the specimens
	// shown give (#lib/archive.ts `givesKinds`), in its colour; none on shows every specimen,
	// several show those giving any of them.
	let { kinds, selected = $bindable([]) }: { kinds: string[]; selected?: string[] } = $props();

	// resources in the top bar's order, then the other kinds, "other" last
	const TOPICS = [
		'research',
		'amenities',
		'stability',
		'leader',
		'pops',
		'military',
		'space fauna',
		'other'
	];
	const rank = (k: string) => TOPICS.indexOf(k);
	const sorted = $derived([...kinds].sort((a, b) => rank(a) - rank(b) || byTopBar(a, b)));
	const toggle = (k: string) =>
		(selected = selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k]);
	const chip = (on: boolean) =>
		`rounded border px-2 py-0.5 ${on ? 'border-current bg-gray-200 font-semibold dark:bg-gray-800' : 'border-gray-300 dark:border-gray-700'}`;
</script>

{#if sorted.length > 1}
	<div class="mb-3 flex flex-wrap items-baseline gap-1 text-sm">
		<span class="mr-1 text-gray-500">bonus</span>
		<button type="button" class={chip(selected.length === 0)} onclick={() => (selected = [])}
			>all</button
		>
		{#each sorted as k (k)}
			<button
				type="button"
				class={chip(selected.includes(k))}
				style:color={colorOf(k)}
				aria-pressed={selected.includes(k)}
				onclick={() => toggle(k)}>{pretty(k)}</button
			>
		{/each}
	</div>
{/if}
