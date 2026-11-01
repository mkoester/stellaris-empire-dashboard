<script lang="ts">
	// The subject agreements we are part of, one card each: who, which preset since when, loyalty,
	// specialisation, the terms (named as the game's agreements screen) and subsidies. Shared by the
	// contacts and subjects tabs.
	import EmpireName from '#lib/EmpireName.svelte';
	import { pretty } from '#lib/format.ts';
	import type { Subject } from '#lib/types.ts';

	let { subjects, diploNames }: { subjects: Subject[]; diploNames: Record<string, string> } =
		$props();
	const presetName = (k: string) => pretty(k.replace(/^preset_/, ''));
	const termValue = (v: string) => pretty(v.replace(/^subject_(is_|does_|gets_)?/, ''));
</script>

<div class="mb-6 flex flex-col gap-3">
	{#each subjects as s (s.countryId)}
		<section class="rounded border border-gray-200 p-3 text-sm dark:border-gray-800">
			<div class="mb-1 flex flex-wrap items-baseline gap-x-4">
				<span class="text-base"><EmpireName name={s.name} /></span>
				<span
					>{s.weAreOverlord ? 'our subject' : 'our overlord'}: {diploNames[s.preset] ??
						presetName(s.preset)}</span
				>
				<span class="text-gray-500 tabular-nums">since {s.since ?? '?'}</span>
				{#if s.loyalty !== null}<span class="tabular-nums"
						>loyalty <b class={s.loyalty < 0 ? 'text-red-600' : 'text-green-600'}>{s.loyalty}</b
						></span
					>{/if}
				{#if s.specialistLevel > 0}<span
						>specialist level {s.specialistLevel} ({s.specialistExperience} XP)</span
					>{/if}
			</div>
			<div class="text-gray-500">
				{Object.entries(s.terms)
					// terms the game hides have no name: left out, as in its agreements screen
					.filter(([k]) => diploNames[k])
					.map(([k, v]) => `${diploNames[k]}: ${diploNames[v] ?? termValue(v)}`)
					.join(' · ')}
			</div>
			{#if Object.values(s.subsidies).some((v) => v !== 0)}
				<div>
					subsidies: {Object.entries(s.subsidies)
						.filter(([, v]) => v !== 0)
						.map(([k, v]) => `${pretty(k.replace(/^resource_subsidies_/, ''))} ${v}`)
						.join(', ')}
				</div>
			{/if}
		</section>
	{/each}
</div>
