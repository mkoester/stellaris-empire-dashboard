<script lang="ts">
	import { byExpiry, timeLeft } from './countryModifiers.ts';
	import type { CapSource, PlanetDetailsData } from './districtCaps.ts';
	import BlockerHint from './BlockerHint.svelte';
	import type { BlockerHint as Hint } from './blockers.ts';
	import DistrictName from './DistrictName.svelte';
	import SortTable from './SortTable.svelte';
	import type { Column } from './sort.ts';
	import Effects from './Effects.svelte';
	import { nameOf, pretty } from './format.ts';
	import InfoPopup from './InfoPopup.svelte';

	// What a planet offers: district caps (computed, see districtCaps.ts), its features, its
	// blockers and what they hide, and its modifiers. For colonies and expansion candidates alike.
	let {
		planet,
		caps,
		date,
		blockers,
		names,
		colors,
		explain,
		hints = null
	}: PlanetDetailsData & {
		date: string;
		// colonies only: what clearing each blocker gives
		hints?: { hints: Hint[]; names: Record<string, string> } | null;
	} = $props();
	// a colony's blockers of one type are alike, so the first hint for the type serves them all
	const hintFor = (key: string) => hints?.hints.find((h) => h.blocker === key);

	const title = (ref: string) =>
		ref.startsWith('building:')
			? nameOf(names, ref.slice('building:'.length))
			: (explain[ref]?.title ?? pretty(ref.replace(/^\w+:/, '')));
	const features = $derived(planet.deposits.filter((d) => !blockers.includes(d.key)));
	const blocked = $derived(planet.deposits.filter((d) => blockers.includes(d.key)));
	const modifiers = $derived(
		byExpiry(planet.modifiers.map((m) => ({ ...m, name: title(`modifier:${m.key}`) })))
	);
	// What can still be built: the type's room, but never more than the planet's
	const room = $derived(caps.limit === null ? Infinity : Math.max(0, caps.limit - caps.built));
	const free = (cap: number, built: number) => Math.min(Math.max(0, cap - built), room);
	type Cap = (typeof caps.types)[number];
	const freeOf = (t: Cap) =>
		t.cap === null ? (room === Infinity ? null : room) : free(t.cap, t.built);
	const districtColumns: Column<Cap>[] = [
		{
			id: 'district',
			label: 'District',
			value: (t) => nameOf(names, t.district),
			cell: districtCell
		},
		{ id: 'built', label: 'Built', value: (t) => t.built, right: true },
		{ id: 'cap', label: 'Cap', value: (t) => t.cap, cell: capCell, right: true },
		{ id: 'free', label: 'Free', value: freeOf, cell: freeCell, right: true }
	];
	const sourceText = (s: CapSource[]) =>
		s
			.map(
				(x) =>
					`${x.value > 0 ? '+' : ''}${x.key.endsWith('_mult') ? `${Math.round(x.value * 100)} %` : x.value} ${title(x.from)}${x.blocked ? ' (behind a blocker)' : ''}`
			)
			.join('\n');
</script>

{#snippet districtCell(t: Cap)}<span title={sourceText(t.sources)}
		><DistrictName name={nameOf(names, t.district)} color={colors[t.district]} /></span
	>{/snippet}
{#snippet capCell(t: Cap)}{t.cap ?? '–'}{#if t.sources.some((s) => s.blocked)}<span
			class="text-amber-600"
			title="includes features behind blockers">*</span
		>{/if}{/snippet}
{#snippet freeCell(t: Cap)}<span
		class="font-semibold"
		title={t.cap !== null && free(t.cap, t.built) < t.cap - t.built
			? `${t.cap - t.built} by its cap, but the planet's limit is reached`
			: ''}>{freeOf(t) ?? ''}</span
	>{/snippet}

<div class="flex flex-col gap-3 text-sm">
	<div>
		<div class="mb-1 font-semibold">
			Districts {caps.built}{#if caps.limit !== null}
				/ {caps.limit}{/if}
			<span class="font-normal text-gray-500"
				>{caps.limit === null
					? '— a habitat’s limit depends on its capital tier and system, not computed'
					: `— size + ${caps.limitSources.length ? sourceText(caps.limitSources).replaceAll('\n', ', ') : 'nothing else'}`}</span
			>
		</div>
		<SortTable
			rows={caps.types}
			columns={districtColumns}
			key={(t) => t.district}
			sort={{ column: '', desc: false }}
		/>
	</div>

	{#if features.length}
		<div>
			<div class="mb-1 font-semibold">Features</div>
			{#each features as d, i (i)}
				<div>
					<InfoPopup explanation={explain[`deposit:${d.key}`]}
						>{title(`deposit:${d.key}`)}</InfoPopup
					>
					<Effects explanation={explain[`deposit:${d.key}`]} />
				</div>
			{/each}
		</div>
	{/if}

	{#if blocked.length}
		<div>
			<div class="mb-1 font-semibold">
				Blockers <span class="font-normal text-gray-500"
					>— each takes districts from the limit until cleared</span
				>
			</div>
			{#each blocked as d, i (i)}
				<div class="mb-1">
					<span class="text-amber-600">⛔</span>
					<InfoPopup explanation={explain[`deposit:${d.key}`]}
						>{title(`deposit:${d.key}`)}</InfoPopup
					>
					<span class="text-xs text-gray-500">{explain[`deposit:${d.key}`]?.facts.join(' · ')}</span
					>
					{#if d.swap}
						<div class="ml-5">
							hides <InfoPopup explanation={explain[`deposit:${d.swap}`]}
								>{title(`deposit:${d.swap}`)}</InfoPopup
							>
							<Effects explanation={explain[`deposit:${d.swap}`]} />
						</div>
					{/if}
					{#if hintFor(d.key)}
						<div class="ml-5 text-xs">
							clearing: <BlockerHint hint={hintFor(d.key)!} names={hints!.names} />
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if modifiers.length}
		<div>
			<div class="mb-1 font-semibold">Modifiers</div>
			{#each modifiers as m (m.key)}
				<div class="mb-1">
					<div class="flex justify-between gap-3">
						<InfoPopup explanation={explain[`modifier:${m.key}`]}>{m.name}</InfoPopup>
						<span class="shrink-0 text-gray-500 tabular-nums" title={m.until ?? ''}
							>{m.until ? timeLeft(date, m.until) : 'permanent'}</span
						>
					</div>
					<Effects explanation={explain[`modifier:${m.key}`]} />
				</div>
			{/each}
		</div>
	{/if}
</div>
