<script lang="ts">
	import type { EffectTotal } from './effects.ts';
	import { formatModifierValue, modifierColor, modifierLabel } from './modifiers.ts';

	// Modifiers summed over several sources, each line with where its parts come from.
	let { effects }: { effects: EffectTotal[] } = $props();

	const parts = (t: EffectTotal) =>
		t.sources
			.map((s) => `${formatModifierValue({ ...t.mod, value: s.value })} ${s.name}`)
			.join(', ');
</script>

<ul class="space-y-0.5 text-sm">
	{#each effects as t (t.mod.key)}
		<li class="flex items-baseline gap-1.5">
			<span class="font-mono font-semibold {modifierColor(t.mod)}"
				>{formatModifierValue(t.mod)}</span
			>
			<span>{modifierLabel(t.mod)}</span>
			<span class="text-xs text-gray-500">{parts(t)}</span>
		</li>
	{/each}
</ul>
