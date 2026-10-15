<script lang="ts">
	import { colorOf } from './colors.ts';
	import { fmt, pretty } from './format.ts';
	import type { Resources } from './types.ts';

	// Rows of signed resource amounts per month (output +, use −), each resource in its colour.
	let { rows }: { rows: { label: string; flows: Resources; strong?: boolean }[] } = $props();

	const signed = (n: number) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
	const shown = (flows: Resources) =>
		Object.entries(flows)
			.filter(([, v]) => Math.abs(v) >= 0.05)
			.sort(([a], [b]) => a.localeCompare(b));
</script>

<table class="text-left text-sm">
	<tbody>
		{#each rows as r (r.label)}
			<tr class="border-b border-gray-200 dark:border-gray-800" class:font-semibold={r.strong}>
				<td class="p-1 pr-4 whitespace-nowrap">{r.label}</td>
				<td class="p-1">
					{#each shown(r.flows) as [k, v] (k)}
						<span class="mr-3 whitespace-nowrap"
							><span class={v < 0 ? 'text-red-600' : 'text-green-600'}>{signed(v)}</span>
							<span style:color={colorOf(k)}>{pretty(k)}</span></span
						>
					{/each}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
