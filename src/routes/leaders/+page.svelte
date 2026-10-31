<script lang="ts">
	import { colorOf } from '#lib/colors.ts';
	import { pretty } from '#lib/format.ts';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { LEADER_CLASSES, leaderOrder, type Bonus } from '#lib/leaders.ts';
	import { followGame } from '#lib/live.ts';
	import { formatModifierValue, modifierColor, modifierLabel } from '#lib/modifiers.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import type { PoolLeader } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// per viewer, not stored: which classes both tables show — none picked: all three (envoys
	// apart, behind their own switch)
	let classes = $state<string[]>([]);
	let envoys = $state(false);
	const shown = (cls: string) =>
		cls === 'envoy' ? envoys : classes.length === 0 || classes.includes(cls);
	const toggle = (c: string) =>
		(classes = classes.includes(c) ? classes.filter((x) => x !== c) : [...classes, c]);
	const hired = (c: string) => data.leaders.filter((l) => l.class === c).length;
	const recruitable = (c: string) => data.pool.filter((l) => l.class === c).length;

	type Leader = (typeof data.leaders)[number];
	// the ruler first, then by level, ties officials, scientists, commanders; a header re-sorts
	const rows = $derived(data.leaders.filter((l) => shown(l.class)).sort(leaderOrder));
	const poolRows = $derived(data.pool.filter((l) => shown(l.class)).sort(leaderOrder));

	const roleLabel = (r: Leader['roles'][number]) =>
		`${r.kind}${r.name ? `: ${r.name}` : ''}${r.level !== null ? ` (${r.level})` : ''}`;

	const columns: Column<Leader>[] = [
		{ id: 'name', label: 'Leader', value: (r) => r.name, cell: name },
		{ id: 'class', label: 'Class', value: (r) => r.class, cell: cls },
		{
			id: 'level',
			label: 'Level',
			value: (r) => r.level,
			right: true,
			cell: level,
			title: 'its level, + its own extra levels where it has any'
		},
		{
			id: 'roles',
			label: 'Holds (acting level)',
			value: (r) =>
				r.roles
					.filter((x) => x.active)
					.map(roleLabel)
					.join(', ') || null,
			cell: roles,
			title:
				'the rule, a council seat, a colony, a fleet or science ship; in brackets the level it acts at there — a councilor with the country’s councilor bonus'
		},
		{
			id: 'bonuses',
			label: 'Gives (dimmed: if assigned)',
			value: (r) =>
				r.roles.filter((x) => x.active).reduce((n, x) => n + x.bonuses.length, 0) + r.self.length,
			cell: bonuses,
			title:
				'what each role gives now: a seat’s modifiers at the councilor level, the traits’ in that role; triggered trait effects are not known'
		},
		{ id: 'age', label: 'Age', value: (r) => r.age, right: true },
		{ id: 'species', label: 'Species', value: (r) => r.species },
		{ id: 'traits', label: 'Traits', value: (r) => r.traits.length, cell: traits }
	];
	const poolColumns: Column<PoolLeader>[] = [
		{ id: 'name', label: 'Leader', value: (r) => r.name ?? null, cell: name },
		{ id: 'class', label: 'Class', value: (r) => r.class, cell: cls },
		{ id: 'level', label: 'Level', value: (r) => r.level ?? null, right: true, cell: level },
		{ id: 'age', label: 'Age', value: (r) => r.age ?? null, right: true },
		{ id: 'species', label: 'Species', value: (r) => r.species ?? null },
		{ id: 'traits', label: 'Traits', value: (r) => r.traits?.length ?? 0, cell: traits }
	];
</script>

