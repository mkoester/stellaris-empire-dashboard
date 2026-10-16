<script lang="ts">
	import { resolve } from '$app/paths';
	import { fmt } from '../format.ts';
	import type { Colony } from '../types.ts';
	import Panel from './Panel.svelte';

	// Last month's pop movement between the empire's colonies: who loses pops to emigration, who
	// gains by immigration, next to natural growth.
	// node: the save shown when not following the game, so the details page stays on it
	let { colonies, node = null }: { colonies: Colony[]; node?: number | null } = $props();
	const details = $derived(
		node === null ? resolve('/migration') : resolve(`/migration?node=${node}`)
	);

	const rows = $derived(
		colonies
			.filter((c) => c.growth)
			.map((c) => ({
				name: c.name,
				out: -(c.growth!.by.emigration ?? 0),
				in: c.growth!.by.immigration ?? 0,
				growth: c.growth!.by.growth ?? 0,
				net: c.growth!.net
			}))
	);
	const total = $derived(rows.reduce((n, r) => n + r.in, 0));
	const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '0');
</script>

<Panel
	title="Migration"
	note="Last month, in pops. Emigrants leave for the empire's other colonies."
>
	<div class="mb-1">
		moving: <b>{fmt(total)}</b> a month · <a class="underline" href={details}>details</a>
	</div>
	<table class="text-left text-sm">
		<thead>
			<tr class="border-b border-gray-300 dark:border-gray-700">
				<th class="p-1">Colony</th>
				<th class="p-1 text-right">Leaving</th>
				<th class="p-1 text-right">Arriving</th>
				<th class="p-1 text-right">Growth</th>
				<th class="p-1 text-right">Net</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r, i (i)}
				<tr class="border-b border-gray-200 dark:border-gray-800">
					<td class="p-1">{r.name}</td>
					<td class="p-1 text-right {r.out ? 'text-red-600' : 'text-gray-500'}"
						>{r.out ? `−${fmt(r.out)}` : '0'}</td
					>
					<td class="p-1 text-right {r.in ? 'text-green-600' : 'text-gray-500'}"
						>{r.in ? `+${fmt(r.in)}` : '0'}</td
					>
					<td class="p-1 text-right">{signed(r.growth)}</td>
					<td class="p-1 text-right font-semibold">{signed(r.net)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</Panel>
