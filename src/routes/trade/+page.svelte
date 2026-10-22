<script lang="ts">
	import { marketRate, monthsLeft, rate, spare, stance, terms } from '#lib/aiTrade.ts';
	import { colorOf } from '#lib/colors.ts';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	type Empire = (typeof data.empires)[number];
	const termsOf = (e: Empire) => terms(e, data.personalities, data.attitudes);
	const GIFT = 'opinion_trade_gift';
	const gift = (e: Empire) => e.opinionModifiers.find((m) => m.key === GIFT)?.value ?? null;
	const decay = $derived(data.opinionModifiers[GIFT]?.decay ?? null);
	const modifierName = (k: string) => data.opinionModifiers[k]?.name ?? pretty(k);

	// the deal finder: what we give, what we want
	let give = $state('alloys');
	let get = $state('energy');
	const offers = $derived(
		data.empires
			.map((e) => ({
				e,
				r: rate(give, get, e, termsOf(e), data.resourceInfo, data.model),
				spare: spare(get, e, data.resourceInfo, data.model)
			}))
			.filter((x) => x.r !== null)
			.sort((a, b) => b.r! - a.r!)
	);
	const market = $derived(marketRate(give, get, data.market.prices, data.market.fee));
</script>

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Trade</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !data.date}
	<p>No save with the other empires read yet; it fills after the next save.</p>
{:else}
	<div class="flex flex-col gap-6">
		<Panel
			title="Empires we talk to"
			note="As the diplomacy screen shows them: personality (and how good a deal must be for it — at 1.0 it accepts a deal equally good for both sides, at 0 none), attitude towards us (some attitudes refuse every trade), their opinion of us and what makes it up. A gift's 'Favorable Trade Deal' adds up to {data
				.opinionModifiers[GIFT]?.max ?? 100} and fades by {decay ?? 2} a month."
		>
			<div class="overflow-x-auto">
				<table class="text-sm">
					<thead>
						<tr class="text-left text-gray-500">
							<th class="pr-3">Empire</th>
							<th class="pr-3">Personality</th>
							<th class="pr-3 text-right">Willing</th>
							<th class="pr-3">Attitude</th>
							<th class="pr-3 text-right">Opinion</th>
							<th class="pr-3 text-right">Trust</th>
							<th class="pr-3">Gift</th>
							<th class="pr-3 text-right">Deals</th>
							<th>Opinion from</th>
						</tr>
					</thead>
					<tbody>
						{#each data.empires as e (e.countryId)}
							{@const t = termsOf(e)}
							{@const g = gift(e)}
							<tr class="border-t border-gray-200 align-top dark:border-gray-800">
								<td class="pr-3">{e.name}</td>
								<td class="pr-3"
									>{e.personality
										? (data.personalities[e.personality]?.name ?? pretty(e.personality))
										: '–'}</td
								>
								<td class="pr-3 text-right tabular-nums">{t.willingness ?? '?'}</td>
								<td class="pr-3 {t.trades ? '' : 'text-red-600'}"
									>{e.attitude
										? (data.attitudes[e.attitude]?.name ?? pretty(e.attitude))
										: '–'}{t.trades ? '' : ' — no trades'}</td
								>
								<td class="pr-3 text-right tabular-nums">{e.opinion ?? '–'}</td>
								<td class="pr-3 text-right tabular-nums">{fmt(e.trust)}</td>
								<td class="pr-3"
									>{#if g !== null}+{fmt(g)}<span class="text-xs text-gray-500">
											· {monthsLeft(g, decay) ?? '?'} mo left</span
										>{/if}</td
								>
								<td class="pr-3 text-right">{e.deals || ''}</td>
								<td class="text-xs"
									>{e.opinionModifiers
										.map((m) => `${modifierName(m.key)} ${m.value > 0 ? '+' : ''}${fmt(m.value)}`)
										.join(' · ')}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Panel>

		{#if !data.tradeIntel}
			<p class="text-sm text-gray-500">
				What they have to spare, what they need and what they would give for what needs their
				stockpiles, which the game does not show — switch on "Trade: other empires’ stockpiles" in ⚙
				(cheating).
			</p>
		{:else}
			<Panel
				title="Who would trade what (estimated)"
				note="For what we give, what each empire would give at most per unit, best first, against selling ours and buying theirs on the {data
					.market.galactic
					? 'galactic'
					: 'internal'} market ({Math.round(
					data.market.fee * 100
				)} % fee). Estimated: the game decides in its engine; the model uses its files' inputs (resource weights, the empire's stockpile, storage and income, its personality) and guesses how they combine — calibrated by docs/trade-calibration.md{data
					.model.calibrated
					? ''
					: ', not done yet'}. Monthly for monthly: the same rate."
			>
				<div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
					<label
						>we give <select
							class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
							bind:value={give}
						>
							{#each data.tradable as r (r)}<option value={r}>{pretty(r)}</option>{/each}
						</select></label
					>
					<label
						>for <select
							class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
							bind:value={get}
						>
							{#each data.tradable as r (r)}<option value={r}>{pretty(r)}</option>{/each}
						</select></label
					>
					<span class="text-gray-500"
						>market: {market === null
							? '–'
							: `${fmt(market)} ${pretty(get)} per ${pretty(give)}`}</span
					>
				</div>
				<table class="text-sm">
					<thead>
						<tr class="text-left text-gray-500">
							<th class="pr-3">Empire</th>
							<th class="pr-3 text-right">{pretty(get)} per {pretty(give)}</th>
							<th class="pr-3 text-right">vs market</th>
							<th class="pr-3 text-right">They spare</th>
						</tr>
					</thead>
					<tbody>
						{#each offers as o (o.e.countryId)}
							<tr class="border-t border-gray-200 dark:border-gray-800">
								<td class="pr-3">{o.e.name}</td>
								<td class="pr-3 text-right tabular-nums">{fmt(o.r!)}</td>
								<td
									class="pr-3 text-right tabular-nums {market !== null && o.r! > market
										? 'text-green-600'
										: ''}">{market ? `${fmt(o.r! / market)} ×` : ''}</td
								>
								<td class="pr-3 text-right tabular-nums">{fmt(o.spare)}</td>
							</tr>
						{:else}
							<tr><td class="text-gray-500">Nobody would make this trade.</td></tr>
						{/each}
					</tbody>
				</table>
			</Panel>

			<Panel
				title="What they need and have to spare"
				note="Per empire and resource: ↑ short of it (under a third of its storage — it pays more), ↓ flush (over three quarters — it gives it cheaper), and the stockpile. A resource it holds less of than it wants is not on offer."
			>
				<div class="overflow-x-auto">
					<table class="text-sm">
						<thead>
							<tr class="text-left text-gray-500">
								<th class="pr-3">Empire</th>
								{#each data.tradable as r (r)}<th class="px-2 text-right" style:color={colorOf(r)}
										>{pretty(r)}</th
									>{/each}
							</tr>
						</thead>
						<tbody>
							{#each data.empires as e (e.countryId)}
								<tr class="border-t border-gray-200 dark:border-gray-800">
									<td class="pr-3">{e.name}</td>
									{#each data.tradable as r (r)}
										{@const s = stance(r, e, data.resourceInfo, data.model)}
										<td
											class="px-2 text-right tabular-nums {s === 'needs'
												? 'text-red-600'
												: s === 'plenty'
													? 'text-green-600'
													: ''}"
											title="net {fmt(e.net[r] ?? 0)}/month"
											>{s === 'needs' ? '↑ ' : s === 'plenty' ? '↓ ' : ''}{fmt(
												e.stockpile[r] ?? 0
											)}</td
										>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Panel>
		{/if}

		<p class="text-sm text-gray-500">
			Gifts: how much opinion a gift buys is computed by the game and not in its files — the trade
			tab will tell once calibrated (docs/trade-calibration.md, part 2).
		</p>
	</div>
{/if}
