<script lang="ts">
	import { fmt } from './format.ts';
	import ResourceChips from './ResourceChips.svelte';
	import type { LuxuryWhatIf } from './luxuries.ts';

	// What the planet decision "Distribute Luxury Goods" would bring if enacted now, or until when
	// it runs (#lib/luxuries.ts). The chain is the panel above's, so it is ≈ as that is.
	let { what, until }: { what: LuxuryWhatIf | null; until: string | null } = $props();

	const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 1000) / 10} %`;
	const pts = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`;
	const ASSUMED =
		'≈ +25 % of today’s amenities (other amenity multipliers make it less); happiness → stability → output on the linear scales above; today’s job output held for the 10 years; job upkeep does not change (stability raises output only)';
</script>

{#if until}
	<section class="mb-4 rounded border border-gray-300 p-2 text-sm dark:border-gray-700">
		<b>Distribute Luxury Goods</b> runs until {until} (+25 % amenities).
	</section>
{:else if what}
	<section class="mb-4 rounded border border-gray-300 p-2 text-sm dark:border-gray-700">
		<h2 class="mb-1 font-semibold" title={ASSUMED}>Distribute Luxury Goods — if enacted now ≈</h2>
		<div>
			<span class="text-red-600">−{fmt(what.cost)} Consumer Goods</span>
			→ amenities +{fmt(what.amenities)}
			→ happiness {pct(what.happiness)} (approval {Math.round(what.approval * 1000) / 10} %) → stability
			{pts(what.stability)} (to {Math.round(what.stabilityAfter * 10) / 10}) → job output {pct(
				what.output
			)}
		</div>
		{#if what.output > 0}
			<div class="mt-1">
				a month <ResourceChips flows={what.monthly} />
			</div>
			<div>
				over 10 years <ResourceChips flows={what.total} />
				<span class="text-gray-500">for {fmt(what.cost)} Consumer Goods</span>
			</div>
		{:else}
			<div class="mt-1 text-xs text-gray-500">
				no more job output: {what.stability > 0
					? 'stability is at its cap already'
					: 'amenities are at twice the need already'}.
			</div>
		{/if}
		<div class="mt-1 text-xs text-gray-500">
			10 years, Consumer Goods by pops (100 per started 1000). Job upkeep stays the same: stability
			raises what jobs produce, not what they use.
		</div>
	</section>
{/if}
