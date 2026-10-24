<script lang="ts">
	import { fmt } from '../format.ts';
	import EmpireName from '../EmpireName.svelte';
	import { CATEGORICAL, OTHER, type ColonySeries } from '../migration.ts';
	import { gameMonth } from '../series.ts';
	import Panel from './Panel.svelte';

	// Variant 3: per month a diverging stacked bar — arrivals above the line, departures below,
	// one colour per colony (fixed categorical order; a 9th colony and beyond fold into grey).
	let { x, colonies }: { x: number[]; colonies: ColonySeries[] } = $props();

	const MONTHS = 36;
	const W = 640;
	const H = 220;
	const PAD_L = 36;
	const PAD_B = 22;
	const from = $derived(Math.max(0, x.length - MONTHS));
	const months = $derived(x.slice(from).map((_, i) => from + i));
	const colorOf = (i: number) => (i < CATEGORICAL.length ? CATEGORICAL[i] : OTHER);
	const max = $derived(
		Math.max(
			1,
			...months.map((m) => colonies.reduce((n, c) => n + (c.immigration[m] ?? 0), 0)),
			...months.map((m) => colonies.reduce((n, c) => n + (c.emigration[m] ?? 0), 0))
		)
	);
	const zero = (H - PAD_B) / 2;
	const unit = $derived((zero - 8) / max);
	const step = $derived((W - PAD_L) / Math.max(months.length, 1));
	// stacked segments: arrivals grow up from the zero line, departures down; 2px gaps between
	const segments = $derived(
		months.flatMap((m, col) => {
			let up = zero;
			let down = zero;
			return colonies.flatMap((c, i) => {
				const out = [];
				const inn = c.immigration[m] ?? 0;
				const em = c.emigration[m] ?? 0;
				if (inn > 0) {
					const h = inn * unit;
					up -= h;
					out.push({
						x: PAD_L + col * step + 1,
						y: up,
						h: Math.max(h - 2, 1),
						fill: colorOf(i),
						tip: `${gameMonth(x[m])} ${c.name}: +${fmt(inn)}`
					});
				}
				if (em > 0) {
					const h = em * unit;
					out.push({
						x: PAD_L + col * step + 1,
						y: down + 2,
						h: Math.max(h - 2, 1),
						fill: colorOf(i),
						tip: `${gameMonth(x[m])} ${c.name}: −${fmt(em)}`
					});
					down += h;
				}
				return out;
			});
		})
	);
</script>

<Panel title="Over time" note="Arrivals above the line, departures below — per month, by colony.">
	{#if colonies.length === 0}
		<p class="text-gray-500">No migration recorded yet.</p>
	{:else}
		<svg viewBox="0 0 {W} {H}" class="w-full max-w-3xl" role="img" aria-label="Migration per month">
			<line x1={PAD_L} x2={W} y1={zero} y2={zero} class="stroke-gray-400" />
			<text x={PAD_L - 4} y="12" text-anchor="end" class="fill-gray-500 text-[10px]"
				>+{fmt(max)}</text
			>
			<text x={PAD_L - 4} y={H - PAD_B - 2} text-anchor="end" class="fill-gray-500 text-[10px]"
				>−{fmt(max)}</text
			>
			{#each segments as s, i (i)}
				<rect x={s.x} y={s.y} width={Math.max(step - 2, 1)} height={s.h} rx="1" fill={s.fill}
					><title>{s.tip}</title></rect
				>
			{/each}
			{#each months as m, col (m)}
				{#if col % 6 === 0}
					<text x={PAD_L + col * step} y={H - 6} class="fill-gray-500 text-[10px]"
						>{gameMonth(x[m])}</text
					>
				{/if}
			{/each}
		</svg>
		<div class="mt-1 flex flex-wrap gap-x-4 text-xs">
			{#each colonies as c, i (c.key)}
				<span
					><span
						class="inline-block h-2.5 w-2.5 rounded-sm align-middle"
						style:background={colorOf(i)}
					></span>
					{c.name}{#if !c.own}
						({#if c.owner}<EmpireName name={c.owner} bold={false} />{/if}){/if}</span
				>
			{/each}
		</div>
	{/if}
</Panel>
