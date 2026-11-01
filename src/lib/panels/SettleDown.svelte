<script lang="ts">
	import { colorOf } from '../colors.ts';
	import { fmt } from '../format.ts';
	import { habitabilityTier, TIER_CLASS } from '../habitability.ts';
	import {
		allMet,
		ARKSHIP_REMAINS,
		SETTLE_DAYS,
		type Requirement,
		type SettleOutcome,
		type SettleTarget
	} from '../settle.ts';
	import SortTable from '../SortTable.svelte';
	import type { Column } from '../sort.ts';
	import Panel from './Panel.svelte';

	// Settling down (a nomad) or embarking (a settled empire): what the empire still needs, and for a
	// nomad where an arkship could settle and what each of the game's four outcomes would do now.
	// Costs are left out (they fluctuate): settling 250 influence, embarking 500 influence and
	// 10,000 alloys.
	let {
		mode,
		requirements,
		targets = [],
		outcome = null,
		species = null,
		defines = {}
	}: {
		mode: 'settle' | 'embark';
		requirements: Requirement[];
		targets?: SettleTarget[];
		outcome?: SettleOutcome | null;
		species?: string | null; // whose habitability the targets show
		defines?: Record<string, number>;
	} = $props();
	const ready = $derived(allMet(requirements));
	const never = $derived(requirements.some((r) => r.never));
	const pct = (v: number) => `${Math.round(v * 100)} %`;
	const mark = (r: Requirement) => (r.met === true ? '✓' : r.met === false ? '✗' : '?');
	const markClass = (r: Requirement) =>
		r.met === true ? 'text-green-600' : r.met === false ? 'text-red-600' : 'text-gray-500';
	const jumps = (n: number | null) => (n === null ? '–' : String(n));

	const columns: Column<SettleTarget>[] = [
		{ id: 'name', label: 'Planet', value: (t) => t.name },
		{ id: 'class', label: 'Class', value: (t) => t.className, cell: classCell },
		{ id: 'size', label: 'Size', value: (t) => t.size, right: true },
		{
			id: 'hab',
			label: 'Hab. now',
			value: (t) => t.hab,
			cell: habCell,
			right: true,
			title: 'estimated for the species picked on the expansion table below'
		},
		{
			id: 'settled',
			label: 'Hab. settled ≈',
			value: (t) => t.settled,
			cell: settledCell,
			right: true,
			title: `with Arkship Remains' +${pct(ARKSHIP_REMAINS.tolerance)} environment tolerance — assumed to count on every colonizable class`
		},
		{ id: 'system', label: 'System', value: (t) => t.system },
		{
			id: 'ark',
			label: 'Arkship',
			value: (t) => t.fromArk,
			cell: arkCell,
			right: true,
			title: 'jumps from the nearest of our arkships'
		},
		{
			id: 'capital',
			label: 'Capital',
			value: (t) => t.fromCapital,
			cell: capitalCell,
			right: true,
			title: 'jumps from the capital arkship'
		},
		{
			id: 'deposits',
			label: 'Deposits ≈',
			value: (t) => t.deposits,
			right: true,
			title:
				"deposits on the system's other bodies: settling builds a station on each (planetary ones counted too)"
		}
	];
</script>

