<script lang="ts">
	import { colorOf } from '#lib/colors.ts';
	import type { Reward } from '#lib/focus.ts';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	const open = $derived(data.view?.cards.filter((c) => !c.done) ?? []);
	const done = $derived(data.view?.cards.filter((c) => c.done) ?? []);
	// the game's colours per category: exploration blue, conquest red, development gold
	const tint = (category: string | null) => colorOf(`focus-${category}`);
</script>

{#snippet reward(r: Reward)}
	{#each r.options.filter((o) => o.ours !== false) as o, i (o.tech)}{i ? ' or ' : ''}<InfoPopup
			explanation={data.explain[`tech:${o.tech}`]}>{data.techNames[o.tech]}</InfoPopup
		>{/each}
	<InfoPopup explanation={data.explain[`focusreward:${r.key}`]}
		><span class="text-gray-500" title="what this reward does">ⓘ</span></InfoPopup
	>
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Empire focus</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<p class="mb-4 max-w-3xl text-sm text-gray-500">
	The empire focus hands out tasks (cards). Each one done adds progress to a category, as its card
	says; enough progress unlocks the category's next reward: a tech that stays among your research
	choices until you research it. The category picked as priority draws more of its cards.
</p>

{#if !data.view}
	<p class="text-sm text-amber-600">
		No save read since this tab exists; it fills after the next one.
	</p>
{:else}
	<div class="grid gap-8 lg:grid-cols-2">
		<Panel
			title="Rewards"
			note="Per category: progress towards the next reward and the one after it, each the tech your empire gets (hover for why, and the others)."
		>
			<table class="text-left text-sm">
				<tbody>
					{#each data.view.rewards as r (r.category)}
						<tr class="border-b border-gray-100 align-top dark:border-gray-900">
							<th
								class="p-1 pr-3 whitespace-nowrap {r.priority ? 'font-semibold' : 'font-normal'}"
								style:color={tint(r.category)}>{r.name}{r.priority ? ' ★' : ''}</th
							>
							<td class="p-1 whitespace-nowrap tabular-nums"
								>{r.progress}{r.now?.cost != null ? ` / ${r.now.cost}` : ''}</td
							>
							<td class="p-1"
								>{#if r.now}{@render reward(r.now)}{/if}{#if r.next}<div class="text-gray-500">
										then at {r.next.cost}: {@render reward(r.next)}
									</div>{/if}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</Panel>

		<Panel
			title="Open tasks ({open.length})"
			note="How to do each, from the card's hint; what it gives when done."
		>
			{#each open as c (c.key)}
				<div class="mb-2 border-l-4 pl-2 text-sm" style:border-color={tint(c.category)}>
					<b>{c.name}</b>
					<span class="text-gray-500">{c.tier ? `tier ${c.tier}` : ''}</span>
					{#each c.gives as g (g.category)}<span
							class="ml-1 rounded px-1 text-xs font-semibold text-white"
							style:background={tint(g.category)}
							title="focus progress for {data.view.rewards.find((r) => r.category === g.category)
								?.name ?? g.category}">+{g.amount}</span
						>{/each}
					{#if c.requirement}<div>{c.requirement}</div>{/if}
					{#if c.hint}<div class="text-gray-500">{c.hint}</div>{/if}
				</div>
			{:else}<p class="text-sm text-gray-500">None.</p>{/each}
			{#if done.length}
				<h3 class="mt-3 mb-1 font-semibold">Done ({done.length})</h3>
				<p class="text-sm">
					{#each done as c, i (c.key)}{i ? ' · ' : ''}<span style:color={tint(c.category)}
							>{c.name}</span
						>{/each}
				</p>
			{/if}
		</Panel>
	</div>
{/if}
