<script lang="ts">
	import {
		agreementName,
		CONTACT_COLUMNS,
		CONTACT_KINDS,
		KIND_LABELS,
		kindOf,
		kindTypes,
		shown,
		type ContactColumn,
		type ContactRow,
		type ContactView
	} from '#lib/contacts.ts';
	import { nameOf, pretty } from '#lib/format.ts';
	import EmpireName from '#lib/EmpireName.svelte';
	import type { Battle, Claim, Combat } from '#lib/types.ts';
	import { followGame } from '#lib/live.ts';
	import { putSettings } from '#lib/settings.ts';
	import SortTable from '#lib/SortTable.svelte';
	import type { Column } from '#lib/sort.ts';

	let { data } = $props();
	followGame(() => data.isHead);

	// the view is the profile's: changed here, stored at once
	let view: ContactView = $derived(data.view);
	const save = (v: ContactView) => {
		view = v;
		void putSettings({ contactView: v });
	};
	const rows = $derived(shown(data.rows, view));
	const yesNo = (v: boolean) => (v ? 1 : 0);

	const ALL: Record<ContactColumn, Column<ContactRow>> = {
		type: { id: 'type', label: 'Type', value: (r) => (r.country ? pretty(r.country.type) : null) },
		ethics: {
			id: 'ethics',
			label: 'Ethics',
			value: (r) =>
				r.communications
					? (r.country?.ethics.map((e) => nameOf(data.names, e)).join(', ') ?? null)
					: null,
			title: 'known after communications'
		},
		government: {
			id: 'government',
			label: 'Government',
			value: (r) =>
				r.communications && r.country?.governmentType
					? nameOf(data.names, r.country.governmentType)
					: null
		},
		communications: {
			id: 'communications',
			label: 'Comms',
			value: (r) => yesNo(r.communications),
			cell: comms
		},
		opinion: { id: 'opinion', label: 'Opinion', value: (r) => r.opinion, right: true },
		trust: { id: 'trust', label: 'Trust', value: (r) => r.trust, right: true },
		threat: { id: 'threat', label: 'Threat', value: (r) => r.threat, right: true },
		agreements: {
			id: 'agreements',
			label: 'Agreements',
			value: (r) => r.agreements.map(agreementName).join(', ') || null
		},
		border: {
			id: 'border',
			label: 'Border',
			value: (r) => r.borderRange,
			right: true,
			title: 'border range; – not bordering'
		},
		firstContact: {
			id: 'firstContact',
			label: 'First contact',
			value: (r) => r.firstContact?.stage ?? null,
			cell: fc
		}
	};
	const columns: Column<ContactRow>[] = $derived([
		{ id: 'name', label: 'Empire', value: (r) => r.name, cell: name },
		...view.columns.map((c) => ALL[c])
	]);
	const goalName = (k: string) => pretty(k.replace(/^wg_/, ''));
	const presetName = (k: string) => pretty(k.replace(/^preset_/, ''));
	// "subject_can_not_be_integrated" → "can not be integrated"
	const termValue = (v: string) => pretty(v.replace(/^subject_(is_|does_|gets_)?/, ''));
	const percent = (v: number | null) => (v === null ? '?' : `${Math.round(v * 100)} %`);

	const battleColumns: Column<Battle & { i: number }>[] = [
		{ id: 'date', label: 'Date', value: (b) => b.date },
		{ id: 'system', label: 'System', value: (b) => b.system },
		{ id: 'type', label: 'Type', value: (b) => b.type },
		{ id: 'result', label: 'Result', value: (b) => (b.won ? 1 : 0), cell: battleResult },
		{ id: 'lost', label: 'Lost', value: (b) => b.lost, right: true },
		{ id: 'killed', label: 'Killed', value: (b) => b.killed, right: true }
	];
	const combatColumns: Column<Combat>[] = [
		{ id: 'date', label: 'Date', value: (c) => c.date },
		{ id: 'fleet', label: 'Our fleet', value: (c) => c.fleet },
		{ id: 'enemy', label: 'Against', value: (c) => c.enemy, cell: combatEnemy },
		{ id: 'lost', label: 'Our losses', value: (c) => c.lost, cell: combatLost, right: true },
		{ id: 'killed', label: 'Theirs', value: (c) => c.enemyLost, cell: combatKilled, right: true }
	];
	const claimColumns: Column<Claim>[] = [
		{ id: 'system', label: 'System', value: (c) => c.system },
		{ id: 'holder', label: 'Held by', value: (c) => c.holder, cell: claimHolder },
		{
			id: 'claimant',
			label: 'Claimed by',
			value: (c) => (c.ours ? 'us' : c.claimant),
			cell: claimant
		},
		{ id: 'claims', label: 'Claims', value: (c) => c.claims, right: true },
		{ id: 'since', label: 'Since', value: (c) => c.since }
	];