{#snippet classCell(t: SettleTarget)}<span style:color={colorOf(`climate-${t.climate}`)}
		>{t.className}</span
	>{/snippet}
{#snippet habCell(t: SettleTarget)}<span class={TIER_CLASS[habitabilityTier(t.hab, defines)]}
		>{pct(t.hab)}</span
	>{/snippet}
{#snippet settledCell(t: SettleTarget)}<span
		class={TIER_CLASS[habitabilityTier(t.settled, defines)]}>{pct(t.settled)}</span
	>{/snippet}
{#snippet arkCell(t: SettleTarget)}{jumps(t.fromArk)}{/snippet}
{#snippet capitalCell(t: SettleTarget)}{jumps(t.fromCapital)}{/snippet}

{#snippet checklist()}
	<ul class="mb-4 flex flex-col gap-1 text-sm">
		{#each requirements as r (r.key)}
			<li>
				<span class="inline-block w-4 font-semibold {markClass(r)}">{mark(r)}</span>
				{r.label}{#if r.detail}<span class="text-gray-500"> — {r.detail}</span>{/if}
				{#if r.never}<span class="ml-1 text-xs text-red-600">(never)</span>{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#if mode === 'settle'}
	<Panel
		title="Settle down"
		note="A nomad ends its voyage by sending an arkship to settle on a planet: the colony moves onto it and the empire is settled (in game: the expansion planner's Colonize, or an arkship's right-click on an uncolonized habitable world). It costs 250 influence and takes {SETTLE_DAYS} days, less with faster arkship actions; one settling at a time."
	>
		{@render checklist()}
		{#if never}
			<p class="mb-4 text-sm text-red-600">This empire can never settle.</p>
		{:else}
			{#if ready !== true}
				<p class="mb-4 text-sm text-amber-600">
					Not possible yet — the targets and outcomes below are for planning.
				</p>
			{/if}
			<h3 class="mb-1 font-semibold">Where to settle</h3>
			<p class="mb-2 text-sm text-gray-500">
				Colonizable planets in surveyed systems no one owns, best habitability once settled first{species
					? ''
					: ' (no species with a climate preference: habitability unknown)'}. The settled planet
				keeps Arkship Remains: +{pct(ARKSHIP_REMAINS.tolerance)} environment tolerance and +{ARKSHIP_REMAINS.districts}
				districts.
			</p>
			{#if targets.length}
				<SortTable
					rows={targets}
					{columns}
					key={(t) => t.planetId}
					sort={{ column: '', desc: false }}
				/>
			{:else}
				<p class="mb-4 text-sm text-gray-500">
					No colonizable planet surveyed in an unowned system.
				</p>
			{/if}
			{#if outcome}
				<h3 class="mt-4 mb-1 font-semibold">What settling does</h3>
				<p class="mb-2 text-sm text-gray-500">
					The game asks once the arkship has settled. Assumed here: the capital arkship settles.
					Either way the nomad economy ends, {outcome.waystations} waystation{outcome.waystations ===
					1
						? ''
						: 's'} become outposts (in systems no one owns) and {outcome.logistic} logistic ship{outcome.logistic ===
					1
						? ''
						: 's'} become construction ships.
				</p>
				<div class="grid gap-3 sm:grid-cols-2">
					<div class="rounded border border-gray-200 p-3 text-sm dark:border-gray-800">
						<b>Settle{outcome.others.length ? ', scuttle the other arkships' : ''}</b>
						{#if outcome.others.length}
							<p class="mt-1">
								Their pops move to the planet; each returns 10 % of its cost as minerals and alloys:
							</p>
							<ul class="mt-1 text-gray-600 dark:text-gray-400">
								{#each outcome.others as o (o.name)}
									<li>{o.name}: {fmt(o.pops)} pops, +{fmt(o.refund)} minerals and alloys</li>
								{/each}
							</ul>
						{:else}
							<p class="mt-1">Our only arkship becomes the planet's colony.</p>
						{/if}
					</div>
					{#if outcome.others.length}
						<div
							class="rounded border border-gray-200 p-3 text-sm dark:border-gray-800 {outcome.subjectOptions ===
							false
								? 'opacity-50'
								: ''}"
						>
							<b>Keep roaming</b>
							<p class="mt-1">
								The settling arkship becomes a settled subject; the other {outcome.others.length} roam
								on with us, and the subject gets outposts in our waystation systems within 4 jumps.
							</p>
						</div>
						<div
							class="rounded border border-gray-200 p-3 text-sm dark:border-gray-800 {outcome.subjectOptions ===
							false
								? 'opacity-50'
								: ''}"
						>
							<b>Settle, the others roam as a subject</b>
							<p class="mt-1">
								We settle; the other {outcome.others.length} arkships, our waystations and logistic ships
								become a nomadic subject, and we get outposts in waystation systems within 4 jumps.
							</p>
						</div>
					{/if}
				</div>
				{#if outcome.others.length && outcome.subjectOptions === false}
					<p class="mt-2 text-sm text-gray-500">
						No subject options for this empire: {outcome.why}.
					</p>
				{/if}
			{/if}
		{/if}
	</Panel>
{:else}
	<details open={!never} class="mb-2">
		<summary class="cursor-pointer text-xl font-semibold"
			>Embark <span class="text-base font-normal text-gray-500"
				>{never ? 'never possible for this empire' : ready === true ? 'possible' : 'not yet'}</span
			></summary
		>
		<p class="my-2 max-w-3xl text-sm text-gray-500">
			A settled empire can take to the stars as a nomad: the planet decision Embarkation (on a
			planet of ours; 500 influence and 10,000 alloys, half the alloys plus food with bio ships;
			3600 days). Our remaining colonies become a subject.
		</p>
		{@render checklist()}
	</details>
{/if}
