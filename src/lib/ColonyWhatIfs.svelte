<script lang="ts">
	import { CRIME_TARGET } from './crime.ts';
	import { fmt } from './format.ts';
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
		what: {
			designations: DesignationWhatIf[];
			losing: DesignationWhatIf | null; // the current designation's own benefits, lost with any change
			decisions: DecisionWhatIf[];
		} | null;
		automation?: ColonyAutomation | null;
		openJobs?: number; // the colony's open positions, workforce, for the pops automation frees
	} = $props();

	const CRIME_NOTE = `≈ valued at the enforcers it takes to hold crime at ${CRIME_TARGET}, what the game's crime automation holds (Criminal Underworld may appear from 30): an enforcer job takes 25 crime off, 35 during the campaign, which costs +2 energy each. Workforce no longer needed as enforcers is counted working open jobs at this colony's average net output; more enforcers come out of other jobs. Criminal jobs fill first and make nothing: their workforce comes from the unemployed, then from other jobs. Crime's own stability penalty is the same either way at the target; below it, it is not counted.`;
</script>

{#if (what && (what.designations.length || what.losing || what.decisions.length)) || automation?.options.length || automation?.barred === 'tankbound'}
	<section class="mb-4 rounded border border-gray-300 p-2 text-sm dark:border-gray-700">
		<h2 class="mb-1 font-semibold">What-ifs — if taken now ≈</h2>
		{#if what?.designations.length || what?.losing}
			<h3
				class="mt-1 text-xs font-semibold text-gray-500"
				title="designations of the same kind as this one's: the game may still refuse one"
			>
				Designation
			</h3>
			{#if what.losing}
				<div
					title="what the current designation's own modifiers bring today: lost with any change, already counted in each line below"
				>
					<WhatIfLine
						what={what.losing.what}
						label={`losing ${what.losing.name}`}
						emptyLabel="nothing the estimate counts"
					/>
				</div>
			{/if}
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
						>{`lasts: ${d.months ? `${fmt(d.months / 12)} years` : 'until ended'}`}</span
					>{#if d.crime}<span class="ml-2 cursor-help text-xs text-gray-500" title={CRIME_NOTE}
							>{`crime ${fmt(d.crime.now)}${Math.abs(d.crime.crimeWith - d.crime.crimeWithout) > 0.05 ? ` → ${fmt(d.crime.crimeWith)}` : ''}${d.crime.enforcersWith + d.crime.enforcersWithout >= 1 ? `, ${fmt(d.crime.enforcersWith / 100)} enforcer jobs hold it at ${CRIME_TARGET} instead of ${fmt(d.crime.enforcersWithout / 100)}` : ''}${d.crime.criminalsTaken >= 1 ? `, criminals take ${fmt(d.crime.criminalsTaken / 100)} jobs' workforce` : ''}`}</span
						>{/if}
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
