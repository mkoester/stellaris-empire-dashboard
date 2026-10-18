<script lang="ts">
	import { untrack } from 'svelte';
	import {
		blockersOf,
		capOf,
		districtTypes,
		expansionCounts,
		RANGE_CHOICES,
		sortRows,
		visible,
		type ExpansionRow,
		type ExpansionView,
		type SpeciesChoice
	} from '../expansion.ts';
	import { pretty } from '../format.ts';
	import { habitabilityLabel, habitabilityTier, TIER_CLASS } from '../habitability.ts';
	import PlanetDetails from '../PlanetDetails.svelte';
	import { putSettings } from '../settings.ts';
	import TraitChip from '../TraitChip.svelte';
	import Panel from './Panel.svelte';

	// The expansion candidates, on the `all` tab (compact: modifiers by name, effects on hover) and
	// on the expansion tab (each effect shown, its source on hover). Sorted by a clicked header;
	// filtered by range, class, district and the toggles; habitability for the species picked. The
	// view belongs to the profile (config tab) and is shared by both.
	let {
		planets,
		date,
		view: stored,
		species,
		defines,
		compact = false,
		rowLine = 1
	}: {
		planets: ExpansionRow[];
		date: string;
		view: ExpansionView;
		species: SpeciesChoice[];
		defines: Record<string, number>;
		compact?: boolean;
		rowLine?: number;
	} = $props();

	let view: ExpansionView = $state(untrack(() => structuredClone(stored)));
	const save = () => putSettings({ expansionView: $state.snapshot(view) });
	const set = <K extends keyof ExpansionView>(k: K, v: ExpansionView[K]) => {
		view[k] = v;
		save();
	};
	const onSort = (column: string) =>
		set(
			'sort',
			view.sort.column === column
				? { column, desc: !view.sort.desc }
				: {
						column,
						desc: !['name', 'system', 'capital', 'shipyard', 'beyond', 'blockers'].includes(column)
					}
		);

	// the species picked, else the main one (the most pops)
	const speciesId = $derived(
		species.find((s) => s.id === view.species)?.id ?? species[0]?.id ?? ''
	);
	const shown = $derived(
		sortRows(
			planets.filter((p) => visible(p, view)),
			view.sort,
			speciesId
		)
	);
	const counts = $derived(expansionCounts(planets));
	const types = $derived(districtTypes(planets));
	const classes = $derived(
		[...new Map(planets.map((p) => [p.planetClass, p.className]))].sort((a, b) =>
			a[1].localeCompare(b[1])
		)
	);
	// district names and colours, from any planet that has the type
	const districtName = (d: string) =>
		(planets.find((p) => p.details?.names[d])?.details?.names ?? {})[d] ?? pretty(d);
	const districtColor = (d: string) =>
		planets.find((p) => p.details?.colors[d])?.details?.colors[d];
	const short = (d: string) => districtName(d).replace(/ District$/, '');

	const hab = (p: ExpansionRow) => {
		const v = p.hab[speciesId];
		return v === undefined
			? null
			: {
					value: v,
					label: habitabilityLabel({ value: v, exact: false }),
					tier: TIER_CLASS[habitabilityTier(v, defines)]
				};
	};
	const via = (p: ExpansionRow) =>
		p.via?.length ? `via ${[...new Set(p.via)].map((v) => pretty(v)).join(', ')}` : '';
	// compact: each source once, its effects on hover
	const sources = (p: ExpansionRow) => {
		const by = new Map<string, string[]>();
		for (const [t, pro] of [
			...p.effects.pros.map((t) => [t, true] as const),
			...p.effects.cons.map((t) => [t, false] as const)
		])
			by.set(t.detail, [
				...(by.get(t.detail) ?? []),
				`${pro ? '👍' : '👎'} ${t.label}${t.until ? ' ⏳' : ''}`
			]);
		return [...by];
	};
	const candidateLabel = (c: string) =>
		c.startsWith('toxic') ? 'toxic: needs a perk, origin or civic' : 'terraforming candidate';

	let open: number | null = $state(null);
	const width = $derived(12 + types.length);
</script>

