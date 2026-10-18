<script lang="ts">
	// A district's name in its colour in game: a swatch and the name tinted (darkened on light
	// backgrounds, where the game's yellow and green would not read). Plain text without a colour.
	let { name, color }: { name: string; color?: string } = $props();
</script>

{#if color}<span class="district whitespace-nowrap" style:--c={color}
		><span class="mr-1 inline-block size-2.5 rounded-sm bg-(--c) align-[-1px]"></span>{name}</span
	>{:else}{name}{/if}

<style>
	.district {
		color: color-mix(in oklab, var(--c) 70%, black);
	}
	:global(.dark) .district {
		color: color-mix(in oklab, var(--c) 85%, white);
	}
</style>
