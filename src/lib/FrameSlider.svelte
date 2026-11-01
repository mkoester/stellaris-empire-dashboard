<script lang="ts">
	// A slider over a list of dates (months, saves), the latest picked until the viewer moves it:
	// `picked` (bindable) is the index, null for "the latest". The migration and history tabs.
	let {
		dates,
		picked = $bindable(null),
		label,
		unit = 'month',
		format = (d: string) => d.slice(0, 7)
	}: {
		dates: string[];
		picked?: number | null;
		label: string; // what moving it changes, for screen readers
		unit?: string;
		format?: (date: string) => string;
	} = $props();
	const last = $derived(dates.length - 1);
	const at = $derived(picked === null || picked > last ? last : picked);
</script>

{#if dates.length}
	<div class="flex max-w-3xl items-center gap-3 text-sm">
		<span class="text-gray-500">{unit}</span>
		<input
			type="range"
			min="0"
			max={last}
			value={at}
			oninput={(e) => (picked = Number(e.currentTarget.value))}
			class="flex-1"
			aria-label={label}
		/>
		<b class="tabular-nums">{format(dates[at])}</b>
		{#if at !== last}
			<button class="underline" onclick={() => (picked = null)}>latest</button>
		{/if}
	</div>
{/if}