</script>

{#snippet name(r: ContactRow)}
	<EmpireName
		name={r.name}
		color={data.flagColors[r.country?.flagColor ?? ''] ?? null}
		kind={kindOf(r.country?.type ?? '')}
		nomadic={data.nomads.includes(r.countryId)}
	/>{#if r.hostile}<span class="text-red-600"> · hostile</span>{/if}
{/snippet}
{#snippet comms(r: ContactRow)}{r.communications ? '✓' : '–'}{/snippet}
{#snippet fc(r: ContactRow)}{r.firstContact
		? `${pretty(r.firstContact.stage)}, ${r.firstContact.clues} clues`
		: '–'}{/snippet}

<header class="mb-4 flex items-start gap-4">
	<h1 class="flex-1 text-2xl font-bold">Contacts</h1>
	<span class="shrink-0 text-2xl font-bold tabular-nums">{data.latest.date}</span>
</header>

{#snippet who(names: string[])}{#each names as n, i (n)}{i ? ', ' : ''}<EmpireName
			name={n}
			bold={false}
		/>{/each}{/snippet}

{#if data.wars.length > 0}
	<h2 class="mb-2 text-xl font-semibold">Wars</h2>
	<div class="mb-6 flex flex-col gap-3">
		{#each data.wars as w (w.id)}
			<section class="rounded border border-gray-200 p-3 text-sm dark:border-gray-800">
				<div class="mb-1 flex flex-wrap items-baseline gap-x-4">
					<b class="text-base">{w.name}</b>
					<span class="text-gray-500 tabular-nums">since {w.start ?? '?'}</span>
				</div>
				<div>
					we {w.attacker ? 'attack' : 'defend'}{#if w.allies.length}
						with {@render who(w.allies)}{/if} against <b>{@render who(w.enemies)}</b>
				</div>
				<div>
					war goals: ours {w.goal ? goalName(w.goal) : '–'}, theirs {w.enemyGoal
						? goalName(w.enemyGoal)
						: '–'}
				</div>
				<div class="tabular-nums">
					war exhaustion: ours {percent(w.exhaustion)}, theirs {percent(w.enemyExhaustion)}
				</div>
				{#if w.battles.length}
					<div class="mt-2 text-xs">
						<SortTable
							rows={w.battles.map((b, i) => ({ ...b, i }))}
							columns={battleColumns}
							key={(b) => b.i}
						/>
					</div>
				{/if}
			</section>
		{/each}
	</div>
{/if}

{#if data.combats.length}
	<h2 class="mb-2 text-xl font-semibold">Fleet combats</h2>
	<p class="mb-1 text-xs text-gray-500">
		what the saves caught: a fleet's combat record is cleared some time after the fight
	</p>
	<div class="mb-6">
		<SortTable
			rows={data.combats}
			columns={combatColumns}
			key={(c) => `${c.fleetId}:${c.date}`}
			sort={{ column: 'date', desc: true }}
		/>
	</div>
{/if}

{#if data.claims.length}
	<h2 class="mb-2 text-xl font-semibold">Claims</h2>
	<div class="mb-6">
		<SortTable
			rows={data.claims}
			columns={claimColumns}
			key={(c) => `${c.systemId}:${c.claimant}`}
		/>
	</div>
{/if}

{#snippet battleResult(b: Battle)}<span class={b.won ? 'text-green-600' : 'text-red-600'}
		>{b.won ? 'won' : 'lost'}</span
	>{/snippet}
{#snippet combatEnemy(c: Combat)}{c.enemyFleets}
	<span class="text-gray-500">({@render who(c.enemy.split(', '))})</span>{/snippet}
{#snippet combatLost(c: Combat)}<span class={c.lost ? 'text-red-600' : ''}
		>{c.lost} / {c.ships}</span
	>{/snippet}
{#snippet combatKilled(c: Combat)}<span class={c.enemyLost ? 'text-green-600' : ''}
		>{c.enemyLost} / {c.enemyShips}</span
	>{/snippet}
{#snippet claimHolder(c: Claim)}{#if c.holder}<EmpireName
			name={c.holder}
			bold={false}
		/>{:else}–{/if}{/snippet}
{#snippet claimant(c: Claim)}{#if c.ours}us{:else}<span class="text-red-600"
			><EmpireName name={c.claimant} bold={false} /></span
		>{/if}{/snippet}

{#if data.subjects?.length}
	<h2 class="mb-2 text-xl font-semibold">Subjects</h2>
	<div class="mb-6 flex flex-col gap-3">
		{#each data.subjects as s (s.countryId)}
			<section class="rounded border border-gray-200 p-3 text-sm dark:border-gray-800">
				<div class="mb-1 flex flex-wrap items-baseline gap-x-4">
					<span class="text-base"><EmpireName name={s.name} /></span>
					<span
						>{s.weAreOverlord ? 'our subject' : 'our overlord'}: {data.diploNames[s.preset] ??
							presetName(s.preset)}</span
					>
					<span class="text-gray-500 tabular-nums">since {s.since ?? '?'}</span>
					{#if s.loyalty !== null}<span class="tabular-nums"
							>loyalty <b class={s.loyalty < 0 ? 'text-red-600' : 'text-green-600'}>{s.loyalty}</b
							></span
						>{/if}
					{#if s.specialistLevel > 0}<span
							>specialist level {s.specialistLevel} ({s.specialistExperience} XP)</span
						>{/if}
				</div>
				<div class="text-gray-500">
					{Object.entries(s.terms)
						// terms the game hides have no name: left out, as in its agreements screen
						.filter(([k]) => data.diploNames[k])
						.map(([k, v]) => `${data.diploNames[k]}: ${data.diploNames[v] ?? termValue(v)}`)
						.join(' · ')}
				</div>
				{#if Object.values(s.subsidies).some((v) => v !== 0)}
					<div>
						subsidies: {Object.entries(s.subsidies)
							.filter(([, v]) => v !== 0)
							.map(([k, v]) => `${pretty(k.replace(/^resource_subsidies_/, ''))} ${v}`)
							.join(', ')}
					</div>
				{/if}
			</section>
		{/each}
	</div>
{/if}

<h2 class="mb-2 text-xl font-semibold">Relations</h2>
<div class="mb-4 flex flex-col gap-2 text-sm">
	<div class="flex flex-wrap items-center gap-4">
		<label class="flex items-center gap-1"
			><input
				type="checkbox"
				checked={view.communicationsOnly}
				onchange={(e) => save({ ...view, communicationsOnly: e.currentTarget.checked })}
			/> with communications only</label
		>
		<label class="flex items-center gap-1"
			>hostile
			<select
				class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
				value={view.hostile}
				onchange={(e) =>
					save({ ...view, hostile: e.currentTarget.value as ContactView['hostile'] })}
			>
				<option value="any">any</option><option value="hostile">only</option><option
					value="peaceful">not</option
				>
			</select></label
		>
		<span class="text-gray-500">{rows.length} of {data.rows.length}</span>
	</div>
	<div class="flex flex-wrap items-center gap-1">
		<span class="text-gray-500">show:</span>
		{#each CONTACT_KINDS as k (k)}
			<label
				class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700 {view.kinds.includes(
					k
				)
					? ''
					: 'opacity-40'}"
				title={kindTypes(k).join(', ') || 'every other country type'}
				><input
					type="checkbox"
					class="sr-only"
					checked={view.kinds.includes(k)}
					onchange={() =>
						save({
							...view,
							kinds: CONTACT_KINDS.filter((x) => (x === k) !== view.kinds.includes(x))
						})}
				/>{KIND_LABELS[k]}</label
			>
		{/each}
	</div>
	<div class="flex flex-wrap items-center gap-1">
		<span class="text-gray-500">columns:</span>
		{#each CONTACT_COLUMNS as c (c)}
			<label
				class="rounded border border-gray-300 px-2 py-0.5 dark:border-gray-700 {view.columns.includes(
					c
				)
					? ''
					: 'opacity-40'}"
				><input
					type="checkbox"
					class="sr-only"
					checked={view.columns.includes(c)}
					onchange={() =>
						save({
							...view,
							columns: CONTACT_COLUMNS.filter((x) => (x === c) !== view.columns.includes(x))
						})}
				/>{ALL[c].label}</label
			>
		{/each}
	</div>
</div>

{#if data.seenAt}
	<SortTable {rows} {columns} key={(r) => r.countryId} />
{:else}
	<p class="text-sm text-amber-600">
		No save read since this tab exists; it fills after the next one.
	</p>
{/if}
