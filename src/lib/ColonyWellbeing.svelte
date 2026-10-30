<script lang="ts">
	import { fmt } from './format.ts';
	import type { Colony } from './types.ts';
	import {
		amenities,
		happinessStability,
		stabilityOutput,
		type WellbeingRules
	} from './wellbeing.ts';

	// A colony's amenities, happiness and stability, what each does and what to do about it
	// (#lib/wellbeing.ts). The effects between the game's ends are assumed linear: marked ≈.
	let { colony, rules, gestalt }: { colony: Colony; rules: WellbeingRules; gestalt: boolean } =
		$props();

	const a = $derived(
		colony.amenities != null && colony.amenitiesUsage != null
			? amenities(colony.amenities, colony.amenitiesUsage, gestalt, rules)
			: null
	);
	const approval = $derived(colony.approval ?? colony.happiness);
	const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 1000) / 10} %`;
	const pts = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`;
	const tone = (v: number) =>
		v < 0 ? 'text-red-600' : v > 0 ? 'text-green-700 dark:text-green-500' : '';
	const ASSUMED =
		'≈ the game files give the ends; the scaling between them is assumed linear until checked against the game';
</script>

<section class="mb-4 rounded border border-gray-300 p-2 text-sm dark:border-gray-700">
	<h2 class="mb-1 font-semibold">Amenities, happiness and stability</h2>
	<ul class="flex flex-col gap-1">
		<li>
			<b>Amenities</b>
			{#if a && colony.amenities != null && colony.amenitiesUsage != null}
				{fmt(colony.amenities)} for {fmt(colony.amenitiesUsage)} needed ({Math.round(a.ratio * 100)} %)
				→
				<span class={tone(a.effect)} title={ASSUMED}
					>≈ {a.on === 'happiness'
						? `${pct(a.effect)} happiness`
						: `${pts(a.effect)} stability`}</span
				>
				<div class="text-xs text-gray-500">
					{#if a.short > 0}
						short by <b class="text-red-600">{fmt(a.short)}</b>: the penalty grows to its full
						{a.on === 'happiness' ? pct(rules.amenityLow) : pts(rules.amenityLowGestalt)} at {rules.minAmenities *
							100} % of the need — more amenity jobs or buildings pay off here first.
					{:else if a.useful > 0}
						enough. {fmt(a.useful)} more would still add {a.on === 'happiness'
							? 'happiness'
							: 'stability'}, up to {a.on === 'happiness'
							? pct(rules.amenityHigh)
							: pts(rules.amenityHighGestalt)} at {rules.maxAmenities}× the need{a.on ===
						'happiness'
							? ' (citizens only)'
							: ''}.
					{:else if a.wasted > 0}
						<b>{fmt(a.wasted)} wasted</b>: beyond {rules.maxAmenities}× the need amenities do
						nothing — an amenity job or building here could go, or its pops work elsewhere.
					{:else}
						at {rules.maxAmenities}× the need: the full bonus, nothing wasted.
					{/if}
				</div>
			{:else}
				<span class="text-gray-500">not read yet (the next save)</span>
			{/if}
		</li>
		{#if !gestalt && approval != null}
			{@const st = happinessStability(approval, rules)}
			<li>
				<b>Happiness</b>
				{Math.round(approval * 1000) / 10} %
				<span
					class="text-gray-500"
					title="happiness weighted by political power: what stability uses"
					>{colony.approval != null ? 'approval rating' : 'pops-weighted'}</span
				>
				→ <span class={tone(st)} title={ASSUMED}>≈ {pts(st)} stability</span>
				<div class="text-xs text-gray-500">
					{rules.baseHappiness * 100} % moves stability neither way; it reaches {pts(
						rules.happinessHigh
					)} at 100 % and {pts(rules.happinessLow)} at 0 %. Living standards, amenities, edicts and faction
					approval move happiness.
				</div>
			</li>
		{/if}
		<li>
			<b>Stability</b>
			{Math.round(colony.stability * 10) / 10}
			{#if colony.stability < rules.lowStability}<span class="text-red-600">low</span>{/if}
			→
			<span class={tone(stabilityOutput(colony.stability, rules))} title={ASSUMED}
				>≈ {pct(stabilityOutput(colony.stability, rules))} job output</span
			>
			<div class="text-xs text-gray-500">
				{rules.baseStability} is neutral; job output reaches {pct(rules.outputHigh)} at {rules.maxStability}
				and {pct(rules.outputLow)} at {rules.minStability}; below {rules.lowStability} the game warns
				(unrest, revolts).{#if colony.crime}
					Crime {fmt(colony.crime)}.{/if}
			</div>
		</li>
	</ul>
</section>
