<script lang="ts">
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import Traditions from '#lib/panels/Traditions.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	const taken = $derived(data.perks.filter((p) => p.taken));
	const open = $derived(data.perks.filter((p) => !p.taken));
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Traditions</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if data.next}
	<p class="mb-4 text-sm">
		Next tradition: {data.next.date}{data.next.exact ? '' : ' (est.)'} — {data.next.detail}
	</p>
{/if}

<div class="grid gap-8 lg:grid-cols-2">
	<Traditions trees={data.trees} perks={taken} explain={data.explain} />

	<Panel
		title="Other trees"
		note="Not adopted yet. Hover a tradition in an adopted tree for its effects."
	>
		<p class="text-sm">{data.otherTrees.map((t) => t.name).join(' · ')}</p>
	</Panel>

	<Panel
		title="Ascension perks"
		note="Taken first; hover for what each does. Their conditions are not checked."
	>
		<div class="text-sm">
			{#each taken as p (p.key)}<div>
					<b><InfoPopup explanation={data.explain[`perk:${p.key}`]}>{p.name}</InfoPopup></b> ✓
				</div>{/each}
			<div class="mt-2 text-gray-500">
				{#each open as p, i (p.key)}{i ? ' · ' : ''}<InfoPopup
						explanation={data.explain[`perk:${p.key}`]}>{p.name}</InfoPopup
					>{/each}
			</div>
		</div>
	</Panel>
</div>
