<script lang="ts">
	import { fmt } from './format.ts';
	import InfoPopup from './InfoPopup.svelte';
	import { formatModifierValue, modifierColor, modifierLabel } from './modifiers.ts';
	import type { Colony, Explanation } from './types.ts';
	import {
		amenities,
		amenityRoom,
		approvalRoom,
		roomRates,
		type WellbeingRules
	} from './wellbeing.ts';
	import type { Lever, LeverTarget } from './wellbeingLevers.ts';

	// A colony at the stability cap: how far above it the game's sum is (companion mod 0.8.0),
	// how much happiness and amenities could go before it drops below, and what holds them up
	// (#lib/wellbeing.ts, #lib/wellbeingLevers.ts). Shown while stability is at the cap.
	let {
		colony,
		rules,
		gestalt,
		uncapped,
		levers,
		explain
	}: {
		colony: Colony;
		rules: WellbeingRules;
		gestalt: boolean;
		uncapped: number | null;
		levers: Record<LeverTarget, Lever[]>;
		explain: Record<string, Explanation>;
	} = $props();

	const over = $derived(uncapped === null ? null : Math.max(0, uncapped - rules.maxStability));
	const approval = $derived(colony.approval ?? colony.happiness);
	const need = $derived(colony.amenitiesUsage ?? null);
	const have = $derived(colony.amenities ?? null);
	const rates = $derived(need ? roomRates(need, gestalt, rules) : null);
	const happy = $derived(
		over !== null && approval != null && !gestalt ? approvalRoom(over, approval, rules) : null
	);
	// what the amenities' effect may lose: approval for a regular empire, stability for a gestalt
	const amen = $derived(
		over !== null && have != null && need
			? amenityRoom(gestalt ? over : (happy?.drop ?? 0), have, need, gestalt, rules)
			: null
	);
	const ratioAfter = $derived(
		amen && have != null && need && !amen.all ? (have - amen.amount) / need : null
	);
	const pctPts = (v: number) => `${Math.round(v * 1000) / 10}`;
	const HOW: Record<string, string> = { now: 'now', slow: 'slowly', no: 'fixed' };
	const NOTE =
		'≈ amenities between 100 % and 200 % of the need are assumed to scale linearly; above the need they raise citizens’ happiness only, so this assumes the colony’s political power lies with citizens';
</script>

{#snippet list(items: Lever[], what: string)}
	{#if items.length}
		<ul class="mt-1 flex flex-col gap-1 text-xs">
			{#each items as l (l.ref)}
				<li class:opacity-60={l.how === 'no'}>
					<InfoPopup explanation={explain[l.ref]}>{explain[l.ref]?.title ?? l.ref}</InfoPopup>
					{#if l.ref.startsWith('job:')}<span class="text-gray-500"
							>{fmt(l.count)} working, each</span
						>{:else if l.count > 1}<span class="text-gray-500">×{fmt(l.count)}</span>{/if}
					<span class="text-gray-500">{l.local ? 'this colony' : 'empire-wide'}</span>:
					{#each l.effects as m, i (i)}<span class={modifierColor(m)}
							>{formatModifierValue(m)} {modifierLabel(m)}</span
						>{i < l.effects.length - 1 ? ', ' : ''}{/each}
					<div class="text-gray-500">
						<b>{HOW[l.how]}</b>: {l.change}{#if l.side.length}
							· giving it up also loses: {#each l.side as m, i (i)}<span class={modifierColor(m)}
									>{formatModifierValue(m)} {modifierLabel(m)}</span
								>{i < l.side.length - 1 ? ', ' : ''}{/each}{/if}
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="text-xs text-gray-500">no source the save and the game files name for {what}</div>
	{/if}
{/snippet}

<section class="mb-4 rounded border border-gray-300 p-2 text-sm dark:border-gray-700">
	<h2 class="mb-1 font-semibold">Room above the stability cap</h2>
	<ul class="flex flex-col gap-2">
		<li>
			<b>Stability</b>
			{#if uncapped !== null && over !== null}
				{fmt(uncapped)} before the cap →
				<b class={over > 0 ? 'text-green-700 dark:text-green-500' : ''}
					>{over > 0 ? `${fmt(over)} over ${rules.maxStability}` : 'none over'}</b
				>
				<div class="text-xs text-gray-500">
					Base {rules.baseStability} + the colony’s flat stability {fmt(
						colony.stabilityAdd ?? 0
					)}{#if !gestalt}
						+ approval’s{/if}{#if colony.stabilityMult}, × {fmt(1 + colony.stabilityMult)}{/if} — what
					is over {rules.maxStability} does nothing: that much happiness or amenities could go.
				</div>
			{:else}
				<span
					class="text-gray-500"
					title="the companion mod 0.8.0 exports the colony's flat stability"
					>≈ unknown — the game saves stability capped at {rules.maxStability}</span
				>
				<div class="text-xs text-gray-500">
					The companion mod (0.8.0 or later) stores how far above the cap the colony is, from the
					next month on. Until then the rates below.
				</div>
			{/if}
		</li>

		{#if !gestalt && approval != null}
			<li>
				<b>Happiness</b>
				{#if happy}
					approval could fall by <b>{happy.all ? 'all of it' : `${pctPts(happy.drop)} points`}</b>
					({pctPts(approval)} % →
					{pctPts(Math.max(0, approval - happy.drop))} %){#if approval >= 1}<span
							class="text-gray-500"
							title="the save holds happiness capped at 100 %: there may be more above it"
						>
							at least</span
						>{/if}
				{:else if rates}
					≈ {fmt(rates.approvalPerStability * 100)} points of approval per stability point over the cap
				{/if}
				<div class="text-xs text-gray-500">
					Above {rules.baseHappiness * 100} % approval each point gives {fmt(
						rules.happinessHigh / ((1 - rules.baseHappiness) * 100)
					)} stability; below it, {fmt(-rules.happinessLow / (rules.baseHappiness * 100))}. Lowering
					happiness also raises crime and weakens the pull towards the governing ethics.
				</div>
				{@render list(levers.happiness, 'happiness')}
			</li>
		{/if}

		{#if have != null && need}
			<li>
				<b>Amenities</b>
				{#if amen}
					<span title={NOTE}>≈ <b>{amen.all ? 'all of them' : fmt(amen.amount)}</b> could go</span>
					({fmt(have)} → {fmt(Math.max(0, have - amen.amount))} for {fmt(need)} needed{#if ratioAfter !== null},
						{Math.round(ratioAfter * 100)} %{/if}){#if (amenities(have, need, gestalt, rules)?.wasted ?? 0) > 0},
						{fmt(amenities(have, need, gestalt, rules)!.wasted)} of them wasted already{/if}
				{:else if rates}
					<span title={NOTE}
						>≈ {fmt(rates.amenitiesPerEffect / (gestalt ? 1 : 100))} amenities per {gestalt
							? 'stability point'
							: 'point of approval'}</span
					>
				{/if}
				<div class="text-xs text-gray-500">
					Between 100 % and {rules.maxAmenities * 100} % of the need {rates
						? fmt(rates.amenitiesPerEffect / (gestalt ? 1 : 100))
						: '?'} amenities make one {gestalt ? 'stability point' : 'point of happiness'}; beyond
					{rules.maxAmenities * 100} % they make nothing, below 100 % the penalty starts.
				</div>
				{@render list(levers.amenities, 'amenities')}
			</li>
		{/if}
	</ul>
	<div class="mt-2 text-xs text-gray-500">
		Sources: what the save shows held and the game files give unconditionally — conditional effects
		(living standards’ happiness, most job variants) and leader traits are not listed.
	</div>
</section>
