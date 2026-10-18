<script lang="ts">
	import type { BlockerHint } from './blockers.ts';
	import { fmt, pretty } from './format.ts';

	// One blocker's clearing hint: the gain, the price, and what stands in the way.
	let {
		hint: h,
		names,
		colony = false
	}: { hint: BlockerHint; names: Record<string, string>; colony?: boolean } = $props();

	const name = (k: string) => names[k] ?? pretty(k);
	const cost = $derived(
		Object.entries(h.cost)
			.map(([r, n]) => `${fmt(n)} ${pretty(r)}`)
			.join(', ')
	);
</script>

<span>
	{#if colony}<b>{h.colony}</b>:
	{/if}{name(h.blocker)} —
	<b class={h.atLimit ? 'text-green-600' : ''}
		>+{h.districts} district{h.districts === 1 ? '' : 's'}</b
	>{#if h.atLimit}<span class="text-green-600"> (at its limit)</span>{/if}{#if h.feature}, then {name(
			h.feature
		)}{/if}
	<span class="text-gray-500">· {h.days ?? '?'} days{cost ? `, ${cost}` : ''}</span>
	{#if h.clearing}<span class="text-blue-600">· being cleared</span>
	{:else if h.missing.length}<span class="text-amber-600"
			>· needs {h.missing.map(name).join(', ')}</span
		>
	{:else if h.lodge}<span class="text-amber-600">· not while the Ranger Lodge stands</span>
	{/if}
</span>
