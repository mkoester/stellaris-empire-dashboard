<script lang="ts">
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	const fmt = (n: number) => Math.round(n).toLocaleString('en');
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Ambitions</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !data.seenAt}
	<p class="text-sm text-gray-500">No save read since this tab exists.</p>
{:else if data.noData}
	<p class="text-sm text-gray-500">
		The game data has no ambitions: it comes from an older extractor. Restart the dashboard to
		extract it again.
	</p>
{:else}
	{#if data.mine && 'unknownPath' in data.mine}
		<p class="text-sm text-gray-500">
			{`Our ambition, ${data.mine.unknownPath}, is not in the game data.`}
		</p>
	{:else if data.mine}
		{@const m = data.mine}
		<Panel title={m.name} note={`ambition level ${m.level} of ${m.levels.length}`}>
			{#if m.description}<p class="mb-3 text-sm opacity-75">{m.description}</p>{/if}
			{#if m.currency}
				<p class="mb-3 text-sm">
					{`${m.currency.replace(/_/g, ' ')}: `}<span class="font-mono font-semibold">
						{fmt(m.amount ?? 0)}
					</span>
				</p>
			{/if}
			<ol class="mb-4 space-y-2">
				{#each m.levels as l (l.key)}
					<li
						class="rounded border p-2 {l.reached
							? 'border-green-600/50'
							: l.next
								? 'border-amber-500'
								: 'border-gray-300/60 opacity-75'}"
					>
						<div class="flex flex-wrap items-baseline gap-x-3">
							<span class="font-semibold">{`${l.level}. ${l.name}`}</span>
							{#if l.reached}<span class="text-xs text-green-700">reached</span>{/if}
							{#if l.required}
								<span class="text-xs text-gray-500">
									{`needs ${fmt(l.required)} ${m.currency?.replace(/_/g, ' ') ?? ''}`}
								</span>
							{/if}
						</div>
						{#if l.requirements.length && !l.reached}
							<ul class="mt-1 list-disc pl-5 text-xs">
								{#each l.requirements as r, i (i)}<li>{r}</li>{/each}
							</ul>
						{/if}
						{#if l.perks.length}
							<p class="mt-1 text-xs opacity-75">{`Gives: ${l.perks.join(', ')}`}</p>
						{/if}
					</li>
				{/each}
			</ol>
			{#if m.objectives.length}
				<h3 class="mb-1 font-semibold">Objectives</h3>
				<ul class="space-y-1 text-sm">
					{#each m.objectives as o (o.key)}
						<li title={o.description ?? undefined}>
							{o.name}
							{#if o.recurring}<span class="text-xs text-gray-500">(recurring)</span>{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</Panel>
	{:else}
		<p class="mb-3 text-sm text-gray-500">Nothing to show yet: {data.why}.</p>
		{#if data.choices.length}
			<Panel title="Ambitions this empire could take" note="each is an ascension perk">
				<ul class="space-y-2 text-sm">
					{#each data.choices as c (c.key)}
						<li class={c.why ? 'opacity-50' : ''} title={c.why ?? undefined}>
							<span class="font-semibold">{c.name}</span>
							<span class="text-gray-500">{` · perk ${c.perk}`}</span>
							{#if c.description}<p class="text-xs opacity-75">{c.description}</p>{/if}
						</li>
					{/each}
				</ul>
			</Panel>
		{/if}
	{/if}

	{#if data.othersShown}
		<h2 class="mt-6 mb-2 text-lg font-semibold">
			{data.tellAll
				? 'Every other empire’s ambition (cheat)'
				: 'Ambitions the game gave away (spoiler)'}
		</h2>
		{#if data.others.length}
			<ul class="space-y-1 text-sm">
				{#each data.others as o (o.id)}
					<li>
						<span class="font-semibold">{o.name}</span>
						{`: ${o.path}`}
						{#if o.level !== null}<span class="text-gray-500">{` · level ${o.level}`}</span>{/if}
						{#if o.shownAs}<span class="text-xs text-gray-500">
								{` · shown as “${o.shownAs}”`}
							</span>{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-gray-500">None.</p>
		{/if}
	{/if}
{/if}
