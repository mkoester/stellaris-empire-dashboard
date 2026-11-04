<script lang="ts">
	import { fmt } from './format.ts';
	import ResourceChips from './ResourceChips.svelte';
	import type { DecisionWhatIf, DesignationWhatIf } from './server/whatIfs.ts';
	import WhatIfLine from './WhatIfLine.svelte';

	// What switching this colony's designation or taking a planet decision would do now (⚙ What-ifs,
	// a spoiler; #lib/whatIf.ts). ≈ throughout: output as a share of today's, wellbeing along the
	// colony's chain; the designations offered are those of its own kind, the game may refuse one.
	let {
		what
	}: { what: { designations: DesignationWhatIf[]; decisions: DecisionWhatIf[] } | null } = $props();

	const negate = (r: Record<string, number>) =>
		Object.fromEntries(Object.entries(r).map(([k, v]) => [k, -v]));
</script>

{#if what && (what.designations.length || what.decisions.length)}
	<section class="mb-4 rounded border border-gray-300 p-2 text-sm dark:border-gray-700">
		<h2 class="mb-1 font-semibold">What-ifs — if taken now ≈</h2>
		{#if what.designations.length}
			<h3
				class="mt-1 text-xs font-semibold text-gray-500"
				title="designations of the same kind as this one's: the game may still refuse one"
			>
				Designation
			</h3>
			{#each what.designations as d (d.key)}
				<div>
					<WhatIfLine what={d.what} label={d.name} />{#if Math.abs(d.fee) >= 0.01}<span
							class="text-xs {d.fee > 0 ? 'text-red-600' : 'text-green-600'}"
							title="the deficit fee's change a month, from the output change alone"
							>deficit fee {d.fee > 0 ? '+' : '−'}{fmt(Math.abs(d.fee))} trade</span
						>{/if}
				</div>
			{/each}
		{/if}
		{#if what.decisions.length}
			<h3 class="mt-2 text-xs font-semibold text-gray-500">Planet decisions</h3>
			{#each what.decisions as d (d.key)}
				<div>
					<WhatIfLine what={d.what} label={`${d.name}${d.possible === null ? ' (?)' : ''}`} />
					<span class="text-xs text-gray-500"
						>{d.months
							? `for ${d.months / 12} years`
							: 'for good'}{#if d.cost && Object.keys(d.cost).length}, costs
							<ResourceChips flows={negate(d.cost)} />{/if}</span
					>
				</div>
			{/each}
			<div class="mt-1 text-xs text-gray-500">
				(?) the save cannot tell whether the game allows it here.
			</div>
		{/if}
	</section>
{/if}
