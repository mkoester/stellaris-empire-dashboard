<script lang="ts">
	import InfoPopup from '../InfoPopup.svelte';
	import type { TreeRow } from '../traditions.ts';
	import type { Explanation } from '../types.ts';
	import Panel from './Panel.svelte';

	let {
		trees,
		perks,
		explain = {}
	}: {
		trees: TreeRow[];
		perks: { key: string; name: string }[];
		explain?: Record<string, Explanation>;
	} = $props();
</script>

<Panel title="Traditions">
	{#each trees as t (t.key)}
		<div class="mb-1">
			<b>{t.name}</b>
			<span class="text-gray-500"
				>{t.picked.length} / {t.total}{t.finished ? ' · finished ✓' : ''}</span
			>
			{#if t.picked.length}
				<div class="text-sm">
					{#each t.picked as p, i (p.key)}{i ? ' · ' : ''}<InfoPopup
							explanation={explain[`tradition:${p.key}`]}>{p.name}</InfoPopup
						>{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div>none adopted</div>
	{/each}
	<div class="mt-3 text-gray-500">ascension perks ({perks.length})</div>
	{#each perks as p (p.key)}
		<div><InfoPopup explanation={explain[`perk:${p.key}`]}>{p.name}</InfoPopup></div>
	{:else}
		<div>none yet</div>
	{/each}
</Panel>
