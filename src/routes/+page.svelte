<script lang="ts">
	import EmpirePanel from '#lib/EmpirePanel.svelte';
	import { announceBranch, followGame, postBranch } from '#lib/live.ts';
	import { LAYOUT } from '#lib/settings.ts';

	let { data } = $props();
	followGame(() => data.empty || data.isHead);

	// Planet pages in other panes follow the branch shown here.
	const shown = () => (data.empty || data.isHead ? null : data.tip);
	announceBranch(shown);
	$effect(() => postBranch(shown()));
</script>

{#if data.empty}
	<h1 class="text-2xl font-bold">Empire dashboard</h1>
	<p>Waiting for the first save.</p>
{:else}
	<div class="flex flex-col gap-6">
		{#each LAYOUT as group, i (i)}
			<div class={group.cols}>
				{#each group.panels as p (p.id)}
					<EmpirePanel id={p.id} {data} />
				{/each}
			</div>
		{/each}
	</div>
{/if}
