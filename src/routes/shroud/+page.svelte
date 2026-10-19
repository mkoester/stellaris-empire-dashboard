<script lang="ts">
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import type { DeedRow } from '#lib/shroud.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// the Shroud plane as a compass: radius 1 → R px, y up as in the game's screen (the Composer
	// of Strands at (0, −1) sits at the bottom)
	const R = 110;
	const at = (p: { x: number; y: number }) => ({ cx: R + 10 + p.x * R, cy: R + 10 - p.y * R });
	const fmt = (v: number) => (Math.abs(v) < 1 ? v.toFixed(1) : String(Math.round(v)));
</script>

{#snippet deeds(rows: DeedRow[], tone: string)}
	<table class="text-sm tabular-nums">
		<tbody>
			{#each rows as d (d.key)}
				<tr
					><td class="pr-4">{d.name}</td><td class="text-right {tone}"
						>{d.weight > 0 ? '+' : ''}{fmt(d.weight)}</td
					></tr
				>
			{/each}
		</tbody>
	</table>
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">The Shroud</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !data.shroud}
	<p class="text-sm text-gray-500">
		{data.seenAt ? 'No access to the Shroud yet.' : 'No save read since this tab exists.'}
	</p>
{:else}
	{@const s = data.shroud}
	<div class="flex flex-wrap items-start gap-6">
		<Panel title="Attunement">
			<svg width={2 * R + 20} height={2 * R + 20} role="img" aria-label="attunement">
				<circle cx={R + 10} cy={R + 10} r={R} fill="none" stroke="currentColor" opacity="0.3" />
				<line x1="10" y1={R + 10} x2={2 * R + 10} y2={R + 10} stroke="currentColor" opacity="0.1" />
				<line x1={R + 10} y1="10" x2={R + 10} y2={2 * R + 10} stroke="currentColor" opacity="0.1" />
				{#each data.known as p (p.key)}
					<circle {...at(p)} r="8" fill={p.color ?? 'gray'} />
				{/each}
				<circle {...at(s.monthStart)} r="4" fill="none" stroke="currentColor" />
				<circle {...at(s.attunement)} r="4" fill="currentColor" />
			</svg>
			<p class="text-xs text-gray-500">
				● now ({fmt(s.attunement.x * 1000)}, {fmt(s.attunement.y * 1000)}), ○ at the month's start —
				standings count from it{s.lastDelve ? ` · last delve ${s.lastDelve}` : ''}
			</p>
		</Panel>

		{#if data.cards.length === 0}
			<p class="text-sm text-gray-500">No patron contacted yet: delve into the Shroud.</p>
		{/if}
		{#each data.cards as c (c.key)}
			<Panel title={c.name}>
				<div class="mb-2 flex flex-wrap items-baseline gap-x-4 text-sm">
					<span class="tabular-nums">standing <b style:color={c.color}>{c.standing}</b> / 1000</span
					>
					{#if c.preferred}<span class="text-gray-500">preferred patron</span>{/if}
				</div>
				{#if c.calling}
					<div class="mb-2 text-sm">
						<b>{c.calling.name}</b>, tier {c.calling.tier}{c.calling.reward !== null
							? ` · reward ${c.calling.reward}`
							: ''}{c.calling.start ? ` · since ${c.calling.start}` : ''}{c.calling.completed
							? ' · completed'
							: ''}
					</div>
				{/if}
				<div class="mb-2 flex gap-8">
					<div>
						<h3 class="text-sm font-semibold text-green-600">Positive deeds</h3>
						{@render deeds(c.positive, 'text-green-600')}
					</div>
					<div>
						<h3 class="text-sm font-semibold text-red-600">Negative deeds</h3>
						{@render deeds(c.negative, 'text-red-600')}
					</div>
				</div>
				<div class="text-sm text-gray-500">
					accords: {c.accords.map((a) => `${a.name} (${a.kind})`).join(', ') || '–'}{c.covenant
						? ` · ${c.covenant}`
						: ''}
				</div>
			</Panel>
		{/each}
	</div>
{/if}
