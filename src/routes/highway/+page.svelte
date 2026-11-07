<script lang="ts">
	import EmpireName from '#lib/EmpireName.svelte';
	import GalaxyMap from '#lib/GalaxyMap.svelte';
	import HighwayMarks from '#lib/HighwayMarks.svelte';
	import { GRANT_CAP, STAGE_COLOR, type HighwayWhy, type TechState } from '#lib/highway.ts';
	import { followGame } from '#lib/live.ts';
	import type { MapWidth } from '#lib/mapView.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);
	let width: MapWidth = $state('normal');
	let hovered: number | null = $state(null);

	const h = $derived(data.highway);
	const byId = $derived(new Map((data.systems ?? []).map((s) => [s.id, s])));
	const name = (id: number | null) => (id === null ? '–' : (data.names?.[id] ?? `system ${id}`));

	type Tech = { key: string; name: string; state: TechState; cost: number | null; granted: number };
	const pct = (x: number) => `${Math.round(x * 100)} %`;
	const techText = (t: Tech) =>
		t.state === 'researched'
			? 'researched'
			: t.state === null
				? t.granted
					? `${pct(t.granted)} granted`
					: 'not started'
				: t.cost
					? `≈ ${pct(Math.min(1, t.state / t.cost))} (${Math.round(t.state)} of ≈ ${t.cost})`
					: `${Math.round(t.state)} points`;
	const WHY: Record<HighwayWhy, { label: string; cls: string }> = {
		ours: { label: 'ours', cls: 'text-gray-500' },
		friend: { label: 'a friend’s (spoiler)', cls: 'text-amber-600' },
		cheat: { label: 'cheat', cls: 'text-red-600' }
	};

	type PortalRow = NonNullable<typeof h>['portals'][number];
	const portalColumns: Column<PortalRow>[] = [
		{ id: 'pair', label: 'Pair', value: (p) => p.pair, right: true },
		{ id: 'portal', label: 'Portal', value: (p) => name(p.systemId) },
		{ id: 'anchor', label: 'Anchor', value: (p) => name(p.anchorId) },
		{ id: 'stage', label: 'Gate', value: (p) => p.stage, cell: stageCell },
		{ id: 'exit', label: 'Exit node', value: (p) => name(p.exitId) },
		{ id: 'why', label: 'Known', value: (p) => p.why, cell: whyCell }
	];
	type ExpressRow = NonNullable<typeof h>['express'][number];
	const expressColumns: Column<ExpressRow>[] = [
		{ id: 'link', label: 'Link', value: (e) => e.link, right: true },
		{ id: 'a', label: 'Station', value: (e) => name(e.a) },
		{ id: 'b', label: 'Next station', value: (e) => name(e.b) },
		{ id: 'state', label: 'State', value: (e) => e.state },
		{ id: 'why', label: 'Known', value: (e) => e.why, cell: whyCell }
	];
	type OtherRow = NonNullable<typeof h>['others'][number];
	const otherColumns: Column<OtherRow>[] = [
		{ id: 'name', label: 'Empire', value: (o) => o.name, cell: empireCell },
		{ id: 'studied', label: 'Studied', value: (o) => (o.studied ? 1 : 0), cell: studiedCell },
		{ id: 'theory', label: 'Gate Theory', value: (o) => techValue(o.techs[0]), cell: theoryCell },
		{
			id: 'construction',
			label: 'Gate Construction',
			value: (o) => techValue(o.techs[1]),
			cell: constructionCell
		},
		{
			id: 'known',
			label: 'Highway systems visited',
			value: (o) => o.known.length,
			right: true
		},
		{ id: 'why', label: 'Shown', value: (o) => o.why, cell: whyCell }
	];
	const techValue = (t: Tech) =>
		t.state === 'researched' ? 2 : t.state === null ? t.granted : 1 + t.granted;
	let sort = $state({ column: '', desc: false });
	let expressSort = $state({ column: '', desc: false });
	let otherSort = $state({ column: '', desc: false });
</script>

