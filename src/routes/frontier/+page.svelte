<script lang="ts">
	import ContractMarks from '#lib/ContractMarks.svelte';
	import OutcomeCell from '#lib/Outcome.svelte';
	import { resolve } from '$app/paths';
	import { pretty } from '#lib/format.ts';
	import GalaxyMap from '#lib/GalaxyMap.svelte';
	import type { MapWidth } from '#lib/mapView.ts';
	import EmpireName from '#lib/EmpireName.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import AddGoal from '#lib/planner/AddGoal.svelte';
	import type { ContactRow, SituationRow } from '#lib/situations.ts';
	import type { SeenRow } from '#lib/territories.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import type { Outcome } from '#lib/types.ts';

	let { data } = $props();
	let width: MapWidth = $state('normal'); // "wide + table": the contacts table goes beside the map
	followGame(() => data.isHead);

	let showDone = $state(false);
	let contactSort = $state({ column: 'difficulty', desc: true });
	let hovered: number | null = $state(null); // a system, on the map or a contact's row

	const contacts = $derived(data.contacts.filter((c) => showDone || c.status === 'in_progress'));
	const open = $derived(data.contacts.filter((c) => c.status === 'in_progress'));
	const byId = $derived(new Map(data.systems.map((s) => [s.id, s])));

	// difficulty: the game's 1 (easy) … 10; three steps, green, amber, red
	const hard = (d: number) => (d <= 3 ? '#1baf7a' : d <= 5 ? '#eda100' : '#e34948');
	const fill = $derived(
		Object.fromEntries(data.owners.flatMap((o) => o.systems.map((id) => [id, o.color])))
	);
	const titles = $derived(
		Object.fromEntries(
			data.owners.flatMap((o) =>
				o.systems.map((id) => [id, `station: ${o.name} (${pretty(o.type ?? '?')})`])
			)
		)
	);

	const seenColumns: Column<SeenRow>[] = [
		{ id: 'system', label: 'System', value: (r) => r.system },
		{ id: 'shipset', label: 'Shipset', value: (r) => r.shipset },
		{
			id: 'territory',
			label: 'Owner',
			value: (r) => r.territory,
			cell: territory,
			title: 'known, or our guess'
		},
		{ id: 'first', label: 'First seen', value: (r) => r.first },
		{ id: 'last', label: 'Last seen', value: (r) => r.last }
	];

	const contactColumns: Column<ContactRow>[] = [
		{ id: 'name', label: 'Contact', value: (r) => r.name, cell: contactName },
		{ id: 'system', label: 'System', value: (r) => r.system },
		{ id: 'date', label: 'Found', value: (r) => r.date },
		{
			id: 'months',
			label: 'Age',
			value: (r) => r.months,
			right: true,
			title: 'months since found'
		},
		{ id: 'difficulty', label: 'Diff.', value: (r) => r.difficulty, right: true, cell: difficulty },
		{ id: 'clues', label: 'Clues', value: (r) => r.clues, right: true },
		{ id: 'stage', label: 'Stage', value: (r) => r.stage, cell: stage },
		{
			id: 'daysLeft',
			label: 'Days',
			value: (r) => r.daysLeft,
			right: true,
			cell: days,
			title: 'days left in this stage'
		},
		{ id: 'envoy', label: 'Envoy', value: (r) => r.leaderName, cell: envoy },
		{
			id: 'jumps',
			label: 'Jumps',
			value: (r) => r.jumps,
			right: true,
			title: 'hyperlane jumps from our border'
		},
		{
			id: 'stations',
			label: 'Stations',
			value: (r) => r.stations,
			right: true,
			title: 'visited systems whose station is theirs'
		}
	];
	const situationColumns: Column<SituationRow>[] = [
		{ id: 'name', label: 'Situation', value: (r) => r.name },
		{ id: 'category', label: 'Kind', value: (r) => r.category },
		{ id: 'progress', label: 'Progress', value: (r) => r.progress, right: true },
		{ id: 'monthly', label: '±/mo', value: (r) => r.monthly, right: true },
		{ id: 'approach', label: 'Approach', value: (r) => r.approachName },
		{ id: 'stage', label: 'Stage', value: (r) => r.stageName }
	];
	// below each list, what earlier saves had and the latest has not: finished, or lost
	const lastSeen = <T extends { lastSeen: string }>(): Column<T> => ({
		id: 'lastSeen',
		label: 'Last seen',
		value: (r) => r.lastSeen,
		title: 'the last save that had it'
	});
	type Anomaly = (typeof data.anomalies)[number];
	type Project = (typeof data.projects)[number];
	type Dig = (typeof data.digSites)[number];
	const anomalyColumns: Column<Anomaly>[] = [
		{ id: 'name', label: 'Anomaly', value: (a) => a.name, cell: anomalyName },
		{ id: 'where', label: 'Where', value: (a) => `${a.planet}, ${a.system}` },
		{ id: 'level', label: 'Level', value: (a) => a.level ?? null, right: true },
		{
			id: 'outcomes',
			label: 'Outcome',
			value: (a) => a.tree?.length ?? a.outcomes?.length ?? null,
			cell: anomalyOutcomes,
			title: 'what it leads to — hover a marker for its meaning, open the line for the whole tree'
		}
	];
	const projectColumns: Column<Project>[] = [
		{ id: 'name', label: 'Project', value: (p) => p.name, cell: bold },
		{ id: 'system', label: 'System', value: (p) => p.system },
		{
			id: 'department',
			label: 'Department',
			value: (p) => (p.department ? pretty(p.department.replace(/_technology$/, '')) : null)
		},
		{ id: 'days', label: 'Days', value: (p) => p.days || null, right: true },
		{
			id: 'outcomes',
			label: 'Outcome',
			value: (p) => p.tree?.length ?? p.outcomes?.length ?? null,
			cell: projectOutcomes,
			title: 'what it leads to — hover a marker for its meaning, open the line for the whole tree'
		}
	];
	const digColumns: Column<Dig>[] = [
		{ id: 'type', label: 'Site', value: (d) => d.name, cell: digName },
		{ id: 'system', label: 'System', value: (d) => d.system },
		{ id: 'difficulty', label: 'Difficulty', value: (d) => d.difficulty, right: true },
		{ id: 'clues', label: 'Clues', value: (d) => d.clues, right: true },
		{
			id: 'chapter',
			label: 'Chapter',
			value: (d) => d.chapter ?? null,
			cell: chapter,
			right: true,
			title: 'the next chapter, of how many'
		},
		{
			id: 'excavating',
			label: 'Excavated',
			value: (d) => (d.excavating ? 'being excavated' : null)
		},
		{
			id: 'outcome',
			label: 'Outcome',
			value: (d) => d.tree?.length ?? null,
			cell: digOutcome,
			title: 'what each chapter gives — open the line for the whole tree'
		}
	];
