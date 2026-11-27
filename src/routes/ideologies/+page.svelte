<script lang="ts">
	import { followGame } from '#lib/live.ts';
	import { formatModifierValue, modifierColor, modifierLabel } from '#lib/modifiers.ts';
	import Panel from '#lib/panels/Panel.svelte';

	let { data } = $props();
	followGame(() => data.isHead);

	type TenetView = (typeof data.others)[number]['tenets'][number];
	const ROMAN = ['', 'I', 'II', 'III'];
	const SCOPES: Record<string, string> = {
		country: 'empire',
		colony: 'colonies',
		system: 'systems in reach',
		pop_group: 'followers',
		leader: 'leaders'
	};
</script>

{#snippet tenet(t: TenetView)}
	<div class="rounded border border-gray-300/60 p-2">
		<div class="flex items-baseline gap-2">
			<span class="font-mono text-xs text-gray-500" title="slot and Intensity">
				{ROMAN[t.tier] ?? t.tier}
			</span>
			<span class="font-semibold" title={t.description ?? undefined}>{t.name}</span>
		</div>
		{#if t.modifiers.length}
			<ul class="mt-1 text-xs">
				{#each t.modifiers as m, i (i)}
					<li>
						<span class="font-mono font-semibold {modifierColor(m)}">{formatModifierValue(m)}</span>
						<span class="opacity-75">{modifierLabel(m)}</span>
						<span class="text-gray-500">{`(${SCOPES[m.scope] ?? m.scope})`}</span>
					</li>
				{/each}
			</ul>
		{/if}
		{#if t.text}<p class="mt-1 text-xs opacity-75">{t.text}</p>{/if}
	</div>
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Ideologies</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#if !data.seenAt}
	<p class="text-sm text-gray-500">No save read since this tab exists.</p>
{:else}
	{#if data.noData}
		<p class="mb-3 text-sm text-gray-500">
			The game data has no tenets: it comes from an extractor before 0.1.26. Tenets show by their
			keys until it is extracted again.
		</p>
	{/if}
	{#if data.why && !data.all}
		<p class="text-sm text-gray-500">Nothing to show yet: {data.why}.</p>
	{/if}

	{#if data.ours}
		{@const o = data.ours}
		<Panel title={`${o.name} — ${o.type}`} note="our official ideology">
			<div class="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
				<span>
					Strength <span class="font-mono font-semibold">{o.strength.toFixed(2)}</span>
					{#if o.progress.next !== null}<span class="text-gray-500">
							{` / ${o.progress.next} for tenet slot ${ROMAN[o.progress.level + 1]}`}
						</span>{/if}
				</span>
				<span title="tenet slots its strength has opened">Level {o.progress.level} of 3</span>
				{#if o.momentum !== null}
					<span title="last month's change of strength">
						Momentum
						<span
							class="font-mono font-semibold {o.momentum < 0 ? 'text-red-600' : 'text-green-600'}"
						>
							{`${o.momentum >= 0 ? '+' : ''}${o.momentum.toFixed(2)}`}
						</span>
					</span>
				{/if}
				{#if o.pendingLevels > 0}
					<span class="text-amber-600">
						{`${o.pendingLevels} more slot${o.pendingLevels === 1 ? '' : 's'} to codify after this one`}
					</span>
				{/if}
			</div>
			<div class="mb-3 h-2 w-full max-w-md rounded bg-gray-200">
				<div class="h-2 rounded bg-green-600" style:width={`${o.progress.share * 100}%`}></div>
			</div>
			{#if o.tenets.length}
				<h3 class="mb-1 font-semibold">Tenets</h3>
				<div class="mb-3 grid gap-2 md:grid-cols-3">
					{#each o.tenets as t (t.key)}{@render tenet(t)}{/each}
				</div>
			{:else}
				<p class="mb-3 text-sm text-gray-500">
					No tenet codified yet: the first slot opens at 250 strength.
				</p>
			{/if}
			{#each o.offered as c (c.tier)}
				<h3 class="mb-1 font-semibold">{`On offer for slot ${ROMAN[c.tier] ?? c.tier}`}</h3>
				<div class="mb-3 grid gap-2 md:grid-cols-3">
					{#each c.tenets as t (t.key)}{@render tenet(t)}{/each}
				</div>
			{/each}
		</Panel>
	{/if}

	{#if data.others.length}
		<h2 class="mt-6 mb-2 text-lg font-semibold">
			{data.all ? 'Every other ideology' : 'Foreign ideologies we know'}
		</h2>
		<div class="grid gap-4 lg:grid-cols-2">
			{#each data.others as i (i.id)}
				<Panel
					title={`${i.name} — ${i.type}`}
					note={i.known ? `custodian: ${i.custodian}` : `cheat · custodian: ${i.custodian}`}
				>
					{#if data.all}
						<p class="mb-2 text-sm">
							{`Founded by ${i.founder} · ${i.systems} systems in reach`}
						</p>
						{#if i.adopters.length}
							<ul class="mb-2 text-sm">
								{#each i.adopters as a (a.id)}
									<li>
										{a.name}
										{#if a.strength !== null}<span class="text-gray-500">
												{` · strength ${a.strength.toFixed(0)}, level ${a.level} of 3`}
											</span>{/if}
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
					{#if i.tenets.length}
						<div class="grid gap-2 md:grid-cols-3">
							{#each i.tenets as t (t.key)}{@render tenet(t)}{/each}
						</div>
					{:else}
						<p class="text-sm text-gray-500">No tenet codified.</p>
					{/if}
				</Panel>
			{/each}
		</div>
	{/if}
{/if}
