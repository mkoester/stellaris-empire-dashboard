<script lang="ts">
	import { followGame } from '#lib/live.ts';
	import BonusCard from '#lib/panels/BonusCard.svelte';
	import Panel from '#lib/panels/Panel.svelte';

	let { data } = $props();
	followGame(() => data.isHead);
	const groups = $derived(data.bonuses ? [...new Set(data.bonuses.cards.map((c) => c.group))] : []);
	const NOTES: Record<string, string> = {
		Research:
			'Per field: speed (progress per point), output (points a month) and cost. Days are what is left on the tech in progress.',
		'Job output':
			'Job efficiency is extra workforce: its own pile, multiplied with the output pile, so it is worth more than an output bonus of the same size — but it raises the job’s upkeep too. Per resource below: every colony at the total it measurably gets now (its booked output ÷ its workforce’s base).',
		'Other output':
			'What stations, starbases, megastructures and the strata as such make (the budget’s income outside jobs), by economic category.',
		Costs:
			'What construction cost over the last year, a month on average (exact, from the save diffs). A cost bonus on top of others saves more than it says: −10 % on top of −20 % saves 12.5 %.',
		'Empire size':
			'Empire size by its parts, and what a change does to the costs that grow with it; tradition cost and naval capacity.',
		Upkeep:
			'By economic category: a bonus to a category reaches every budget source below it. What is paid now is the budget’s.',
		Pops: 'Measured growth and assembly per colony, times the change of the pile.',
		Wellbeing:
			'Flat bonuses, not a pile: run colony by colony through amenities → happiness → stability → job output, the stability cap respected.',
		Speed:
			'A speed bonus divides the time: what is queued now, at its base days, else the change of the time.'
	};
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Bonuses</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums"
		>{data.bonuses?.date ?? data.latest.date}</span
	>
</header>

<p class="mb-4 text-sm text-gray-500">
	Bonuses of a kind add up, and the sum multiplies: so each one more is worth less than it says —
	+10 % on top of +50 % is +6.7 %, and −10 % upkeep on top of −20 % saves 12.5 %. Pick a typical
	value from the game data, or your own, and see what it changes at this point. Counted: what the
	empire holds (traditions, perks, edicts, policies, civics, ethics, authority, origin, techs, timed
	modifiers, situation stages, the council); ≈ where a pile leaves out what a single colony or
	building adds.
</p>

{#if !data.bonuses}
	<p class="text-gray-500">No full save yet.</p>
{:else}
	<div class="flex flex-col gap-8">
		{#each groups as g (g)}
			<Panel title={g} note={NOTES[g]}>
				<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{#each data.bonuses.cards.filter((c) => c.group === g) as c (c.id)}
						<BonusCard card={c} wellbeing={data.bonuses.wellbeing} />
					{/each}
				</div>
			</Panel>
		{/each}
	</div>
{/if}
