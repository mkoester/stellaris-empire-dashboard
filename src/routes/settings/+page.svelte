<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { listed, SWITCH_GROUPS, SWITCHES } from '#lib/displaySwitches.ts';
	import { ROW_LINES, type Display, type RowLine } from '#lib/profiles.ts';
	import { MAX_POP_WINDOW, windowMonths, windowStrip, type PopWindow } from '#lib/popWindow.ts';
	import { MAX_RINGS, SECTOR_COUNTS, type QuadrantView, type SectorCount } from '#lib/quadrants.ts';
	import { campaignAction, profileAction, putSettings } from '#lib/settings.ts';

	let { data } = $props();

	// the display switches by group, filtered by the search; spoilers and cheats only when shown,
	// cheats and the spoilers revealing other empires never in a multiplayer or Ironman game
	let query = $state('');
	const gates = $derived({
		showSpoilers: data.display.showSpoilers,
		showCheats: data.display.showCheats && !data.noCheats
	});
	const groups = $derived(
		SWITCH_GROUPS.map((g) => ({
			title: g,
			items: SWITCHES.filter((s) => s.group === g && listed(s, gates, query, !!data.noCheats))
		})).filter((g) => g.items.length)
	);
	const setDisplay = (patch: Partial<Display>) =>
		act(() => putSettings({ display: { ...data.display, ...patch } }));
	const KIND_LABEL = { spoiler: 'spoiler', cheat: 'cheat', normal: '' } as const;
	// the left-hand list: every section, the display groups among them
	const NAV = [
		['profiles', 'Profiles'],
		['reveal', 'Spoilers and cheats'],
		['display', 'Display'],
		['quadrants', 'Map rings and quadrants'],
		['popWindow', 'Pops charts'],
		['games', 'Games'],
		['folders', 'Folders']
	] as const;

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
	// every map's rings and sectors, stored whole
	const setQuadrants = (patch: Partial<QuadrantView>) =>
		act(() => putSettings({ quadrants: { ...data.quadrants, ...patch } }));

	// the months the Pops charts' mean takes in, stored whole
	const setPopWindow = (patch: Partial<PopWindow>) =>
		act(() => putSettings({ popWindow: { ...data.popWindow, ...patch } }));
	const strip = $derived(windowStrip(data.popWindow));
	const MONTH_CHOICES = Array.from({ length: MAX_POP_WINDOW + 1 }, (_, i) => i);

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