{#snippet head(id: string, label: string, title = '', right = true, color?: string)}
	<th class="p-1 {right ? 'text-right' : ''}" {title}>
		<button
			class="cursor-pointer whitespace-nowrap hover:underline {view.sort.column === id
				? 'font-semibold'
				: 'font-normal'}"
			style:color
			onclick={() => onSort(id)}
			>{label}{#if view.sort.column === id}{view.sort.desc ? ' ▼' : ' ▲'}{/if}</button
		>
	</th>
{/snippet}

{#snippet select(
	label: string,
	value: string,
	options: [string, string][],
	onchange: (v: string) => void,
	any = 'any'
)}
	<label
		>{label}
		<select
			class="rounded border border-gray-300 bg-transparent dark:border-gray-700"
			{value}
			onchange={(e) => onchange(e.currentTarget.value)}
		>
			{#if any}<option value="">{any}</option>{/if}
			{#each options as [v, l] (v)}<option value={v}>{l}</option>{/each}
		</select></label
	>
{/snippet}

<Panel
	title="Expansion"
	note="Surveyed planets nobody owns. Jumps count hyperlanes and the wormholes, gateways and L-Gates you can use. District numbers are what the planet allows once its blockers are cleared, now in brackets. Habitability is estimated from the species' traits and the planet (≈): empire-wide bonuses are not counted."
>
	<div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
		{@render select(
			'beyond my borders',
			view.beyond === null ? 'any' : String(view.beyond),
			[...RANGE_CHOICES.map((n): [string, string] => [String(n), `+${n}`]), ['any', 'any']],
			(v) => set('beyond', v === 'any' ? null : Number(v)),
			''
		)}
		{@render select('class', view.cls, classes, (v) => set('cls', v))}
		{@render select(
			'has district',
			view.district,
			types.map((d): [string, string] => [d, short(d)]),
			(v) => set('district', v)
		)}
		{#if species.length}
			{@render select(
				'habitability for',
				speciesId,
				species.map((s, i): [string, string] => [s.id, i ? s.name : `${s.name} (main)`]),
				(v) => set('species', v),
				''
			)}
		{/if}
		<label
			><input
				type="checkbox"
				checked={view.candidates}
				onchange={(e) => set('candidates', e.currentTarget.checked)}
			/>
			terraforming candidates ({counts.candidates})</label
		>
		<label
			><input
				type="checkbox"
				checked={view.all}
				onchange={(e) => set('all', e.currentTarget.checked)}
			/>
			other uncolonizable ({counts.rest})</label
		>
		<span class="text-gray-500">{shown.length} of {planets.length}</span>
	</div>
	{#if shown.length === 0}
		<p>No planet matches — see the range, the filters and the toggles.</p>
	{:else}
		<table class="text-left text-sm">
			<thead>
				<tr class="border-b border-gray-300 dark:border-gray-700">
					{@render head('name', 'Planet', '', false)}
					{@render head('class', 'Class', 'coloured by habitability, as in game', false)}
					{@render head('hab', 'Hab.', 'habitability for the species picked (estimate)')}
					{@render head('size', 'Size')}
					{@render head('system', 'System', '', false)}
					{@render head('capital', 'Capital', 'jumps from the capital')}
					{@render head('shipyard', 'Shipyard', 'jumps from the nearest own shipyard')}
					{@render head('beyond', 'Border', 'jumps beyond the borders; * via a bypass')}
					{#each types as d (d)}
						{@render head(
							`cap:${d}`,
							short(d),
							`${districtName(d)}: cap once blockers are cleared (now)`,
							true,
							districtColor(d)
						)}
					{/each}
					{@render head('districts', 'Districts', 'district limit once blockers are cleared (now)')}
					{@render head('blockers', 'Blockers')}
					<th class="p-1 font-normal">Modifiers</th>
					<th class="p-1 font-normal">Note</th>
				</tr>
			</thead>
			<tbody>
				{#each shown as p (p.planetId)}
					{@const h = hab(p)}
					{@const caps = p.details?.caps}
					<tr
						class="cursor-pointer border-gray-300 align-top hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900 {p.colonizable
							? ''
							: 'text-gray-500'}"
						style:border-bottom-width="{rowLine}px"
						onclick={() => (open = open === p.planetId ? null : p.planetId)}
						title="details"
					>
						<td class="p-1">{p.name}</td>
						<td class="p-1 whitespace-nowrap {h?.tier ?? ''}">{p.className}</td>
						<td class="p-1 text-right whitespace-nowrap {h?.tier ?? ''}">{h?.label ?? '–'}</td>
						<td class="p-1 text-right">{p.size}</td>
						<td class="p-1">{p.system}</td>
						<td class="p-1 text-right">{p.jumps ?? '–'}</td>
						<td class="p-1 text-right">{p.shipyard ?? '–'}</td>
						<td class="p-1 text-right" title={via(p)}
							>{p.beyond == null ? '–' : `+${p.beyond}`}{#if p.via?.length}*{/if}</td
						>
						{#each types as d (d)}
							{@const c = capOf(p, d)}
							<td
								class="p-1 text-right tabular-nums"
								title={c && c.now !== c.after
									? `${c.now} now, ${c.after} once blockers are cleared`
									: ''}
							>
								{#if c}<span style:color={districtColor(d)}>{c.after}</span
									>{#if c.now !== c.after}<span class="text-xs text-gray-500">
											({c.now})</span
										>{/if}{/if}
							</td>
						{/each}
						<td class="p-1 text-right tabular-nums">
							{caps?.limitCleared ?? '–'}{#if caps && caps.limit !== caps.limitCleared}<span
									class="text-xs text-gray-500"
								>
									({caps.limit})</span
								>{/if}
						</td>
						<td class="p-1 text-right">{blockersOf(p) || ''}</td>
						<td class="p-1 text-xs">
							{#if compact}
								{#each sources(p) as [source, effects], i (source)}{i ? ', ' : ''}<span
										class="cursor-help underline decoration-dotted underline-offset-2"
										title={effects.join('\n')}>{source}</span
									>{/each}
							{:else}
								<span class="flex flex-wrap gap-1">
									{#each p.effects.pros as t, i (i)}<TraitChip {t} pro />{/each}
									{#each p.effects.cons as t, i (i)}<TraitChip {t} pro={false} />{/each}
								</span>
							{/if}
						</td>
						<td class="p-1">
							{p.candidate ? candidateLabel(p.candidate) : p.colonizable ? '' : 'not colonizable'}
						</td>
					</tr>
					{#if open === p.planetId && p.details}
						<tr class="border-b border-gray-200 dark:border-gray-800">
							<td colspan={width} class="p-2"><PlanetDetails {...p.details} {date} /></td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{/if}
</Panel>
