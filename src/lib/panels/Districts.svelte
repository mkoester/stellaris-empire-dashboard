<script lang="ts">
	import BuildingName from '../BuildingName.svelte';
	import DistrictName from '../DistrictName.svelte';
	import { nameOf } from '../format.ts';
	import SortTable from '../SortTable.svelte';
	import type { Column } from '../sort.ts';
	import type { ColonyDistrict } from '../types.ts';
	import Panel from './Panel.svelte';

	// A colony's districts in detail: how many are built, its zones (specialisations) and their
	// buildings by name — a row per zone.
	let {
		districts,
		names,
		colors
	}: {
		districts: ColonyDistrict[];
		names: Record<string, string>;
		colors: Record<string, string>;
	} = $props();

	type Row = {
		key: string;
		type: string;
		built: number;
		zone: string | null;
		buildings: string[] | null;
	};
	const rows: Row[] = $derived(
		districts.flatMap((d) =>
			(d.zones.length ? d.zones : [null]).map((z, i) => ({
				key: `${d.type}:${i}`,
				type: d.type,
				built: d.built,
				zone: z ? nameOf(names, z.type) : null,
				buildings: z ? z.buildings : null
			}))
		)
	);
	const columns: Column<Row>[] = [
		{ id: 'district', label: 'District', value: (r) => nameOf(names, r.type), cell: district },
		{ id: 'built', label: 'Built', value: (r) => r.built, right: true },
		{ id: 'zone', label: 'Zone', value: (r) => r.zone },
		{
			id: 'buildings',
			label: 'Buildings',
			value: (r) =>
				r.buildings === null
					? null
					: r.buildings.map((b) => nameOf(names, b)).join(', ') || 'none yet',
			cell: buildings
		}
	];
</script>

{#snippet buildings(r: Row)}{#if r.buildings !== null}{#each r.buildings as b, i (i)}{i
				? ', '
				: ''}<BuildingName key={b} name={nameOf(names, b)} />{:else}none yet{/each}{/if}{/snippet}
{#snippet district(r: Row)}<DistrictName
		name={nameOf(names, r.type)}
		color={colors[r.type]}
	/>{/snippet}

<Panel
	title="Districts"
	note="Free district slots: see the planet's district caps. Free building slots are computed by the game and not in the save."
>
	<SortTable {rows} {columns} key={(r) => r.key} sort={{ column: '', desc: false }} />
</Panel>
