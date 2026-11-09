<script lang="ts">
	import {
		designComponents,
		designLabel,
		designStats,
		designStatus,
		type DesignStatus
	} from '#lib/designStats.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import { shipName } from '#lib/ships.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';
	import type { Fleet, ShipDesign } from '#lib/types.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const sizeName = (size: string) => data.parts.sizes[size]?.name ?? shipName(size);
	const byId = $derived(new Map(data.designs.map((d) => [d.id, d])));
	const label = (d: ShipDesign) => designLabel(d, sizeName(d.size));
	const labelOf = (id: number) => {
		const d = byId.get(id);
		return d ? label(d) : `design ${id}`;
	};
	const component = (key: string) => data.parts.components[key]?.name ?? pretty(key);

	// the design shown in detail: picked here, or `?design=` (a link from elsewhere)
	let picked = $state<number | null>(null);
	const selected = $derived(byId.get(picked ?? data.selected ?? -1) ?? null);
	const stats = $derived(selected && data.hasParts ? designStats(selected, data.parts) : null);
	const usedBy = $derived(
		selected
			? data.fleets.flatMap((f) =>
					(f.designs ?? [])
						.filter((x) => x.designId === selected.id)
						.map((x) => ({ fleet: f.name, count: x.count }))
				)
			: []
	);

	const STATUS: Record<DesignStatus, { text: string; cls: string; title: string }> = {
		saved: { text: 'saved', cls: 'text-gray-500', title: 'saved in the ship designer' },
		unused: { text: 'saved, unused', cls: 'text-gray-500', title: 'saved, no ship built to it' },
		unofficial: {
			text: 'unofficial',
			cls: 'text-amber-600',
			title: 'ships are built to it, but it is no longer saved in the ship designer'
		}
	};

	const fleetColumns: Column<Fleet>[] = [
		{ id: 'name', label: 'Fleet', value: (f) => f.name },
		{ id: 'ships', label: 'Ships', value: (f) => f.ships, right: true },
		{ id: 'power', label: 'Power', value: (f) => Math.round(f.power), right: true },
		{ id: 'at', label: 'Where', value: (f) => f.route.at || null },
		{
			id: 'designs',
			label: 'Designs',
			value: (f) => (f.designs ?? []).map((d) => labelOf(d.designId)).join(', ') || null,
			cell: fleetDesigns
		}
	];
	const designColumns: Column<ShipDesign>[] = [
		{ id: 'name', label: 'Design', value: label, cell: designName },
		{ id: 'size', label: 'Size', value: (d) => sizeName(d.size) },
		{ id: 'role', label: 'Role', value: (d) => (d.role ? pretty(d.role) : null) },
		{ id: 'ships', label: 'Ships', value: (d) => d.ships, right: true },
		{ id: 'status', label: 'Status', value: (d) => designStatus(d), cell: statusCell }
	];
	// unofficial designs first, then those in use, then saved but unused — each in the save's order
	const ORDER: Record<DesignStatus, number> = { unofficial: 0, saved: 1, unused: 2 };
	const designRows = $derived(
		[...data.designs].sort((a, b) => ORDER[designStatus(a)] - ORDER[designStatus(b)])
	);
	const res = (r: Record<string, number>) =>
		Object.entries(r)
			.map(([k, v]) => `${fmt(v)} ${pretty(k)}`)
			.join(', ') || '–';
</script>

