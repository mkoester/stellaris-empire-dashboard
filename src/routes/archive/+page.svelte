<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { givesKinds, RARITY_TONE } from '#lib/archive.ts';
	import { followGame } from '#lib/live.ts';
	import {
		formatModifierValue,
		modifierColor,
		modifierLabel,
		modifierTint
	} from '#lib/modifiers.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import ResourceChips from '#lib/ResourceChips.svelte';
	import SpecimenFilter from '#lib/SpecimenFilter.svelte';
	import SpecimenGives from '#lib/SpecimenGives.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	type Line = (typeof data.total)[number];

	// the bonus filter: exhibits that do not match fade (the exhibition keeps its shape), stored
	// specimens that do not match are left out
	let kinds: string[] = $state([]);
	type Gives = Parameters<typeof givesKinds>[0];
	const matches = (g: Gives) => !kinds.length || givesKinds(g).some((k) => kinds.includes(k));
	const presentKinds = $derived([
		...new Set(
			[...data.categories.flatMap((c) => c.exhibits), ...data.storage].flatMap((e) => givesKinds(e))
		)
	]);
	const stored = $derived(data.storage.filter(matches));
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
				<span style:color={modifierTint(b.key)}>
					{modifierLabel(b)}{b.applies === null ? ' (?)' : ''}
				</span>
				<span class="text-xs text-gray-500">{b.sources.join(', ')}</span>
			</li>
		{/each}
	</ul>
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
	<SpecimenFilter kinds={data.bonusKinds} present={presentKinds} bind:selected={kinds} />
	<div class="mb-6 grid gap-6 lg:grid-cols-3">
		{#each data.categories as c (c.key)}
			<Panel
				title={c.name}
				note={`${c.exhibits.length} of ${data.perCategory} exhibits · output ${multNote(c.mult)}`}
			>
				<ol class="mb-3 space-y-0.5 text-sm">
					{#each c.exhibits as e (e.id)}
						<li
							class:opacity-30={!matches(e)}
							title={e.active
								? `exhibited, active${e.added ? ` — collected ${e.added}` : ''}`
								: 'not active: its bonuses do not apply until the exhibit is activated'}
						>
							<div class="flex items-baseline gap-2">
								<span class="w-3 text-center" class:text-gray-400={!e.active}>
									{e.active ? '●' : '○'}
								</span>
								<span
									class="flex-1 {e.rarity ? (RARITY_TONE[e.rarity] ?? '') : ''}"
									title={e.rarity ?? ''}
								>
									{e.name}
								</span>
							</div>
							<div class="pl-5 text-xs">
								<SpecimenGives bonuses={e.bonuses} produces={e.produces} on={e.active} />
							</div>
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
			{#if stored.length}
				<ul class="space-y-0.5 text-sm">
					{#each stored as e (e.id)}
						<li>
							<div class="flex items-baseline gap-2">
								<span
									class="flex-1 {e.rarity ? (RARITY_TONE[e.rarity] ?? '') : ''}"
									title={e.rarity ?? ''}
								>
									{e.name}
								</span>
								<span class="text-xs text-gray-500">{e.category ?? ''}</span>
							</div>
							<div class="text-xs">
								<SpecimenGives bonuses={e.bonuses} produces={e.produces} on={false} />
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-gray-500">
					{data.storage.length ? 'None with that bonus.' : 'Empty.'}
				</p>
			{/if}
		</Panel>
	</div>
{/if}
