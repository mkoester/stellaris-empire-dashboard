<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ContractMarks from '#lib/ContractMarks.svelte';
	import EmpireName from '#lib/EmpireName.svelte';
	import GalaxyMap from '#lib/GalaxyMap.svelte';
	import {
		AT_OWNER,
		branchLine,
		COLONY_SUPPORT,
		CONTRACT_RANGES,
		KIND_INFO,
		TRANSPORT,
		WHY_LABEL
	} from '#lib/contracts.ts';
	import { followGame } from '#lib/live.ts';
	import type { MapWidth } from '#lib/mapView.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import { putSettings } from '#lib/settings.ts';
	import type { Column } from '#lib/sort.ts';
	import { fmt } from '#lib/format.ts';

	let { data } = $props();
	followGame(() => data.isHead);
	let width: MapWidth = $state('normal');
	let hovered: number | null = $state(null);

	type Row = (typeof data.contracts.rows)[number];
	const c = $derived(data.contracts);
	const byId = $derived(new Map(data.systems.map((s) => [s.id, s])));
	const system = (r: Row) =>
		r.systemId === null ? null : (c.systemNames[r.systemId] ?? `system ${r.systemId}`);
	// the range decides which rows the server sends: store it, then load again
	const setRange = async (range: string) => {
		await putSettings({ contractView: { range } });
		await invalidateAll();
	};
	let sort = $state({ column: '', desc: false }); // ours first, then by days left

	const word = (k: string) => k.replaceAll('_', ' ');
	const work = (r: Row) => {
		const days = [...new Set(r.detail.projects.map((p) => p.days).filter((d) => d !== null))];
		return days.length === 1 && r.detail.steps ? r.detail.steps * (days[0] as number) : null;
	};
	const name = (id: number | null) => (id === null ? null : (c.systemNames[id] ?? `system ${id}`));
	// where the work is done, not where the contract is issued: remote, at its system, the
	// system owner's colonies (a raid), or a transport's way; with the ships that can do it
	const by = (r: Row) => (r.detail.ships.length ? ` (${r.detail.ships.join(' or ')})` : '');
	const where = (r: Row): { label: string; title: string } => {
		const d = r.detail;
		if (d.remote === null)
			return { label: '–', title: 'not known: the data DB predates the extractor of 2026-11-20' };
		if (d.remote)
			return {
				label: 'remote',
				title: d.research
					? `research projects only (${fmt(d.research)} research): done from anywhere`
					: 'no trip asked: done from anywhere'
			};
		const to = TRANSPORT[r.key]?.to ?? 'your choice';
		if (d.transport && (r.pickup !== null || r.dropoff !== null))
			return {
				label: `${name(r.pickup) ?? '?'} → ${name(r.dropoff) ?? to}${by(r)}`,
				title: 'pick up → deliver, as the save marks them; hover for the arrow on the map'
			};
		if (d.transport)
			return {
				label: `${system(r) ?? '?'} → ${to}${by(r)}`,
				title: 'pick up there; the drop-off is marked once you take it'
			};
		if (AT_OWNER.has(r.key))
			return {
				label: `colonies of ${system(r) ?? '?'}'s owner${by(r)}`,
				title: "bombard any colony of the empire that owns the contract's system"
			};
		return {
			label: `at ${system(r) ?? '?'}${by(r)}`,
			title: `a ship has to be at its system${d.ships.length ? '' : '; which ships count is not known'}`
		};
	};
	// a transport's arrow, while its row or one of its systems is hovered
	const arrows = $derived(
		c.rows.flatMap((r) => {
			const from = r.pickup ?? r.systemId;
			const to = r.dropoff;
			const a = from === null ? undefined : byId.get(from);
			const b = to === null ? undefined : byId.get(to);
			return a && b && hovered !== null && [r.systemId, r.pickup, r.dropoff].includes(hovered)
				? [{ id: r.id, a, b, title: `${r.name}: ${name(from)} → ${name(to)}` }]
				: [];
		})
	);
	const APPROX =
		'≈ at least: +10 % per contract you completed is counted; traditions, authority or leader traits that raise contract rewards (nomadic_contract_value_mult) are not';

	const columns: Column<Row>[] = [
		{ id: 'name', label: 'Contract', value: (r) => r.name, cell: nameCell },
		{ id: 'kind', label: 'Kind', value: (r) => r.kind, cell: kindCell },
		{ id: 'issuer', label: 'Issuer', value: (r) => r.issuerName, cell: issuerCell },
		{ id: 'operator', label: 'Taken by', value: (r) => r.operatorName, cell: operatorCell },
		{ id: 'system', label: 'System', value: system },
		{
			id: 'where',
			label: 'Where',
			value: (r) => where(r).label,
			cell: whereCell,
			title:
				'where the work is done, and which ships can do it — remote: from anywhere (research projects only)'
		},
		{
			id: 'state',
			label: 'State',
			value: (r) => (r.state === 'offered' ? (r.daysLeft ?? 0) : -1),
			cell: stateCell,
			title: 'offered: days left to accept; taken: since when'
		},
		{
			id: 'reward',
			label: 'Reward',
			value: (r) => r.detail.trade,
			cell: rewardCell,
			right: true,
			title: 'what a full success pays, in trade'
		},
		{
			id: 'work',
			label: 'Work',
			value: work,
			cell: workCell,
			right: true,
			title: 'steps × days of each project, travel not counted'
		},
		{
			id: 'ship',
			label: 'Nearest ship',
			value: (r) => r.detail.nearest?.jumps ?? null,
			cell: shipCell,
			title: 'our nearest ship of a kind that can do it (Where), in jumps along known hyperlanes'
		},
		{ id: 'why', label: 'Shown', value: (r) => r.why, cell: whyCell }
	];
