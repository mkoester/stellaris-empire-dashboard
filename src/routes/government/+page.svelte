<script lang="ts">
	import { pretty } from '#lib/format.ts';
	import type { AgendaRow, EdictRow, FactionRow } from '#lib/government.ts';
	import { colorOf } from '#lib/colors.ts';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { formatModifierValue, modifierColor, modifierLabel } from '#lib/modifiers.ts';
	import { followGame } from '#lib/live.ts';
	import Government from '#lib/panels/Government.svelte';
	import Panel from '#lib/panels/Panel.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import { describe } from '#lib/triggers.ts';
	import type { Modifier, Resources } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// the profile's display switch (⚙): what the game does not list
	const showLocked = $derived(data.showLocked);
	let edictSort = $state({ column: 'name', desc: false });
	let agendaSort = $state({ column: 'status', desc: false });

	const STATUS: Record<AgendaRow['status'], [number, string]> = {
		current: [0, 'being prepared'],
		open: [1, 'open'],
		maybe: [2, 'open? the save cannot tell all conditions'],
		cooldown: [3, 'on cooldown'],
		'not-allowed': [4, 'not allowed now'],
		locked: [5, 'locked: needs a tradition or perk']
	};
	const agendas = $derived(
		data.agendas.filter((a) => showLocked || (a.status !== 'locked' && a.status !== 'not-allowed'))
	);
	const activeEdicts = $derived(data.edicts.filter((e) => e.active));
	// as the game lists them: possible and unlocked; the rest with "show locked"
	const otherEdicts = $derived(
		data.edicts.filter((e) => !e.active && (showLocked || (e.unlocked && e.possible === true)))
	);
	// a policy in two categories (War Philosophy: diplomacy, military) shows in both, as in game
	const inCategory = (p: { category: string | null }) => (p.category ?? '').split(',');
	const categories = $derived([...new Set(data.policies.flatMap(inCategory))]);

	const resources = (r: Resources | undefined) =>
		Object.entries(r ?? {})
			.map(([k, v]) => `${v} ${pretty(k)}`)
			.join(', ');
	const length = (days: number | null) =>
		days === null ? null : days === -1 ? 'perpetual' : `${Math.round(days / 30)} months`;
	const effect = (v: number | null) =>
		v === null || Math.abs(v) < 0.01 ? null : `${v > 0 ? '+' : ''}${v}`;
	const mark = (v: boolean | null) => (v === null ? '?' : v ? '✓' : '✗');

	const agendaColumns: Column<AgendaRow>[] = [
		{ id: 'name', label: 'Agenda', value: (r) => r.name, cell: agendaName },
		{
			id: 'cost',
			label: 'Cost',
			value: (r) => r.cost,
			right: true,
			cell: agendaCost,
			title: 'base agenda progress; the one being prepared: progress / cost at your empire size'
		},
		{ id: 'status', label: 'Status', value: (r) => STATUS[r.status][0], cell: agendaStatus },
		{
			id: 'preparing',
			label: 'While preparing',
			value: (r) => data.explain[`agenda:${r.key}`]?.modifiers.length ?? 0,
			cell: agendaNow,
			title: "the agenda's modifier, active while it is being enacted"
		},
		{
			id: 'launched',
			label: 'Once launched',
			value: (r) => data.explain[`agenda:${r.key}`]?.after?.modifiers.length ?? 0,
			cell: agendaAfter,
			title: 'its launch effect, and the modifier it leaves for a while'
		}
	];
	const edictColumns: Column<EdictRow>[] = [
		{ id: 'name', label: 'Edict', value: (r) => r.name, cell: edictName },
		{ id: 'category', label: 'Kind', value: (r) => pretty(r.category ?? '') },
		{
			id: 'cost',
			label: 'Cost',
			value: (r) => resources(r.cost.cost),
			cell: cost,
			title: 'base, once'
		},
		{
			id: 'upkeep',
			label: 'Upkeep',
			value: (r) => resources(r.cost.upkeep),
			cell: upkeep,
			title: 'base, monthly'
		},
		{ id: 'length', label: 'Length', value: (r) => r.length, cell: edictLength },
		{
			id: 'since',
			label: 'Since',
			value: (r) => r.active?.start ?? null,
			title: 'active edicts: started; ends where it is not perpetual'
		},
		{
			id: 'effects',
			label: 'Effects',
			value: (r) => data.explain[`edict:${r.key}`]?.modifiers.length ?? 0,
			cell: edictEffects
		}
	];
