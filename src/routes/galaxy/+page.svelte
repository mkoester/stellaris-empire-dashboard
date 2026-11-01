<script lang="ts">
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';

	let { data } = $props();
	followGame(() => data.isHead);
</script>

<div class="space-y-4">
	<h1 class="text-xl font-semibold">Galaxy setup</h1>
	{#if data.groups.length}
		<p class="text-sm text-gray-500">
			The settings this galaxy was created with, grouped as on the game's setup screen (from the
			save of {data.seenAt}).
		</p>
		<div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
			{#each data.groups as g (g.title)}
				<Panel title={g.title}>
					<table class="w-full text-sm">
						<tbody>
							{#each g.rows as r (r.key)}
								<tr class="border-b border-gray-100 dark:border-gray-800">
									<td class="py-0.5 pr-3 text-gray-500" title={r.key}>{r.label}</td>
									<td class="py-0.5 text-right">{r.value}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</Panel>
			{/each}
		</div>
	{:else}
		<p class="text-sm text-gray-500">
			No save read since this dashboard version yet holds the galaxy's settings — they show once a
			save is read again (saves still on disk are, at the next start).
		</p>
	{/if}
</div>
