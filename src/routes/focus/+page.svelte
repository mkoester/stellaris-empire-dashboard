<script lang="ts">
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	const open = $derived(data.view?.cards.filter((c) => !c.done) ?? []);
	const done = $derived(data.view?.cards.filter((c) => c.done) ?? []);
</script>

{#snippet techs(list: string[])}
	{#each list as t, i (t)}{i ? ' or ' : ''}<InfoPopup explanation={data.explain[`tech:${t}`]}
			>{data.techNames[t]}</InfoPopup
		>{/each}
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Empire focus</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<p class="mb-4 max-w-3xl text-sm text-gray-500">
	The empire focus hands out tasks (cards). Each one done adds progress to its category; enough
	progress unlocks the category's next reward, a research option. The category picked as priority
	draws more of its cards.
</p>

{#if !data.view}
	<p class="text-sm text-amber-600">
		No save read since this tab exists; it fills after the next one.
	</p>
{:else}
	<div class="grid gap-8 lg:grid-cols-2">
		<Panel
			title="Rewards"
			note="Per category: progress towards the next reward and the one after it. Every option a reward can offer is listed; which one depends on the empire."
		>
			<table class="text-left text-sm">
				<tbody>
					{#each data.view.rewards as r (r.category)}
						<tr class="border-b border-gray-100 align-top dark:border-gray-900">
							<th class="p-1 pr-3 whitespace-nowrap {r.priority ? 'font-semibold' : 'font-normal'}"
								>{r.name}{r.priority ? ' ★' : ''}</th
							>
							<td class="p-1 whitespace-nowrap tabular-nums"
								>{r.progress}{r.cost !== null ? ` / ${r.cost}` : ''}</td
							>
							<td class="p-1"
								>{@render techs(r.techs)}{#if r.next}<div class="text-gray-500">
										then at {r.next.cost}: {@render techs(r.next.techs)}
									</div>{/if}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</Panel>

		<Panel title="Open tasks ({open.length})" note="How to do each, from the card's hint.">
			{#each open as c (c.key)}
				<div class="mb-2 text-sm">
					<b>{c.name}</b>
					<span class="text-gray-500">{c.category ?? ''}{c.tier ? `, tier ${c.tier}` : ''}</span>
					{#if c.requirement}<div>{c.requirement}</div>{/if}
					{#if c.hint}<div class="text-gray-500">{c.hint}</div>{/if}
				</div>
			{:else}<p class="text-sm text-gray-500">None.</p>{/each}
			{#if done.length}
				<h3 class="mt-3 mb-1 font-semibold">Done ({done.length})</h3>
				<p class="text-sm text-gray-500">{done.map((c) => c.name).join(' · ')}</p>
			{/if}
		</Panel>
	</div>
{/if}
