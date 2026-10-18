<script lang="ts">
	import { resolve } from '$app/paths';
	import { colorOf } from './colors.ts';
	import { countLabel, type Trait } from './colonyProfile.ts';
	import { sectorName, type ColonyRow, type ColumnId, type Sort } from './colonyTable.ts';
	import DistrictName from './DistrictName.svelte';
	import { fmt, nameOf, pretty } from './format.ts';
	import InfoPopup from './InfoPopup.svelte';
	import type { Explanation } from './types.ts';

	// The colonies tab's table: one row per colony and, under it, its pros (👍) and cons (👎) as
	// chips — thumbs, not triangles, which read as the sort direction.
	// Headers sort; `sectorColors` (one-table mode) marks each row with its sector's colour.
	let {
		rows,
		columns,
		netKeys,
		sort,
		onSort,
		sectorColors = null,
		names,
		colors,
		explain,
		node
	}: {
		rows: ColonyRow[];
		columns: ColumnId[];
		netKeys: string[];
		sort: Sort;
		onSort: (column: string) => void;
		sectorColors?: Record<string, string> | null;
		names: Record<string, string>;
		colors: Record<string, string>;
		explain: Record<string, Explanation>;
		node: number | null;
	} = $props();

	const show = (id: ColumnId) => columns.includes(id);
	const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);
	const signed = (v: number) => (v > 0 ? '+' : '') + fmt(v);
	const href = (planetId: number) =>
		node === null
			? resolve('/colony/[id]', { id: String(planetId) })
			: resolve(`/colony/[id]?node=${node}`, { id: String(planetId) });
	// Short headers for the net-output columns; the full name is the tooltip.
	const ABBR: Record<string, string> = {
		energy: 'EN',
		minerals: 'MI',
		food: 'FO',
		alloys: 'AL',
		consumer_goods: 'CG',
		unity: 'UN',
		influence: 'IN',
		trade: 'TR',
		physics_research: 'PH',
		society_research: 'SO',
		engineering_research: 'EG',
		volatile_motes: 'VM',
		exotic_gases: 'EX',
		rare_crystals: 'RC'
	};
	const abbr = (k: string) => ABBR[k] ?? pretty(k).slice(0, 3).toUpperCase();
	const width = $derived(
		1 + columns.filter((c) => c !== 'net').length + (show('net') ? netKeys.length : 0)
	);
</script>

