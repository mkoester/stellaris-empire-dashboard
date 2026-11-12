<script lang="ts">
	import { fmt } from './format.ts';
	import InfoPopup from './InfoPopup.svelte';
	import ResourceChips from './ResourceChips.svelte';
	import type { AutomationWhatIf } from './server/whatIfs.ts';
	import type { Resources } from './types.ts';

	// One district automation what-if on a line (#lib/jobAutomation.ts): the building, the workforce
	// it automates per job, what that frees or adds, and what it costs. Everything here is ≈.
	let { o, openJobs = null }: { o: AutomationWhatIf; openJobs?: number | null } = $props();

	const HOW =
		'≈ the building’s share of each job’s positions, automated: open positions first, then those pops work (they move on). Output at the job’s output per workforce today. A month: the building’s upkeep plus each automated job’s (its stratum’s rate), so more districts cost more';
	const negate = (r: Resources) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, -v]));
	// workforce as the game shows it, the jobs in the hover (workspace AGENTS.md)
	const jobs = (w: number) => `${fmt(w / 100)} job${Math.abs(w - 100) < 0.5 ? '' : 's'}`;
</script>

<div class="text-xs">
	<span class="text-gray-500" title={HOW}
		>≈ {o.replaces ? 'upgrade to ' : ''}{o.name}{o.queued ? ' (queued)' : ''} (?):</span
	>
	{#each o.steps as s (s.job)}<span class="mr-3 whitespace-nowrap" title={jobs(s.added)}
			>{s.name} +{fmt(s.added)} automated</span
		>{/each}{#if o.freed >= 0.5}<span
			class="mr-3 whitespace-nowrap text-green-600"
			title={`${jobs(o.freed)} of pops' work for other jobs${openJobs !== null ? `; the colony has ${fmt(openJobs)} open workforce` : ''}`}
			>frees {fmt(o.freed)} workforce</span
		>{/if}<ResourceChips flows={o.output} />
	<span class="text-gray-500"
		>costs <ResourceChips flows={negate(o.cost)} />a month <ResourceChips
			flows={negate(o.upkeep)}
		/></span
	>{#if o.missing?.length}<span class="text-amber-600"
			>needs {#each o.missing as t, i (t)}{i ? ', ' : ''}<InfoPopup ref="tech:{t}"
					>{o.techNames[t] ?? t}</InfoPopup
				>{/each}</span
		>{/if}
</div>
