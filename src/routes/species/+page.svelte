<script lang="ts">
	import Effects from '#lib/Effects.svelte';
	import { pretty } from '#lib/format.ts';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';

	let { data } = $props();
	followGame(() => data.isHead);
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Species</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<div class="flex flex-col gap-6">
	{#each data.species as s (s.id)}
		<Panel title={s.name}>
			<p class="mb-1 text-sm text-gray-500">
				{s.className} · {Math.round(s.pops).toLocaleString('en')} pops{s.budget
					? ` · traits ${s.budget.points} / ${s.budget.maxPoints} points, ${s.budget.picks} / ${s.budget.maxPicks} picks`
					: ''}
			</p>
			<!-- each trait with its effects, as many side by side as the width allows -->
			<div class="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-x-4 gap-y-1.5 text-sm">
				{#each s.traits as t (t)}
					<div>
						<b
							><InfoPopup explanation={data.explain[`trait:${t}`]}
								>{data.explain[`trait:${t}`]?.title ?? pretty(t.replace(/^trait_/, ''))}</InfoPopup
							></b
						>
						<div><Effects explanation={data.explain[`trait:${t}`]} /></div>
					</div>
				{/each}
			</div>
			{#if s.rights.length}
				<table class="mt-2 text-left text-sm">
					<tbody>
						{#each s.rights as r (r.kind)}
							<tr class="align-top">
								<th class="pr-3 font-normal whitespace-nowrap text-gray-500">{r.label}</th>
								<td>
									{#each r.options as o, i (o.key)}{i ? ' · ' : ''}<span
											class={o.selected
												? 'font-semibold'
												: o.allowed === false
													? 'text-gray-500 line-through'
													: 'text-gray-500'}>{o.name}</span
										>{/each}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</Panel>
	{:else}<p class="text-sm text-gray-500">No species read yet.</p>{/each}
</div>
