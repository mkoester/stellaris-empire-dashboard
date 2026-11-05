<script lang="ts">
	import Chart from '#lib/Chart.svelte';
	import EmpireName from '#lib/EmpireName.svelte';
	import { fmt, pretty } from '#lib/format.ts';
	import { followGame } from '#lib/live.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	const signed = (n: number) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
	const nameOf = (id: number) => data.names[String(id)] ?? `empire ${id}`;
	const KNOWN = ['migration_access', 'commercial_pact', 'research_agreement'];
	const others = $derived(data.types.filter((t) => !KNOWN.includes(t.key)));
	const typeOf = (key: string) => data.types.find((t) => t.key === key);
	const gate = $derived(data.pactAll ? null : data.pactIntel ? 'intel' : 'none');
</script>

{#snippet upkeep(key: string)}
	{@const t = typeOf(key)}
	{#if t}
		<span class="text-sm font-normal text-gray-500"
			>{t.partners.length} × · upkeep {fmt(t.upkeep)} influence a month</span
		>
	{/if}
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Pacts</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.asOf ?? data.latest.date}</span>
</header>

{#if data.types.length === 0}
	<p class="text-gray-500">No pact with another empire yet.</p>
{/if}

<div class="space-y-4">
	{#if typeOf('migration_access')}
		<section class="rounded border border-gray-300 p-2 dark:border-gray-700">
			<h2 class="mb-1 font-semibold">Migration treaties {@render upkeep('migration_access')}</h2>
			<p class="mb-2 text-xs text-gray-500">
				Pops by species in each empire, save by save — the save books migration per colony, and per
				species only as net growth, so the change between saves is the migration plus growth there.
			</p>
			{#if data.migration.length === 0}
				<p class="text-sm text-gray-500">
					No reading yet: the species per empire are read from saves since this version.
				</p>
			{/if}
			<div class="grid items-start gap-4 lg:grid-cols-2">
				{#each data.migration as m (m.countryId)}
					<div>
						<h3 class="font-semibold"><EmpireName name={nameOf(m.countryId)} /></h3>
						<ul class="text-sm">
							<li>
								our {m.ourSpecies ?? 'main species'} there:
								<span class="font-semibold tabular-nums"
									>{fmt(m.series.lines[Object.keys(m.series.lines)[0]].at(-1) ?? 0)}</span
								>
							</li>
							{#each m.oursThere as s (s.name)}
								<li class="text-gray-500">our {s.name} there: {fmt(s.pops)}</li>
							{/each}
							<li>
								their {m.theirSpecies ?? 'main species'} with us:
								<span class="font-semibold tabular-nums">{fmt(m.theirsHere)}</span>
							</li>
						</ul>
						{#if m.series.x.length > 1}
							{#key data.tip}
								<Chart title="" series={m.series} extent={data.xExtent} />
							{/key}
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if typeOf('commercial_pact') && data.commercial}
		{@const c = data.commercial}
		<section class="rounded border border-gray-300 p-2 dark:border-gray-700">
			<h2 class="mb-1 font-semibold">Commercial pacts {@render upkeep('commercial_pact')}</h2>
			<p class="mb-2 text-sm">
				They bring <span class="font-semibold">{fmt(c.total)} trade</span> a month: 10 % of each partner's
				trade production, not taken from it.
			</p>
			<table class="text-left text-sm tabular-nums">
				<thead>
					<tr class="text-gray-500">
						<th class="p-1">Partner</th>
						<th class="p-1 text-right">its trade</th>
						<th class="p-1 text-right">brings us</th>
						<th class="p-1 text-right">per influence of upkeep</th>
					</tr>
				</thead>
				<tbody>
					{#each c.shares as s (s.countryId)}
						<tr>
							<td class="p-1"><EmpireName name={nameOf(s.countryId)} /></td>
							<td class="p-1 text-right">{s.base === null ? '?' : fmt(s.base)}</td>
							<td class="p-1 text-right">{s.trade === null ? '?' : fmt(s.trade)}</td>
							<td class="p-1 text-right">{s.trade === null ? '' : fmt(s.trade / 0.25)}</td>
						</tr>
					{/each}
					{#if c.shares.some((s) => s.trade === null)}
						<tr class="text-gray-500">
							<td class="p-1" colspan="2">the partners marked ? together</td>
							<td class="p-1 text-right">{fmt(Math.max(0, c.rest))}</td>
							<td></td>
						</tr>
					{:else if Math.abs(c.rest) >= 0.05}
						<tr class="text-gray-500">
							<td class="p-1" colspan="2">booked − predicted</td>
							<td class="p-1 text-right">{signed(c.rest)}</td>
							<td></td>
						</tr>
					{/if}
				</tbody>
			</table>
			{#if gate !== null && c.shares.some((s) => s.trade === null)}
				<p class="mt-1 text-xs text-gray-500">
					A partner's trade shows {gate === 'intel'
						? 'at economy intel level 3 (intel 90)'
						: 'with the pacts intel spoiler (⚙), at economy intel level 3 (intel 90)'} — or with the pacts
					cheat.
				</p>
			{/if}
		</section>
	{/if}

	{#if typeOf('research_agreement') && data.research}
		{@const r = data.research}
		<section class="rounded border border-gray-300 p-2 dark:border-gray-700">
			<h2 class="mb-1 font-semibold">Research agreements {@render upkeep('research_agreement')}</h2>
			<p class="mb-2 text-sm text-gray-500">
				Not a flat amount: +25 % research speed on a tech the partner already has, added to the
				speed you already research at — so the more bonuses you have, the less it adds (assumed: not
				yet seen in a save). Two partners with the same tech: counted once.
			</p>
			<p class="mb-2 text-sm">
				Your research speed now (progress ÷ research output, measured between monthly saves):
				{#each ['physics', 'society', 'engineering'] as a, i (a)}
					{@const sp = r.speed[a]}
					{i ? ' · ' : ''}{a}
					{#if sp}
						<span
							class="font-semibold"
							title="{sp.tech ?? 'stored research'}, {sp.date}: ×{sp.factor.toFixed(
								2
							)} → with +25 % ×{(sp.factor + 0.25).toFixed(2)}, {Math.round(
								(25 / (sp.factor + 0.25)) * 10
							) / 10} % of a tech's time saved">×{sp.factor.toFixed(2)}</span
						>
					{:else}<span class="text-gray-500">not measured yet</span>{/if}
				{/each}
			</p>
			<table class="mb-3 text-left text-sm tabular-nums">
				<thead>
					<tr class="text-gray-500">
						<th class="p-1">In progress</th>
						<th class="p-1">Area</th>
						<th class="p-1">Sped up by</th>
						<th class="p-1 text-right">extra this month</th>
					</tr>
				</thead>
				<tbody>
					{#each r.current as cur (cur.area)}
						{@const by = r.partners.filter(
							(p) => p.known && p.thisMonth.some((m) => m.tech === cur.tech)
						)}
						<tr>
							<td class="p-1">{cur.name}</td>
							<td class="p-1">{cur.area}</td>
							<td class="p-1"
								>{#each by as p, i (p.countryId)}{i ? ', ' : ''}<EmpireName
										name={p.name}
									/>{/each}{by.length ? '' : '–'}</td
							>
							<td class="p-1 text-right"
								>{by.length ? signed((r.monthly[cur.area] ?? 0) * 0.25) : '–'}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>

			<div class="grid items-start gap-4 lg:grid-cols-2">
				{#each r.partners as p (p.countryId)}
					<div>
						<h3 class="font-semibold"><EmpireName name={p.name} /></h3>
						{#if !p.known}
							<p class="text-sm text-gray-500">
								No reading yet: read from saves since this version.
							</p>
						{:else}
							{#if p.counts}
								<table class="text-left text-sm tabular-nums">
									<thead>
										<tr class="text-gray-500">
											<th class="p-1">Techs</th>
											<th class="p-1 text-right">ours</th>
											<th class="p-1 text-right">theirs</th>
											<th class="p-1">who gains</th>
										</tr>
									</thead>
									<tbody>
										{#each p.counts as c (c.area)}
											<tr>
												<td class="p-1">{c.area}</td>
												<td class="p-1 text-right">{c.ours}</td>
												<td class="p-1 text-right">{c.theirs}</td>
												<td class="p-1 text-gray-500"
													>{c.theirs > c.ours
														? `we, at least ${c.theirs - c.ours} techs`
														: c.theirs < c.ours
															? `they, at least ${c.ours - c.theirs} techs`
															: 'unknown: as many techs each'}</td
												>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
							{#if p.ours && p.theirs}
								<p class="mt-1 text-sm">
									For us: {p.ours.techs.length + p.ours.more} techs they have —
									<span class="font-semibold">{fmt(p.ours.savedInReach)}</span> research saved on
									those in reach, {fmt(p.ours.saved)} on all. For them: {p.theirs.count} techs of ours,
									{fmt(p.theirs.saved)} saved.
								</p>
								<details class="text-sm">
									<summary class="cursor-pointer text-gray-500">their techs we lack</summary>
									<ul>
										{#each p.ours.techs as t (t.key)}
											<li class={t.inReach ? '' : 'text-gray-500'}>
												{t.name}
												<span class="text-xs"
													>({t.area}, {t.cost ? fmt(t.cost) : 'cost unknown'}{t.inReach
														? ', in reach'
														: ''})</span
												>
											</li>
										{/each}
										{#if p.ours.more}<li class="text-gray-500">… {p.ours.more} more</li>{/if}
									</ul>
								</details>
							{:else if !p.counts}
								<p class="text-sm text-gray-500">
									Their techs per area show with the pacts intel spoiler (⚙); which techs, with the
									pacts cheat.
								</p>
							{/if}
						{/if}
					</div>
				{/each}
			</div>

			{#if r.hints && r.hints.length}
				<h3 class="mt-3 font-semibold">
					Pick these to gain most <span class="text-xs font-normal text-amber-600">cheat</span>
				</h3>
				<table class="text-left text-sm tabular-nums">
					<thead>
						<tr class="text-gray-500">
							<th class="p-1">Tech</th>
							<th class="p-1">Area</th>
							<th class="p-1 text-right">saved</th>
							<th class="p-1">known by</th>
						</tr>
					</thead>
					<tbody>
						{#each r.hints as h (h.key)}
							<tr>
								<td class="p-1">{h.name}{h.offered ? ' · on offer' : ''}</td>
								<td class="p-1">{h.area}</td>
								<td class="p-1 text-right">{fmt(h.saved)}</td>
								<td class="p-1"
									>{#each h.partners as id, i (id)}{i ? ', ' : ''}<EmpireName
											name={nameOf(id)}
										/>{/each}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
	{/if}

	{#if others.length}
		<section class="rounded border border-gray-300 p-2 dark:border-gray-700">
			<h2 class="mb-1 font-semibold">Other pacts</h2>
			<ul class="text-sm">
				{#each others as t (t.key)}
					<li>
						{pretty(t.name)}: {#each t.partners as p, i (p.countryId)}{i ? ', ' : ''}<EmpireName
								name={p.name}
							/>{/each} — upkeep {fmt(t.upkeep)} influence a month
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
