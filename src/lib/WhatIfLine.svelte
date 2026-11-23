<script lang="ts">
	import { fmt, pretty } from './format.ts';
	import ResourceChips from './ResourceChips.svelte';
	import type { Resources } from './types.ts';
	import type { WhatIf } from './whatIf.ts';

	// One what-if (#lib/whatIf.ts) on a line: "≈ <label>" then the income change a month (output,
	// and upkeep saved or added), the stability change, what it pays, the net in trade and what
	// was not counted. Everything here is an estimate.
	let {
		what,
		label = 'if taken now',
		showSmall = false,
		emptyLabel = ''
	}: {
		what: WhatIf | null | undefined;
		label?: string;
		showSmall?: boolean;
		emptyLabel?: string;
	} = $props();

	const HOW =
		'≈ output and upkeep modifiers as a share of what that output or upkeep is today (an upper bound: the game adds multipliers); amenities, happiness and stability along each colony’s chain to job output';
	const amount = (v: number) =>
		showSmall && Math.abs(v) > 0 && Math.abs(v) < 0.000001
			? Math.abs(v).toExponential(2)
			: showSmall
				? Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 6 })
				: fmt(Math.abs(v));
	const pts = (v: number) => `${v > 0 ? '+' : '−'}${amount(v)}`;
	const signed = (v: number) => `${v < 0 ? '−' : '+'}${amount(v)}`;
	const threshold = $derived(showSmall ? Number.MIN_VALUE : 0.05);
	const big = (r: Resources | undefined) =>
		Object.values(r ?? {}).some((v) => Math.abs(v) >= threshold);
	const income = $derived.by(() => {
		const out: Resources = { ...(what?.monthly ?? {}) };
		for (const [k, v] of Object.entries(what?.upkeep ?? {})) out[k] = (out[k] ?? 0) - v;
		return out;
	});
	// the price as it moves income: upkeep paid is negative, upkeep a cancel saves positive
	const pays = $derived(
		Object.fromEntries(Object.entries(what?.price?.upkeep ?? {}).map(([k, v]) => [k, -v]))
	);
	const priceNote = $derived(
		(what?.price?.measured
			? 'its base cost and upkeep × what the budget books for the active edicts over their base (empire size, upkeep modifiers)'
			: 'base values, before multipliers (empire size raises an edict’s)') +
			(what?.price?.note ? `; unity upkeep after the ${what.price.note}` : '')
	);
	// what the price rests on: measured, the edict fund estimated, or base values
	const priceTag = $derived(what?.price?.measured ? '' : what?.price?.note ? ' (≈)' : ' (base)');
	const netNote = $derived(
		what?.net == null
			? ''
			: `in trade a month, at the produce tab's values: ${signed(what.gained ?? 0)} from output and upkeep${what.netLabel ? ', with its one-time cost spread over 10 years' : `, ${signed(what.net - (what.gained ?? 0))} its own upkeep`}${
					what.unmodelled.length ? '; the effects not counted are left out' : ''
				}`
	);
	const shown = $derived(
		what &&
			(big(income) ||
				big(what.price?.upkeep) ||
				big(what.price?.cost) ||
				(what.stability !== null && Math.abs(what.stability) >= threshold) ||
				what.unmodelled.length > 0 ||
				!!emptyLabel)
	);
</script>

{#if what && shown}
	<span class="text-xs">
		<span class="text-gray-500" title={HOW}>≈ {label}:</span>
		<ResourceChips
			flows={income}
			minimum={threshold}
			maximumFractionDigits={showSmall ? 6 : 1}
		/>{#if what.stability !== null && Math.abs(what.stability) >= threshold}<span
				class="mr-3 whitespace-nowrap {what.stability < 0 ? 'text-red-600' : 'text-green-600'}"
			>
				{pts(what.stability)} stability
			</span>{/if}{#if big(what.price?.upkeep)}<span class="mr-1 text-gray-500" title={priceNote}>
				{`${Object.values(pays).some((v) => v > 0) ? 'saves' : 'pays'}${priceTag}`}
			</span><ResourceChips flows={pays} />{/if}{#if big(what.price?.cost)}<span
				class="mr-3 whitespace-nowrap text-red-600"
				title={`a one-time cost you pay: ${priceNote}`}
			>
				{`costs ${Object.entries(what.price?.cost ?? {})
					.map(([k, v]) => `${amount(v)} ${pretty(k)}`)
					.join(', ')} once${priceTag}`}
			</span>{/if}{#if what.net != null && Math.abs(what.net) >= threshold}<span
				class="mr-3 cursor-help font-semibold whitespace-nowrap {what.net < 0
					? 'text-red-600'
					: 'text-green-600'}"
				title={netNote}
			>
				net {signed(what.net)}
				{what.netLabel ?? 'trade/mo'}
			</span>{/if}{#if what.unmodelled.length}<span
				class="cursor-help text-gray-500"
				title={`effects the estimate leaves out: ${what.unmodelled.map(pretty).join(', ')}`}
			>
				+{what.unmodelled.length} effect{what.unmodelled.length > 1 ? 's' : ''} not counted
			</span>{/if}{#if emptyLabel && !big(income) && !big(what.price?.upkeep) && !big(what.price?.cost) && (what.stability === null || Math.abs(what.stability) < threshold) && (what.net == null || Math.abs(what.net) < threshold) && !what.unmodelled.length}<span
				class="text-gray-500"
			>
				{emptyLabel}
			</span>{/if}
	</span>
{/if}