{#snippet stageCell(p: PortalRow)}<span style:color={STAGE_COLOR[p.stage]}>{p.stage}</span>{p.sealed
		? ' · sealed'
		: ''}{p.ours ? ' · ours' : ''}{/snippet}
{#snippet whyCell(r: { why: HighwayWhy })}<span class={WHY[r.why].cls}>{WHY[r.why].label}</span
	>{/snippet}
{#snippet empireCell(o: OtherRow)}<EmpireName name={o.name} />{/snippet}
{#snippet studiedCell(o: OtherRow)}{o.studied
		? o.headStart
			? 'yes · head start'
			: 'yes'
		: '–'}{/snippet}
{#snippet theoryCell(o: OtherRow)}{techText(o.techs[0])}{/snippet}
{#snippet constructionCell(o: OtherRow)}{techText(o.techs[1])}{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Ancient Highway</h1>
	{#if h}<span class="shrink-0 text-2xl font-bold tabular-nums">{data.date}</span>{/if}
</header>

{#if !h}
	<p class="text-sm text-gray-600 dark:text-gray-400">
		No highway in this campaign's saves: the Ancient Highway mod is not running, or no save has been
		read since it started.
	</p>
{:else}
	<div class="flex flex-col gap-6">
		<Panel title="Our gate" note={h.next}>
			<SortTable
				rows={h.portals.filter((p) => p.ours)}
				columns={portalColumns.filter((c) => c.id !== 'why')}
				key={(p) => p.systemId}
				bind:sort
				link={(p) => p.systemId}
				bind:hovered
			/>
		</Panel>

		<Panel
			title="Gate techs"
			note={`Studying a gate grants 15 % of each, a gate someone else repaired 50 % (the head start), inspecting other gates and centres 5–7 % each; all grants together at most ${GRANT_CAP * 100} %. Costs ≈: base × the galaxy's research slider and difficulty, empire size left out.`}
		>
			<ul class="flex flex-col gap-1 text-sm">
				{#each h.us.techs as t (t.key)}
					<li>
						<span class="font-semibold">{t.name}</span>: {techText(t)}
						<span class="text-gray-500"
							>{` · granted ${pct(t.granted)} of the ${GRANT_CAP * 100} % cap`}</span
						>
					</li>
				{/each}
				<li class="text-gray-500">
					{h.us.studied
						? h.us.headStart
							? 'Studied, head start received.'
							: 'Studied.'
						: 'Not studied yet: the techs are not researchable before a study.'}
				</li>
			</ul>
		</Panel>

		{#if h.studies.length}
			<Panel title="Open studies ({h.studies.length})">
				<ul class="text-sm">
					{#each h.studies as p (p.id)}
						<li>{p.name}{p.system ? ` · ${p.system}` : ''}</li>
					{/each}
				</ul>
			</Panel>
		{/if}

		<Panel
			title="The ring"
			note={`${h.nodes} ring nodes. Lines: gate pairs (portal ↔ exit node; solid when repaired and open) and express links (purple; solid while open or stable). Portals ◈ coloured by their gate: grey broken, gold studied, green repaired; ⛔ sealed. ⇶ express stations.`}
		>
			<GalaxyMap
				systems={data.systems ?? []}
				focus={[
					{
						label: 'highway',
						points: [...h.portals.map((p) => p.systemId), ...h.us.known].flatMap(
							(id) => byId.get(id) ?? []
						)
					}
				]}
				heightKey="highway-map-height"
				label="Highway"
				territories={data.territories}
				bind:hovered
				bind:width
			>
				{#snippet layer(at)}
					<HighwayMarks
						marks={data.map?.marks ?? []}
						lines={data.map?.lines ?? []}
						{at}
						place={byId}
					/>
				{/snippet}
			</GalaxyMap>
		</Panel>

		<Panel
			title="Portals known ({h.portals.length})"
			note="A portal's gate stage as of this save: what we have seen ourselves, or through the switches."
		>
			<SortTable
				rows={h.portals}
				columns={portalColumns}
				key={(p) => p.systemId}
				bind:sort
				link={(p) => p.systemId}
				bind:hovered
			/>
		</Panel>

		<Panel
			title="Express links"
			note={h.awake
				? 'Awake since the mid game: an unstable link opens and closes at random each month until someone stabilises it (the study at a station, cheaper later in the game).'
				: 'Dormant until the mid game.'}
		>
			{#if h.express.length}
				<SortTable
					rows={h.express}
					columns={expressColumns}
					key={(e) => e.link}
					bind:sort={expressSort}
				/>
			{:else}
				<p class="text-sm text-gray-500">No express station visited yet.</p>
			{/if}
		</Panel>

		<Panel
			title="What others know about the ring"
			note={data.cheat
				? 'Cheat on: every other empire that has been on the highway or studied it.'
				: data.spoiler
					? 'Spoiler on: your close friends (federation, overlord or subject, defensive pact, guarantee, the same side of a war).'
					: 'Hidden: switch on the friends spoiler or the cheat in ⚙ (Diplomacy and trade).'}
		>
			{#if h.others.length}
				<SortTable rows={h.others} columns={otherColumns} key={(o) => o.id} bind:sort={otherSort} />
			{:else if data.spoiler || data.cheat}
				<p class="text-sm text-gray-500">Nobody shown has been on the highway yet.</p>
			{/if}
		</Panel>

		<Panel title="Terms">
			<dl class="grid max-w-4xl grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
				<dt class="font-semibold">Ring</dt>
				<dd>
					The systems round the outside of the galaxy, never claimable; its nodes in eight reaches.
				</dd>
				<dt class="font-semibold">Portal</dt>
				<dd>
					Each empire's dead-end system, one hyperlane off its <b>anchor</b>; its <b>gate</b> leads
					to an exit gate in a ring node (a <b>pair</b>).
				</dd>
				<dt class="font-semibold">Study</dt>
				<dd>
					A science ship's project at a broken gate: makes the two techs researchable, grants 15 %.
				</dd>
				<dt class="font-semibold">Gate Theory</dt>
				<dd>Physics: needed to use a gate and to seal one.</dd>
				<dt class="font-semibold">Gate Construction</dt>
				<dd>Engineering: with Gate Theory, needed to repair one.</dd>
				<dt class="font-semibold">Repair</dt>
				<dd>
					An upgrade on the broken gate (300 alloys, 50 influence, 90 days) — or a nomad hired by
					contract. Once, for good.
				</dd>
				<dt class="font-semibold">Head start</dt>
				<dd>The anchor's owner gets 50 % of each tech when someone else repaired its gate.</dd>
				<dt class="font-semibold">Seal</dt>
				<dd>
					The gate's Open/Sealed switch: blocks both ways for all but the owner and its friends.
				</dd>
				<dt class="font-semibold">Express</dt>
				<dd>
					Stations round the ring joined by wormhole links; dormant until the mid game, then
					unstable until stabilised.
				</dd>
			</dl>
		</Panel>
	</div>
{/if}
