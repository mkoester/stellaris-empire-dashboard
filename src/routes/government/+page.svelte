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
	import type { Resources } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	let showLocked = $state(false);
	let edictSort = $state({ column: 'name', desc: false });
	let agendaSort = $state({ column: 'status', desc: false });
	let otherFactions = $state(false);

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
	const otherEdicts = $derived(data.edicts.filter((e) => !e.active && (showLocked || e.unlocked)));
	const categories = $derived([...new Set(data.policies.map((p) => p.category ?? ''))]);
	const shownFactions = $derived(data.factions.filter((f) => otherFactions || f.ours));

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
		{ id: 'cost', label: 'Cost', value: (r) => r.cost, right: true, title: 'base agenda progress' },
		{ id: 'status', label: 'Status', value: (r) => STATUS[r.status][0], cell: agendaStatus }
	];
	const edictColumns: Column<EdictRow>[] = [
		{ id: 'name', label: 'Edict', value: (r) => r.name, cell: edictName },
		{ id: 'category', label: 'Kind', value: (r) => pretty(r.category ?? '') },
		{ id: 'cost', label: 'Cost', value: (r) => resources(r.cost.cost), title: 'base, once' },
		{
			id: 'upkeep',
			label: 'Upkeep',
			value: (r) => resources(r.cost.upkeep),
			title: 'base, monthly'
		},
		{ id: 'length', label: 'Length', value: (r) => r.length, cell: edictLength },
		{
			id: 'since',
			label: 'Since',
			value: (r) => r.active?.start ?? null,
			title: 'active edicts: started; ends where it is not perpetual'
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
{#snippet agendaName(r: AgendaRow)}
	<InfoPopup explanation={data.explain[`agenda:${r.key}`]}>{r.name}</InfoPopup>
{/snippet}
{#snippet agendaStatus(r: AgendaRow)}
	<span
		class={r.status === 'current' ? 'font-semibold' : r.status === 'locked' ? 'text-gray-500' : ''}
		>{STATUS[r.status][1]}</span
	>
{/snippet}
{#snippet edictName(r: EdictRow)}
	<InfoPopup explanation={data.explain[`edict:${r.key}`]}>{r.name}</InfoPopup>{#if !r.unlocked}<span
			class="text-gray-500"
			title="needs a tradition or perk first"
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

<div class="mb-4 flex flex-wrap items-center gap-4 text-sm">
	<label class="flex items-center gap-1"
		><input type="checkbox" bind:checked={showLocked} /> show locked agendas and edicts</label
	>
</div>

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

	<Panel
		title="Council agendas"
		note="Only agendas this empire can have. Open: every condition met; open?: met as far as the save tells; not allowed now: a condition fails; locked: none of the traditions or perks that unlock it taken. The last two show with “show locked”."
	>
		<SortTable rows={agendas} columns={agendaColumns} key={(r) => r.key} bind:sort={agendaSort} />
	</Panel>

	<Panel
		title="Policies"
		note="The options this empire can have; bold is selected, struck through cannot be picked now, ? cannot be told from the save. Hover for effects."
	>
		<div class="flex flex-col gap-3 text-sm">
			{#each categories as cat (cat)}
				<div>
					<h3 class="mb-1 font-semibold text-gray-500">{pretty(cat.replaceAll(',', ', '))}</h3>
					<table class="text-left">
						<tbody>
							{#each data.policies.filter((p) => (p.category ?? '') === cat) as p (p.key)}
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
		note="No faction has formed in our saves yet, so their support and approval are not read. Below: what each faction type demands — ✓ met, ✗ not, ? cannot be told from the save — and how to meet it."
	>
		<label class="mb-3 flex items-center gap-1 text-sm"
			><input type="checkbox" bind:checked={otherFactions} /> also factions of ethics we do not hold</label
		>
		<div class="grid gap-6 lg:grid-cols-2">
			{#each shownFactions as f (f.key)}
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
