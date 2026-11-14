<script lang="ts">
	import EmpireName from '#lib/EmpireName.svelte';
	import { fmt } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { OfferEntry, Sale } from '#lib/slaveMarket.ts';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const ours = $derived(new Set(data.ours));
	const active = $derived(data.offers.filter((e) => e.active));
	const past = $derived(data.offers.filter((e) => !e.active));
	const mine = (species: string) => (ours.has(species) ? 'bg-amber-50 dark:bg-amber-950' : '');

	const species: Column<OfferEntry> = {
		id: 'species',
		label: 'species',
		value: (e) => e.offer.species,
		cell: speciesCell
	};
	const pops: Column<OfferEntry> = {
		id: 'pops',
		label: 'pops',
		value: (e) => e.offer.pops,
		cell: popsCell,
		right: true
	};
	const seller: Column<OfferEntry> = {
		id: 'seller',
		label: 'seller',
		value: (e) => e.offer.sellerName,
		cell: sellerCell
	};
	const nowColumns: Column<OfferEntry>[] = [
		species,
		pops,
		seller,
		{ id: 'since', label: 'offered since', value: (e) => e.firstSeen }
	];
	const pastColumns: Column<OfferEntry>[] = [
		species,
		pops,
		seller,
		{ id: 'from', label: 'offered', value: (e) => e.firstSeen, cell: whenCell },
		{ id: 'outcome', label: 'then', value: (e) => e.sale?.buyer ?? '', cell: outcomeCell }
	];
	const saleColumns: Column<Sale>[] = [
		{ id: 'date', label: 'date', value: (s) => s.date },
		{ id: 'species', label: 'species', value: (s) => s.species },
		{ id: 'pops', label: 'pops', value: (s) => s.pops, right: true },
		{ id: 'seller', label: 'seller', value: (s) => s.seller, cell: saleSeller },
		{ id: 'buyer', label: 'buyer', value: (s) => s.buyer, cell: saleBuyer }
	];
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Slave market</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<p class="mb-4 text-sm text-gray-500">
	{data.slaver ? 'Our empire allows slavery.' : 'Our empire does not allow slavery.'}
	{#if data.ours.length}Rows of species we give full citizenship ({data.ours.join(', ')}) are
		marked.{/if}
	{#if data.bans?.organic || data.bans?.sentient}<span class="text-amber-700 dark:text-amber-400"
			>{` Galactic Community: ${data.bans.sentient ? 'no sentient pops' : 'no organic sentient pops'} may be sold.`}</span
		>{/if}
</p>

<h2 class="mb-2 text-xl font-semibold">For sale now</h2>
{#if active.length === 0}
	<p class="mb-6 text-gray-500">Nothing.</p>
{:else}
	<div class="mb-6">
		<SortTable
			rows={active}
			columns={nowColumns}
			key={(e) => `${e.offer.popGroup}|${e.offer.seller}`}
			rowClass={(e) => mine(e.offer.species)}
		/>
	</div>
{/if}

{#if past.length > 0}
	<h2 class="mb-2 text-xl font-semibold">Offered before</h2>
	<div class="mb-6">
		<SortTable
			rows={past}
			columns={pastColumns}
			key={(e) => `${e.offer.popGroup}|${e.offer.seller}|${e.firstSeen}`}
			sort={{ column: '', desc: false }}
			rowClass={(e) => mine(e.offer.species)}
		/>
	</div>
{/if}

<h2 class="mb-2 text-xl font-semibold">Sales</h2>
{#if !data.mod}
	<p class="mb-2 text-sm text-gray-500">
		Who bought what only the companion mod (0.12.0+) can tell: the save keeps the offers alone, and
		sold pops move into new pop groups of the buyer.
	</p>
{/if}
{#if data.sales.length === 0}
	<p class="mb-2 text-gray-500">None logged.</p>
{:else}
	<SortTable
		rows={data.sales}
		columns={saleColumns}
		key={(s) => [s.date, s.species, s.pops, s.buyer, s.seller].join('|')}
		sort={{ column: 'date', desc: true }}
		rowClass={(s) => mine(s.species)}
	/>
{/if}
{#if data.hiddenSales}
	<p class="mt-2 text-sm text-gray-500">
		{data.hiddenSales} sales between other empires are not shown: the game does not tell us those, and
		this is a {data.barred} game.
	</p>
{/if}

{#snippet speciesCell(e: OfferEntry)}{e.offer.species}{/snippet}
{#snippet popsCell(e: OfferEntry)}<span title="of a pop group of {fmt(e.offer.groupSize)}"
		>{fmt(e.offer.pops)}</span
	>{/snippet}
{#snippet sellerCell(e: OfferEntry)}<EmpireName name={e.offer.sellerName} />{/snippet}
{#snippet whenCell(e: OfferEntry)}<span class="tabular-nums"
		>{e.firstSeen === e.lastSeen ? e.firstSeen : `${e.firstSeen} – ${e.lastSeen}`}</span
	>{/snippet}
{#snippet outcomeCell(e: OfferEntry)}{#if e.sale}sold {e.sale.date} to <EmpireName
			name={e.sale.buyer}
		/>{:else}<span
			class="text-gray-500"
			title="the first save without it; sold or taken off the market — only the companion mod logs sales"
			>gone by {e.gone ?? '?'}</span
		>{/if}{/snippet}
{#snippet saleSeller(s: Sale)}<EmpireName name={s.seller} />{/snippet}
{#snippet saleBuyer(s: Sale)}<EmpireName name={s.buyer} />{/snippet}
