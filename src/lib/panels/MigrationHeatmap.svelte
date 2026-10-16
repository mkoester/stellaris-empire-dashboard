<script lang="ts">
	import { fmt } from '../format.ts';
	import type { ColonySeries } from '../migration.ts';
	import { gameMonth } from '../series.ts';
	import Panel from './Panel.svelte';

	// Variant 4: rows colonies, columns months, colour = net migration on a diverging scale —
	// blue arriving, red leaving, grey nothing (blue↔red: readable with red-green colour blindness).
	let { x, colonies }: { x: number[]; colonies: ColonySeries[] } = $props();

	const MONTHS = 36;
	const from = $derived(Math.max(0, x.length - MONTHS));
	const months = $derived(x.slice(from).map((_, i) => from + i));
	const net = (c: ColonySeries, m: number) =>
		c.immigration[m] === null ? null : (c.immigration[m] ?? 0) - (c.emigration[m] ?? 0);
	const max = $derived(
		Math.max(1, ...colonies.flatMap((c) => months.map((m) => Math.abs(net(c, m) ?? 0))))
	);
	const fill = (v: number | null) =>
		v === null
			? 'transparent'
			: v === 0
				? '#f0efec'
				: `color-mix(in oklab, ${v > 0 ? '#2a78d6' : '#e34948'} ${Math.round(20 + (80 * Math.abs(v)) / max)}%, #f0efec)`;
</script>

<Panel title="Matrix" note="Net migration per colony and month: blue arriving, red leaving.">
	{#if colonies.length === 0}
		<p class="text-gray-500">No migration recorded yet.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="border-separate border-spacing-[2px] text-xs">
				<tbody>
					{#each colonies as c (c.key)}
						<tr>
							<td class="pr-2 whitespace-nowrap">{c.name}{c.own ? '' : ` (${c.owner})`}</td>
							{#each months as m (m)}
								{@const v = net(c, m)}
								<td
									class="h-5 w-3 rounded-sm"
									style:background={fill(v)}
									title="{gameMonth(x[m])} {c.name}: {v === null
										? 'no data'
										: (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v))}"
								></td>
							{/each}
						</tr>
					{/each}
					<tr>
						<td></td>
						{#each months as m, col (m)}
							<td class="text-[10px] text-gray-500">{col % 6 === 0 ? gameMonth(x[m]) : ''}</td>
						{/each}
					</tr>
				</tbody>
			</table>
		</div>
		<div class="mt-1 text-xs text-gray-500">scale: ±{fmt(max)} pops/month</div>
	{/if}
</Panel>
