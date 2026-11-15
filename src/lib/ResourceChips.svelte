<script lang="ts">
	import { colorOf } from './colors.ts';
	import { pretty } from './format.ts';
	import { byTopBar } from './resourceGroups.ts';
	import type { Resources } from './types.ts';

	// Signed amounts, each resource in its colour, in the top bar's order: only the used (sign −1)
	// or produced (+1) part, or all of them without a sign. Each chip keeps together; the `<wbr>`
	// lets a row wrap between them (nothing else separates them: Svelte trims the whitespace).
	let {
		flows,
		sign,
		minimum = 0.05,
		maximumFractionDigits = 1
	}: {
		flows: Resources;
		sign?: 1 | -1;
		minimum?: number;
		maximumFractionDigits?: number;
	} = $props();

	const shown = $derived(
		Object.entries(flows)
			.filter(([, v]) => (sign === undefined ? Math.abs(v) : v * sign) >= minimum)
			.sort(([a], [b]) => byTopBar(a, b))
	);
	const amount = (n: number) =>
		maximumFractionDigits > 1 && Math.abs(n) > 0 && Math.abs(n) < 0.000001
			? n.toExponential(2)
			: n.toLocaleString(undefined, { maximumFractionDigits });
</script>

{#each shown as [k, v] (k)}
	<span class="mr-3 whitespace-nowrap"
		><span class={v < 0 ? 'text-red-600' : 'text-green-600'}
			>{v < 0 ? '−' : '+'}{amount(Math.abs(v))}</span
		>
		<span style:color={colorOf(k)}>{pretty(k)}</span></span
	><wbr />
{/each}
