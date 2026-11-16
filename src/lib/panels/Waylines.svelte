<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { fmt } from '#lib/format.ts';
	import GalaxyMap from '#lib/GalaxyMap.svelte';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import MapLines, { type MapLine, type MapMark } from '#lib/MapLines.svelte';
	import type { MapWidth } from '#lib/mapView.ts';
	import type { OwnOnMap } from '#lib/mapLayers.ts';
	import AddGoal from '#lib/planner/AddGoal.svelte';
	import { goalKey } from '#lib/planner/replay.ts';
	import ResourceChips from '#lib/ResourceChips.svelte';
	import type { Waylines, WayPick, WaySite } from '#lib/server/waylines.ts';
	import { newGoalId, planAction } from '#lib/settings.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import type { Territory } from '#lib/territories.ts';
	import type { Arkship, Explanation } from '#lib/types.ts';
	import { TIER_FACTOR, TIER_SLOTS, UNLICENSED_FLOOR, UNLICENSED_OPINION } from '#lib/waylines.ts';
	import Panel from './Panel.svelte';

	// A nomad's waylines (#lib/waylines.ts, #lib/server/waylines.ts): where a waystation pays off,
	// which modules go in its few slots, which waylines it would join or link, and whose space it
	// is in; our waystations by wayline, with what each holds and what a wayline still lacks.
	let {
		w,
		map
	}: {
		w: Waylines;
		map: {
			systems: {
				id: number;
				name: string;
				x: number;
				y: number;
				lanes: number[];
				owned: boolean;
			}[];
			territories: Territory[];
			own: OwnOnMap;
			arkships: Arkship[];
		};
	} = $props();

	let width: MapWidth = $state('normal');
	let hovered: number | null = $state(null);
	let selected: number | null = $state(null);
	let sort = $state({ column: 'worth', desc: true });
	let busy = $state(false);

	const LINE = '#0ea5e9';
	const byId = $derived(new Map(map.systems.map((s) => [s.id, s])));
	const name = (id: number) => byId.get(id)?.name ?? `system ${id}`;
	const explain = (key: string) =>
		(page.data.explain as Record<string, Explanation> | undefined)?.[`module:${key}`];
	const keys = $derived((page.data.plan?.keys as string[] | undefined) ?? []);
	const plannedWay = (id: number) => keys.includes(goalKey('waystation', { system: id }));

	const best = $derived(w.sites.length ? w.sites[0].worth : 0);
	const tone = (v: number) =>
		['#e5f5e0', '#a1d99b', '#41ab5d', '#006d2c'][
			Math.min(3, Math.floor((v / Math.max(best, 1)) * 4))
		];
	const fill = $derived(
		Object.fromEntries([
			...w.sites.filter((s) => s.trouble.kind !== 'taken').map((s) => [s.id, tone(s.worth)]),
			...w.stations.map((s) => [s.id, LINE])
		])
	);
	const titles = $derived(
		Object.fromEntries(
			w.sites.map((s) => [
				s.id,
				`${fmt(s.worth)} trade a month with ${s.best.map((p) => p.name).join(' + ') || 'nothing to collect'}${troubleText(s) ? ` — ${troubleText(s)}` : ''}`
			])
		)
	);
	const lines: MapLine[] = $derived(
		w.segments.map((x) => ({
			from: x.a,
			to: x.b,
			color: LINE,
			dashed: x.planned,
			title: x.planned ? 'planned wayline' : 'wayline'
		}))
	);
	const marks: MapMark[] = $derived([
		...w.sites
			.filter((s) => s.trouble.kind === 'unlicensed' && s.worth > 0)
			.map((s) => ({
				systemId: s.id,
				symbol: '⚠',
				color: '#d97706',
				title: troubleText(s)
			})),
		...w.sites
			.filter((s) => s.trouble.kind === 'taken')
			.map((s) => ({ systemId: s.id, symbol: '✕', color: '#dc2626', title: troubleText(s) })),
		...w.waylines.flatMap((l) =>
			l.point !== null && l.systems.length > 1
				? [
						{
							systemId: l.point,
							symbol: '◎',
							color: LINE,
							title: 'collection point: a Logistics Hub here collects the whole wayline'
						}
					]
				: []
		)
	]);

	function troubleText(s: WaySite): string {
		switch (s.trouble.kind) {
			case 'none':
				return '';
			case 'taken':
				return `${s.owner}'s waystation is here — one per system`;
			case 'pact':
				return `${s.owner}'s space, Wayline Pact: no penalty, they share the wayline's bonuses`;
			case 'unlicensed':
				return `${s.owner}'s space without a Wayline Pact: their own stations here collect 25 % less of what you collect, ${UNLICENSED_OPINION} opinion each (Unlicensed Waystations, down to ${UNLICENSED_FLOOR}), and it gives them the Expel Nomads war goal`;
		}
	}

	const joinText = (s: WaySite) =>
		s.joins.length > 1
			? `links ${s.joins.map((i) => i + 1).join(' + ')}`
			: s.joins.length
				? `extends ${s.joins[0] + 1}`
				: '';

	/** The waystation here and every one on the way from our waylines: planner goals. */
	async function planChain(s: WaySite) {
		const tip = page.data.tip as number | undefined;
		if (tip === undefined || busy) return;
		const ids = [...(s.chain ?? []), s.id].filter((id) => !plannedWay(id));
		if (!ids.length) return;
		busy = true;
		try {
			await planAction(
				tip,
				ids.map((id) => ({
					goal: newGoalId(),
					op: 'add',
					data: { kind: 'waystation', target: { system: id }, polarity: 'want' }
				}))
			);
			await invalidateAll();
		} finally {
			busy = false;
		}
	}

	const columns: Column<WaySite>[] = [
		{ id: 'name', label: 'System', value: (r) => r.name },
		{
			id: 'jumps',
			label: 'Jumps',
			value: (r) => r.jumps,
			right: true,
			title: 'from our nearest waystation (or arkship, before the first)'
		},
		{
			id: 'deposits',
			label: 'Deposits',
			value: (r) => Object.values(r.deposits).reduce((t, v) => t + v, 0) || null,
			cell: depositsCell,
			title: 'what its surveyed station deposits yield a month, before the waystation’s tier'
		},
		{
			id: 'best',
			label: `Best ${TIER_SLOTS[0]} modules`,
			value: (r) => r.best.map((p) => p.name).join(' + ') || null,
			cell: bestCell,
			title: `for the ${TIER_SLOTS[0]} slots of a new waystation, at ×${TIER_FACTOR[0]} collection (Waystation I)`
		},
		{
			id: 'worth',
			label: 'Trade/mo',
			value: (r) => r.worth || null,
			right: true,
			title:
				'what those modules collect a month, in trade: the market’s base prices, else what a unit costs us (the jobs tab)'
		},
		{
			id: 'joins',
			label: 'Wayline',
			value: (r) => joinText(r) || null,
			title: 'the waylines (numbered below) a waystation here would extend or link'
		},
		{
			id: 'space',
			label: 'Space',
			value: (r) => (r.trouble.kind === 'none' ? null : `${r.trouble.kind} ${r.owner}`),
			cell: spaceCell,
			title: 'whose space it is, and what that means'
		},
		{ id: 'plan', label: '', value: () => null, cell: planCell }
	];
