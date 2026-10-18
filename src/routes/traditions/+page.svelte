<script lang="ts">
	import Effects from '#lib/Effects.svelte';
	import EffectTotals from '#lib/EffectTotals.svelte';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	const taken = $derived(data.perks.filter((p) => p.taken));
	const open = $derived(data.perks.filter((p) => !p.taken));
	const ROLE: Record<string, string> = { adopt: 'adopted', finish: 'finished' };
</script>

{#snippet totals(
	title: string,
	e: { totals: typeof data.traditionEffects.totals; texts: { name: string; text: string }[] },
	none: string
)}
	<Panel {title} note="Flat modifiers summed, with where each part comes from.">
		{#if e.totals.length}<EffectTotals effects={e.totals} />{:else}<p class="text-sm text-gray-500">
				{none}
			</p>{/if}
		{#if e.texts.length}
			<h3 class="mt-3 mb-1 text-sm font-semibold">Also</h3>
			<ul class="space-y-0.5 text-sm">
				{#each e.texts as t (t.name)}<li>
						<b>{t.name}</b> <span class="text-xs text-gray-500">{t.text}</span>
					</li>{/each}
			</ul>
		{/if}
	</Panel>
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Traditions</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if data.next}
	<p class="mb-4 text-sm">
		Next tradition: {data.next.date}{data.next.exact ? '' : ' (est.)'} — {data.next.detail}
	</p>
{/if}

<div class="grid gap-8 lg:grid-cols-2">
	{@render totals('Active effects: traditions', data.traditionEffects, 'No tradition adopted.')}
	{@render totals('Active effects: ascension perks', data.perkEffects, 'No perk taken.')}

	{#each data.trees as t (t.key)}
		<Panel
			title={t.name}
			note="{t.picked.length} / {t.total} picked{t.finished
				? ', finished'
				: ''}. Grey: not active yet."
		>
			<ul class="space-y-1 text-sm">
				{#each t.all as x (x.key)}
					<li class={x.active ? '' : 'text-gray-500 opacity-70'}>
						<b class="font-semibold"
							><InfoPopup explanation={data.explain[`tradition:${x.key}`]}>{x.name}</InfoPopup></b
						>{#if ROLE[x.role]}<span class="text-xs text-gray-500">
								· when {ROLE[x.role]}</span
							>{/if}{x.active ? ' ✓' : ''}
						<div><Effects explanation={data.explain[`tradition:${x.key}`]} /></div>
					</li>
				{/each}
			</ul>
		</Panel>
	{:else}
		<Panel title="Adopted trees"><p class="text-sm text-gray-500">None adopted yet.</p></Panel>
	{/each}

	<Panel title="Other trees" note="Not adopted yet.">
		<p class="text-sm">{data.otherTrees.map((t) => t.name).join(' · ')}</p>
	</Panel>

	<Panel
		title="Ascension perks"
		note="Taken first; hover for what each does. Their conditions are not checked."
	>
		<div class="text-sm">
			{#each taken as p (p.key)}<div>
					<b><InfoPopup explanation={data.explain[`perk:${p.key}`]}>{p.name}</InfoPopup></b> ✓
				</div>{/each}
			<div class="mt-2 text-gray-500">
				{#each open as p, i (p.key)}{i ? ' · ' : ''}<InfoPopup
						explanation={data.explain[`perk:${p.key}`]}>{p.name}</InfoPopup
					>{/each}
			</div>
		</div>
	</Panel>
</div>