<div class="flex gap-8 text-sm">
	<nav class="sticky top-4 hidden w-48 shrink-0 self-start md:block" aria-label="settings sections">
		<input
			class="mb-3 w-full rounded border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
			type="search"
			placeholder="search settings …"
			bind:value={query}
		/>
		<ul class="space-y-1">
			{#each NAV as [id, label] (id)}
				<li><a class="text-gray-500 hover:text-current" href="#{id}">{label}</a></li>
				{#if id === 'display'}
					{#each groups as g (g.title)}
						<li class="pl-3">
							<a class="text-gray-500 hover:text-current" href="#display-{g.title}">{g.title}</a>
						</li>
					{/each}
				{/if}
			{/each}
		</ul>
	</nav>
	<div class="flex max-w-3xl min-w-0 flex-col gap-8">
		<input
			class="w-full rounded border border-gray-300 bg-transparent px-2 py-1 md:hidden dark:border-gray-700"
			type="search"
			placeholder="search settings …"
			bind:value={query}
		/>
		<section id="profiles" class="scroll-mt-4">
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
						act(() => profileAction({ action: 'create', name: newName })).then(
							() => (newName = '')
						);
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

		<section id="reveal" class="scroll-mt-4">
			<h2 class="mb-1 text-xl font-semibold">Spoilers and cheats</h2>
			<p class="mb-1 text-gray-500">
				The tabs show what the game's own screens show. <b>Spoilers</b> reveal what the game hides
				until you find it; <b>cheats</b> what it never tells a player. Hidden, their switches are off
				— each comes back as it was when shown again.
			</p>
			<label class="block"
				><input
					type="checkbox"
					checked={data.display.showSpoilers}
					onchange={(e) => setDisplay({ showSpoilers: e.currentTarget.checked })}
				/> show the spoiler settings</label
			>
			{#if data.noCheats === 'ironman'}
				<p class="mt-1">
					<b>This is an Ironman game: the cheats are off</b>, and so are the spoilers that reveal
					other empires or space you have not explored. Ironman is the game played as it comes.
				</p>
			{:else if data.noCheats === 'multiplayer'}
				<p class="mt-1">
					<b>This is a multiplayer game: the cheats are off</b>, and so are the spoilers that reveal
					other empires or space you have not explored. The other players cannot see that you run
					the dashboard, so it shows nothing here the game would not show you.
				</p>
			{:else}
				<label class="mt-1 block"
					><input
						type="checkbox"
						checked={data.display.showCheats}
						onchange={(e) => setDisplay({ showCheats: e.currentTarget.checked })}
					/> show the cheat settings</label
				>
			{/if}
		</section>
		<section id="display" class="scroll-mt-4">
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
			{#each groups as g (g.title)}
				<h3 id="display-{g.title}" class="mt-4 scroll-mt-4 font-semibold">{g.title}</h3>
				{#each g.items as s (s.key)}
					<label class="mt-1 block"
						><input
							type="checkbox"
							checked={data.display[s.key]}
							onchange={(e) => setDisplay({ [s.key]: e.currentTarget.checked })}
						/>
						{s.label}
						{#if s.kind !== 'normal'}<span
								class="rounded px-1 text-[11px] {s.kind === 'cheat'
									? 'bg-red-500/15 text-red-600'
									: 'bg-amber-500/15 text-amber-600'}">{KIND_LABEL[s.kind]}</span
							>{/if}
						{#if s.note}<span class="text-gray-500">({s.note})</span>{/if}</label
					>
				{/each}
			{:else}
				<p class="mt-2 text-gray-500">No display setting matches “{query}”.</p>
			{/each}
		</section>
		<section id="quadrants" class="scroll-mt-4">
			<h2 class="mb-1 text-xl font-semibold">Map rings and quadrants</h2>
			<p class="mb-1 text-gray-500">
				Rings around the galactic core — one just inside the innermost system, one just outside the
				outermost (special systems such as the L-Cluster may lie beyond it) — and a cross dividing
				the galaxy into sectors, on every map.
			</p>
			<label class="block"
				><input
					type="checkbox"
					checked={data.quadrants.on}
					onchange={(e) => setQuadrants({ on: e.currentTarget.checked })}
				/> show them</label
			>
			<label class="mt-2 block"
				>rings in between
				<select
					class="rounded border border-gray-300 bg-transparent dark:border-gray-700"
					value={data.quadrants.rings === null ? 'auto' : String(data.quadrants.rings)}
					onchange={(e) =>
						setQuadrants({
							rings: e.currentTarget.value === 'auto' ? null : Number(e.currentTarget.value)
						})}
				>
					<option value="auto">by galaxy size</option>
					{#each Array.from({ length: MAX_RINGS + 1 }, (_, i) => i) as n (n)}<option
							value={String(n)}>{n}</option
						>{/each}
				</select></label
			>
			<label class="mt-2 block"
				>sectors
				<select
					class="rounded border border-gray-300 bg-transparent dark:border-gray-700"
					value={String(data.quadrants.sectors)}
					onchange={(e) => setQuadrants({ sectors: Number(e.currentTarget.value) as SectorCount })}
				>
					{#each SECTOR_COUNTS as n (n)}<option value={String(n)}>{n}</option>{/each}
				</select></label
			>
			<label class="mt-2 block"
				><input
					type="checkbox"
					checked={data.quadrants.rotated}
					onchange={(e) => setQuadrants({ rotated: e.currentTarget.checked })}
				/> cross turned by half a sector (4 sectors: N, E, S, W instead of NE, SE, SW, NW)</label
			>
		</section>
		<section id="popWindow" class="scroll-mt-4">
			<h2 class="mb-1 text-xl font-semibold">Pops charts</h2>
			<p class="mb-1 text-gray-500">
				The game books growth in whole pops and turns a fraction into a chance of one more, so a
				single month is off the rate by up to one. The charts draw each month faint and, over it,
				its mean over the months around it.
			</p>
			<label class="block"
				>months before
				<select
					class="rounded border border-gray-300 bg-transparent dark:border-gray-700"
					value={String(data.popWindow.back)}
					onchange={(e) => setPopWindow({ back: Number(e.currentTarget.value) })}
				>
					{#each MONTH_CHOICES as n (n)}<option value={String(n)}>{n}</option>{/each}
				</select></label
			>
			<label class="mt-2 block"
				>months after
				<select
					class="rounded border border-gray-300 bg-transparent dark:border-gray-700"
					value={String(data.popWindow.ahead)}
					onchange={(e) => setPopWindow({ ahead: Number(e.currentTarget.value) })}
				>
					{#each MONTH_CHOICES as n (n)}<option value={String(n)}>{n}</option>{/each}
				</select></label
			>
			<div class="mt-3 flex gap-0.5" aria-label="the months a point's mean takes in">
				{#each strip as m (m.offset)}
					<div
						class={[
							'flex h-8 w-8 items-center justify-center rounded-sm text-xs tabular-nums',
							m.in ? 'bg-sky-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-800',
							m.offset === 0 && 'font-bold ring-2 ring-gray-900 dark:ring-gray-100'
						]}
						title={m.offset === 0
							? 'the month the point stands for'
							: `${Math.abs(m.offset)} month${Math.abs(m.offset) > 1 ? 's' : ''} ${m.offset < 0 ? 'before' : 'after'}`}
					>
						{m.offset === 0 ? 'now' : m.offset > 0 ? `+${m.offset}` : m.offset}
					</div>
				{/each}
			</div>
			<p class="mt-2 text-gray-500">
				Each point: the mean of {windowMonths(data.popWindow)} month{windowMonths(data.popWindow) >
				1
					? 's'
					: ''}{data.popWindow.ahead
					? `. The last ${data.popWindow.ahead} point${data.popWindow.ahead > 1 ? 's' : ''} of a chart have fewer months after them yet, and change as later saves arrive.`
					: ', all before it: the line trails the change by about ' +
						data.popWindow.back / 2 +
						' months.'}
			</p>
		</section>
		<section id="games" class="scroll-mt-4">
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
		<section id="folders" class="scroll-mt-4">
			<h2 class="mb-1 text-xl font-semibold">Folders</h2>
			<p class="text-gray-500">
				The game install and the folder with your saves: <a
					class="underline"
					href={resolve('/setup')}>change them</a
				>.
			</p>
		</section>
	</div>
</div>
