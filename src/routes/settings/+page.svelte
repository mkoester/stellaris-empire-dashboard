<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ROW_LINES, type Display, type RowLine } from '#lib/profiles.ts';
	import { campaignAction, profileAction, putSettings } from '#lib/settings.ts';

	let { data } = $props();

	// on/off display options: key, label, note
	const SWITCHES: [
		Exclude<keyof Display, 'colonyRowLine' | 'expansionRowLine'>,
		string,
		string?
	][] = [
		[
			'tradeoffs',
			'Trade-offs tab: stations, districts or buildings first — payback and a simulation',
			'exploratory: estimates from your budget, with knobs for upcoming techs and traditions'
		],
		[
			'diplomacyAll',
			'Diplomacy: every empire and every relation between them, whatever our intel shows',
			'cheating — the game shows what your intel on each empire reveals'
		],
		[
			'tradeIntel',
			'Trade: other empires’ stockpiles and income, and what they would trade at what rate',
			'cheating — the game shows neither; estimated until calibrated (docs/trade-calibration.md)'
		],
		[
			'habitatsAlways',
			'Expansion: show habitat sites even before habitats can be built',
			'later behind an “enable cheats” switch'
		],
		[
			'showLocked',
			'Government: show locked agendas, edicts and policies too',
			'the game lists only what you can pick'
		],
		[
			'factionTypes',
			'Ethics: faction types of your ethics, with their demands, before any has formed',
			'cheating'
		],
		['allFactionTypes', 'Ethics: also the faction types of ethics you do not hold', 'cheating'],
		['anomalySpoilers', 'Situations: show what an anomaly can lead to', 'spoilers'],
		['projectSpoilers', 'Situations: show what a special project leads to', 'spoilers'],
		[
			'hiddenTimers',
			'Upcoming: show the timers of events in progress (when an event chain continues)',
			'spoilers'
		],
		[
			'unknownStars',
			'Maps: show the undiscovered systems too, without their hyperlanes',
			'the game shows every star from the start'
		],
		['wormholeLinks', 'Maps: show where explored wormholes lead (both ends visited)'],
		[
			'wormholePairs',
			'Maps: show every wormhole pair and its connection, explored or not',
			'spoilers'
		],
		[
			'lgates',
			'Maps: show every L-Gate, the L-Cluster and all their connections',
			'spoilers — until the gates open the L-Cluster does not exist yet: shown where it is predicted to spawn'
		],
		[
			'surveyAll',
			'Treat every system as fully surveyed: bodies, deposits, anomalies, expansion and habitat sites',
			'spoilers'
		],
		[
			'wholeGalaxy',
			'Maps and megastructure sites: every system with its name and hyperlanes',
			'spoilers'
		],
		[
			'contactStations',
			'Maps: colour visited systems by their station’s owner, named, before communications',
			'spoilers — the save knows them before you have communications'
		]
	];

	// Deleting a game's history; the saves still on disk are not read in again.
	const deleteGame = (g: { campaign: string; name: string; onDisk: boolean }) => {
		const what = g.name || g.campaign;
		const note = g.onDisk
			? 'Its saves stay on disk but are not read in again; a new save starts it afresh.'
			: 'Its saves are gone, so it cannot be read back.';
		if (confirm(`Delete the history of ${what}? ${note}`))
			act(() => campaignAction('delete', g.campaign));
	};

	let failure = $state('');
	// every change reloads the page data (and the layout's tab bar, which shows the profile)
	const act = async (f: () => Promise<unknown>) => {
		failure = '';
		try {
			await f();
			await invalidateAll();
		} catch (e) {
			failure = (e as Error).message;
		}
	};
	const rename = (id: string, name: string, before: string) =>
		name.trim() && name !== before
			? act(() => profileAction({ action: 'rename', id, name }))
			: null;
	async function importFiles(files: FileList | null) {
		for (const f of files ?? [])
			await act(async () => profileAction({ action: 'import', file: JSON.parse(await f.text()) }));
	}
	let newName = $state('');
</script>

