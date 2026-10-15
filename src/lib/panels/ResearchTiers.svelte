<script lang="ts">
	import { colorOf } from '../colors.ts';
	import { AREAS, TIERS, type TierCell } from '../techTiers.ts';
	import Panel from './Panel.svelte';

	let { tiers }: { tiers: Record<string, TierCell[]> } = $props();
</script>

<Panel
	title="Research tiers"
	note="Researched / defined in the game files, per field. A tier opens with 6 techs of the tier below."
>
	<table class="text-sm">
		<thead>
			<tr class="border-b border-gray-300 dark:border-gray-700">
				<th class="p-1"></th>
				{#each TIERS as t (t)}<th class="p-1 text-right">T{t}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each AREAS as area (area)}
				<tr class="border-b border-gray-200 dark:border-gray-800">
					<td class="p-1 pr-3" style:color={colorOf(`${area}_research`)}>{area}</td>
					{#each tiers[area] as c, tier (tier)}
						<td
							class="p-1 text-right whitespace-nowrap {c.open ? '' : 'text-gray-400'}"
							title={c.open
								? ''
								: `locked: ${c.needs} more T${tier - 1} tech${c.needs === 1 ? '' : 's'} needed`}
						>
							<b>{c.done}</b>&thinsp;/&thinsp;{c.total}{c.open ? '' : ' 🔒'}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</Panel>
