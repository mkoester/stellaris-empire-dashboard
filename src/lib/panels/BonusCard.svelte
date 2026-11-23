<script lang="ts">
	import { impact, realGain, sizeCostChange } from '#lib/bonusPiles.ts';
	import { colorOf } from '#lib/colors.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import type { Card } from '#lib/server/bonusPiles.ts';
	import type { WellbeingRules } from '#lib/wellbeing.ts';
	import { whatIf, type ColonyInput } from '#lib/whatIf.ts';

	// One pile (#lib/bonusPiles.ts): the lines that hold now, a bonus to try — a typical value from
	// the game data or one's own — and what it would change at this point, part by part.
	let {
		card,
		wellbeing
	}: {
		card: Card & { pick: number };
		wellbeing: { colonies: ColonyInput[]; gestalt: boolean; rules: WellbeingRules } | null;
	} = $props();

	const pct = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n) * 100)} %`;
	const signed = (n: number) =>
		Math.abs(n) < 0.05 ? '±0' : `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;
	const val = (n: number) => (card.unit === 'pct' ? pct(n) : signed(n));

	// svelte-ignore state_referenced_locally
	let choice = $state(card.pick >= 0 ? String(card.pick) : 'own');
	let own = $state('');
	const chosen = $derived.by(() => {
		if (choice !== 'own') {
			const p = card.presets[Number(choice)];
			return p ? { x: p.value, target: p.target } : null;
		}
		const n = Number(own.replace(',', '.'));
		if (!own.trim() || !Number.isFinite(n)) return null;
		return { x: card.unit === 'pct' ? n / 100 : n, target: null };
	});

	// the pile, or its range over the parts
	const sums = $derived([...new Set(card.parts.map((p) => Math.round(p.sum * 1000) / 1000))]);
	const pileText = $derived(
		sums.length === 0
			? null
			: sums.length === 1
				? `×${(1 + sums[0]).toFixed(2)}`
				: `×${(1 + Math.min(...sums)).toFixed(2)}–${(1 + Math.max(...sums)).toFixed(2)}`
	);

	const result = $derived(
		chosen && card.effect !== 'wellbeing'
			? impact(card.effect, card.parts, chosen.x, chosen.target)
			: null
	);
	const real = $derived(
		chosen && card.effect !== 'wellbeing'
			? card.parts
					.filter((p) => chosen.target === null || p.targets.includes(chosen.target))
					.map((p) => realGain(chosen.x, p.sum))
			: []
	);
	const realText = $derived(
		real.length === 0
			? ''
			: Math.max(...real) - Math.min(...real) < 0.0005
				? pct(real[0])
				: `${pct(Math.min(...real))} to ${pct(Math.max(...real))}`
	);
	const well = $derived(
		chosen && card.effect === 'wellbeing' && card.modifier && wellbeing
			? whatIf(
					{ [card.modifier]: chosen.x },
					{ jobs: {} },
					wellbeing.colonies,
					wellbeing.gestalt,
					wellbeing.rules
				)
			: null
	);
	const days = (n: number) => `${n <= 0 ? '−' : '+'}${fmt(Math.abs(n))} days`;
	const amount = (res: string, n: number) =>
		`${signed(n)} ${res === 'pops' ? 'pops' : pretty(res)}${card.measure ? ` ${card.measure}` : ''}`;
</script>

<div class="rounded border border-gray-200 p-2 dark:border-gray-800">
	<h3 class="font-semibold">
		{card.title}
		{#if pileText}<span
				class="font-normal text-gray-500 tabular-nums"
				title="the pile now: 1 + the bonuses that hold"
			>
				{pileText}
			</span>{/if}
		{#if card.estimated}<span class="font-normal text-gray-500" title="≈ {card.estimated}">
				≈
			</span>{/if}
	</h3>

	{#if card.lines.length}
		<table class="w-full text-left text-sm tabular-nums">
			<tbody>
				{#each card.lines as l, i (i)}
					<tr>
						<td class="p-0.5">{l.name}</td>
						<td class="p-0.5 text-xs text-gray-500">{l.target ? pretty(l.target) : ''}</td>
						<td class="p-0.5 text-right {l.value < 0 ? 'text-red-600' : ''}">{val(l.value)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="text-sm text-gray-500">No bonus counted.</p>
	{/if}

	<div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
		<label for="bonus-{card.id}">Try</label>
		<select
			id="bonus-{card.id}"
			class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
			bind:value={choice}
		>
			{#each card.presets as p, i (i)}
				<option value={String(i)}>
					{val(p.value)}{p.target ? ` ${pretty(p.target.replace(/^(job|cat):/, ''))}` : ''} — e.g. {p.example}{p.count >
					1
						? ` (${p.count} sources)`
						: ''}
				</option>
			{/each}
			<option value="own">my own value…</option>
		</select>
		{#if choice === 'own'}
			<input
				class="w-20 rounded border border-gray-300 bg-transparent px-1 tabular-nums dark:border-gray-700"
				type="text"
				inputmode="decimal"
				placeholder={card.unit === 'pct' ? '10' : '5'}
				aria-label="bonus {card.unit === 'pct' ? 'in %' : 'in points'}"
				bind:value={own}
			/>{card.unit === 'pct' ? '%' : ''}
		{/if}
	</div>

	{#if result && chosen}
		<p class="mt-1 text-sm">
			{val(chosen.x)} is <strong>{realText}</strong> real{card.effect === 'speed' ? ' speed' : ''}
			{#if card.measure !== 'days'}
				{#each Object.entries(result.totals) as [res, n] (res)}
					· <span style:color={colorOf(res)} class="tabular-nums">{amount(res, n)}</span>
				{/each}
			{/if}
		</p>
		{#if card.follow && result.totals.empire_size}
			{@const f = card.follow}
			{@const d = result.totals.empire_size}
			<p class="text-sm tabular-nums">
				{#if f.size <= f.base && f.size + d <= f.base}
					<span class="text-gray-500">
						No cost effect: size {fmt(f.size)} stays under {f.base}, where costs start to grow.
					</span>
				{:else}
					{f.penalties
						.map((pen) => `${pen.label} ${pct(sizeCostChange(f.size, d, f.base, pen.per))}`)
						.join(' · ')}
					<span class="text-xs text-gray-500">(size {fmt(f.size)})</span>
				{/if}
			</p>
		{/if}
		{#if !result.each.length}
			<p class="text-xs text-gray-500">Nothing it reaches right now.</p>
		{:else if card.measure === 'days'}
			<ul class="text-sm tabular-nums">
				{#each result.each as p, i (i)}
					<li>{p.label}: {p.change === null ? `time ${pct(p.rel)}` : days(p.change)}</li>
				{/each}
			</ul>
		{:else}
			<details class="text-xs">
				<summary class="cursor-pointer text-gray-500">per part</summary>
				<ul class="tabular-nums">
					<!-- a part it changes by less than 0.05 is left out -->
					{#each result.each.filter((p) => p.change === null || Math.abs(p.change) >= 0.05) as p, i (i)}
						<li>
							{p.label}: {p.change === null ? pct(p.rel) : amount(p.resource ?? '', p.change)}
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	{:else if well && chosen}
		<p class="mt-1 text-sm">
			{val(chosen.x)}:
			{#if well.stability !== null}stability {signed(well.stability)} on average{/if}
			{#each Object.entries(well.monthly) as [res, n] (res)}
				· <span style:color={colorOf(res)} class="tabular-nums">{amount(res, n)}</span>
			{/each}
			{#if !Object.keys(well.monthly).length}· no output change (capped, or no colony to read){/if}
		</p>
	{/if}
</div>
