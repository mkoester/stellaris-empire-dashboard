<script lang="ts">
	import { proposedLabel, voteStanding, type ContactView } from '#lib/contacts.ts';
	import { totalEffects } from '#lib/effects.ts';
	import Effects from '#lib/Effects.svelte';
	import EffectTotals from '#lib/EffectTotals.svelte';
	import EmpireName from '#lib/EmpireName.svelte';
	import { pretty } from '#lib/format.ts';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { followGame } from '#lib/live.ts';
	import { grouped } from '#lib/modifierGroups.ts';
	import { putSettings } from '#lib/settings.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import {
		CATEGORY_VOTE_COOLDOWN,
		type ProposableRow,
		type ProposableStatus
	} from '#lib/proposable.ts';
	import { describe } from '#lib/triggers.ts';
	import type { ResolutionVote } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// the flat-list switch is stored with the contacts tab's view (`galcomFlat`), where it began
	let view: ContactView = $derived(data.view);
	const save = (v: ContactView) => {
		view = v;
		void putSettings({ contactView: v });
	};

	// the Galactic Community: in force by category (or flat), proposals with their sides' weight
	const categoryOf = (type: string) => {
		const c = data.resolutionCategories[type];
		return c ? (data.diploNames[c] ?? pretty(c.replace(/^resolution_category_/, ''))) : null;
	};
	const inForce = $derived.by(() => {
		const passed = data.galcom?.passed ?? [];
		if (view.galcomFlat) return [{ category: null as string | null, items: passed }];
		const m = new Map<string, ResolutionVote[]>();
		for (const r of passed) {
			const c = categoryOf(r.type) ?? 'other';
			m.set(c, [...(m.get(c) ?? []), r]);
		}
		return [...m]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([category, items]) => ({ category: category as string | null, items }));
	});
	const activeEffects = $derived(
		totalEffects(
			(data.galcom?.passed ?? []).map((r) => ({
				name: data.diploNames[r.type] ?? pretty(r.type),
				modifiers: data.explain[`resolution:${r.type}`]?.modifiers ?? []
			}))
		)
	);
	// the game's proposal queue: ranked by the weight of the empires for it ("Diplomatic Support"
	// — 2214.01.01, all 12 sums matched to ±1), the first up next; ties in the save's order
	type Proposal = ResolutionVote & { status: 'voting' | 'proposed'; place: number | null };
	const proposals: Proposal[] = $derived([
		...(data.galcom?.voting
			? [{ ...data.galcom.voting, status: 'voting' as const, place: null }]
			: []),
		...[...(data.galcom?.proposed ?? [])]
			.sort((a, b) => sideWeight(b.support) - sideWeight(a.support))
			.map((r, i) => ({ ...r, status: 'proposed' as const, place: i + 1 }))
	]);
	const weightOf = (name: string) => data.galcom?.weights[name] ?? null;
	// where we voted: faint green while our side outweighs the other, faint red while it does not
	const standingClass = (r: ResolutionVote) => {
		const s = voteStanding(r.ours, sideWeight(r.support), sideWeight(r.oppose));
		return s === 'ahead'
			? 'bg-green-50 dark:bg-green-950/40'
			: s === 'behind'
				? 'bg-red-50 dark:bg-red-950/40'
				: '';
	};
	const galcomHistory = $derived(
		data.milestones.filter((m) => m.kind === 'galcom').map((m, i) => ({ ...m, i }))
	);
	const historyColumns: Column<(typeof galcomHistory)[number]>[] = [
		{ id: 'date', label: 'Date', value: (m) => m.date },
		{ id: 'event', label: 'Event', value: (m) => m.label, cell: historyEvent }
	];
	const proposedOf = (r: ResolutionVote) => data.proposalDates[`${r.id}:${r.type}`] ?? null;
	// rounded down, as the game's tooltips and totals (2214.02.01: 4306.72 shown as 4306)
	const weightLabel = (w: { value: number; exact: boolean } | null) =>
		w === null ? '?' : `${w.exact ? '' : '≈'}${Math.floor(w.value)}`;
	const sideWeight = (names: string[]) => names.reduce((n, x) => n + (weightOf(x)?.value ?? 0), 0);
	const estimated = (names: string[]) => names.some((x) => !weightOf(x)?.exact);
	const anyEstimated = $derived(Object.values(data.galcom?.weights ?? {}).some((w) => !w.exact));
	const proposalColumns: Column<Proposal>[] = [
		{
			id: 'place',
			label: '#',
			value: (r) => r.place ?? 0,
			cell: place,
			right: true,
			title: "place in the game's proposal queue: by the weight of the empires for it"
		},
		{
			id: 'name',
			label: 'Resolution',
			value: (r) => data.diploNames[r.type] ?? r.type,
			cell: resolutionCell
		},
		{ id: 'by', label: 'By', value: (r) => r.proposer, cell: proposerCell },
		{
			id: 'proposed',
			label: 'Proposed',
			value: (r) => proposedOf(r)?.by ?? null,
			cell: proposed,
			title:
				'the game stores no date: between the last save without it and the first with it — or by that first save, when the history begins with it'
		},
		{ id: 'for', label: 'For', value: (r) => r.support.length, right: true, title: 'empires for' },
		{
			id: 'against',
			label: 'Against',
			value: (r) => r.oppose.length,
			right: true,
			title: 'empires against'
		},
		{
			id: 'forWeight',
			label: 'For weight',
			value: (r) => sideWeight(r.support),
			cell: forWeight,
			right: true,
			title: 'the diplomatic weight of the empires for'
		},
		{
			id: 'againstWeight',
			label: 'Against weight',
			value: (r) => sideWeight(r.oppose),
			cell: againstWeight,
			right: true,
			title: 'the diplomatic weight of the empires against'
		},
		{ id: 'we', label: 'We', value: (r) => r.ours }
	];
	// what we could propose (#lib/proposable.ts), per viewer: all or only what is open now
	let onlyNow = $state(false);
	const STATUS_ORDER = [
		'proposable',
		'unknown',
		'cooldown',
		'proposed',
		'needs a target',
		'locked',
		'no target',
		'in force',
		'not a member'
	] as const;
	const STATUS_TONE: Record<ProposableStatus, string> = {
		proposable: 'font-semibold text-green-600',
		unknown: 'text-amber-600',
		cooldown: 'text-amber-600',
		proposed: '',
		locked: 'text-gray-500',
		'needs a target': 'text-amber-600',
		'no target': 'text-gray-500',
		'in force': 'text-sky-600',
		'not a member': 'text-gray-500'
	};
	const proposableColumns: Column<ProposableRow>[] = [
		{
			id: 'category',
			label: 'Category',
			value: (p) =>
				data.diploNames[p.category] ?? pretty(p.category.replace(/^resolution_category_/, ''))
		},
		{
			id: 'name',
			label: 'Resolution',
			value: (p) => data.diploNames[p.key] ?? p.key,
			cell: proposableName
		},
		{ id: 'tier', label: 'Tier', value: (p) => p.level, right: true },
		{
			id: 'status',
			label: 'Status',
			value: (p) => STATUS_ORDER.indexOf(p.status),
			cell: proposableStatus
		},
		{
			id: 'cost',
			label: 'Cost',
			value: (p) => (p.cost === null ? null : Math.round(p.cost)),
			right: true,
			title: 'influence'
		}
	];
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Galactic Community</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !data.galcom}
	<p class="text-sm text-gray-500">
		{data.seenAt ? 'No Galactic Community yet.' : 'No save read since this tab exists.'}
	</p>
{/if}

