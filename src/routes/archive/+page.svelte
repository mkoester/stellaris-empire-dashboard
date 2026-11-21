<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { RARITY_TONE } from '#lib/archive.ts';
	import { followGame } from '#lib/live.ts';
	import { formatModifierValue, modifierColor, modifierLabel } from '#lib/modifiers.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import ResourceChips from '#lib/ResourceChips.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	type Line = (typeof data.total)[number];
	type Gives = { bonuses: Omit<Line, 'sources'>[]; produces: Record<string, number> };

	const multNote = (m: number) => `${data.multExact ? '' : '≈ '}×${m.toFixed(2)}`;

	// another empire's archive (cheat), staying on the branch shown
	const show = (id: string) => {
		const node = data.isHead ? null : data.tip;
		return goto(
			id
				? node === null
					? resolve(`/archive?empire=${id}`)
					: resolve(`/archive?empire=${id}&node=${node}`)
				: node === null
					? resolve('/archive')
					: resolve(`/archive?node=${node}`)
		);
	};
</script>

{#snippet bonusList(lines: Line[])}
	<ul class="space-y-0.5 text-sm">
		{#each lines as b (`${b.key}|${b.condition}`)}
			<li
				class="flex flex-wrap items-baseline gap-x-1.5"
				class:opacity-60={b.applies === null}
				title={b.applies === null
					? `only if ${b.condition} — the save does not tell`
					: b.condition
						? `applies: ${b.condition}`
						: ''}
			>
				<span class="font-mono font-semibold {modifierColor(b)}">{formatModifierValue(b)}</span>
				<span>{modifierLabel(b)}{b.applies === null ? ' (?)' : ''}</span>
				<span class="text-xs text-gray-500">{b.sources.join(', ')}</span>
			</li>
		{/each}
	</ul>
{/snippet}

<!-- what one specimen gives once exhibited and active; grey while it gives nothing -->
{#snippet gives(g: Gives, on: boolean)}
	{#if g.bonuses.length || Object.keys(g.produces).length}
		<div
			class="flex flex-wrap items-baseline gap-x-2 pl-5 text-xs"
			class:text-gray-400={!on}
			class:grayscale={!on}
		>
			{#each g.bonuses as b (`${b.key}|${b.condition}`)}
				<span
					class:opacity-60={b.applies === null}
					title={b.applies === null ? `only if ${b.condition} — the save does not tell` : ''}
				>
					<span class="font-mono font-semibold {on ? modifierColor(b) : ''}"
						>{formatModifierValue(b)}</span
					>
					{modifierLabel(b)}{b.applies === null ? ' (?)' : ''}
				</span>
			{/each}
			{#if Object.keys(g.produces).length}
				<span class:opacity-60={!on}><ResourceChips flows={g.produces} sign={1} /> a month</span>
			{/if}
		</div>
	{/if}
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<div class="flex flex-1 flex-wrap items-baseline gap-x-4">
		<h1 class="text-2xl font-bold">Grand Archive</h1>
		{#if data.others.length}
			<select
				class="rounded border border-gray-300 bg-transparent text-sm"
				value={data.shownId === null ? '' : String(data.shownId)}
				onchange={(e) => show(e.currentTarget.value)}
				aria-label="whose archive"
				title="cheat: another empire's archive"
			>
				<option value="">ours</option>
				{#each data.others as o (o.id)}<option value={String(o.id)}>{o.name}</option>{/each}
			</select>
		{/if}
	</div>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if data.noData}
	<p class="text-sm text-gray-500">
		The game data has no specimens: it comes from an older extractor. Restart the dashboard to
		extract it again.
	</p>
{:else if !data.seenAt}
	<p class="text-sm text-gray-500">No save read since this tab exists.</p>
{:else}
	{#if !data.multExact}
		<p class="mb-3 text-sm text-gray-500">
			≈ Each exhibition's output (×) counts no Specimens Output bonus: the save holds them only with
			companion mod 0.15.0 or later.
		</p>
	{/if}
	<div class="mb-6 grid gap-6 lg:grid-cols-3">
		{#each data.categories as c (c.key)}
			<Panel
				title={c.name}
				note={`${c.exhibits.length} of ${data.perCategory} exhibits · output ${multNote(c.mult)}`}
			>
				<ol class="mb-3 space-y-0.5 text-sm">
					{#each c.exhibits as e (e.id)}
						<li
							title={e.active
								? `exhibited, active${e.added ? ` — collected ${e.added}` : ''}`
								: 'not active: its bonuses do not apply until the exhibit is activated'}
						>
							<div class="flex items-baseline gap-2">
								<span class="w-3 text-center" class:text-gray-400={!e.active}
									>{e.active ? '●' : '○'}</span
								>
								<span
									class="flex-1 {e.rarity ? (RARITY_TONE[e.rarity] ?? '') : ''}"
									title={e.rarity ?? ''}>{e.name}</span
								>
							</div>
							{@render gives(e, e.active)}
						</li>
					{/each}
					{#each Array.from({ length: Math.max(0, data.perCategory - c.exhibits.length) }, (_, i) => i) as i (i)}
						<li class="flex gap-2 text-gray-400"><span class="w-3 text-center">·</span>empty</li>
					{/each}
				</ol>
				{#if c.bonuses.length}
					{@render bonusList(c.bonuses)}
				{:else if !Object.keys(c.produces).length}
					<p class="text-sm text-gray-500">
						{c.exhibits.some((e) => e.active)
							? 'No bonus for this empire.'
							: 'No active exhibit: no bonus.'}
					</p>
				{/if}
				{#if Object.keys(c.produces).length}
					<div class="mt-1 text-sm"><ResourceChips flows={c.produces} sign={1} /> a month</div>
				{/if}
			</Panel>
		{/each}
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<Panel
			title="What the archive gives"
			note="Every active exhibit, summed. Greyed with (?): applies only to some empires, and the save does not tell whether to this one."
		>
			{#if data.total.length}
				{@render bonusList(data.total)}
			{:else}
				<p class="text-sm text-gray-500">Nothing yet.</p>
			{/if}
			{#if Object.keys(data.totalProduces).length}
				<div class="mt-1 text-sm">
					<ResourceChips flows={data.totalProduces} sign={1} /> a month
				</div>
			{/if}
		</Panel>
		<Panel
			title="Storage"
			note={`${data.storage.length} of ${data.storageSlots} slots: stored specimens give nothing`}
		>
			{#if data.storage.length}
				<ul class="space-y-0.5 text-sm">
					{#each data.storage as e (e.id)}
						<li>
							<div class="flex items-baseline gap-2">
								<span
									class="flex-1 {e.rarity ? (RARITY_TONE[e.rarity] ?? '') : ''}"
									title={e.rarity ?? ''}>{e.name}</span
								>
								<span class="text-xs text-gray-500">{e.category ?? ''}</span>
							</div>
							{@render gives(e, false)}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-gray-500">Empty.</p>
			{/if}
		</Panel>
	</div>
{/if}
