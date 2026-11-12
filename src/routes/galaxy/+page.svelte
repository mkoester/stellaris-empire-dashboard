<script lang="ts">
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { followGame } from '#lib/live.ts';
	import { formatModifierValue, modifierLabel } from '#lib/modifiers.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import type { Modifier } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// Difficulty by its place, 1–7 (the user's colours, 2026-11-12): Civilian green, Cadet plain,
	// Ensign yellow on to Grand Admiral red.
	const TONE = [
		'text-green-600',
		'',
		'text-yellow-500',
		'text-amber-500',
		'text-orange-500',
		'text-orange-600',
		'text-red-600'
	];
	const toneOf = (key: unknown) => TONE[data.difficulties.find((d) => d.key === key)?.rank ?? 1];
	const line = (ms: Modifier[]) =>
		ms.map((m) => `${modifierLabel(m)} ${formatModifierValue(m)}`).join(', ') || '—';
	const pct = (v: number | null) => (v === null ? '?' : `+${Math.round(v * 1000) / 10} %`);
</script>

<div class="space-y-4">
	<h1 class="text-xl font-semibold">Galaxy setup</h1>
	{#if data.groups.length}
		<p class="text-sm text-gray-500">
			The settings this galaxy was created with, grouped as on the game's setup screen (from the
			save of {data.seenAt}).
			<span class="rounded bg-amber-100 px-1 dark:bg-amber-900/40">Highlighted</span>: not the
			default for this galaxy size (hover for the default; "assumed" where the default is the
			engine's, in no file).
		</p>
		<div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
			{#each data.groups as g (g.title)}
				<Panel title={g.title}>
					<table class="w-full text-sm">
						<tbody>
							{#each g.rows as r (r.key)}
								{@const hint = r.changed
									? `default: ${r.default}${r.assumed ? ' (assumed: the engine’s, in no file)' : ''}`
									: undefined}
								<tr
									class="border-b border-gray-100 dark:border-gray-800 {r.changed
										? 'bg-amber-100 dark:bg-amber-900/40'
										: ''}"
								>
									<td class="py-0.5 pr-3 text-gray-500" title={hint ?? r.key}>{r.label}</td>
									<td class="py-0.5 text-right" title={hint}>
										{#if r.key === 'difficulty' && data.difficultyCard}
											<span class={toneOf(r.raw)}
												><InfoPopup explanation={data.difficultyCard}>{r.value}</InfoPopup></span
											>
										{:else}{r.value}{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</Panel>
			{/each}
		</div>
		<details class="text-sm">
			<summary class="cursor-pointer font-semibold">All difficulties and what they do</summary>
			<table class="mt-2 w-full">
				<thead class="text-left text-gray-500">
					<tr>
						<th class="pr-4">Difficulty</th>
						<th class="pr-4">Our empire</th>
						<th class="pr-4">The AI's regular empires</th>
						<th class="pr-4">Non-playable countries</th>
						<th
							title="a tech's cost × (1 + this × its tier), at this game's Tech and Tradition Difficulty Scaling (measured in game for techs; how traditions scale is not known)"
							>Tech cost a tier</th
						>
					</tr>
				</thead>
				<tbody>
					{#each data.difficulties as d (d.key)}
						<tr class="border-t border-gray-100 align-top dark:border-gray-800">
							<td class="pr-4 whitespace-nowrap {TONE[d.rank]}">{d.label}</td>
							<td class="pr-4">{line(d.player)}</td>
							<td class="pr-4">{line(d.ai)}</td>
							<td class="pr-4">{line(d.npc)}</td>
							<td class="whitespace-nowrap">{pct(d.costPerTier)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="mt-1 text-gray-500">
				From the game's static modifiers: the AI's bonuses are not applied to the subjects of
				players; its Difficulty Modifier Mult counts only with the Difficulty Adjusted AI Modifiers
				setting.
			</p>
		</details>
	{:else}
		<p class="text-sm text-gray-500">
			No save read since this dashboard version yet holds the galaxy's settings — they show once a
			save is read again (saves still on disk are, at the next start).
		</p>
	{/if}
</div>
