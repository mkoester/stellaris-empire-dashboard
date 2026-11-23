<script lang="ts">
	import { runs } from './frameRuns.ts';

	// A slider over a list of dates (months, saves), the latest picked until the viewer moves it:
	// `picked` (bindable) is the index, null for "the latest". The migration and history tabs.
	// `lanes` mark where something happened, one row each under the track: a run of marked
	// entries is one band (many months of migration read as an area, not a row of ticks), a click
	// on it picks its first; ◀ ▶ step to the previous or next marked entry of any lane.
	let {
		dates,
		picked = $bindable(null),
		label,
		unit = 'month',
		format = (d: string) => d.slice(0, 7),
		lanes = []
	}: {
		dates: string[];
		picked?: number | null;
		label: string; // what moving it changes, for screen readers
		unit?: string;
		format?: (date: string) => string;
		lanes?: { label: string; color: string; on: boolean[] }[];
	} = $props();
	const last = $derived(dates.length - 1);
	const at = $derived(picked === null || picked > last ? last : picked);
	const shown = $derived(lanes.filter((l) => l.on.some(Boolean)));
	const marked = $derived(dates.flatMap((_, i) => (shown.some((l) => l.on[i]) ? [i] : [])));
	const prev = $derived(marked.findLast((i) => i < at));
	const next = $derived(marked.find((i) => i > at));
	// an entry's place on a lane, in %: the lanes sit 8px in from each side (`mx-2`), about half
	// the range's thumb, so a band lines up with the thumb's centre at that entry
	const pos = (i: number) => (last > 0 ? (i / last) * 100 : 0);
	const step = 'rounded px-1 disabled:opacity-30';
</script>

{#if dates.length}
	<div class="flex max-w-3xl items-start gap-3 text-sm">
		<span class="text-gray-500">{unit}</span>
		<div class="flex flex-1 flex-col">
			<input
				type="range"
				min="0"
				max={last}
				value={at}
				oninput={(e) => (picked = Number(e.currentTarget.value))}
				class="w-full"
				aria-label={label}
			/>
			{#each shown as lane (lane.label)}
				<div class="relative mx-2 h-2" title={lane.label}>
					{#each runs(lane.on) as [from, to] (from)}
						<button
							class="absolute top-0.5 h-1.5 min-w-1.5 rounded-sm"
							style:left="{pos(from)}%"
							style:width="{pos(to) - pos(from)}%"
							style:background-color={lane.color}
							title="{lane.label}: {format(dates[from])}{format(dates[to]) !== format(dates[from])
								? ` – ${format(dates[to])}`
								: ''}"
							aria-label="{lane.label} from {format(dates[from])}"
							onclick={() => (picked = from)}
						></button>
					{/each}
				</div>
			{/each}
		</div>
		{#if marked.length}
			<button
				class={step}
				disabled={prev === undefined}
				title="the previous {unit} with something marked"
				aria-label="previous marked {unit}"
				onclick={() => (picked = prev ?? null)}
			>
				◀
			</button>
			<button
				class={step}
				disabled={next === undefined}
				title="the next {unit} with something marked"
				aria-label="next marked {unit}"
				onclick={() => (picked = next === last ? null : (next ?? null))}
			>
				▶
			</button>
		{/if}
		<b class="tabular-nums">{format(dates[at])}</b>
		{#if at !== last}
			<button class="underline" onclick={() => (picked = null)}>latest</button>
		{/if}
	</div>
	{#if shown.length > 1}
		<div class="mt-1 flex max-w-3xl gap-3 pl-14 text-xs text-gray-500">
			{#each shown as lane (lane.label)}
				<span class="flex items-center gap-1">
					<span class="inline-block h-1.5 w-3 rounded-sm" style:background-color={lane.color}
					></span>{lane.label}
				</span>
			{/each}
		</div>
	{/if}
{/if}
