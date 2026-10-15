<script lang="ts">
	import { resolve } from '$app/paths';
	import { colorOf } from './colors.ts';
	import { pretty } from './format.ts';
	import type { Upcoming } from './events.ts';

	// node: the save shown when not following the game, so planet links stay on that branch.
	let { events, node }: { events: Upcoming[]; node: number | null } = $props();

	const planetHref = (planetId: number) =>
		node === null
			? resolve('/planet/[id]', { id: String(planetId) })
			: resolve(`/planet/[id]?node=${node}`, { id: String(planetId) });

	const inMonths = (m: number) =>
		m <= 0 ? 'now' : m < 1 ? `${Math.round(m * 30)} days` : `${Math.round(m)} mo`;
</script>

{#if events.length === 0}
	<p>Nothing scheduled.</p>
{:else}
	<div class="overflow-x-auto">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-gray-300 dark:border-gray-700">
					<th class="p-1">Due</th>
					<th class="p-1 text-right">In</th>
					<th class="p-1">What</th>
					<th class="p-1">Kind</th>
					<th class="p-1">Details</th>
				</tr>
			</thead>
			<tbody>
				{#each events as e, i (i)}
					<!-- the event in its game colour; the numbers in Details stay plain -->
					<tr class="border-b border-gray-200 dark:border-gray-800" style:color={colorOf(e.tint)}>
						<td class="p-1 whitespace-nowrap" title={e.exact ? 'exact' : 'estimated'}
							>{e.exact ? '' : '≈ '}{e.date}</td
						>
						<td class="p-1 text-right whitespace-nowrap">{inMonths(e.months)}</td>
						<td class="p-1">{e.kind === 'construction' ? pretty(e.what) : e.what}</td>
						<td class="p-1 opacity-75">{e.kind}</td>
						<td class="p-1" style="color: CanvasText">
							{#if e.planetId !== undefined}
								<a class="underline" href={planetHref(e.planetId)}>{e.detail}</a>
							{:else}
								{e.detail}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