{#snippet fleetDesigns(f: Fleet)}{#each f.designs ?? [] as d, i (d.designId)}{i ? ', ' : ''}<button
			type="button"
			class="underline decoration-dotted"
			class:text-amber-600={byId.get(d.designId)?.saved === false}
			onclick={() => (picked = d.designId)}>{labelOf(d.designId)}</button
		>{` ×${d.count}`}{/each}{/snippet}
{#snippet designName(d: ShipDesign)}<button
		type="button"
		class="text-left underline decoration-dotted"
		class:font-semibold={selected?.id === d.id}
		onclick={() => (picked = d.id)}>{label(d)}</button
	>{/snippet}
{#snippet statusCell(d: ShipDesign)}{@const s = STATUS[designStatus(d)]}<span
		class={s.cls}
		title={s.title}>{s.text}</span
	>{/snippet}

<div class="flex flex-wrap items-baseline gap-x-6">
	<h1 class="text-2xl font-semibold">Fleets</h1>
	{#if data.date}<span class="ml-auto text-sm text-gray-500">{data.date}</span>{/if}
</div>

{#if data.date === null}
	<p class="mt-4 text-sm text-gray-500">
		No save read by this dashboard version yet holds the designs — the next autosave will.
	</p>
{:else}
	<div class="mt-4 grid items-start gap-6 xl:grid-cols-2">
		<Panel title="Military fleets">
			{#if data.fleets.length}
				<SortTable
					rows={data.fleets}
					columns={fleetColumns}
					key={(f) => f.fleetId ?? f.name}
					sort={{ column: '', desc: false }}
				/>
			{:else}<p class="text-sm">none</p>{/if}
		</Panel>
		<Panel
			title="Ship designs"
			note="Saved in the ship designer, or unofficial: ships are built to it but it is no longer saved."
		>
			<SortTable
				rows={designRows}
				columns={designColumns}
				key={(d) => d.id}
				sort={{ column: '', desc: false }}
			/>
		</Panel>
	</div>

	{#if selected}
		<div class="mt-6">
			<Panel
				title={label(selected)}
				note="Base values from the game files, before techs, traditions and other empire modifiers."
			>
				<p class="mb-2 text-sm">
					{sizeName(selected.size)}{selected.role ? ` · ${pretty(selected.role)}` : ''} ·
					<span class={STATUS[designStatus(selected)].cls}
						>{STATUS[designStatus(selected)].text}</span
					>{selected.autoGen ? ' · auto-generated' : ''}
					{#if selected.upgradeTo !== null}
						· its ships upgrade to
						<button
							type="button"
							class="underline decoration-dotted"
							onclick={() => (picked = selected.upgradeTo)}>{labelOf(selected.upgradeTo)}</button
						>
					{/if}
				</p>
				{#if usedBy.length}
					<p class="mb-2 text-sm">
						<span class="text-gray-500">In fleets:</span>
						{usedBy.map((u) => `${u.fleet} ×${u.count}`).join(', ')}
					</p>
				{/if}

				<div class="grid items-start gap-6 lg:grid-cols-2">
					<div>
						<h3 class="mb-1 font-semibold">Sections and components</h3>
						{#each selected.sections as s, i (i)}
							<div class="mb-2 text-sm">
								<div class="text-gray-500">{pretty(s.slot)} · {s.template}</div>
								<ul class="ml-4 list-disc">
									{#each s.components as c, j (j)}<li>{component(c.template)}</li>{/each}
									{#if !s.components.length}<li class="text-gray-500">no components</li>{/if}
								</ul>
							</div>
						{/each}
						{#if selected.required.length}
							<div class="text-sm">
								<div class="text-gray-500">Core components</div>
								<ul class="ml-4 list-disc">
									{#each selected.required as c, j (j)}<li>{component(c)}</li>{/each}
								</ul>
							</div>
						{/if}
					</div>

					{#if stats}
						<div>
							<h3 class="mb-1 font-semibold">Stats</h3>
							<dl class="grid grid-cols-[auto_1fr] gap-x-4 text-sm">
								<dt class="text-gray-500">Hull</dt>
								<dd class="tabular-nums">{fmt(stats.hull)}</dd>
								<dt class="text-gray-500">Armor</dt>
								<dd class="tabular-nums">{fmt(stats.armor)}</dd>
								<dt class="text-gray-500">Shields</dt>
								<dd class="tabular-nums">{fmt(stats.shield)}</dd>
								<dt class="text-gray-500">Evasion</dt>
								<dd class="tabular-nums">{fmt(stats.evasion)} %</dd>
								<dt class="text-gray-500">Speed</dt>
								<dd class="tabular-nums">{fmt(stats.speed)}</dd>
								<dt class="text-gray-500">Power</dt>
								<dd class="tabular-nums" class:text-red-600={stats.powerUsed > stats.powerMax}>
									{fmt(stats.powerUsed)} / {fmt(stats.powerMax)}
								</dd>
								<dt class="text-gray-500">Cost</dt>
								<dd>{res(stats.cost)}</dd>
								<dt class="text-gray-500">Upkeep</dt>
								<dd>{res(stats.upkeep)} a month</dd>
								{#each Object.entries(stats.other) as [k, v] (k)}
									<dt class="text-gray-500">{pretty(k)}</dt>
									<dd class="tabular-nums">{fmt(v)}</dd>
								{/each}
							</dl>
							{#if stats.missing.length}
								<p class="mt-2 text-xs text-amber-600">
									Not in the game data, left out: {stats.missing.join(', ')}
								</p>
							{/if}
						</div>
					{:else if !data.hasParts}
						<p class="text-sm text-gray-500">
							Stats need game data from a newer extractor (ship parts, 2026-11-09).
						</p>
					{/if}
				</div>

				{#if stats?.weapons.length}
					<h3 class="mt-4 mb-1 font-semibold">Weapons</h3>
					<table class="text-sm">
						<thead>
							<tr class="text-left text-gray-500">
								<th class="p-1">Weapon</th>
								<th class="p-1 text-right">×</th>
								<th class="p-1 text-right">Damage</th>
								<th class="p-1 text-right">Cooldown</th>
								<th class="p-1 text-right">Range</th>
								<th class="p-1 text-right">Accuracy</th>
								<th class="p-1 text-right">Tracking</th>
								<th
									class="p-1 text-right"
									title="count × mean damage ÷ cooldown, to compare designs">Dmg / cooldown</th
								>
							</tr>
						</thead>
						<tbody class="tabular-nums">
							{#each stats.weapons as w (w.key)}
								<tr>
									<td class="p-1">{w.name}</td>
									<td class="p-1 text-right">{w.count}</td>
									<td class="p-1 text-right">{fmt(w.minDamage)}–{fmt(w.maxDamage)}</td>
									<td class="p-1 text-right">{fmt(w.cooldown)}</td>
									<td class="p-1 text-right">{fmt(w.range)}</td>
									<td class="p-1 text-right">{Math.round(w.accuracy * 100)} %</td>
									<td class="p-1 text-right">{Math.round(w.tracking * 100)} %</td>
									<td class="p-1 text-right">{w.perCooldown.toFixed(2)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="mt-1 text-xs text-gray-500">
						Cooldown in the game file's unit (component_templates/weapon_components.csv). The last
						column compares designs; it is not the designer's damage per day.
					</p>
				{/if}
				{#if !designComponents(selected).length}
					<p class="text-sm text-gray-500">This design has no components.</p>
				{/if}
			</Panel>
		</div>
	{/if}
{/if}