{#snippet head(id: string, label: string, title = '', right = true)}
	<th class="p-1 {right ? 'text-right' : ''}" {title}>
		<button
			class="cursor-pointer whitespace-nowrap hover:underline {sort.column === id
				? 'font-semibold'
				: 'font-normal'}"
			onclick={() => onSort(id)}
			>{label}{#if sort.column === id}{sort.desc ? ' ▼' : ' ▲'}{/if}</button
		>
	</th>
{/snippet}

{#snippet chip(t: Trait, pro: boolean)}
	<span
		class="inline-flex items-center gap-1 rounded border px-1 whitespace-nowrap {pro
			? 'border-green-600/40'
			: 'border-red-600/40'}"
		title={t.until ? `${t.detail}\ntemporary, until ${t.until}` : t.detail}
		><span class={pro ? 'text-green-600' : 'text-red-600'}>{pro ? '👍' : '👎'}</span
		>{#if t.resource && colorOf(t.resource)}<span
				class="inline-block size-2 rounded-full"
				style:background={colorOf(t.resource)}
			></span>{/if}<InfoPopup explanation={t.ref ? explain[t.ref] : undefined}>{t.label}</InfoPopup
		>{#if t.until}<span class="cursor-help" aria-label="temporary">⏳</span>{/if}</span
	>
{/snippet}

<!-- no overflow wrapper: it would clip the popups -->
<div>
	<table class="text-left text-sm">
		<thead>
			<tr class="border-b border-gray-300 dark:border-gray-700">
				{@render head('name', 'Colony', '', false)}
				{#if show('sector')}{@render head('sector', 'Sector', '', false)}{/if}
				{#if show('designation')}{@render head('designation', 'Designation', '', false)}{/if}
				{#if show('class')}{@render head('class', 'Class', 'sorted by size', false)}{/if}
				{#if show('pops')}{@render head('pops', 'Pops')}{/if}
				{#if show('growth')}{@render head(
						'growth',
						'±/mo',
						'last month: growth, migration, …'
					)}{/if}
				{#if show('stability')}{@render head('stability', 'Stab.', 'stability')}{/if}
				{#if show('happiness')}{@render head('happiness', 'Happy', 'happiness')}{/if}
				{#if show('habitability')}{@render head(
						'habitability',
						'Hab.',
						'habitability, pops-weighted'
					)}{/if}
				{#if show('housing')}{@render head('housing', 'Housing', 'free housing')}{/if}
				{#if show('amenities')}{@render head('amenities', 'Amen.', 'free amenities')}{/if}
				{#if show('civilians')}{@render head(
						'civilians',
						'Civil.',
						'civilians: pops without a job'
					)}{/if}
				{#if show('jobs')}{@render head('jobs', 'Open jobs')}{/if}
				{#if show('net')}
					{#each netKeys as k (k)}
						<th class="p-1 text-right" title="net {pretty(k)} per month">
							<button
								class="cursor-pointer hover:underline {sort.column === `net:${k}`
									? 'font-semibold'
									: 'font-normal'}"
								style:color={colorOf(k)}
								onclick={() => onSort(`net:${k}`)}
								>{abbr(k)}{#if sort.column === `net:${k}`}{sort.desc ? ' ▼' : ' ▲'}{/if}</button
							>
						</th>
					{/each}
				{/if}
				{#if show('districts')}{@render head(
						'districts',
						'Districts',
						'built / cap per type; sorted by free room',
						false
					)}{/if}
				{#if show('suits')}{@render head(
						'suits',
						'Suits',
						'what its caps and modifiers favour',
						false
					)}{/if}
				{#if show('pros')}{@render head('pros', '👍', 'pros (lasting+temporary)')}{/if}
				{#if show('cons')}{@render head('cons', '👎', 'cons (lasting+temporary)')}{/if}
				{#if show('queue')}{@render head('queue', 'Queue', 'build queue', false)}{/if}
				{#if show('automation')}<th class="p-1 font-normal">Automation</th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.planetId)}
				{@const mark = sectorColors?.[sectorName(r)]}
				<tr class="align-top" style:box-shadow={mark ? `inset 4px 0 0 ${mark}` : undefined}>
					<td class="p-1 pl-2 whitespace-nowrap">
						{#if r.problems.length}<span
								class="mr-1 cursor-help font-bold text-red-600"
								title={r.problems.join('\n')}>!</span
							>{/if}<a class="underline" href={href(r.planetId)}>{r.name}</a
						>{#if r.colonizing}&nbsp;<span class="text-xs text-green-700">colonizing</span>{/if}
					</td>
					{#if show('sector')}
						<td class="p-1 whitespace-nowrap">
							{#if mark}<span class="mr-1 inline-block size-2 rounded-sm" style:background={mark}
								></span>{/if}{sectorName(r)}
						</td>
					{/if}
					{#if show('designation')}
						<td class="p-1 whitespace-nowrap">
							{pretty(r.designation)}{#if r.profile.mismatch}&nbsp;<span
									class="cursor-help text-amber-600"
									title={r.profile.mismatch}>⚠</span
								>{/if}
						</td>
					{/if}
					{#if show('class')}<td class="p-1 whitespace-nowrap">{r.planetClass} {r.size}</td>{/if}
					{#if show('pops')}<td class="p-1 text-right">{fmt(r.pops)}</td>{/if}
					{#if show('growth')}
						<td
							class="p-1 text-right {(r.growth ?? 0) < 0
								? 'text-red-600'
								: (r.growth ?? 0) > 0
									? 'text-green-600'
									: ''}">{r.growth === null ? '' : signed(r.growth)}</td
						>
					{/if}
					{#if show('stability')}
						<td class="p-1 text-right {r.stability < 50 ? 'text-red-600' : ''}"
							>{fmt(r.stability)}</td
						>
					{/if}
					{#if show('happiness')}<td class="p-1 text-right">{pct(r.happiness)}</td>{/if}
					{#if show('habitability')}
						<td
							class="p-1 text-right {r.habitability !== null && r.habitability < 0.7
								? 'text-red-600'
								: ''}">{pct(r.habitability)}</td
						>
					{/if}
					{#if show('housing')}
						<td class="p-1 text-right {r.freeHousing < 0 ? 'text-red-600' : ''}"
							>{fmt(r.freeHousing)}</td
						>
					{/if}
					{#if show('amenities')}
						<td class="p-1 text-right {r.freeAmenities < 0 ? 'text-red-600' : ''}"
							>{fmt(r.freeAmenities)}</td
						>
					{/if}
					{#if show('civilians')}<td class="p-1 text-right">{fmt(r.civilians)}</td>{/if}
					{#if show('jobs')}<td class="p-1 text-right">{fmt(r.openJobs)}</td>{/if}
					{#if show('net')}
						{#each netKeys as k (k)}
							{@const v = r.net[k] ?? 0}
							<td
								class="p-1 text-right tabular-nums {v < 0
									? 'text-red-600'
									: v === 0
										? 'text-gray-400'
										: ''}">{v === 0 ? '·' : signed(v)}</td
							>
						{/each}
					{/if}
					{#if show('districts')}
						<td class="p-1">
							<span class="flex flex-wrap gap-1">
								{#each r.districts as d (d.type)}
									{@const c = colors[d.type]}
									<span
										class="rounded border px-1 text-xs whitespace-nowrap tabular-nums"
										style:border-color={c}
										style:background={c ? `color-mix(in oklab, ${c} 20%, transparent)` : undefined}
										title={nameOf(names, d.type)}>{d.built}{d.cap !== null ? `/${d.cap}` : ''}</span
									>
								{/each}
								{#if r.room !== null}<span class="text-xs text-gray-500" title="districts free"
										>{r.room} free</span
									>{/if}
							</span>
						</td>
					{/if}
					{#if show('suits')}
						<td class="p-1 whitespace-nowrap">
							{#each r.profile.suits.slice(0, 2) as s, i (s.resource)}{i ? ', ' : ''}<span
									class="cursor-help"
									style:color={colorOf(s.resource)}
									title={s.why.join('\n')}>{pretty(s.resource)}</span
								>{/each}
						</td>
					{/if}
					{#if show('pros')}<td class="p-1 text-right text-green-600"
							>{countLabel(r.profile.pros)}</td
						>{/if}
					{#if show('cons')}<td class="p-1 text-right text-red-600">{countLabel(r.profile.cons)}</td
						>{/if}
					{#if show('queue')}
						<td class="p-1 whitespace-nowrap">
							{#each r.queue as q, i (i)}<span class="block"
									><DistrictName name={nameOf(names, q.name)} color={colors[q.name]} /></span
								>{:else}∅{/each}
						</td>
					{/if}
					{#if show('automation')}<td class="p-1">{r.automation}</td>{/if}
				</tr>
				<tr
					class="border-b border-gray-200 text-xs dark:border-gray-800"
					style:box-shadow={mark ? `inset 4px 0 0 ${mark}` : undefined}
				>
					<td class="p-1 pb-2 pl-2" colspan={width}>
						<span class="flex flex-wrap gap-1">
							{#each r.profile.pros as t, i (i)}{@render chip(t, true)}{/each}
							{#each r.profile.cons as t, i (i)}{@render chip(t, false)}{/each}
							{#if !r.profile.pros.length && !r.profile.cons.length}<span class="text-gray-500"
									>nothing known about this planet</span
								>{/if}
						</span>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