</script>

{#snippet classes(list: string[])}
	{#each list as k (k)}<span
			class="mr-1 rounded px-1 text-xs text-white"
			style:background={colorOf(`class-${k}`)}
			title="takes a {k}">{k}</span
		>{/each}
{/snippet}
{#snippet mods(list: Modifier[])}
	{#each list as m (m.key)}<div>
			<span class={modifierColor(m)}>{formatModifierValue(m)}</span>
			{modifierLabel(m)}
		</div>{/each}
{/snippet}
{#snippet agendaNow(r: AgendaRow)}{@render mods(
		data.explain[`agenda:${r.key}`]?.modifiers ?? []
	)}{/snippet}
{#snippet agendaAfter(r: AgendaRow)}
	{@const e = data.explain[`agenda:${r.key}`]}
	{#if e?.text}<div class="max-w-md text-gray-500">{e.text}</div>{/if}
	{#if e?.after}<div class="text-xs text-gray-500">{e.after.label}:</div>
		{@render mods(e.after.modifiers)}{/if}
{/snippet}
{#snippet edictEffects(r: EdictRow)}
	{@const e = data.explain[`edict:${r.key}`]}
	{@render mods(e?.modifiers ?? [])}
	{#if e?.text}<div class="max-w-md text-gray-500">{e.text}</div>{/if}
{/snippet}
{#snippet agendaName(r: AgendaRow)}
	<InfoPopup explanation={data.explain[`agenda:${r.key}`]}>{r.name}</InfoPopup>
{/snippet}
{#snippet agendaCost(r: AgendaRow)}
	{#if r.status === 'current' && data.agenda}{Math.round(data.agenda.progress).toLocaleString('en')}
		<div class="text-gray-500">
			/ {Math.round(data.agendaDue?.total ?? r.cost ?? 0).toLocaleString('en')}
		</div>{:else}{r.cost?.toLocaleString('en') ?? '–'}{/if}
{/snippet}
{#snippet agendaStatus(r: AgendaRow)}
	<span
		class={r.status === 'current' ? 'font-semibold' : r.status === 'locked' ? 'text-gray-500' : ''}
		>{STATUS[r.status][1]}</span
	>
	{#if r.status === 'current' && data.agenda && data.agendaDue?.total}<div
			class="text-xs whitespace-nowrap text-gray-500"
		>
			{Math.floor((data.agenda.progress / data.agendaDue.total) * 100)}% · {data.agendaDue.months}
			months{data.agendaDue.exact ? '' : ' (est.)'}
		</div>{/if}
	{#if r.launch}<div class="text-xs whitespace-nowrap text-gray-500">
			{#if r.launch.launched}<div>launched {r.launch.launched}</div>{/if}
			{#if r.launch.effectUntil}<div>effect until {r.launch.effectUntil}</div>{/if}
			<div>available again {r.launch.availableAgain}</div>
		</div>{/if}
{/snippet}
{#snippet amounts(r: Resources | undefined)}
	{#each Object.entries(r ?? {}) as [k, v], i (k)}{i ? ', ' : ''}<span
			class="whitespace-nowrap"
			style:color={colorOf(k)}>{v} {pretty(k)}</span
		>{/each}
{/snippet}
{#snippet cost(r: EdictRow)}{@render amounts(r.cost.cost)}{/snippet}
{#snippet upkeep(r: EdictRow)}{@render amounts(r.cost.upkeep)}{/snippet}
{#snippet edictName(r: EdictRow)}
	<InfoPopup explanation={data.explain[`edict:${r.key}`]}>{r.name}</InfoPopup>{#if !r.unlocked}<span
			class="text-gray-500"
			title={r.needs.length
				? `needs ${r.needs.map((t) => data.techNames[t] ?? t).join(', ')}`
				: 'needs a tradition or perk first'}
		>
			🔒</span
		>{/if}
{/snippet}
{#snippet edictLength(r: EdictRow)}
	{length(r.length) ?? '–'}{#if r.active?.end}<span class="text-gray-500">
			until {r.active.end}</span
		>{/if}
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Government</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !data.complete}
	<p class="mb-4 max-w-3xl text-sm text-amber-600">
		The save of {data.seenAt} was read before this tab existed: council, policy flags and edict dates
		show after the next save.
	</p>
{/if}

<p class="mb-4 text-sm text-gray-500">
	{showLocked
		? 'Showing locked agendas, edicts and policies too.'
		: 'As the game lists them; locked agendas, edicts and policies show with the switch in ⚙.'}
</p>

<div class="grid gap-8 lg:grid-cols-2">
	<Government government={data.government} explain={data.explain} />

	<Panel
		title="Council"
		note="The ruler and the seats held, each with its leader and what it gives at the leader's level (the game multiplies a seat's modifiers by it). Hover a seat for its description."
	>
		<table class="mb-3 text-left text-sm">
			<tbody>
				{#each data.seats as c (c.key)}
					<tr class="border-b border-gray-100 align-top dark:border-gray-900">
						<th class="p-1 pr-3 font-normal whitespace-nowrap"
							><InfoPopup explanation={data.explain[`seat:${c.key}`]}>{c.name}</InfoPopup>
							<div>{@render classes(c.classes)}</div></th
						>
						<td class="p-1 whitespace-nowrap"
							>{c.leader ?? 'empty'}{#if c.level !== null}<div class="text-gray-500">
									level {c.level}{#if c.council !== null && c.council !== c.level}, council level <b
											class="text-current">{c.council}</b
										>{/if}
								</div>{/if}</td
						>
						<td class="p-1">
							{#each c.effects as e (e.perLevel.key)}
								<div>
									<span class={modifierColor(e.perLevel)}>{formatModifierValue(e.perLevel)}</span>
									{modifierLabel(e.perLevel)}
									<span class="text-gray-500">per level</span>{#if c.council !== null}
										(<span class={modifierColor(e.now)}>{formatModifierValue(e.now)}</span>){/if}
								</div>
							{:else}{#if data.explain[`seat:${c.key}`]?.text}<span class="text-gray-500"
										>{data.explain[`seat:${c.key}`]?.text}</span
									>{/if}{/each}
							{#each c.traitEffects as t (t.trait)}
								<div class="text-gray-500">
									<InfoPopup explanation={data.explain[`ltrait:${t.trait}`]}>{t.name}</InfoPopup>:
									{#each t.modifiers as m, i (m.key)}{i ? ', ' : ''}<span class={modifierColor(m)}
											>{formatModifierValue(m)}</span
										>
										{modifierLabel(m)}{/each}
								</div>
							{/each}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if data.councilSlots !== null}
			<p class="mb-1 text-sm text-gray-500">
				Seats unlocked: {data.councilSlots}, held: {data.seats.filter((c) => !c.ruler).length} (the ruler's
				apart). Expand The Council adds one.
			</p>
		{/if}
		<p class="mb-1 text-sm text-gray-500">
			Council level = the leader's level + its own extra levels + the empire's councilor bonus{#if data.councilBonus.length}
				({data.councilBonus
					.map((b) => `${b.value > 0 ? '+' : ''}${b.value} ${b.name}`)
					.join(', ')}){:else}
				(none now){/if}.
		</p>
		{#if data.possibleSeats.length}
			<div class="mb-3 text-sm">
				Possible:
				{#each data.possibleSeats as p (p.key)}
					<div class="ml-2">
						<InfoPopup explanation={data.explain[`seat:${p.key}`]}>{p.name}</InfoPopup>{p.civic
							? ' (civic)'
							: ''}{p.possible === null ? '?' : ''}
						{@render classes(p.classes)}
					</div>
				{/each}
			</div>
		{/if}
		{#if data.agenda}
			<div class="text-sm">
				Agenda:
				<InfoPopup explanation={data.explain[`agenda:${data.agenda.key}`]}
					><b
						>{data.agendas.find((a) => a.key === data.agenda?.key)?.name ??
							pretty(data.agenda.key)}</b
					></InfoPopup
				>
				— {Math.round(data.agenda.progress).toLocaleString('en')}{#if data.agendaDue?.total}
					of {Math.round(data.agendaDue.total).toLocaleString('en')}{/if}
				{#if data.agendaDue}, due {data.agendaDue.date}{data.agendaDue.exact ? '' : ' (est.)'}{/if}
			</div>
		{:else}
			<p class="text-sm text-gray-500">No agenda being prepared.</p>
		{/if}
	</Panel>

	<!-- full width: its effect columns need the room -->
	<div class="lg:col-span-2">
		<Panel
			title="Council agendas"
			note="Only agendas this empire can have. Open: every condition met; open?: met as far as the save tells; not allowed now: a condition fails; locked: none of the traditions or perks that unlock it taken. The last two show with the “show locked” switch in ⚙."
		>
			<SortTable rows={agendas} columns={agendaColumns} key={(r) => r.key} bind:sort={agendaSort} />
		</Panel>
	</div>

	<Panel
		title="Policies"
		note="The options this empire can have; bold is selected, struck through cannot be picked now, ? cannot be told from the save. Hover for effects."
	>
		<div class="flex flex-col gap-3 text-sm">
			{#each categories as cat (cat)}
				<div>
					<h3 class="mb-1 font-semibold text-gray-500">{pretty(cat)}</h3>
					<table class="text-left">
						<tbody>
							{#each data.policies.filter((p) => inCategory(p).includes(cat)) as p (p.key)}
								<tr class="align-top">
									<th class="pr-3 pb-1 font-normal whitespace-nowrap">{p.name}</th>
									<td class="pb-1">
										{#each p.options as o, i (o.key)}{i ? ' · ' : ''}<span
												class={o.selected
													? 'font-semibold'
													: o.valid === false
														? 'text-gray-500 line-through'
														: ''}
												><InfoPopup explanation={data.explain[`policy:${o.key}`]}
													>{o.name}</InfoPopup
												>{o.valid === null && !o.selected ? '?' : ''}</span
											>{/each}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/each}
		</div>
	</Panel>

	<Panel title="Edicts" note="Costs are base values, before multipliers.">
		<h3 class="mb-1 font-semibold">Active ({activeEdicts.length})</h3>
		{#if activeEdicts.length}
			<div class="mb-4">
				<SortTable
					rows={activeEdicts}
					columns={edictColumns}
					key={(r) => r.key}
					bind:sort={edictSort}
				/>
			</div>
		{:else}<p class="mb-4 text-sm text-gray-500">None.</p>{/if}
		<h3 class="mb-1 font-semibold">Available ({otherEdicts.length})</h3>
		<SortTable
			rows={otherEdicts}
			columns={edictColumns.filter((c) => c.id !== 'since')}
			key={(r) => r.key}
			bind:sort={edictSort}
		/>
	</Panel>
</div>

<div class="mt-8">
	<Panel
		title="Factions"
		note={data.factionTypes
			? 'No faction has formed yet. The faction types the switches in ⚙ show, with what each demands — ✓ met, ✗ not, ? cannot be told from the save — and how to meet it.'
			: 'No faction has formed yet. The faction types and their demands show with the switches in ⚙ (cheating).'}
	>
		<div class="grid gap-6 lg:grid-cols-2">
			{#each data.factions as f (f.key)}
				{@render faction(f)}
			{/each}
		</div>
	</Panel>
</div>

{#snippet faction(f: FactionRow)}
	<section class="text-sm">
		<h3 class="text-base font-semibold">
			{f.name}
			<span class="font-normal text-gray-500"
				>{f.ethic ? pretty(f.ethic.replace(/^ethic_/, '')) : ''}</span
			>
		</h3>
		{#if f.description}<p class="mb-1 text-gray-500">{f.description}</p>{/if}
		<table class="text-left">
			<tbody>
				{#each f.demands as d, i (i)}
					<tr class="border-b border-gray-100 align-top dark:border-gray-900">
						<td class="w-5 p-1">{mark(d.met)}</td>
						<td class="p-1">
							<b>{d.met === false && d.unfulfilledTitle ? d.unfulfilledTitle : d.title}</b>
							{#if effect(d.fulfilled)}<span class="text-green-700 dark:text-green-500">
									{effect(d.fulfilled)} if met</span
								>{/if}
							{#if effect(d.unfulfilled)}<span class="text-red-600">
									{effect(d.unfulfilled)} if not</span
								>{/if}
							{#if d.description}<div class="text-gray-500">{d.description}</div>{/if}
							<div class="text-xs text-gray-500">how: {describe(d.trigger)}</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/snippet}
