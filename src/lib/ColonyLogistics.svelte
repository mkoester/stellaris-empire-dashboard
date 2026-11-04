<script lang="ts">
	import { colorOf } from './colors.ts';
	import { fmt, pretty } from './format.ts';
	import type { ColonyLogistics } from './server/logistics.ts';

	// What this colony uses beyond what it makes, what the empire pays in trade to supply it
	// (#lib/colonyLogistics.ts: fitted, ≈), and per resource whether making it here would be cheaper.
	let { what }: { what: ColonyLogistics | null } = $props();

	const num = (v: number, d: number) => v.toLocaleString(undefined, { maximumFractionDigits: d });
	const per = (v: number) => (v < 0.01 ? num(v, 3) : num(v, 2));
	const RULE =
		'≈ per unit short: 0.125 trade for energy, minerals and food, 0.25 consumer goods, 0.5 alloys (the game’s deficit_trade_conversion_mult) × the galaxy’s Planet Deficit setting; the capital’s shortfall is covered by the empire’s base income first. Within a few % of the budget in our saves';
	const LOCAL =
		'the cheapest option on this colony (the produce tab’s), as many as cover the shortfall: building cost spread over the horizon, upkeep, and what the workers it takes made in their jobs here (civilians take the jobs first), less what everything it makes is worth — the surplus counts. Below 0 it pays by itself. Building slots are not in the save: a building assumes one is free';
	const signed = (v: number) => (v > 0 ? '−' : '+') + num(Math.abs(v), 2);
</script>

{#if what}
	<section class="mb-4 rounded border border-gray-300 p-2 text-sm dark:border-gray-700">
		<h2 class="mb-1 font-semibold" title={RULE}>
			Supplied from elsewhere — <span class="text-red-600">≈ −{num(what.fee, 2)} trade</span> a month
		</h2>
		<table class="w-full text-left">
			<thead>
				<tr class="border-b border-gray-300 text-xs text-gray-500 dark:border-gray-700">
					<th class="p-1 font-normal">short</th>
					<th class="p-1 text-right font-normal" title={RULE}>fee/mo</th>
					<th class="p-1 font-normal" title={LOCAL}
						>make it here instead: + gains, − costs a month ({what.months / 12} y)</th
					>
					<th class="p-1 font-normal"></th>
				</tr>
			</thead>
			<tbody>
				{#each what.rows as r (r.resource)}
					<tr>
						<td class="p-1 whitespace-nowrap">
							<span style:color={colorOf(r.resource)}>{pretty(r.resource)}</span>
							{num(r.short, 2)}
						</td>
						<td class="p-1 text-right tabular-nums">{num(r.feeTrade, 2)}</td>
						<td class="p-1">
							{#if r.best}
								<span
									class="tabular-nums {r.best.net < 0 ? 'text-green-700' : 'text-red-600'}"
									title="per unit: {per(r.best.perUnit)} building and upkeep + {per(
										r.best.lost
									)} what {fmt(r.best.moved)} pops make now − {per(
										r.importing - r.fee
									)} its value; × {num(r.best.made, 2)} made">{signed(r.best.net)}</span
								>
								<span class="text-gray-500"
									>{r.best.label} × {r.best.needed}{r.best.room !== null &&
									r.best.needed > r.best.room
										? ` (room for ${r.best.room})`
										: ''}, {fmt(r.best.workers)} workers{r.best.moved < r.best.workers
										? ` (${fmt(r.best.workers - r.best.moved)} now civilians)`
										: ''}</span
								>
							{:else}
								<span class="text-gray-500">nothing here makes it</span>
							{/if}
						</td>
						<td class="p-1 whitespace-nowrap">
							{#if r.verdict === 'import'}<span class="text-green-700">import</span
								>{:else if r.verdict === 'local'}<span class="text-amber-600">make here</span>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if what.unpriced.length}
			<div class="mt-1 text-xs text-gray-500">
				no market price, so no fee known: {what.unpriced.map(pretty).join(', ')}
			</div>
		{/if}
		<div class="mt-1 text-xs text-gray-500">
			Import wins while the fee is less than what making it here costs net — building, upkeep and
			what the workers make now ({per(what.worker)} trade a month each), less what it makes. Not counted:
			designation bonuses the moved workers lose or gain.
			{#if what.mult !== 1}Planet Deficit setting ×{what.mult}.{/if}
			{#if what.capital}The capital's shortfall is what the empire's base income ({Object.entries(
					what.capital
				)
					.filter(([k]) => ['energy', 'minerals', 'food', 'consumer_goods', 'alloys'].includes(k))
					.map(([k, v]) => `${num(v, 1)} ${pretty(k)}`)
					.join(', ')}) does not cover.{/if}
		</div>
	</section>
{/if}