</script>

{#snippet contactTable()}
	<Panel
		title="First contacts"
		note="Envoy ✉: someone is working on it. Jumps from our border along hyperlanes (bypasses not counted). Stages are the game's internal names."
	>
		<label class="mb-2 flex items-center gap-1 text-sm"
			><input type="checkbox" bind:checked={showDone} /> also finished and aborted</label
		>
		<SortTable
			rows={contacts}
			columns={contactColumns}
			key={(r) => r.id}
			bind:sort={contactSort}
			link={(r) => r.systemId}
			bind:hovered
		/>
	</Panel>
{/snippet}

{#snippet goneNote(n: number)}<p class="mt-3 mb-1 text-xs text-gray-500">
		No longer in the save ({n}) — finished or lost, the save cannot tell. Kept for what they were
		and where they led.
	</p>{/snippet}
{#snippet bold(r: Anomaly | Project)}<b>{r.name}</b>{/snippet}
{#snippet anomalyName(a: Anomaly)}<b>{a.name}</b><AddGoal
		kind="anomaly"
		target={{ planet: a.planetId }}
	/>{/snippet}
{#snippet digName(d: Dig)}<b>{d.name}</b><AddGoal
		kind="digsite"
		target={{ planet: d.planetId }}
	/>{/snippet}
{#snippet anomalyOutcomes(a: Anomaly)}{#if a.tree}<OutcomeCell tree={a.tree} />{:else}<span
			class="text-gray-500">{@render outcomes(a.outcomes)}</span
		>{/if}{/snippet}
{#snippet projectOutcomes(p: Project)}{#if p.tree}<OutcomeCell tree={p.tree} />{:else}<span
			class="text-gray-500">{@render outcomes(p.outcomes)}</span
		>{/if}{/snippet}
{#snippet chapter(d: Dig)}{d.chapter ?? '–'}{d.stages ? ` / ${d.stages}` : ''}{/snippet}
{#snippet digOutcome(d: Dig)}{#if d.tree}<OutcomeCell
			tree={d.tree}
			chapter={d.chapter ?? null}
		/>{/if}{/snippet}

{#snippet territory(r: SeenRow)}{#if r.territory}<EmpireName
			name={r.territory}
			bold={false}
		/>{:else}–{/if}{/snippet}
{#snippet contactName(r: ContactRow)}
	<EmpireName name={r.name} />{#if r.country && r.communications}<span class="text-gray-500">
			· <EmpireName name={r.country.name} bold={false} /></span
		>{/if}{#if r.status === 'in_progress'}<AddGoal
			kind="contact"
			target={{ country: r.countryId }}
		/>{/if}
{/snippet}
{#snippet difficulty(r: ContactRow)}<span style:color={hard(r.difficulty)}>{r.difficulty}</span
	>{/snippet}
{#snippet stage(r: ContactRow)}{pretty(r.stage)}{r.status === 'in_progress'
		? ''
		: ` (${pretty(r.status)})`}{/snippet}
{#snippet days(r: ContactRow)}{r.status === 'in_progress' && r.daysLeft !== null
		? Math.ceil(r.daysLeft)
		: '–'}{/snippet}
{#snippet envoy(r: ContactRow)}{#if r.status !== 'in_progress'}–{:else if r.leaderName}✉ {r.leaderName}{:else}<span
			class="text-amber-600">none</span
		>{/if}{/snippet}
{#snippet outcomes(list: Outcome[] | null)}
	{#if list}{list.map((o) => o.name ?? o.event).join(' · ') || '–'}{/if}
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Frontier</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !data.seenAt}
	<p class="mb-4 text-sm text-amber-600">
		No save read since this tab exists; it fills after the next one.
	</p>
{/if}

<div class="flex flex-col gap-8">
	<!-- two columns where the window is wide: what is met on the left, what is studied on the right -->
	<div class="grid items-start gap-8 xl:grid-cols-2">
		<div class="flex min-w-0 flex-col gap-8">
			{#if width !== 'side'}{@render contactTable()}{/if}

			<Panel
				title="Stations seen"
				note="Other empires' stations in systems one of your fleets was in when the game saved (monthly autosaves catch only the fleets there at that moment), with their shipset. Unknown owners are guessed: one shipset within 3 jumps counts as one empire."
			>
				{#if data.seen.length}
					<SortTable
						rows={data.seen}
						columns={seenColumns}
						key={(r) => r.systemId}
						link={(r) => r.systemId}
						bind:hovered
					/>
				{:else}<p class="text-sm text-gray-500">
						None yet: no fleet of yours has been at another empire's station when the game saved.
					</p>{/if}
			</Panel>

			<Panel title="Situations" note="Progress runs to 100.">
				{#if data.situations.length}
					<SortTable rows={data.situations} columns={situationColumns} key={(r) => r.id} />
				{:else}<p class="text-sm text-gray-500">None running.</p>{/if}
				{#if data.gone.situations.length}
					{@render goneNote(data.gone.situations.length)}
					<div class="opacity-60 transition-opacity hover:opacity-100">
						<SortTable
							rows={data.gone.situations}
							columns={[...situationColumns, lastSeen()]}
							key={(r) => r.id}
						/>
					</div>
				{/if}
			</Panel>

			<Panel title="Events" note="The campaign's bigger events are in their own tab.">
				<a class="text-sm hover:underline" href={resolve('/events')}>→ events</a>
			</Panel>
		</div>
		<div class="flex min-w-0 flex-col gap-8">
			<Panel
				title="Anomalies"
				note="Found and not yet researched. {data.opts.anomalySpoilers
					? 'What each can lead to, followed through its events and the projects it starts.'
					: 'What they can lead to: switch on the spoilers in ⚙.'}"
			>
				{#if data.anomalies.length}
					<SortTable rows={data.anomalies} columns={anomalyColumns} key={(a) => a.planetId} />
				{:else}<p class="text-sm text-gray-500">None waiting.</p>{/if}
				{#if data.gone.anomalies.length}
					{@render goneNote(data.gone.anomalies.length)}
					<div class="opacity-60 transition-opacity hover:opacity-100">
						<SortTable
							rows={data.gone.anomalies}
							columns={[...anomalyColumns, lastSeen()]}
							key={(a) => `${a.planetId}:${a.category}`}
						/>
					</div>
				{/if}
			</Panel>

			<Panel
				title="Dig sites"
				note="Archaeological sites in systems you visited. {data.opts.digSiteSpoilers
					? 'What each chapter gives; the next one is marked.'
					: 'What their chapters give: switch on the spoilers in ⚙.'}"
			>
				{#if data.digSites.length}
					<SortTable rows={data.digSites} columns={digColumns} key={(d) => d.id} />
				{:else}<p class="text-sm text-gray-500">None found.</p>{/if}
				{#if data.gone.digSites.length}
					{@render goneNote(data.gone.digSites.length)}
					<div class="opacity-60 transition-opacity hover:opacity-100">
						<SortTable
							rows={data.gone.digSites}
							columns={[...digColumns, lastSeen()]}
							key={(d) => d.id}
						/>
					</div>
				{/if}
			</Panel>

			<Panel
				title="Special projects"
				note="The save holds no progress for them. {data.opts.projectSpoilers
					? 'What each leads to, followed through its events.'
					: 'What they lead to: switch on the spoilers in ⚙.'}"
			>
				{#if data.projects.length}
					<SortTable rows={data.projects} columns={projectColumns} key={(p) => p.id} />
				{:else}<p class="text-sm text-gray-500">None on offer.</p>{/if}
				{#if data.gone.projects.length}
					{@render goneNote(data.gone.projects.length)}
					<div class="opacity-60 transition-opacity hover:opacity-100">
						<SortTable
							rows={data.gone.projects}
							columns={[...projectColumns, lastSeen()]}
							key={(p) => p.id}
						/>
					</div>
				{/if}
			</Panel>
		</div>
	</div>

	<Panel
		title="First contact map"
		note="Open contacts where they were found: colour by difficulty (green ≤ 3, amber ≤ 5, red), the bigger the older, ✉ with an envoy on it. {data
			.opts.contactStations
			? 'Visited systems are coloured by their station’s owner.'
			: 'Switch on “colour visited systems by their station’s owner” in ⚙ to see whose stations you found.'}"
	>
		<GalaxyMap
			systems={data.systems}
			{fill}
			{titles}
			focus={[{ label: 'contacts', points: open.flatMap((c) => byId.get(c.systemId) ?? []) }]}
			heightKey="first-contact-map-height"
			square
			bind:width
			beside={contactTable}
			label="First contact map"
			territories={data.territories}
			bind:hovered
		>
			{#snippet layer(at)}
				{#each open as c (c.id)}
					{@const s = byId.get(c.systemId)}
					{#if s}
						{@const p = at(s)}
						<circle
							cx={p.x}
							cy={p.y}
							r={7 + Math.min(c.months, 36) / 3}
							fill={hard(c.difficulty)}
							role="presentation"
							onpointerenter={() => (hovered = c.systemId)}
							onpointerleave={() => (hovered = null)}
							fill-opacity="0.35"
							stroke={hard(c.difficulty)}
							stroke-width="2"
							><title
								>{c.name}: difficulty {c.difficulty}, {c.months} months, {c.clues} clues{c.leaderName
									? `, envoy ${c.leaderName}`
									: ', no envoy'}</title
							></circle
						>
						<text x={p.x + 14} y={p.y + 4} class="fill-current text-[11px]"
							>{c.leaderName ? '✉ ' : ''}{c.name}</text
						>
					{/if}
				{/each}
				<ContractMarks marks={data.contractMarks} {at} place={byId} />
			{/snippet}
		</GalaxyMap>
		{#if data.owners.length}
			<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
				{#each data.owners as o (o.countryId)}
					<li class="flex items-center gap-1">
						<span class="inline-block h-2.5 w-2.5 rounded-full" style:background={o.color}></span>
						{o.name}
						<span class="text-gray-500"
							>{pretty(o.type ?? '?')}{o.shipset ? `, ${pretty(o.shipset)} ships` : ''}, {o.systems
								.length} system{o.systems.length === 1 ? '' : 's'}{o.contact !== null
								? ', first contact open'
								: ''}</span
						>
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>
</div>
