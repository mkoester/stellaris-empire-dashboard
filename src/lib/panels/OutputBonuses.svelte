<script lang="ts">
	import { colorOf } from '#lib/colors.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { realGain } from '#lib/outputBonuses.ts';
	import type { outputModel } from '#lib/server/outputModel.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import Panel from './Panel.svelte';

	// Job output bonuses per colony and resource (#lib/outputBonuses.ts): what the counted sources
	// add up to, what the colony actually got (the save's output ÷ its workforce's base), and the rest.
	type ColonyOut = ReturnType<typeof outputModel>[number];
	type Row = ColonyOut['resources'][number];
	let { colonies }: { colonies: ColonyOut[] } = $props();

	const pct = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n) * 100)} %`;
	// the multiplier one more +10 % works against: the measured one where there is one
	const total = (r: Row) => r.measured ?? r.counted;
	// each source once per resource, summed over the jobs it reaches, weighted by their base output
	const lines = (r: Row) => {
		const by = new Map<string, { name: string; kind: string; value: number }>();
		for (const j of r.jobs) {
			const w = r.base ? ((j.workforce / 100) * (j.base + j.add)) / r.base : 0;
			for (const l of j.lines) {
				const k = `${l.kind}:${l.ref}:${l.name}`;
				const was = by.get(k) ?? { name: l.name, kind: l.kind, value: 0 };
				// an add is per 100 workforce of its job: shown as written; a mult by its jobs' weight
				by.set(k, {
					...was,
					value: l.kind === 'add' ? l.value * l.share : was.value + l.value * l.share * w
				});
			}
		}
		return [...by.values()].sort((a, b) => b.value - a.value);
	};
	const columns: Column<Row>[] = [
		{ id: 'resource', label: 'Resource', value: (r) => r.resource, cell: resource },
		{ id: 'booked', label: 'Output', value: (r) => r.booked, cell: booked, right: true },
		{
			id: 'base',
			label: 'Base',
			value: (r) => r.base,
			cell: base,
			right: true,
			title: 'workforce (with job efficiency) ÷ 100 × base output per job, before multipliers'
		},
		{ id: 'counted', label: 'Counted bonuses', value: (r) => r.counted, cell: counted },
		{
			id: 'rest',
			label: 'Rest',
			value: (r) => r.rest,
			cell: rest,
			right: true,
			title:
				'what the counted sources do not explain yet: e.g. Pleased (+25 % for workers and specialists, when the engine applies it) and flat output from buildings'
		},
		{ id: 'total', label: 'Total', value: (r) => total(r), cell: tot, right: true },
		{
			id: 'more',
			label: '+10 % is',
			value: (r) => realGain(0.1, total(r)),
			cell: more,
			right: true,
			title: 'what one more +10 % bonus for this resource is really worth here'
		}
	];
</script>

{#snippet resource(r: Row)}<span style:color={colorOf(r.resource)}>{pretty(r.resource)}</span
	>{/snippet}
{#snippet booked(r: Row)}{fmt(r.booked)}{/snippet}
{#snippet base(r: Row)}{fmt(r.base)}{/snippet}
{#snippet counted(r: Row)}
	<details>
		<summary class="cursor-pointer tabular-nums">{pct(r.counted)}</summary>
		<ul class="text-xs">
			{#each lines(r) as l, i (i)}
				<li class={l.value < 0 ? 'text-red-600' : ''}>
					{l.kind === 'add' ? `+${fmt(l.value)} per job` : pct(l.value)} · {l.name}
				</li>
			{/each}
		</ul>
	</details>
{/snippet}
{#snippet rest(r: Row)}<span class="text-gray-500">{r.rest === null ? '' : pct(r.rest)}</span
	>{/snippet}
{#snippet tot(r: Row)}×{(1 + total(r)).toFixed(2)}{/snippet}
{#snippet more(r: Row)}{pct(realGain(0.1, total(r)))}{/snippet}

<Panel
	title="Job output bonuses and how they stack"
	note="Per colony and resource: the workforce's base output, the bonuses counted from the game files (empire, colony, governor, species, difficulty) and the rest the colony got on top, measured from the save. Bonuses add up within a resource, so each one more is worth less: +10 % on top of ×2 is +5 %. Click a bonus total for its sources."
>
	<div class="flex flex-col gap-4">
		{#each colonies as c (c.planetId)}
			<div>
				<h3 class="font-semibold">
					{c.colony}
					<span class="text-sm font-normal text-gray-500"
						>stability {fmt(c.stability)} · {pretty(c.designation.replace(/^col_/, ''))}</span
					>
				</h3>
				<div class="overflow-x-auto">
					<SortTable
						rows={c.resources.filter((r) => r.base > 0)}
						{columns}
						key={(r) => r.resource}
						sort={{ column: 'booked', desc: true }}
					/>
				</div>
			</div>
		{/each}
	</div>
</Panel>
