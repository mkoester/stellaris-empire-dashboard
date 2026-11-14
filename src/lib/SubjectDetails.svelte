<script lang="ts">
	// One subject agreement beyond its card (#lib/subjects.ts): loyalty over time and where it is
	// heading, when the deal can be renegotiated, the specialisation's progress and perks, our
	// holdings against the limit, what the subject does (opinion, trust, wars, policies) and — with
	// the `subjectNumbers` cheat — its numbers.
	import Chart from './Chart.svelte';
	import EmpireName from './EmpireName.svelte';
	import { fmt } from './format.ts';
	import InfoPopup from './InfoPopup.svelte';
	import type { Series } from './series.ts';
	import type { SpecialistView } from './subjects.ts';
	import type { Explanation, Subject, SubjectPower, SubjectStance } from './types.ts';

	type Details = {
		renegotiation: { from: string; now: boolean } | null;
		proposalBase: number;
		loyalty: Series;
		trend: number | null;
		fromOpinion: number | null;
		specialist: SpecialistView | null;
		holdings: { used: number; limit: number | null } | null;
		stance: SubjectStance | null;
		power: SubjectPower | null;
		hasPower: boolean;
	};
	let {
		s,
		d,
		extent,
		subjectNumbers,
		policyNames,
		perkNames,
		explain
	}: {
		s: Subject;
		d: Details;
		extent: [number, number];
		subjectNumbers: boolean;
		policyNames: Record<string, string>;
		perkNames: Record<string, string>;
		explain: Record<string, Explanation>;
	} = $props();

	const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`;
	const tone = (v: number | null) =>
		v === null ? '' : v > 0 ? 'text-green-600' : v < 0 ? 'text-red-600' : '';
	const policies = $derived(Object.entries(d.stance?.policies ?? {}));
	const POWER: [keyof SubjectPower, string][] = [
		['military', 'military power'],
		['economy', 'economy power'],
		['tech', 'tech power'],
		['fleetSize', 'fleet size'],
		['navalUsed', 'naval capacity used'],
		['empireSize', 'empire size'],
		['pops', 'pops'],
		['colonies', 'colonies'],
		['victoryRank', 'victory rank']
	];
</script>

{#snippet perkList(keys: string[])}
	{#each keys as k, i (k)}{i ? ', ' : ''}<InfoPopup explanation={explain[`specialistperk:${k}`]}
			>{perkNames[k] ?? k}</InfoPopup
		>{/each}
{/snippet}

<section class="rounded border border-gray-200 p-3 text-sm dark:border-gray-800">
	<h3 class="mb-2 text-base"><EmpireName name={s.name} /></h3>
	<div class="grid gap-x-6 gap-y-3 md:grid-cols-2">
		<div class="space-y-1">
			<div>
				loyalty <b class={tone(s.loyalty)}>{s.loyalty === null ? '?' : fmt(s.loyalty)}</b>
				{#if d.trend !== null}<span
						class={tone(d.trend)}
						title="its change a month between the last two saves">{signed(d.trend)} a month</span
					>{/if}
				{#if d.fromOpinion !== null}<span
						class="text-gray-500"
						title="each month the subject's opinion of its overlord × 0.01 is added to its loyalty (SUBJECT_MONTHLY_LOYALTY_OPINION_MULTIPLIER)"
						>{` (${signed(d.fromOpinion)} of it from opinion)`}</span
					>{/if}
			</div>
			<div>
				{#if d.renegotiation === null}
					<span class="text-gray-500"
						>renegotiation: unknown until a save is read again by this version</span
					>
				{:else if d.renegotiation.now}
					renegotiation <b class="text-green-600">possible now</b>
				{:else}
					renegotiation possible from <b>{d.renegotiation.from}</b>
				{/if}
				<span
					class="text-gray-500"
					title="AGREEMENT_PROPOSE_INFLUENCE_COST + |loyalty change| × AGREEMENT_LOYALTY_DELTA_MULT (4.5.4 defines); an agreement can change every AGREEMENT_CHANGE_COOLDOWN_MONTHS"
					>{` · a proposal costs ≈ ${d.proposalBase} influence + 5 per point of loyalty it moves`}</span
				>
			</div>
			{#if d.holdings}
				<div title="colonies of this subject with our holdings, against the deal's holdings limit">
					our holdings on its colonies <b
						>{d.holdings.used}{d.holdings.limit !== null ? ` / ${d.holdings.limit}` : ''}</b
					>
				</div>
			{/if}
			{#if d.specialist}
				{@const sp = d.specialist}
				<div>
					specialisation <b>{sp.name}</b> level {sp.level}{#if sp.xpNext !== null}<span
							>{`, ${fmt(sp.xp)} / ${fmt(sp.xpNext)} XP`}</span
						>{#if sp.months !== null}<span
								class="text-gray-500"
								title="XP a month = loyalty × 0.1 (SUBJECT_XP_LOYALTY_MULTIPLIER), at today's loyalty"
								>{` — level ${sp.level + 1} in ≈ ${fmt(sp.months / 12)} years (${fmt(sp.perMonth ?? 0)} XP a month)`}</span
							>{/if}{:else}<span class="text-gray-500">, the top level</span>{/if}
				</div>
				{#if sp.perks.length}<div class="text-gray-500">
						now: {@render perkList(sp.perks)}
					</div>{/if}
				{#if sp.nextPerks.length}<div class="text-gray-500">
						at level {sp.level + 1}: {@render perkList(sp.nextPerks)}
					</div>{/if}
			{:else if s.conversion?.inProgress}
				<div>
					becoming a specialist: {fmt(s.conversion.progress)}
					<span class="text-gray-500">progress</span>
				</div>
			{/if}
		</div>
		<div class="space-y-1">
			{#if d.stance}
				<div>
					its opinion of us <b class={tone(d.stance.opinion)}
						>{d.stance.opinion === null ? '?' : signed(d.stance.opinion)}</b
					>
					· trust <b>{d.stance.trust === null ? '?' : fmt(d.stance.trust)}</b>
				</div>
				<div>
					{#if d.stance.wars.length}at war: {d.stance.wars.join(', ')}{:else}<span
							class="text-gray-500">at peace</span
						>{/if}
					{#if d.stance.inBreach}<span
							class="text-amber-600"
							title="`is_in_breach_of_any`: it breaks a Galactic Community resolution in force"
							>· in breach of a resolution</span
						>{/if}
				</div>
				{#if policies.length}
					<div class="text-gray-500">
						{#each policies as [p, o], i (p)}{i ? ' · ' : ''}{policyNames[p] ?? p}:
							<span class="text-gray-700 dark:text-gray-300">{policyNames[o] ?? o}</span>{/each}
					</div>
				{/if}
			{:else}
				<div class="text-gray-500">
					What it does shows once a save is read again by this version.
				</div>
			{/if}
			{#if d.power}
				<div
					class="flex flex-wrap gap-x-3"
					title="cheat: the game compares these only as Inferior, Equivalent or Superior"
				>
					{#each POWER as [k, label] (k)}{#if d.power[k] !== null}<span
								>{label} <b>{fmt(d.power[k] ?? 0)}</b></span
							>{/if}{/each}
				</div>
			{:else if d.hasPower && !subjectNumbers}
				<div class="text-xs text-gray-500">
					Its numbers (power, fleet, size, pops): ⚙ → cheats → Subjects.
				</div>
			{/if}
		</div>
	</div>
	{#if d.loyalty.x.length > 1}
		<div class="mt-2">
			<Chart title={`Loyalty — ${s.name}`} series={d.loyalty} {extent} yMin={-100} yMax={100} />
		</div>
	{/if}
</section>
