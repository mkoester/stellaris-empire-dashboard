<script lang="ts">
	import {
		DEFAULT_WINDOW,
		DEFAULT_YEARS,
		WINDOW_PRESETS,
		gameMonth,
		panWindow,
		spanWindow,
		windowRange
	} from './series.ts';
	import { timeWindow } from './timeWindow.svelte.ts';

	// The menu for the window all history charts share (`#lib/timeWindow.svelte.ts`): how many years,
	// a stretch of years, half a window back or on, and back to following the latest save.
	let { extent }: { extent: [number, number] } = $props();

	const w = $derived(timeWindow.value);
	const [from, to] = $derived(windowRange(extent, w));
	const following = $derived('years' in w);
	const step = $derived((to - from) / 2);
	const btn = (on: boolean) =>
		`rounded border px-1.5 ${on ? 'border-sky-500 text-sky-600 dark:text-sky-400' : 'border-gray-300 dark:border-gray-700'}`;

	function setYears(field: 'from' | 'to', value: string) {
		const y = Number(value);
		if (!Number.isFinite(y)) return;
		timeWindow.set(spanWindow(extent, field === 'from' ? y : from, field === 'to' ? y + 1 : to));
	}
</script>

<div class="mb-2 flex flex-wrap items-center justify-end gap-1 text-xs text-gray-500">
	<span
		title="every history chart shows this stretch; drag in a chart to zoom, Ctrl+wheel zooms, Shift+wheel moves, double-click resets"
		>charts {gameMonth(from)} – {gameMonth(to)}{following ? ', following the latest' : ''}</span
	>
	<button
		class={btn(false)}
		title="half a window back"
		onclick={() => timeWindow.set(panWindow(w, extent, -step))}>◀</button
	>
	<button
		class={btn(false)}
		title="half a window on"
		onclick={() => timeWindow.set(panWindow(w, extent, step))}>▶</button
	>
	{#each WINDOW_PRESETS as y (y)}
		<button class={btn('years' in w && w.years === y)} onclick={() => timeWindow.set({ years: y })}
			>{y} y</button
		>
	{/each}
	<button
		class={btn('years' in w && w.years === 'all')}
		onclick={() => timeWindow.set({ years: 'all' })}>all</button
	>
	<label
		>from <input
			class="w-14 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
			type="number"
			value={Math.floor(from)}
			onchange={(e) => setYears('from', e.currentTarget.value)}
		/></label
	>
	<label
		>to <input
			class="w-14 rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
			type="number"
			value={Math.floor(to)}
			onchange={(e) => setYears('to', e.currentTarget.value)}
		/></label
	>
	<button
		class={btn(false)}
		title="the default: the last {DEFAULT_YEARS} years, following the latest"
		disabled={'years' in w && w.years === DEFAULT_YEARS}
		onclick={() => timeWindow.set(DEFAULT_WINDOW)}>now</button
	>
</div>
