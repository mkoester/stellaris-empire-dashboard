<script lang="ts">
	import EthicChip from './EthicChip.svelte';
	import type { AttractionSource, Change, RuleRow, Unlock } from './ethicSources.ts';
	import InfoPopup from './InfoPopup.svelte';
	import SortTable from './SortTable.svelte';
	import type { Column } from './sort.ts';
	import { describe } from './triggers.ts';
	import type { EthicAxis, Explanation } from './types.ts';

	// Everything that draws pops to each ethic, the governing ethics and the shift speed
	// (#lib/ethicSources.ts): the ethic's own rules and every modifier, which apply to us (✓, or on
	// how many colonies; ? the save cannot tell) and how the player can change them.
	type Source = AttractionSource & {
		name: string;
		ref: string | null;
		applies: boolean | number | null;
		change: Change;
		unlock: Unlock;
		holders: { name: string; council: boolean }[];
	};
	type Group = {
		target: string;
		name: string;
		ours: boolean;
		weight: number | null;
		computed: { known: number; open: number } | null;
		rules: RuleRow[];
		modifiers: Source[];
	};
	let {
		groups,
		axes,
		explain
	}: { groups: Group[]; axes: Record<string, EthicAxis>; explain: Record<string, Explanation> } =
		$props();

	// per viewer, not stored: what applies or can be changed (the default), what applies, or all
	let show = $state<'useful' | 'applies' | 'all'>('useful');

	const on = (a: boolean | number | null) => a === true || (typeof a === 'number' && a > 0);
	const mark = (a: boolean | number | null) =>
		a === null ? '?' : typeof a === 'number' ? (a > 0 ? `✓ ×${a}` : '✗') : a ? '✓' : '✗';
	const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 1000) / 10} %`;
	const times = (v: number) => `×${Math.round(v * 100) / 100}`;
	const TONE = {
		now: 'text-green-700 dark:text-green-500',
		slow: 'text-amber-600',
		no: 'text-gray-500'
	};

	// promoting or suppressing a faction leaves a static modifier on the empire: say so
	const kindOf = (m: Source) =>
		m.kind === 'static' && /^(promoted|suppressed)_/.test(m.key) ? 'faction' : m.kind;

	const shownModifiers = (g: Group) =>
		g.modifiers
			.filter((m) =>
				show === 'all'
					? true
					: show === 'applies'
						? on(m.applies)
						: // what this empire can never have (the nomads' twin of an agenda) left out
							on(m.applies) || (m.change.how !== 'no' && m.unlock.forUs !== false)
			)
			// what applies first, then what can be changed now, then the rest; biggest first
			.sort(
				(a, b) =>
					Number(on(b.applies)) - Number(on(a.applies)) ||
					Number(b.change.how === 'now') - Number(a.change.how === 'now') ||
					Math.abs(b.value) - Math.abs(a.value)
			);
	const shownRules = (g: Group) =>
		g.rules.filter((r) => (show === 'all' ? true : r.applies !== false));

	const modifierColumns: Column<Source & { i: number }>[] = [
		{
			id: 'applies',
			label: 'Ours',
			value: (m) => (m.applies === null ? null : Number(on(m.applies))),
			cell: appliesCell
		},
		{ id: 'name', label: 'Source', value: (m) => m.name, cell: nameCell },
		{ id: 'kind', label: 'Kind', value: (m) => kindOf(m), cell: kindCell },
		{ id: 'value', label: 'Attraction', value: (m) => m.value, cell: valueCell, right: true },
		{ id: 'change', label: 'Change it', value: (m) => m.change.how, cell: changeCell },
		{
			id: 'needs',
			label: 'How to get it',
			value: (m) => (m.unlock.available === null ? null : Number(m.unlock.available)),
			cell: needsCell,
			title:
				'what it takes (the data DB knows nothing of buildings yet): ✓ possible now, ✗ not yet, — not for this empire'
		}
	];
	const ruleColumns: Column<RuleRow & { i: number }>[] = [
		{
			id: 'applies',
			label: 'Ours',
			value: (r) => (r.applies === null ? null : Number(r.applies)),
			cell: ruleApplies
		},
		{
			id: 'kind',
			label: 'Effect',
			value: (r) => r.factor,
			cell: ruleEffect,
			title:
				"×: an empire-wide factor on the ethic (country_attraction); reason: a line of the game's attraction tooltip (pop_attraction_tag), for pops it applies to"
		},
		{ id: 'what', label: 'Rule', value: (r) => r.description, cell: ruleWhat }
	];
</script>

{#snippet appliesCell(m: Source)}<span
		class={on(m.applies) ? 'font-semibold text-green-700 dark:text-green-500' : 'text-gray-500'}
		title={m.applies === null
			? 'the save cannot tell'
			: typeof m.applies === 'number'
				? m.kind === 'building'
					? 'this many built (each counted, assumed — not yet checked in game)'
					: 'on this many colonies'
				: ''}>{mark(m.applies)}</span
	>{/snippet}
{#snippet nameCell(m: Source)}<InfoPopup explanation={m.ref ? explain[m.ref] : undefined}
		>{m.name}</InfoPopup
	>{#if m.scope && m.scope !== 'country'}<span class="text-xs text-gray-500">
			· {m.scope}</span
		>{/if}{/snippet}
{#snippet kindCell(m: Source)}<span class="text-gray-500">{kindOf(m)}</span>{/snippet}
{#snippet valueCell(m: Source)}<span class={m.value < 0 ? 'text-red-600' : ''}>{pct(m.value)}</span
	>{#if m.after !== undefined}<span
			class="text-xs text-gray-500"
			title="while preparing, then after launch">&nbsp;then {pct(m.after)}</span
		>{/if}{/snippet}
{#snippet needsCell(m: Source)}{#if m.unlock.forUs === false}<span class="text-gray-500"
			>— not for us</span
		>{:else}{#if m.unlock.available !== null}<span
				class={m.unlock.available ? 'text-green-700 dark:text-green-500' : 'text-gray-500'}
				>{m.unlock.available ? '✓ ' : '✗ '}</span
			>{/if}<span class="text-xs"
			>{#each m.unlock.needs as n, i (i)}{i
					? n.any && m.unlock.needs[i - 1].any
						? ' or '
						: ' · '
					: ''}<InfoPopup explanation={n.ref ? explain[n.ref] : undefined}>{n.text}</InfoPopup
				>{/each}{#if m.holders.length}<span class="text-gray-500"
					>&nbsp;— have it: {m.holders
						.map((l) => `${l.name}${l.council ? ' (on the council)' : ''}`)
						.join(', ')}</span
				>{/if}</span
		>{/if}{/snippet}
{#snippet changeCell(m: Source)}<span class={TONE[m.change.how]}>{m.change.label}</span>{/snippet}
{#snippet ruleApplies(r: RuleRow)}<span
		class={r.applies ? 'font-semibold text-green-700 dark:text-green-500' : 'text-gray-500'}
		title={r.applies === null
			? 'the save cannot tell (a script value, or what it asks is not read)'
			: ''}>{r.applies === null ? '?' : r.applies ? '✓' : '✗'}</span
	>{/snippet}
{#snippet ruleEffect(r: RuleRow)}{#if r.kind === 'country'}<b
			class={(r.factor ?? 1) < 1 ? 'text-red-600' : ''}
			>{r.factor !== null ? times(r.factor) : '× script value'}</b
		>{:else}<span class="text-gray-500">reason</span>{/if}{/snippet}
{#snippet ruleWhat(r: RuleRow)}
	{r.description ?? ''}
	<div class="text-xs text-gray-500">if: {describe(r.trigger)}</div>
{/snippet}

<div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
	<span class="text-gray-500">show</span>
	{#each [['useful', 'what applies or can be changed'], ['applies', 'what applies'], ['all', 'everything']] as const as [k, label] (k)}
		<button
			class="rounded border px-2 {show === k
				? 'border-sky-500 text-sky-600 dark:text-sky-400'
				: 'border-gray-300 dark:border-gray-700'}"
			onclick={() => (show = k)}>{label}</button
		>
	{/each}
</div>

{#each groups as g (g.target)}
	{@const mods = shownModifiers(g)}
	{@const rules = shownRules(g)}
	<details
		class="mb-3 rounded border border-gray-300 p-2 dark:border-gray-700"
		open={g.ours || g.target === 'government'}
	>
		<summary class="cursor-pointer">
			<span class="font-semibold"
				>{#if g.target.startsWith('ethic_')}<EthicChip
						ethic={g.target}
						name={g.name}
						{axes}
						explanation={explain[`ethic:${g.target}`]}
					/>{:else}{g.name}{/if}</span
			>
			{#if g.ours}<span class="text-xs text-gray-500">ours</span>{/if}
			{#if g.weight !== null}
				<span
					class="text-sm"
					title="the empire-wide factor on this ethic, as the save holds it (ethics_attraction); the known part is the product of the rules below that apply"
					>· empire-wide <b>{times(g.weight)}</b>{#if g.computed}<span class="text-gray-500"
							>&nbsp;(known {times(
								g.computed.known
							)}{#if Math.abs(g.weight - g.computed.known) > 0.005}, {times(
									g.weight / (g.computed.known || 1)
								)} from {g.computed.open} rule{g.computed.open === 1 ? '' : 's'} the save cannot tell{/if})</span
						>{/if}</span
				>
			{/if}
			<span class="text-sm text-gray-500"
				>· {g.modifiers.filter((m) => on(m.applies)).length} of {g.modifiers.length} modifiers apply</span
			>
		</summary>
		{#if rules.length}
			<h4 class="mt-2 text-sm font-semibold">The ethic's own rules</h4>
			<SortTable
				rows={rules.map((r, i) => ({ ...r, i }))}
				columns={ruleColumns}
				key={(r) => r.i}
				sort={{ column: '', desc: false }}
			/>
		{/if}
		{#if mods.length}
			<h4 class="mt-2 text-sm font-semibold">Modifiers</h4>
			<SortTable
				rows={mods.map((m, i) => ({ ...m, i }))}
				columns={modifierColumns}
				key={(m) => m.i}
				sort={{ column: '', desc: false }}
			/>
		{:else}<p class="mt-2 text-sm text-gray-500">
				No modifier {show === 'all' ? '' : 'that applies or can be changed '}moves it.
			</p>{/if}
	</details>
{/each}
