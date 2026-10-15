<script lang="ts">
	import { colorOf } from './colors.ts';
	import { fmt, pretty } from './format.ts';
	import { byTopBar } from './resourceGroups.ts';
	import type { Resources } from './types.ts';

	// Signed amounts, each resource in its colour, in the top bar's order: only the used (sign −1)
	// or produced (+1) part, or all of them without a sign.
	let { flows, sign }: { flows: Resources; sign?: 1 | -1 } = $props();

	const shown = $derived(
		Object.entries(flows)
			.filter(([, v]) => (sign === undefined ? Math.abs(v) : v * sign) >= 0.05)
			.sort(([a], [b]) => byTopBar(a, b))
	);
</script>

{#each shown as [k, v] (k)}
	<span class="mr-3 whitespace-nowrap"
		><span class={v < 0 ? 'text-red-600' : 'text-green-600'}
			>{v < 0 ? '−' : '+'}{fmt(Math.abs(v))}</span
		>
		<span style:color={colorOf(k)}>{pretty(k)}</span></span
	>
{/each}
