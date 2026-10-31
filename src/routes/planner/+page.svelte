<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { followGame } from '#lib/live.ts';
	import Panel from '#lib/panels/Panel.svelte';
	import { GROUPS, sourceOf } from '#lib/planner/kinds.ts';
	import { moved, type Polarity, type Target } from '#lib/planner/replay.ts';
	import { newGoalId, planAction } from '#lib/settings.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	type Row = (typeof data.groups)[number]['goals'][number];

	// --- changes -------------------------------------------------------------------------------
	let error = $state('');
	async function change(changes: { goal: string; op: string; data?: Record<string, unknown> }[]) {
		error = '';
		try {
			await planAction(data.tip, changes);
			await invalidateAll();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}
	const addGoal = (
		kind: string,
		target: Target,
		polarity: Polarity,
		extra: Record<string, unknown> = {}
	) => change([{ goal: newGoalId(), op: 'add', data: { kind, target, polarity, ...extra } }]);
	const op = (g: { id: string }, o: string, d?: Record<string, unknown>) =>
		change([{ goal: g.id, op: o, data: d }]);
	const reorder = (group: string, ids: string[]) =>
		change([{ goal: `group:${group}`, op: 'order', data: { ids } }]);
	function remove(g: Row) {
		if (confirm(`Remove "${g.label}" from the plan? (It stays in the history.)`)) op(g, 'remove');
	}

	// --- status --------------------------------------------------------------------------------
	const chip = (r: { state: string; polarity: string }) => {
		if (r.polarity === 'avoid')
			return (
				{
					done: ['✗ happened', 'bg-red-600 text-white'],
					blocked: [
						'✓ cannot happen',
						'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
					],
					progress: [
						'⚠ under way',
						'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
					],
					open: ['○ not yet', 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'],
					unknown: ['? unknown', 'bg-gray-100 text-gray-500 dark:bg-gray-800']
				} as Record<string, string[]>
			)[r.state];
		return (
			{
				done: ['✓ done', 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'],
				progress: ['◐ under way', 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200'],
				open: ['○ open', 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'],
				blocked: ['⚠ no longer possible', 'bg-red-600 text-white'],
				unknown: ['? unknown', 'bg-gray-100 text-gray-500 dark:bg-gray-800']
			} as Record<string, string[]>
		)[r.state];
	};
	const alert = (r: Row) =>
		(r.polarity === 'want' && r.state === 'blocked') ||
		(r.polarity === 'avoid' && r.state === 'done');
	const finished = (r: Row) =>
		(r.polarity === 'want' && r.state === 'done') ||
		(r.polarity === 'avoid' && r.state === 'blocked');

	// next up: per group the first goal not finished, warnings first
	const nextUp = $derived(
		data.groups
			.flatMap((g) => {
				const open = g.goals.filter((r) => !finished(r));
				return [...open.filter(alert), ...open.filter((r) => !alert(r)).slice(0, 1)].map((r) => ({
					...r,
					groupName: g.name
				}));
			})
			.sort((a, b) => Number(alert(b)) - Number(alert(a)))
	);

	// --- groups: folding (per viewer), dragging ------------------------------------------------
	const FOLD_KEY = 'planner:folded';
	let folded = $state<string[]>([]);
	$effect(() => {
		try {
			folded = JSON.parse(localStorage.getItem(FOLD_KEY) ?? '[]');
		} catch {
			folded = [];
		}
	});
	function fold(id: string) {
		folded = folded.includes(id) ? folded.filter((x) => x !== id) : [...folded, id];
		try {
			localStorage.setItem(FOLD_KEY, JSON.stringify(folded));
		} catch {
			/* storage blocked: folding lasts for the page */
		}
	}
	let dragging = $state<{ group: string; id: string } | null>(null);
	let over = $state<string | null>(null);
	function drop(group: string, ids: string[], targetId: string) {
		if (!dragging || dragging.group !== group || dragging.id === targetId) return;
		reorder(group, moved(ids, dragging.id, ids.indexOf(targetId)));
		dragging = null;
		over = null;
	}
	const step = (group: string, ids: string[], id: string, by: number) =>
		reorder(group, moved(ids, id, ids.indexOf(id) + by));

	// --- notes ---------------------------------------------------------------------------------
	let editing = $state<string | null>(null);
	let draft = $state('');
	function saveNote(g: Row) {
		if (draft !== g.note) op(g, 'edit', { note: draft });
		editing = null;
	}

	// --- the add form --------------------------------------------------------------------------
	let kind = $state('tech');
	let polarity = $state<Polarity>('want');
	let values = $state<Record<string, string>>({});
	let note = $state('');
	let title = $state('');
	const kindInfo = $derived(data.kinds.find((k) => k.id === kind));
	const optionsFor = (field: string) =>
		(data.options as Record<string, { value: string | number; label: string }[]>)[
			sourceOf(kind, field)
		] ?? [];
	// the typed label back to its value: a datalist shows labels, the target wants ids and keys
	function valueOf(field: string): string | number | null {
		const typed = (values[field] ?? '').trim();
		if (field === 'count') return Number(typed) > 0 ? Math.round(Number(typed)) : null;
		const o = optionsFor(field).find((x) => x.label === typed || String(x.value) === typed);
		return o ? o.value : null;
	}
	const formTarget = $derived.by(() => {
		const out: Target = {};
		for (const f of kindInfo?.fields ?? []) {
			const v = valueOf(f);
			if (v === null) return null;
			out[f] = v;
		}
		return out;
	});
	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!formTarget || (kindInfo?.manual && !title.trim())) return;
		await addGoal(kind, formTarget, polarity, {
			...(note.trim() ? { note: note.trim() } : {}),
			...(title.trim() ? { title: title.trim() } : {})
		});
		values = {};
		note = '';
		title = '';
	}

	// --- other branches, suggestions -----------------------------------------------------------
	const copy = (g: (typeof data.others)[number]) =>
		addGoal(g.kind, g.target, g.polarity, {
			from: g.id,
			...(g.note ? { note: g.note } : {}),
			...(g.title ? { title: g.title } : {}),
			// what is not possible here is kept as a potential step, to plan again
			...(g.state === 'blocked' ? { parked: true } : {})
		});
	const suggestionsBy = $derived(
		GROUPS.map((g) => ({
			...g,
			list: data.suggestions.filter((s) => data.kinds.find((k) => k.id === s.kind)?.group === g.id)
		})).filter((g) => g.list.length)
	);
	let historyGoal = $state<string | null>(null);
	const sinceText = (s: { date: string; exact: boolean } | null) =>
		s ? `${s.exact ? 'since' : 'by'} ${s.date}` : '';
</script>

{#snippet status(r: Row)}
	{@const [text, cls] = chip(r)}
	<span class="rounded px-1.5 py-0.5 text-[11px] whitespace-nowrap {cls}">{text}</span>
	{#if r.why}<span class="text-xs text-gray-500">{r.why}</span>{/if}
	{#if r.since}<span class="text-xs text-gray-500">{sinceText(r.since)}</span>{/if}
{/snippet}

{#snippet name(r: Row)}
	<span class={r.polarity === 'avoid' ? 'text-red-700 dark:text-red-400' : ''}
		>{#if r.polarity === 'avoid'}<span title="to avoid">⊘ </span>{/if}<InfoPopup
			explanation={r.ref ? data.explain[r.ref] : undefined}>{r.label}</InfoPopup
		></span
	>
{/snippet}

{#snippet goalRow(r: Row, group: string, ids: string[], draggable: boolean)}
	<li
		class="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-100 py-1 dark:border-gray-800 {over ===
		r.id
			? 'border-t-2 border-t-sky-500'
			: ''} {finished(r) ? 'opacity-70' : ''}"
		{draggable}
		ondragstart={(e) => {
			dragging = { group, id: r.id };
			e.dataTransfer?.setData('text/plain', r.id);
		}}
		ondragend={() => {
			dragging = null;
			over = null;
		}}
		ondragover={(e) => {
			if (dragging?.group === group) {
				e.preventDefault();
				over = r.id;
			}
		}}
		ondragleave={() => over === r.id && (over = null)}
		ondrop={(e) => {
			e.preventDefault();
			drop(group, ids, r.id);
		}}
	>
		{#if draggable}
			<span class="cursor-grab text-gray-400 select-none" title="drag to reorder">⠿</span>
			<span class="flex flex-col text-[10px] leading-none text-gray-400">
				<button type="button" title="move up" onclick={() => step(group, ids, r.id, -1)}>▲</button>
				<button type="button" title="move down" onclick={() => step(group, ids, r.id, 1)}>▼</button>
			</span>
		{/if}
		<span class="min-w-48 flex-1">{@render name(r)}</span>
		{@render status(r)}
		{#if r.manual}
			<label class="text-xs"
				><input
					type="checkbox"
					checked={r.checked}
					onchange={() => op(r, r.checked ? 'uncheck' : 'check')}
				/> done</label
			>
		{/if}
		<span class="flex gap-1 text-xs">
			<button
				type="button"
				class="text-gray-500 hover:text-current"
				title={r.polarity === 'want' ? 'switch to: avoid this' : 'switch to: want this'}
				onclick={() => op(r, 'edit', { polarity: r.polarity === 'want' ? 'avoid' : 'want' })}
				>{r.polarity === 'want' ? 'want' : 'avoid'} ⇄</button
			>
			<button
				type="button"
				class="text-gray-500 hover:text-current"
				title="note"
				onclick={() => {
					editing = r.id;
					draft = r.note;
				}}>✎</button
			>
			<button
				type="button"
				class="text-gray-500 hover:text-current"
				title="park: keep it as a potential step, out of the plan"
				onclick={() => op(r, 'park')}>park</button
			>
			<button
				type="button"
				class="text-gray-500 hover:text-current"
				title="history of this goal"
				onclick={() => (historyGoal = historyGoal === r.id ? null : r.id)}>⏱</button
			>
			<button
				type="button"
				class="text-gray-500 hover:text-red-600"
				title="remove"
				onclick={() => remove(r)}>✕</button
			>
		</span>
		{#if editing === r.id}
			<div class="flex w-full gap-1 pl-8">
				<textarea
					class="flex-1 rounded border border-gray-300 bg-transparent p-1 text-sm dark:border-gray-700"
					rows="2"
					bind:value={draft}
					onkeydown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							saveNote(r);
						}
						if (e.key === 'Escape') editing = null;
					}}></textarea>
				<button type="button" class="text-xs" onclick={() => saveNote(r)}>save</button>
			</div>
		{:else if r.note}
			<div class="w-full pl-8 text-xs whitespace-pre-line text-gray-500">{r.note}</div>
		{/if}
		{#if historyGoal === r.id}
			<ul class="w-full pl-8 text-xs text-gray-500">
				{#each data.history.filter((h) => h.goal === r.id) as h (h.id)}
					<li>
						{h.date ?? '?'} · {h.op}{h.detail ? `: ${h.detail}` : ''}
						<span class="text-gray-400">({new Date(h.at).toLocaleString()})</span>
					</li>
				{/each}
				{#if r.since}<li>
						{r.polarity === 'avoid' ? 'happened' : 'reached'}
						{sinceText(r.since)} (from the saves)
					</li>{/if}
			</ul>
		{/if}
	</li>
{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Planner</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

<p class="mb-4 max-w-3xl text-sm text-gray-500">
	Goals for this playthrough. Each is checked against the latest save: done goals tick themselves
	off, and a goal that is no longer possible is flagged. An avoided goal turns red once it happens.
	The plan follows the save graph: loading an older save starts a branch with its own plan, and
	goals from other branches can be copied over. Add goals here, with "+ goal" on other tabs, or with
	a right-click on the map.
</p>

{#if !data.isHead && data.laterBranches > 0}
	<p class="mb-4 rounded border border-amber-400 bg-amber-50 p-2 text-sm dark:bg-amber-950">
		You are looking at an older save. A change made here also applies to the {data.laterBranches}
		later branch{data.laterBranches === 1 ? '' : 'es'} that grew from it.
	</p>
{/if}
{#if error}<p class="mb-4 text-sm text-red-600">{error}</p>{/if}

<div class="grid gap-6 xl:grid-cols-[2fr_1fr]">
	<div class="space-y-6">
		{#if nextUp.length}
			<Panel title="Next up" note="The first open goal of each group, and every warning.">
				<ul class="space-y-1 text-sm">
					{#each nextUp as r (r.id)}
						<li class="flex flex-wrap items-center gap-2">
							<span class="w-40 shrink-0 text-xs text-gray-500">{r.groupName}</span>
							{@render name(r)}
							{@render status(r)}
						</li>
					{/each}
				</ul>
			</Panel>
		{/if}

		<Panel title="Plan">
			{#each data.groups as g (g.id)}
				{@const ids = g.goals.map((r) => r.id)}
				{@const open = g.goals.filter((r) => !finished(r))}
				{@const done = g.goals.filter(finished)}
				{#if g.goals.length}
					<section class="mb-3">
						<button
							type="button"
							class="flex w-full items-baseline gap-2 text-left text-lg font-semibold"
							onclick={() => fold(g.id)}
						>
							<span class="w-4 text-gray-400">{folded.includes(g.id) ? '▸' : '▾'}</span>{g.name}
							<span class="text-sm font-normal text-gray-500"
								>{open.length} open{done.length ? `, ${done.length} done` : ''}</span
							>
						</button>
						{#if !folded.includes(g.id)}
							<ul class="ml-6 text-sm">
								{#each open as r (r.id)}{@render goalRow(r, g.id, ids, true)}{/each}
							</ul>
							{#if done.length}
								<details class="ml-6 text-sm">
									<summary class="cursor-pointer text-gray-500">done ({done.length})</summary>
									<ul>
										{#each done as r (r.id)}{@render goalRow(r, g.id, ids, false)}{/each}
									</ul>
								</details>
							{/if}
						{/if}
					</section>
				{/if}
			{:else}
				<p class="text-sm text-gray-500">No goals yet.</p>
			{/each}
			{#if !data.groups.some((g) => g.goals.length)}
				<p class="text-sm text-gray-500">
					No goals yet: add one below, pick one of the potential goals, or right-click a system on
					the map.
				</p>
			{/if}
		</Panel>

		<Panel title="Add a goal">
			<form class="flex flex-wrap items-end gap-2 text-sm" onsubmit={submit}>
				<label class="flex flex-col"
					><span class="text-xs text-gray-500">kind</span>
					<select
						class="rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-700"
						bind:value={kind}
						onchange={() => (values = {})}
					>
						{#each GROUPS as g (g.id)}
							<optgroup label={g.name}>
								{#each data.kinds.filter((k) => k.group === g.id) as k (k.id)}
									<option value={k.id}>{k.name}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</label>
				{#each kindInfo?.fields ?? [] as f (f)}
					<label class="flex flex-col"
						><span class="text-xs text-gray-500">{f}</span>
						{#if f === 'count'}
							<input
								type="number"
								min="1"
								class="w-20 rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-700"
								bind:value={values[f]}
							/>
						{:else}
							<input
								list="plan-{kind}-{f}"
								class="w-64 rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-700 {values[
									f
								] && valueOf(f) === null
									? 'border-red-400'
									: ''}"
								placeholder="type to search"
								bind:value={values[f]}
							/>
							<datalist id="plan-{kind}-{f}">
								{#each optionsFor(f) as o (o.value)}<option value={o.label}></option>{/each}
							</datalist>
						{/if}
					</label>
				{/each}
				{#if kindInfo?.manual}
					<label class="flex flex-col"
						><span class="text-xs text-gray-500">what</span>
						<input
							class="w-80 rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-700"
							bind:value={title}
							placeholder="e.g. befriend the Tiyanki matriarch"
						/>
					</label>
				{/if}
				<label class="flex flex-col"
					><span class="text-xs text-gray-500">I</span>
					<select
						class="rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-700"
						bind:value={polarity}
					>
						<option value="want">want it</option>
						<option value="avoid">avoid it</option>
					</select>
				</label>
				<label class="flex flex-col"
					><span class="text-xs text-gray-500">note</span>
					<input
						class="w-56 rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-700"
						bind:value={note}
					/>
				</label>
				<button
					type="submit"
					class="rounded bg-sky-600 px-3 py-1 text-white disabled:opacity-40"
					disabled={!formTarget || (kindInfo?.manual && !title.trim())}>add</button
				>
			</form>
		</Panel>

		{#if data.parked.length}
			<Panel title="Parked" note="Potential steps, out of the plan until you take them up again.">
				<ul class="text-sm">
					{#each data.parked as r (r.id)}
						<li
							class="flex flex-wrap items-center gap-2 border-b border-gray-100 py-1 dark:border-gray-800"
						>
							<span class="min-w-48 flex-1">{@render name(r)}</span>
							{@render status(r)}
							<button type="button" class="text-xs text-sky-600" onclick={() => op(r, 'unpark')}
								>plan again</button
							>
							<button
								type="button"
								class="text-xs text-gray-500 hover:text-red-600"
								onclick={() => remove(r)}>✕</button
							>
						</li>
					{/each}
				</ul>
			</Panel>
		{/if}

		<Panel
			title="History"
			note="Changes to the plan along this branch, newest first, and what the saves showed reached."
		>
			{#if historyGoal}
				<button type="button" class="mb-2 text-xs text-sky-600" onclick={() => (historyGoal = null)}
					>show every goal</button
				>
			{/if}
			<div class="grid gap-4 md:grid-cols-2">
				<ul class="text-xs">
					{#each data.history
						.filter((h) => !historyGoal || h.goal === historyGoal)
						.slice(0, 200) as h (h.id)}
						<li class="py-0.5">
							<span class="text-gray-500 tabular-nums">{h.date ?? '?'}</span>
							<b>{h.op}</b>
							{h.label}{h.detail ? ` — ${h.detail}` : ''}
							<span class="text-gray-400">({new Date(h.at).toLocaleString()})</span>
						</li>
					{:else}
						<li class="text-gray-500">No changes yet.</li>
					{/each}
				</ul>
				<ul class="text-xs">
					{#each [...data.doneAt]
						.filter((d) => !historyGoal || d.goal === historyGoal)
						.sort((a, b) => b.date.localeCompare(a.date)) as d (d.goal)}
						<li class="py-0.5">
							<span class="text-gray-500 tabular-nums">{d.exact ? '' : 'by '}{d.date}</span>
							<b class={d.avoid ? 'text-red-600' : 'text-green-700 dark:text-green-400'}
								>{d.avoid ? 'happened' : 'reached'}</b
							>
							{d.label}
						</li>
					{:else}
						<li class="text-gray-500">Nothing reached yet.</li>
					{/each}
				</ul>
			</div>
		</Panel>
	</div>

	<div class="space-y-6">
		{#if data.others.length}
			<Panel
				title="From other branches"
				note="Goals planned on another branch of the save graph, not on this one; their status is this branch's. One no longer possible here is copied as parked."
			>
				<button
					type="button"
					class="mb-2 text-xs text-sky-600"
					onclick={() =>
						change(
							data.others.map((g) => ({
								goal: newGoalId(),
								op: 'add',
								data: {
									kind: g.kind,
									target: g.target,
									polarity: g.polarity,
									from: g.id,
									...(g.note ? { note: g.note } : {}),
									...(g.title ? { title: g.title } : {}),
									...(g.state === 'blocked' ? { parked: true } : {})
								}
							}))
						)}>copy all here</button
				>
				<ul class="text-sm">
					{#each data.others as g (g.id)}
						<li
							class="flex flex-wrap items-center gap-2 border-b border-gray-100 py-1 dark:border-gray-800"
						>
							<span class="min-w-40 flex-1">{@render name(g)}</span>
							{@render status(g)}
							<button type="button" class="text-xs text-sky-600" onclick={() => copy(g)}
								>{g.state === 'blocked' ? 'copy, parked' : 'copy here'}</button
							>
						</li>
					{/each}
				</ul>
			</Panel>
		{/if}

		<Panel title="Potential goals" note="What the latest save suggests; a click adds it.">
			{#each suggestionsBy as g (g.id)}
				<h3 class="mt-2 font-semibold">{g.name}</h3>
				<ul class="text-sm">
					{#each g.list as s, i (i)}
						<li class="flex items-center gap-2">
							<span class="flex-1"
								>{s.label}{#if s.why}<span class="text-xs text-gray-500">
										· {s.why}</span
									>{/if}</span
							>
							<button
								type="button"
								class="text-xs text-sky-600"
								title="want it"
								onclick={() => addGoal(s.kind, s.target, 'want')}>+ want</button
							>
							<button
								type="button"
								class="text-xs text-red-600"
								title="avoid it"
								onclick={() => addGoal(s.kind, s.target, 'avoid')}>+ avoid</button
							>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-gray-500">Nothing to suggest from the latest save.</p>
			{/each}
		</Panel>
	</div>
</div>
