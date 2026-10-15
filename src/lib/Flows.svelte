<script lang="ts">
	import { colorOf } from './colors.ts';
	import { fmt, pretty } from './format.ts';
	import { byTopBar } from './resourceGroups.ts';
	import type { Resources } from './types.ts';

	// Rows of resource flows per month: what is used (−) first, then what is produced (+), each
	// resource in its colour, in the top bar's order.
	let { rows }: { rows: { label: string; flows: Resources; strong?: boolean }[] } = $props();

	const part = (flows: Resources, sign: 1 | -1): [string, number][] =>
		Object.entries(flows)
			.filter(([, v]) => v * sign >= 0.05)
			.sort(([a], [b]) => byTopBar(a, b));
</script>

{#snippet chips(list: [string, number][])}
	{#each list as [k, v] (k)}
		<span class="mr-3 whitespace-nowrap"
			><span class={v < 0 ? 'text-red-600' : 'text-green-600'}
				>{v < 0 ? '−' : '+'}{fmt(Math.abs(v))}</span
			>
			<span style:color={colorOf(k)}>{pretty(k)}</span></span
		>
	{/each}
{/snippet}

<table class="text-left text-sm">
	<thead>
		<tr class="border-b border-gray-300 dark:border-gray-700">
			<th class="p-1"></th>
			<th class="p-1">Uses</th>
			<th class="p-1">Produces</th>
		</tr>
	</thead>
	<tbody>
		{#each rows as r (r.label)}
			<tr class="border-b border-gray-200 dark:border-gray-800" class:font-semibold={r.strong}>
				<td class="p-1 pr-4 whitespace-nowrap">{r.label}</td>
				<td class="p-1 pr-4">{@render chips(part(r.flows, -1))}</td>
				<td class="p-1">{@render chips(part(r.flows, 1))}</td>
			</tr>
		{/each}
	</tbody>
</table>