</script>

{#snippet module(p: WayPick)}
	<InfoPopup explanation={explain(p.key)}
		><span class={p.maybe ? 'text-gray-500' : ''} title={p.why}>{p.name}</span></InfoPopup
	>
{/snippet}
{#snippet depositsCell(r: WaySite)}<ResourceChips flows={r.deposits} />{/snippet}
{#snippet bestCell(r: WaySite)}{#each r.best as p, i (p.key)}{#if i}<span class="text-gray-400"
				>+</span
			>{/if}{@render module(p)}<AddGoal
			kind="station_module"
			target={{ system: r.id, module: p.key }}
			title="plan this module here"
		/>{/each}{/snippet}
{#snippet spaceCell(r: WaySite)}
	{#if r.trouble.kind !== 'none'}
		<span
			class={r.trouble.kind === 'unlicensed'
				? 'text-amber-600'
				: r.trouble.kind === 'taken'
					? 'text-red-600'
					: 'text-gray-500'}
			title={troubleText(r)}
			>{r.trouble.kind === 'unlicensed'
				? '⚠ '
				: r.trouble.kind === 'taken'
					? '✕ '
					: ''}{r.owner}</span
		>
	{/if}
{/snippet}
{#snippet planCell(r: WaySite)}
	{#if r.trouble.kind !== 'taken'}
		<AddGoal kind="waystation" target={{ system: r.id }} title="plan a waystation here" />
		{#if r.chain?.length && !plannedWay(r.id)}
			<button
				type="button"
				class="ml-1 rounded px-1 text-[11px] whitespace-nowrap text-gray-400 hover:bg-gray-100 hover:text-current dark:hover:bg-gray-800"
				title="plan waystations here and in {r.chain.map(name).join(', ')}: one wayline from ours"
				disabled={busy}
				onclick={(e) => {
					e.stopPropagation();
					void planChain(r);
				}}>+ wayline ({r.chain.length + 1})</button
			>
		{/if}
	{/if}
{/snippet}
{#snippet table()}
	<SortTable
		rows={w.sites}
		{columns}
		key={(r) => r.id}
		bind:sort
		link={(r) => r.id}
		bind:hovered
		bind:selected
	/>
{/snippet}

<div class="flex flex-col gap-6">
	<Panel
		title="Waystations"
		note="Where a waystation pays off: each collects only its own system’s station deposits, one module per resource group, ×{TIER_FACTOR.join(
			' / ×'
		)} by tier ({TIER_SLOTS.join(
			' / '
		)} slots). Waystations in neighbouring systems form a wayline: a module’s wayline effects reach every system on it, and a Logistics Hub collects the whole line at one station. Green: what the best modules would collect; ⚠ another empire’s space without a pact; ✕ someone else’s waystation; dashed: planned."
	>
		<GalaxyMap
			systems={map.systems}
			{fill}
			{titles}
			focus={[
				{
					label: 'best sites',
					points: w.sites.slice(0, 10).flatMap((s) => byId.get(s.id) ?? [])
				}
			]}
			heightKey="waylines-map-height"
			label="waylines"
			territories={map.territories}
			own={map.own}
			arkships={map.arkships}
			bind:hovered
			bind:selected
			bind:width
			beside={table}
		>
			{#snippet layer(at)}
				<MapLines {lines} {marks} {at} place={byId} />
			{/snippet}
		</GalaxyMap>
		{#if width !== 'side'}{@render table()}{/if}
	</Panel>

	<Panel
		title="Your waylines"
		note="Each wayline’s waystations (planned ones in italics), what they hold until a logistic ship collects it, and the wayline modules it has or lacks — one of each is enough per wayline.{w.hub
			? ''
			: ' A Logistics Hub needs Waystations III; until then each station is collected on its own.'}{w
			.pacts.length
			? ` Wayline Pacts: ${w.pacts.join(', ')}.`
			: ''}"
	>
		{#if !w.waylines.length}
			<p class="text-sm text-gray-500">
				No waystation yet. Pick a site above: waystations next to each other make a wayline.
			</p>
		{/if}
		<div class="flex flex-col gap-4 text-sm">
			{#each w.waylines as l, i (l.systems[0])}
				<div>
					<h3 class="font-semibold">
						Wayline {i + 1}
						<span class="font-normal text-gray-500"
							>{`${l.built} built${l.systems.length > l.built ? `, ${l.systems.length - l.built} planned` : ''}`}{#if l.point !== null && l.systems.length > 1}{`, collection point ${name(l.point)}`}{/if}</span
						>
					</h3>
					<ul class="ml-4 list-disc">
						{#each l.systems as id (id)}
							{@const st = w.stations.find((s) => s.id === id)}
							<li>
								{#if st}
									<span class="font-medium">{st.name}</span>
									<span class="text-gray-500">{`tier ${st.tier}`}</span>
									{#each st.modules as m (m)}<span class="ml-1"
											><InfoPopup explanation={explain(m)}>{explain(m)?.title ?? m}</InfoPopup
											></span
										>{/each}
									{#if st.fill !== null}<span
											class="ml-2 {st.fill > 0.8 ? 'text-amber-600' : 'text-gray-500'}"
											title="how full its stockpile is (the game's monthly value)"
											>{`${Math.round(st.fill * 100)} % full`}</span
										>{/if}
									{#if st.collecting}<span class="ml-1 text-gray-500">(being collected)</span>{/if}
									<ResourceChips flows={st.stockpile} />
									{#if st.next.length}
										<span class="ml-2 text-gray-500">{`${st.free} free: `}</span>
										{#each st.next as p (p.key)}{@render module(p)}<AddGoal
												kind="station_module"
												target={{ system: id, module: p.key }}
											/>{/each}
									{/if}
								{:else}
									<span class="italic">{name(id)}</span>
									<span class="text-gray-500">planned</span>
								{/if}
							</li>
						{/each}
					</ul>
					<p class="mt-1">
						<span class="text-gray-500">Wayline modules:</span>
						{#each l.modules as m (m.key)}
							<span
								class="ml-1 {m.have ? 'text-green-600' : m.maybe ? 'text-gray-400' : ''}"
								title={m.have ? 'on this wayline' : 'not on this wayline yet'}
								>{m.have ? '✓' : '·'}
								<InfoPopup explanation={explain(m.key)}>{m.name}</InfoPopup></span
							>
						{/each}
					</p>
				</div>
			{/each}
		</div>
	</Panel>

	{#if w.unlicensed.length}
		<Panel
			title="Unlicensed waystations"
			note="Our waystations in other empires’ space without a Wayline Pact: {UNLICENSED_OPINION} opinion each with them (down to {UNLICENSED_FLOOR}), their stations there collect 25 % less, and they hold the Expel Nomads war goal. A Wayline Pact ends all three."
		>
			<ul class="text-sm">
				{#each w.unlicensed as u (u.id)}
					<li>
						<span class="font-medium">{u.name}</span>
						<span class="text-gray-500">{`${u.count} waystations, ${u.opinion} opinion`}</span>
					</li>
				{/each}
			</ul>
		</Panel>
	{/if}
</div>