{#if data.galcom}
	{@const g = data.galcom}
	<h2 class="mb-2 text-xl font-semibold">In force</h2>
	<section class="mb-6 rounded border border-gray-200 p-3 text-sm dark:border-gray-800">
		<div class="mb-2 flex flex-wrap items-center gap-x-4 text-gray-500">
			<span
				>since {g.formed ?? '?'} ·
				<span title={g.members.join('\n')}>{g.members.length} members</span>{g.member
					? ', we among them'
					: ', we are not a member'}</span
			>
			{#if g.passed.length}
				<label class="flex items-center gap-1"
					><input
						type="checkbox"
						checked={view.galcomFlat}
						onchange={(e) => save({ ...view, galcomFlat: e.currentTarget.checked })}
					/> flat list</label
				>
			{/if}
		</div>
		{#if !g.passed.length}
			<p class="text-gray-500">No resolution in force.</p>
		{:else}
			{#each inForce as group (group.category)}
				{#if group.category}<h3 class="mt-2 mb-1 font-semibold">{group.category}</h3>{/if}
				<ul class="mb-2 space-y-1">
					{#each group.items as r (r.id)}
						<li>
							<InfoPopup explanation={data.explain[`resolution:${r.type}`]}
								>{data.diploNames[r.type] ?? pretty(r.type)}</InfoPopup
							>{#if view.galcomFlat && categoryOf(r.type)}<span class="text-xs text-gray-500">
									· {categoryOf(r.type)}</span
								>{/if}
							<span class="text-gray-500">by <EmpireName name={r.proposer} bold={false} /></span>
							<div class="ml-4"><Effects explanation={data.explain[`resolution:${r.type}`]} /></div>
						</li>
					{/each}
				</ul>
			{/each}
			{#if activeEffects.length}
				<h3 class="mt-3 mb-1 font-semibold">All active effects</h3>
				{#each grouped(activeEffects, (t) => t.mod.key) as g (g.group)}
					<h4 class="mt-2 mb-0.5 text-xs font-semibold text-gray-500 uppercase">{g.label}</h4>
					<EffectTotals effects={g.items} />
				{/each}
			{/if}
		{/if}
	</section>

	<h2 class="mb-2 text-xl font-semibold">Proposed</h2>
	<section class="mb-6 rounded border border-gray-200 p-3 text-sm dark:border-gray-800">
		{#if g.voting}
			<div class="mb-2">
				<b>voting on:</b>
				{data.diploNames[g.voting.type] ?? pretty(g.voting.type)}{#if g.voteEnds}<span
						class="text-gray-500"
					>
						· decided {g.voteEnds}</span
					>{/if}
			</div>
		{:else if g.nextVote}
			<div class="mb-2 text-gray-500">in recess: the next vote starts {g.nextVote}</div>
		{/if}
		<p class="mb-2 text-xs text-gray-500">
			Weight: each empire's diplomatic weight, summed over its side; the game ranks its proposal
			queue by the weight for (#). {anyEstimated
				? '≈ estimated from naval, economic and technological power where companion mod 0.4.0 has not stored the game’s value yet — between 20 % too low and 2.6 × too high (checked against the game’s screen at 2214.01.01).'
				: 'The game’s values, stored by companion mod 0.4.0.'}
			Where we voted, the row is green while our side has more weight, red while it does not. Click a
			resolution for who is for and against.
		</p>
		{#if proposals.length}
			<SortTable
				rows={proposals}
				columns={proposalColumns}
				key={(r) => r.id}
				sort={{ column: '', desc: false }}
				rowClass={standingClass}
			/>
		{:else}<p class="text-gray-500">Nothing proposed.</p>{/if}
		{#if galcomHistory.length}
			<h3 class="mt-4 mb-1 font-semibold">History</h3>
			<p class="mb-1 text-xs text-gray-500">
				from the saves, each dated to the first save showing it; a proposal that left the queue
				without a vote was withdrawn — the game keeps no record of it
			</p>
			<div class="max-h-80 overflow-y-auto">
				<SortTable
					rows={galcomHistory}
					columns={historyColumns}
					key={(m) => m.i}
					sort={{ column: 'date', desc: true }}
				/>
			</div>
		{/if}
	</section>

	<h2 class="mb-2 text-xl font-semibold">Proposable</h2>
	<section class="mb-6 rounded border border-gray-200 p-3 text-sm dark:border-gray-800">
		<p class="mb-2 text-xs text-gray-500">
			Every resolution the game offers us, as of {data.seenAt}: a chain's next tier needs the one
			below in force; after a vote in a category, the next of it waits {CATEGORY_VOTE_COOLDOWN /
				360} years; one already in the queue cannot be proposed again; repeals undo one in force. Costs
			in influence{data.costMult
				? `, ${Math.round(data.costMult * 100)} % from our traditions and modifiers`
				: ''}.
		</p>
		<label class="mb-2 flex items-center gap-1"
			><input type="checkbox" bind:checked={onlyNow} /> only what we can propose now ({data.proposals.filter(
				(p) => p.status === 'proposable'
			).length})</label
		>
		<SortTable
			rows={onlyNow ? data.proposals.filter((p) => p.status === 'proposable') : data.proposals}
			columns={proposableColumns}
			key={(p) => p.key}
			sort={{ column: '', desc: false }}
		/>
	</section>
{/if}

{#snippet proposableName(p: ProposableRow)}<InfoPopup
		explanation={data.explain[`resolution:${p.key}`]}
		>{data.diploNames[p.key] ?? pretty(p.key.replace(/^resolution_/, ''))}</InfoPopup
	>{#if p.repeal}<span class="ml-1 text-xs text-gray-500">repeal</span>{/if}{#if p.target}<span
			class="ml-1 text-xs text-gray-500">names a target</span
		>{/if}{/snippet}
{#snippet proposableStatus(p: ProposableRow)}<span class={STATUS_TONE[p.status]}
		>{#if p.status === 'cooldown'}cooldown until {p.until}{:else if p.status === 'proposed'}proposed
			by <EmpireName
				name={p.by ?? '?'}
				bold={false}
			/>{:else if p.status === 'locked'}{#if p.needs}needs
				<InfoPopup explanation={data.explain[`resolution:${p.needs}`]}
					>{data.diploNames[p.needs] ?? pretty(p.needs)}</InfoPopup
				> in force{:else}<span title={p.why ? describe(p.why) : ''}
					>not allowed{p.why ? `: ${describe(p.why)}` : ''}</span
				>{/if}{:else if p.status === 'needs a target' || p.status === 'no target'}<span
				title={p.why ? describe(p.why) : ''}
				>{p.status === 'no target' ? 'no empire it could name' : 'needs a target'}{p.why
					? `: ${describe(p.why)}`
					: ''}</span
			>{:else if p.status === 'unknown'}<span title={p.why ? describe(p.why) : ''}
				>? {p.why ? describe(p.why) : ''}</span
			>{:else}{p.status}{/if}</span
	>{/snippet}

{#snippet resolutionCell(r: Proposal)}
	<details>
		<summary class="cursor-pointer"
			><InfoPopup explanation={data.explain[`resolution:${r.type}`]}
				>{data.diploNames[r.type] ?? pretty(r.type)}</InfoPopup
			></summary
		>
		<div class="mt-1 grid grid-cols-2 gap-x-6 text-xs">
			{#each [['for', r.support, 'text-green-600'], ['against', r.oppose, 'text-red-600']] as const as [label, side, tone] (label)}
				<div>
					<div class="font-semibold {tone}">{label}</div>
					{#each [...side].sort((a, b) => (weightOf(b)?.value ?? 0) - (weightOf(a)?.value ?? 0)) as n (n)}
						<div class="flex justify-between gap-2">
							<EmpireName name={n} bold={false} /><span class="text-gray-500 tabular-nums"
								>{weightLabel(weightOf(n))}</span
							>
						</div>
					{:else}<div class="text-gray-500">nobody</div>{/each}
				</div>
			{/each}
		</div>
	</details>
{/snippet}
{#snippet historyEvent(m: (typeof galcomHistory)[number])}{#if m.galcom}{m.galcom.action}:
		<InfoPopup explanation={data.explain[`resolution:${m.galcom.resolution}`]}
			>{data.diploNames[m.galcom.resolution] ??
				pretty(m.galcom.resolution.replace(/^resolution_/, ''))}</InfoPopup
		>{#if m.galcom.by}
			<span class="text-gray-500">(by <EmpireName name={m.galcom.by} bold={false} />)</span
			>{/if}{:else}{m.label}{/if}{/snippet}
{#snippet proposed(r: Proposal)}{@const d = proposedOf(r)}<span
		class="whitespace-nowrap tabular-nums">{d ? proposedLabel(d) : '?'}</span
	>{/snippet}
{#snippet place(r: Proposal)}{r.status === 'voting'
		? 'voting now'
		: r.place === 1
			? '1 · up next'
			: r.place}{/snippet}
{#snippet forWeight(r: Proposal)}<span class="text-green-600"
		>{estimated(r.support) ? '≈' : ''}{Math.floor(sideWeight(r.support))}</span
	>{/snippet}
{#snippet againstWeight(r: Proposal)}<span class="text-red-600"
		>{estimated(r.oppose) ? '≈' : ''}{Math.floor(sideWeight(r.oppose))}</span
	>{/snippet}
{#snippet proposerCell(r: Proposal)}<EmpireName name={r.proposer} bold={false} />{/snippet}
