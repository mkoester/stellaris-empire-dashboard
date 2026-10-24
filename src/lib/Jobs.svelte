<script lang="ts">
	import ResourceChips from './ResourceChips.svelte';
	import { fmt } from './format.ts';
	import InfoPopup from './InfoPopup.svelte';
	import { stratumName, type JobRow } from './jobs.ts';
	import SortTable from './SortTable.svelte';
	import type { Column } from './sort.ts';
	import type { Explanation } from './types.ts';

	let { rows, explain = {} }: { rows: JobRow[]; explain?: Record<string, Explanation> } = $props();

	const open = (r: JobRow) => (r.positions === null ? null : Math.max(r.positions - r.filled, 0));
	// all resources summed, for sorting: what a job moves in total
	const total = (r: JobRow, sign: number) =>
		Object.values(r.flows ?? {}).reduce((n, v) => n + (Math.sign(v) === sign ? Math.abs(v) : 0), 0);
	const columns: Column<JobRow>[] = [
		{ id: 'name', label: 'Job', value: (r) => r.name, cell: job },
		{ id: 'stratum', label: 'Stratum', value: (r) => r.category, cell: stratum },
		{ id: 'pops', label: 'Pops', value: (r) => r.pops, cell: pops, right: true },
		{
			id: 'positions',
			label: 'Positions',
			value: (r) => r.positions,
			cell: positions,
			right: true
		},
		{ id: 'open', label: 'Open', value: open, cell: openCell, right: true },
		{ id: 'uses', label: 'Uses', value: (r) => total(r, -1), cell: uses },
		{ id: 'produces', label: 'Produces', value: (r) => total(r, 1), cell: produces }
	];
</script>

{#snippet job(r: JobRow)}<InfoPopup explanation={explain[`job:${r.type}`]}>{r.name}</InfoPopup
	>{/snippet}
{#snippet stratum(r: JobRow)}<span class="text-gray-500">{stratumName(r.category)}</span>{/snippet}
{#snippet pops(r: JobRow)}{fmt(r.pops)}{/snippet}
{#snippet positions(r: JobRow)}{r.positions === null ? '∞' : fmt(r.positions)}{/snippet}
{#snippet openCell(r: JobRow)}{open(r) === null ? '' : fmt(open(r)!)}{/snippet}
{#snippet uses(r: JobRow)}<span title={r.estimated ? 'share of the empire total by pops' : ''}
		>{r.estimated ? '≈ ' : ''}<ResourceChips flows={r.flows ?? {}} sign={-1} /></span
	>{/snippet}
{#snippet produces(r: JobRow)}<span title={r.estimated ? 'share of the empire total by pops' : ''}
		>{r.estimated ? '≈ ' : ''}<ResourceChips flows={r.flows ?? {}} sign={1} /></span
	>{/snippet}

{#if rows.length === 0}
	<p>No jobs.</p>
{:else}
	<SortTable {rows} {columns} key={(r) => r.type} sort={{ column: '', desc: false }} />
{/if}