</script>

{#snippet nameCell(r: Row)}{r.name}{#if r.internal}<span class="text-gray-500">
			· internal</span
		>{/if}{#if r.special}<span class="text-gray-500"> · special</span>{/if}{/snippet}
{#snippet kindCell(r: Row)}<span style:color={KIND_INFO[r.kind].color}
		>{KIND_INFO[r.kind].symbol}</span
	>{` ${r.kind}`}{/snippet}
{#snippet issuerCell(r: Row)}<EmpireName name={r.issuerName} wrap />{/snippet}
{#snippet operatorCell(r: Row)}{#if r.operatorName}<EmpireName
			name={r.operatorName}
			wrap
		/>{:else}<span class="text-gray-500">–</span>{/if}{/snippet}
{#snippet stateCell(r: Row)}{#if r.state === 'offered'}offered{r.daysLeft === null
			? ''
			: `, ${r.daysLeft} days`}{#if r.detail.unoffered.length}<div
				class="text-xs text-amber-600"
				title="the game offers it only with these researched"
			>
				not offered to you: needs {r.detail.unoffered.join(', ')}
			</div>{:else if r.detail.missingTechs.length || r.detail.acceptNeeds.length}<div
				class="text-xs text-amber-600"
				title="the game lets you accept it only with these"
			>
				to accept: needs {[...r.detail.missingTechs, ...r.detail.acceptNeeds].join('; ')}
			</div>{/if}{:else}taken{r.accepted ? ` ${r.accepted}` : ''}{/if}{/snippet}
{#snippet whereCell(r: Row)}<span
		class={where(r).label === '–'
			? 'text-gray-500'
			: where(r).label === 'remote'
				? 'text-green-700 dark:text-green-400'
				: ''}
		title={where(r).title}>{where(r).label}</span
	>{/snippet}
{#snippet whyCell(r: Row)}<span
		class={r.why === 'spoiler'
			? 'text-amber-600'
			: r.why === 'cheat'
				? 'text-red-600'
				: 'text-gray-500'}>{WHY_LABEL[r.why]}</span
	>{/snippet}

{#snippet rewardCell(r: Row)}{#if r.detail.trade !== null}<span title={APPROX}
			>≈{r.detail.trade.toFixed(2)}</span
		>{:else}<span class="text-gray-500">–</span>{/if}{/snippet}
{#snippet workCell(r: Row)}{#if r.detail.research !== null}{fmt(r.detail.research)} research{:else if work(r) !== null}{work(
			r
		)} days{:else if r.detail.steps}{r.detail.steps} steps{:else}<span class="text-gray-500">–</span
		>{/if}{/snippet}
{#snippet shipCell(r: Row)}{#if r.detail.aboard}<span
			class="font-semibold"
			title={`${r.detail.aboard.who} came aboard ${r.detail.aboard.since ?? 'on an unknown day'}; the game does not show which arkship carries them`}
			>{r.detail.aboard.who} aboard {r.detail.aboard.name}</span
		>{:else if r.detail.remote}<span class="text-gray-500">none needed</span
		>{:else if r.detail.nearest}{@const n = r.detail.nearest}{n.name}<span class="text-gray-500"
			>{` (${n.kind})`}</span
		>{n.jumps === null ? ' · no known route' : ` · ${n.jumps} jumps`}{:else}<span
			class="text-gray-500"
			>{r.detail.ships.length ? `no ${r.detail.ships.join(' or ')}` : 'none'}</span
		>{/if}{/snippet}
{#snippet details(r: Row)}
	{@const d = r.detail}
	<details class="text-sm">
		<summary class="cursor-pointer text-gray-500">details</summary>
		{#if !d.detailed}
			<p class="mt-1 text-amber-600">
				This data DB has no contract details yet: they come with the extractor of 2026-11-18.
			</p>
		{:else}
			<dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
				<dt class="text-gray-500">What to do</dt>
				<dd>
					{d.description ?? '–'}
					{#each d.projects as p (p.key)}<div>
							{p.name}: {p.days ?? '?'} days, needs {p.needs.join(', ') || 'nothing named'}
						</div>
						{#if p.arkshipBranches}<div
								class="text-gray-500"
								title={(['science', 'military', 'civilian'] as const)
									.map((k) => `${k}: ${COLONY_SUPPORT[k]}`)
									.join('\n')}
							>
								{branchLine(d.arkships)}
							</div>{/if}{/each}
					{#if d.steps && d.steps > 1}<div>{d.steps} steps, one project each</div>{/if}
					{#if d.unoffered.length}<div class="text-amber-600">
							The game does not offer it to you before {d.unoffered.join(', ')} is researched.
						</div>{/if}
					{#if d.missingTechs.length}<div class="text-amber-600">
							needs {d.missingTechs.join(', ')}, not researched
						</div>{/if}
					{#each d.acceptNeeds as n (n)}<div class="text-amber-600">needs {n}</div>{/each}
				</dd>
				<dt class="text-gray-500">Reward</dt>
				<dd>
					{#if d.reward.length}<span title={APPROX}
							>{d.reward
								.map((l) => `${l.scaled ? '≈' : ''}${fmt(l.amount)} ${word(l.resource)}`)
								.join(' + ')}</span
						>{d.trust ? ` · +${d.trust} trust` : ''}{d.opinion
							? ` · +${d.opinion} opinion`
							: ''}{#if d.partial.length}<div class="text-gray-500">
								partial success: {d.partial
									.map((l) => `${fmt(l.amount)} ${word(l.resource)}`)
									.join(' + ')}
							</div>{/if}
					{:else}–{/if}
				</dd>
				<dt class="text-gray-500">Cost / risk</dt>
				<dd>
					No resources: the ship is busy for the trip and the work.{d.timeToComplete
						? ` ${d.timeToComplete} days to finish once accepted.`
						: ''}{d.failedOpinion !== null
						? ` Failing or cancelling: ${d.failedOpinion} opinion with ${r.issuerName}.`
						: ''}
				</dd>
				<dt class="text-gray-500">Your arkships</dt>
				<dd>
					{#if d.aboard}<div class="font-semibold">
							{d.aboard.who} are aboard {d.aboard.name}{d.aboard.since
								? ` since ${d.aboard.since}`
								: ''}.
						</div>{/if}
					{#if !d.needsArkship}Not an arkship's job (see what to do).
					{:else if !d.arkships.length}None.
					{:else}{d.arkships
							.map(
								(a) =>
									`${a.name} (${a.kind}${a.capital ? ', capital' : ''}): ${a.jumps === null ? 'no known route' : `${a.jumps} jumps`}`
							)
							.join(' · ')}{/if}
					<div class="text-gray-500">Jumps only: how many days a jump takes is not read yet.</div>
				</dd>
			</dl>
		{/if}
	</details>
{/snippet}

{#snippet table()}
	<SortTable
		rows={c.rows}
		{columns}
		key={(r) => r.id}
		bind:sort
		link={(r) => r.systemId}
		bind:hovered
		below={details}
	/>
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Contracts</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !c.known}
	<p class="mb-4 text-sm text-amber-600">
		No contracts read yet: they fill after the next save (or a dashboard restart reads the saves on
		disk again).
	</p>
{:else}
	<p class="mb-4 max-w-4xl text-sm text-gray-600 dark:text-gray-400">
		{#if c.nomadic}
			As a nomad you see the contracts you took and the offers of empires you have communications
			with (an empire needs that to issue contracts to you).{data.spoilers
				? ' With the spoiler on: offers of empires you do not talk to.'
				: ''}
		{:else}
			You see the contracts you issued.{data.spoilers
				? ' With the spoiler on: other empires’ contracts within the range beyond your border.'
				: ''} Whether the game shows a settled empire other empires’ contracts is not checked yet.
		{/if}
		{data.all ? ' Cheat on: every contract in the galaxy.' : ''} Who may accept an offer (the game’s own
		conditions) is not in the save. As of {c.date}.
	</p>
{/if}

{#if c.known && !c.nomadic && data.spoilers && !data.all}
	<div class="mb-4 text-sm">
		<label class="flex items-center gap-1"
			>others’ contracts
			<select
				class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
				value={c.range}
				onchange={(e) => void setRange(e.currentTarget.value)}
			>
				{#each CONTRACT_RANGES as r (r)}<option value={r}
						>{r === 'mine'
							? 'in my systems'
							: r === 'all'
								? 'anywhere'
								: `up to +${r} beyond the border`}</option
					>{/each}
			</select></label
		>
	</div>
{/if}

<div class="flex flex-col gap-6">
	<Panel
		title="Contracts ({c.rows.length})"
		note="Symbols are ours: ⚔ military, ⚗ science, ⚒ resource, ⚖ diplomacy, ¤ other. A contract in a system not yet discovered is in the table, not on the map."
	>
		<GalaxyMap
			systems={data.systems}
			focus={[
				{
					label: 'contracts',
					points: data.marks.flatMap((m) => byId.get(m.systemId) ?? [])
				}
			]}
			heightKey="contracts-map-height"
			label="Contracts"
			territories={data.territories}
			bind:hovered
			bind:width
			beside={table}
		>
			{#snippet layer(at)}
				<ContractMarks marks={data.marks} {at} place={byId} />
				<defs
					><marker
						id="contract-arrow"
						viewBox="0 0 10 10"
						refX="9"
						refY="5"
						markerWidth="7"
						markerHeight="7"
						orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#c9822b" /></marker
					></defs
				>
				{#each arrows as w (w.id)}
					{@const p = at(w.a)}
					{@const q = at(w.b)}
					<line
						x1={p.x}
						y1={p.y}
						x2={q.x}
						y2={q.y}
						stroke="#c9822b"
						stroke-width="3"
						marker-end="url(#contract-arrow)"
						pointer-events="none"><title>{w.title}</title></line
					>
				{/each}
			{/snippet}
		</GalaxyMap>
		{#if width !== 'side'}<div class="mt-3">{@render table()}</div>{/if}
	</Panel>
</div>
