<script lang="ts">
	import { colorOf } from '#lib/colors.ts';
	import { fmt } from '#lib/format.ts';
	import type { researchBonuses } from '#lib/server/researchBonuses.ts';
	import Panel from './Panel.svelte';

	// The research bonuses per area in their three piles (#lib/researchBonuses.ts): what each
	// source adds, each pile's sum, what one more is worth on top, and the speed checked against
	// the speed measured from the saves.
	type Area = NonNullable<ReturnType<typeof researchBonuses>>[number];
	let { areas }: { areas: Area[] } = $props();

	const pct = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n) * 100)} %`;
	const x = (n: number) => `×${n.toFixed(2)}`;
</script>

{#snippet lines(ls: { name: string; scope: string; value: number; applies?: boolean }[])}
	<table class="w-full text-left text-sm tabular-nums">
		<tbody>
			{#each ls as l, i (i)}
				<tr
					class={l.applies === false ? 'text-gray-400' : ''}
					title={l.applies === false ? 'not for the tech in progress (another field)' : ''}
				>
					<td class="p-0.5">{l.name}</td>
					<td class="p-0.5 text-xs text-gray-500">{l.scope}</td>
					<td class="p-0.5 text-right {l.value < 0 ? 'text-red-600' : ''}">{pct(l.value)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/snippet}

<Panel
	title="Research bonuses and how they stack"
	note="Three piles: research output (points a month), speed (progress per point) and cost. Within a pile the bonuses add up, so each one more is worth less: +10 % on top of +48 % is +6.8 % faster. The piles multiply: time for a tech = cost ÷ (output × speed). Counted: what the empire holds — traditions, perks, edicts, policies, civics, ethics, authority, origin, techs, timed modifiers, situation stages — and the council at its councilors' levels with their traits. Not counted: species traits, buildings and planet modifiers (they act on single colonies' jobs: the booked output has them)."
>
	<div class="grid gap-6 md:grid-cols-3">
		{#each areas as a (a.area)}
			{@const m = a.speed.measured}
			<div>
				<h3 class="mb-1 font-semibold" style:color={colorOf(`${a.area}_research`)}>{a.area}</h3>

				<h4 class="mt-2 text-sm font-semibold">
					Speed {x(1 + a.speed.sum)}
					{#if a.speed.tech}<span class="font-normal text-gray-500"
							>for {a.speed.tech.name} ({a.speed.tech.category?.replaceAll('_', ' ') ?? '?'}{a.speed
								.tech.rare
								? ', rare'
								: ''})</span
						>{/if}
				</h4>
				{#if a.speed.lines.length}{@render lines(a.speed.lines)}{:else}<p
						class="text-sm text-gray-500"
					>
						No bonus.
					</p>{/if}
				{#if m}
					{@const ok = Math.abs(m.factor - m.predicted) < 0.005}
					<p
						class="text-xs {ok ? 'text-green-700 dark:text-green-500' : 'text-amber-600'}"
						title="progress gained between the month-start saves to {m.date} ÷ the research output booked"
					>
						Measured {x(m.factor)} on {m.name} ({m.date}){ok
							? ' ✓ the lines add up to it'
							: ` — the lines give ${x(m.predicted)}: ${pct(m.factor - m.predicted)} from a source not counted`}
					</p>
				{:else}
					<p class="text-xs text-gray-500">
						Not measured yet: needs two month-start saves on the same tech, with no stored research.
					</p>
				{/if}
				<p class="mt-1 text-xs">
					One more +10 % speed: {pct(a.speed.worth10)} real · a research agreement's +25 %: {pct(
						a.speed.agreement
					)}
				</p>

				<h4 class="mt-3 text-sm font-semibold">
					Output {fmt(a.output.booked)} a month
				</h4>
				{#if a.output.lines.length}{@render lines(a.output.lines)}{/if}
				<p class="text-xs">
					One more +10 % output: {pct(a.output.worth10)} real (of the empire-wide bonuses counted here)
				</p>

				<h4 class="mt-3 text-sm font-semibold">Cost</h4>
				<table class="w-full text-left text-sm tabular-nums">
					<tbody>
						<tr>
							<td class="p-0.5">difficulty, tier {a.cost.tier}</td>
							<td class="p-0.5 text-right">{pct(a.cost.difficulty)}</td>
						</tr>
						{#if a.cost.slider !== 1}
							<tr>
								<td class="p-0.5">galaxy setting</td>
								<td class="p-0.5 text-right">{x(a.cost.slider)}</td>
							</tr>
						{/if}
						<tr title="+0.2 % per empire size above 100 (EMPIRE_SIZE_TECH_COST_PENALTY)">
							<td class="p-0.5">empire size {a.cost.size ?? '?'}</td>
							<td class="p-0.5 text-right">{pct(a.cost.sizePenalty)}</td>
						</tr>
					</tbody>
				</table>
				{#if a.cost.lines.length}{@render lines(a.cost.lines)}{/if}
			</div>
		{/each}
	</div>
</Panel>