{#snippet name(r: { name?: string; class: string })}
	<b class="border-l-4 pl-1" style:border-color={colorOf(`class-${r.class}`)}>{r.name ?? '?'}</b>
{/snippet}
{#snippet cls(r: { class: string })}
	<span class="rounded px-1 text-xs text-white" style:background={colorOf(`class-${r.class}`)}
		>{r.class}</span
	>
{/snippet}
{#snippet level(r: { level?: number; bonus?: number })}
	{r.level ?? '–'}{#if r.bonus}<span class="text-gray-500"> +{r.bonus}</span>{/if}
{/snippet}
{#snippet roles(r: Leader)}
	{#each r.roles.filter((x) => x.active) as x, i (i)}<div class="whitespace-nowrap">
			{roleLabel(x)}
		</div>{:else}<span class="text-gray-500">–</span>{/each}
{/snippet}
{#snippet bonusList(list: Bonus[])}
	{#each list as b, i (i)}<div class="text-xs">
			<span class="text-gray-500">{b.source}:</span>
			{#each b.modifiers as m, j (j)}{j ? ', ' : ''}<span class={modifierColor(m)}
					>{formatModifierValue(m)}</span
				>
				{modifierLabel(m)}{/each}
		</div>{/each}
{/snippet}
{#snippet bonuses(r: Leader)}
	<!-- every role its class can hold; those it does not, dimmed: what it would do there -->
	{#each r.roles as x, i (i)}<div
			class="mb-1 {x.active ? '' : 'opacity-50'}"
			title={x.active ? undefined : `not held: what it would give as ${x.kind}`}
		>
			<div class="text-xs font-semibold">
				{x.kind}{x.level !== null ? ` (${x.level})` : ''}{x.active ? '' : ' — if assigned'}
			</div>
			{#if x.bonuses.length}{@render bonusList(x.bonuses)}{:else}<div class="text-xs text-gray-500">
					{x.kind === 'council' && !x.active
						? 'its seat’s modifiers per level; no trait of its own there'
						: 'no trait effect known there'}
				</div>{/if}
		</div>{/each}
	{#if r.self.length}<div>
			<div class="text-xs font-semibold">itself</div>
			{@render bonusList(r.self)}
		</div>{/if}
{/snippet}
{#snippet traits(r: { traits?: string[] })}
	{#each r.traits ?? [] as t, i (t)}{i ? ' · ' : ''}<InfoPopup
			explanation={data.explain[`ltrait:${t}`]}
			>{data.explain[`ltrait:${t}`]?.title ?? pretty(t.replace(/^(leader_)?trait_/, ''))}</InfoPopup
		>{/each}
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Leaders</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if data.leaders.length}
	<div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
		<span class="text-gray-500" title="none ticked: all three">only</span>
		{#each LEADER_CLASSES as c (c)}
			<label class="flex items-center gap-1"
				><input type="checkbox" checked={classes.includes(c)} onchange={() => toggle(c)} />
				<span class="rounded px-1 text-xs text-white" style:background={colorOf(`class-${c}`)}
					>{c}</span
				>
				<span
					class={data.limits && hired(c) > data.limits[c] ? 'text-amber-600' : 'text-gray-500'}
					title="hired / limit — a soft one: more cost more upkeep"
					>{hired(c)}{data.limits ? ` / ${data.limits[c]}` : ''}</span
				></label
			>
		{/each}
		<label class="flex items-center gap-1"
			><input type="checkbox" bind:checked={envoys} /> envoys
			<span class="text-gray-500">{hired('envoy')}</span></label
		>
	</div>
	<SortTable {rows} {columns} key={(r) => r.id} sort={{ column: '', desc: false }} />

	<h2 class="mt-6 mb-2 text-lg font-semibold">
		Recruitable{#if data.poolKnown}<span class="ml-2 text-sm font-normal text-gray-500"
				>{LEADER_CLASSES.map((c) => `${recruitable(c)} ${c}s`).join(' · ')}</span
			>{/if}
	</h2>
	{#if !data.poolKnown}
		<p class="text-sm text-amber-600">Not read from this save yet; it fills after the next one.</p>
	{:else if poolRows.length}
		<SortTable
			rows={poolRows}
			columns={poolColumns}
			key={(r) => r.id}
			sort={{ column: '', desc: false }}
		/>
	{:else}
		<p class="text-sm text-gray-500">None of the classes shown.</p>
	{/if}
{:else}
	<p class="text-sm text-amber-600">
		No save read since this tab exists; it fills after the next one.
	</p>
{/if}
