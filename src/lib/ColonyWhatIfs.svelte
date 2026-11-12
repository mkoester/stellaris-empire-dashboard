<script lang="ts">
	import { fmt } from './format.ts';
	import ResourceChips from './ResourceChips.svelte';
	import type { ColonyAutomation, DecisionWhatIf, DesignationWhatIf } from './server/whatIfs.ts';
	import AutomationLine from './AutomationLine.svelte';
	import WhatIfLine from './WhatIfLine.svelte';

	// What switching this colony's designation or taking a planet decision would do now (⚙ What-ifs,
	// a spoiler; #lib/whatIf.ts). ≈ throughout: output as a share of today's, wellbeing along the
	// colony's chain; the designations offered are those of its own kind, the game may refuse one.
	// District automation: the next automation building per job line (#lib/jobAutomation.ts).
	let {
		what,
		automation = null,
		openJobs = 0
	}: {
		what: { designations: DesignationWhatIf[]; decisions: DecisionWhatIf[] } | null;
		automation?: ColonyAutomation | null;
		openJobs?: number; // the colony's open positions, workforce, for the pops automation frees
	} = $props();

	const negate = (r: Record<string, number>) =>
		Object.fromEntries(Object.entries(r).map(([k, v]) => [k, -v]));
</script>

{#if (what && (what.designations.length || what.decisions.length)) || automation?.options.length || automation?.barred === 'tankbound'}
	<section class="mb-4 rounded border border-gray-300 p-2 text-sm dark:border-gray-700">
		<h2 class="mb-1 font-semibold">What-ifs — if taken now ≈</h2>
		{#if what?.designations.length}
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
		{#if what?.decisions.length}
			<h3 class="mt-2 text-xs font-semibold text-gray-500">Planet decisions</h3>
			{#each what.decisions as d (d.key)}
				<div>
					<WhatIfLine what={d.what} label={`${d.name}${d.possible === null ? ' (?)' : ''}`} /><span
						class="text-xs text-gray-500"
						>{`, lasts: ${d.months ? `${fmt(d.months / 12)} years` : 'for good'}${d.cost && Object.keys(d.cost).length ? ', costs: ' : ''}`}{#if d.cost && Object.keys(d.cost).length}<ResourceChips
								flows={negate(d.cost)}
							/>{/if}</span
					>
				</div>
			{/each}
			<div class="mt-1 text-xs text-gray-500">
				(?) the save cannot tell whether the game allows it here.
			</div>
		{/if}
		{#if automation?.barred === 'tankbound'}
			<h3 class="mt-2 text-xs font-semibold text-gray-500">District automation</h3>
			<div class="text-xs text-gray-500">
				Farmers, miners and technicians are fully automated by the Tankbound civic.
			</div>
		{:else if automation?.options.length}
			<h3
				class="mt-2 text-xs font-semibold text-gray-500"
				title="farming, mining and generator districts' jobs only; one building per job line and planet"
			>
				District automation
			</h3>
			{#each automation.options as o (o.key)}
				<AutomationLine {o} {openJobs} />
			{/each}
			<div class="mt-1 text-xs text-gray-500">
				(?) the save cannot tell whether a zone has a free slot for it.
			</div>
		{/if}
	</section>
{/if}