<div class="flex max-w-3xl flex-col gap-8 text-sm">
	<section>
		<h2 class="mb-1 text-xl font-semibold">Profiles</h2>
		<p class="mb-3 text-gray-500">
			A profile keeps your tabs, chart events, the colonies view and the display options — one per
			playstyle or play-through. The theme is shared. Picking one while a campaign runs makes it
			that campaign's: its saves bring it back.
			{#if data.campaign}Current campaign: <b>{data.campaign}</b>.{/if}
		</p>
		<table class="mb-3 text-left">
			<tbody>
				{#each data.profiles as p (p.id)}
					<tr class="border-b border-gray-200 dark:border-gray-800">
						<td class="p-1">
							<input
								type="radio"
								name="profile"
								checked={p.id === data.active}
								onchange={() => act(() => profileAction({ action: 'select', id: p.id }))}
								aria-label="use {p.name}"
							/>
						</td>
						<td class="p-1">
							<input
								class="w-48 rounded border border-transparent bg-transparent px-1 hover:border-gray-300 dark:hover:border-gray-700 {p.id ===
								data.active
									? 'font-semibold'
									: ''}"
								value={p.name}
								onchange={(e) => rename(p.id, e.currentTarget.value, p.name)}
								aria-label="name"
							/>
						</td>
						<td class="p-1 text-gray-500">{(data.campaigns[p.id] ?? []).join(', ')}</td>
						<td class="p-1 whitespace-nowrap">
							<button
								class="underline"
								onclick={() =>
									act(() => profileAction({ action: 'create', name: p.name, copyOf: p.id }))}
								>duplicate</button
							>
							·
							<a class="underline" href={resolve('/api/profiles/[id]', { id: p.id })} download
								>export</a
							>
							{#if data.profiles.length > 1}
								·
								<button
									class="text-red-600 underline"
									onclick={() =>
										confirm(`Delete profile “${p.name}”?`) &&
										act(() => profileAction({ action: 'delete', id: p.id }))}>delete</button
								>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<div class="flex flex-wrap items-center gap-4">
			<form
				class="flex gap-1"
				onsubmit={(e) => {
					e.preventDefault();
					act(() => profileAction({ action: 'create', name: newName })).then(() => (newName = ''));
				}}
			>
				<input
					class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
					placeholder="new profile …"
					bind:value={newName}
				/>
				<button
					class="rounded border border-gray-300 px-2 dark:border-gray-700"
					disabled={!newName.trim()}>add</button
				>
			</form>
			<label class="cursor-pointer underline"
				>import …<input
					class="hidden"
					type="file"
					accept=".json,application/json"
					multiple
					onchange={(e) => importFiles(e.currentTarget.files)}
				/></label
			>
		</div>
		{#if failure}<p class="mt-2 text-red-600">{failure}</p>{/if}
	</section>

	<section>
		<h2 class="mb-1 text-xl font-semibold">Display</h2>
		{#each [['colonyRowLine', 'Colonies tab, line between colonies'], ['expansionRowLine', 'Expansion, line between planets']] as const as [key, label] (key)}
			<label class="block"
				>{label}
				<select
					class="rounded border border-gray-300 bg-transparent dark:border-gray-700"
					value={data.display[key]}
					onchange={(e) =>
						act(() =>
							putSettings({
								display: { ...data.display, [key]: e.currentTarget.value as RowLine }
							})
						)}
				>
					{#each Object.keys(ROW_LINES) as l (l)}<option value={l}>{l}</option>{/each}
				</select></label
			>
		{/each}
		{#each SWITCHES as [key, label, note] (key)}
			<label class="mt-2 block"
				><input
					type="checkbox"
					checked={data.display[key]}
					onchange={(e) =>
						act(() =>
							putSettings({ display: { ...data.display, [key]: e.currentTarget.checked } })
						)}
				/>
				{label}
				{#if note}<span class="text-gray-500">({note})</span>{/if}</label
			>
		{/each}
	</section>
	<section>
		<h2 class="mb-1 text-xl font-semibold">Games</h2>
		<p class="mb-1 text-gray-500">
			The history kept for each game. It is the only copy of what the game's autosaves no longer
			hold.
		</p>
		<table class="text-left">
			<tbody>
				{#each data.games as g (g.campaign)}
					<tr class="border-b border-gray-200 dark:border-gray-800">
						<td class="p-1">{g.name || g.campaign}</td>
						<td class="p-1 text-gray-500">{g.date}</td>
						<td class="p-1 text-gray-500">{g.nodes} states</td>
						<td class="p-1 text-gray-500">{g.onDisk ? 'saves on disk' : 'no saves on disk'}</td>
						<td class="p-1">
							<button class="text-red-600 underline" onclick={() => deleteGame(g)}>delete</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
	<section>
		<h2 class="mb-1 text-xl font-semibold">Folders</h2>
		<p class="text-gray-500">
			The game install and the folder with your saves: <a class="underline" href={resolve('/setup')}
				>change them</a
			>.
		</p>
	</section>
</div>
