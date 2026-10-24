<script lang="ts">
	import type { EffectTotal } from './effects.ts';
	import { formatModifierValue, modifierColor, modifierLabel } from './modifiers.ts';
	import SourceBadge from './SourceBadge.svelte';

	// Modifiers summed over several sources, each line with where its parts come from — and, where
	// known, a badge for what kind of source it is (origin, civic, GalCom, event, …).
	let { effects }: { effects: EffectTotal[] } = $props();
</script>

<ul class="space-y-0.5 text-sm">
	{#each effects as t (t.mod.key)}
		<li class="flex flex-wrap items-baseline gap-x-1.5">
			<span class="font-mono font-semibold {modifierColor(t.mod)}"
				>{formatModifierValue(t.mod)}</span
			>
			<span>{modifierLabel(t.mod)}</span>
			{#each t.sources as s, i (i)}<span class="text-xs whitespace-nowrap text-gray-500"
					>{#if s.kind}<SourceBadge kind={s.kind} />
					{/if}{formatModifierValue({
						...t.mod,
						value: s.value
					})}
					{s.name}{i < t.sources.length - 1 ? ',' : ''}</span
				>{/each}
		</li>
	{/each}
</ul>
