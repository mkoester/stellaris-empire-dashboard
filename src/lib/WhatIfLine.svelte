<script lang="ts">
	import { pretty } from './format.ts';
	import ResourceChips from './ResourceChips.svelte';
	import type { WhatIf } from './whatIf.ts';

	// One what-if (#lib/whatIf.ts) on a line: "≈ <label>" then the output a month, the stability
	// change and what was not counted. Everything here is an estimate.
	let { what, label = 'if taken now' }: { what: WhatIf | null | undefined; label?: string } =
		$props();

	const HOW =
		'≈ output modifiers as a share of what that output is today (an upper bound: the game adds multipliers); amenities, happiness and stability along each colony’s chain to job output. Upkeep and costs are not counted';
	const pts = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(Math.round(v * 10) / 10)}`;
	const shown = $derived(
		what &&
			(Object.values(what.monthly).some((v) => Math.abs(v) >= 0.05) ||
				(what.stability !== null && Math.abs(what.stability) >= 0.05) ||
				what.unmodelled.length > 0)
	);
</script>

{#if what && shown}
	<span class="text-xs">
		<span class="text-gray-500" title={HOW}>≈ {label}:</span>
		<ResourceChips
			flows={what.monthly}
		/>{#if what.stability !== null && Math.abs(what.stability) >= 0.05}<span
				class="mr-3 whitespace-nowrap {what.stability < 0 ? 'text-red-600' : 'text-green-600'}"
				>{pts(what.stability)} stability</span
			>{/if}{#if what.unmodelled.length}<span
				class="cursor-help text-gray-500"
				title={`not counted: ${what.unmodelled.map(pretty).join(', ')}`}
				>+{what.unmodelled.length} not counted</span
			>{/if}
	</span>
{/if}
