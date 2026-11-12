<script lang="ts">
	import './layout.css';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { campaignAction, putSettings, THEMES, type Theme } from '#lib/settings.ts';
	import { applyTheme } from '#lib/theme.ts';
	import favicon from '#lib/assets/favicon.svg';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import { followLoads, followTicks } from '#lib/live.ts';
	import TimeWindow from '#lib/TimeWindow.svelte';

	let { data, children } = $props();

	// Tabs keep the branch being looked at (`?node=`).
	const node = $derived(page.url.searchParams.get('node'));
	const path = $derived(page.url.pathname);
	const tabsAt = (node: string | null) => [
		{ name: 'all', href: node ? resolve(`/?node=${node}`) : resolve('/'), active: path === '/' },
		{
			name: 'planner',
			href: node ? resolve(`/planner?node=${node}`) : resolve('/planner'),
			active: path === '/planner'
		},
		{
			name: 'colonies',
			href: node ? resolve(`/colonies?node=${node}`) : resolve('/colonies'),
			active: path === '/colonies'
		},
		{
			name: 'colony',
			href: node ? resolve(`/colony?node=${node}`) : resolve('/colony'),
			active: path.startsWith('/colony')
		},
		{
			name: 'map',
			href: node ? resolve(`/map?node=${node}`) : resolve('/map'),
			active: path === '/map'
		},
		{
			name: 'history',
			href: node ? resolve(`/history?node=${node}`) : resolve('/history'),
			active: path === '/history'
		},
		{
			name: 'migration',
			href: node ? resolve(`/migration?node=${node}`) : resolve('/migration'),
			active: path === '/migration'
		},
		{
			name: 'expansion',
			href: node ? resolve(`/expansion?node=${node}`) : resolve('/expansion'),
			active: path === '/expansion'
		},
		{
			name: 'growth',
			href: node ? resolve(`/growth?node=${node}`) : resolve('/growth'),
			active: path === '/growth'
		},
		{
			name: 'jobs',
			href: node ? resolve(`/jobs?node=${node}`) : resolve('/jobs'),
			active: path === '/jobs'
		},
		{
			name: 'produce',
			href: node ? resolve(`/produce?node=${node}`) : resolve('/produce'),
			active: path === '/produce'
		},
		{
			name: 'systems',
			href: node ? resolve(`/systems?node=${node}`) : resolve('/systems'),
			active: path === '/systems'
		},
		{
			name: 'fleets',
			href: node ? resolve(`/fleets?node=${node}`) : resolve('/fleets'),
			active: path === '/fleets'
		},
		{
			name: 'starbases',
			href: node ? resolve(`/starbases?node=${node}`) : resolve('/starbases'),
			active: path === '/starbases'
		},
		{
			name: 'trade',
			href: node ? resolve(`/trade?node=${node}`) : resolve('/trade'),
			active: path === '/trade'
		},
		{
			name: 'influence',
			href: node ? resolve(`/influence?node=${node}`) : resolve('/influence'),
			active: path === '/influence'
		},
		{
			name: 'trade deals',
			href: node ? resolve(`/deals?node=${node}`) : resolve('/deals'),
			active: path === '/deals'
		},
		{
			name: 'market',
			href: node ? resolve(`/market?node=${node}`) : resolve('/market'),
			active: path === '/market'
		},
		...(data.slaveMarket
			? [
					{
						name: 'slave market',
						href: node ? resolve(`/slaves?node=${node}`) : resolve('/slaves'),
						active: path === '/slaves'
					}
				]
			: []),
		{
			name: 'resources',
			href: node ? resolve(`/resources?node=${node}`) : resolve('/resources'),
			active: path === '/resources'
		},
		...(data.tradeoffs
			? [
					{
						name: 'trade-offs',
						href: node ? resolve(`/tradeoffs?node=${node}`) : resolve('/tradeoffs'),
						active: path === '/tradeoffs'
					}
				]
			: []),
		{
			name: 'events',
			href: node ? resolve(`/events?node=${node}`) : resolve('/events'),
			active: path === '/events'
		},
		{
			name: 'government',
			href: node ? resolve(`/government?node=${node}`) : resolve('/government'),
			active: path === '/government'
		},
		{
			name: 'ethics',
			href: node ? resolve(`/ethics?node=${node}`) : resolve('/ethics'),
			active: path === '/ethics'
		},
		{
			name: 'situations',
			href: node ? resolve(`/situations?node=${node}`) : resolve('/situations'),
			active: path === '/situations'
		},
		{
			name: 'shroud',
			href: node ? resolve(`/shroud?node=${node}`) : resolve('/shroud'),
			active: path === '/shroud'
		},
		{
			name: 'focus',
			href: node ? resolve(`/focus?node=${node}`) : resolve('/focus'),
			active: path === '/focus'
		},
		{
			name: 'traditions',
			href: node ? resolve(`/traditions?node=${node}`) : resolve('/traditions'),
			active: path === '/traditions'
		},
		{
			name: 'tech',
			href: node ? resolve(`/tech?node=${node}`) : resolve('/tech'),
			active: path === '/tech'
		},
		{
			name: 'leaders',
			href: node ? resolve(`/leaders?node=${node}`) : resolve('/leaders'),
			active: path === '/leaders'
		},
		{
			name: 'species',
			href: node ? resolve(`/species?node=${node}`) : resolve('/species'),
			active: path === '/species'
		},
		{
			name: 'contacts',
			href: node ? resolve(`/contacts?node=${node}`) : resolve('/contacts'),
			active: path === '/contacts'
		},
		{
			name: 'contracts',
			href: node ? resolve(`/contracts?node=${node}`) : resolve('/contracts'),
			active: path === '/contracts'
		},
		{
			name: 'galcom',
			href: node ? resolve(`/galcom?node=${node}`) : resolve('/galcom'),
			active: path === '/galcom'
		},
		{
			name: 'diplomacy',
			href: node ? resolve(`/diplomacy?node=${node}`) : resolve('/diplomacy'),
			active: path === '/diplomacy'
		},
		{
			name: 'pacts',
			href: node ? resolve(`/pacts?node=${node}`) : resolve('/pacts'),
			active: path === '/pacts'
		},
		{
			name: 'subjects',
			href: node ? resolve(`/subjects?node=${node}`) : resolve('/subjects'),
			active: path === '/subjects'
		},
		{
			name: 'megastructures',
			href: node ? resolve(`/megastructures?node=${node}`) : resolve('/megastructures'),
			active: path === '/megastructures'
		},
		{
			name: 'galaxy',
			href: node ? resolve(`/galaxy?node=${node}`) : resolve('/galaxy'),
			active: path === '/galaxy'
		},
		{
			name: 'mods',
			href: node ? resolve(`/mods?node=${node}`) : resolve('/mods'),
			active: path === '/mods'
		},
		{
			name: 'dlc',
			href: node ? resolve(`/dlc?node=${node}`) : resolve('/dlc'),
			active: path === '/dlc'
		},
		{
			name: 'about',
			href: node ? resolve(`/about?node=${node}`) : resolve('/about'),
			active: path === '/about'
		}
	];
	const fixed = $derived(tabsAt(node));
	const tabHref = (id: string) =>
		node ? resolve(`/tab/[id]?node=${node}`, { id }) : resolve('/tab/[id]', { id });
	const tab = (active: boolean) =>
		`rounded-t border-b-2 px-3 py-1 ${active ? 'border-blue-500 font-semibold' : 'border-transparent text-gray-500 hover:text-current'}`;

	async function addTab() {
		const id = crypto.randomUUID().slice(0, 8);
		await putSettings({ tabs: [...data.tabs, { id, name: 'new tab', header: true, panels: [] }] });
		await goto(tabHref(id), { invalidateAll: true });
	}

	// Another campaign is its tip node; pages tied to one colony or custom tab start over at `all`.
	async function switchCampaign(campaign: string) {
		const c = data.campaigns.find((x) => x.campaign === campaign);
		if (!c) return;
		const same = tabsAt(String(c.tip)).find((t) => t.active && t.name !== 'colony');
		await goto(same?.href ?? resolve(`/?node=${c.tip}`));
	}

	// A campaign whose saves are gone: its history here is the only copy left.
	async function answerGone(action: 'keep' | 'delete', c: { campaign: string; name: string }) {
		const what = c.name || c.campaign;
		if (
			action === 'delete' &&
			!confirm(`Delete the history of ${what}? Its saves are gone, so it cannot be read back.`)
		)
			return;
		await campaignAction(action, c.campaign);
		if (action === 'delete' && data.campaign === c.campaign) await goto(resolve('/'));
		await invalidateAll();
	}

	// This very page — its route, params and other query parameters — pinned to a node, or
	// unpinned: the arguments for resolve(), as the lint wants each goto() resolved.
	const here = (n: number | null) => {
		const query = new URLSearchParams(page.url.search);
		if (n === null) query.delete('node');
		else query.set('node', String(n));
		const q = query.size ? `?${query}` : '';
		return [`${page.route.id ?? '/'}${q}`, page.params] as Parameters<typeof resolve>;
	};

	// A save loaded in game: the dashboard follows it with the next save or month; until then the
	// player may look at it at once, on the same tab — or wave the question away.
	// A page pinned (`?node=`) to the save being played — the head, or the save just loaded — goes
	// on following the game when the next save or month arrives; pinned elsewhere, it stays.
	followLoads(
		() => invalidateAll(),
		async () => {
			if (node === null || ![data.head, data.loaded?.node].includes(Number(node))) return;
			await goto(resolve(...here(null)), { invalidateAll: true }); // the same page, unpinned
		}
	);
	// the last save and the last data of the game being played; a daily tick heard after the page
	// loaded is newer data than the server knew
	let tick = $state<{ date: string; at: number } | null>(null);
	followTicks((t) => (tick = { date: t.date, at: Date.now() }));
	const lastData = $derived(
		data.dates && tick && tick.at > data.dates.at ? tick.date : (data.dates?.data ?? null)
	);
	let waved = $state<number | null>(null);
	const loaded = $derived(
		data.loaded && data.loaded.node !== waved && String(data.loaded.node) !== node
			? data.loaded
			: null
	);
	// the same page at the loaded save — every page, a colony's and a custom tab's included
	const showLoaded = (n: number) => goto(resolve(...here(n)));

	async function setTheme(theme: Theme) {
		applyTheme(theme);
		await putSettings({ theme });
	}
</script>

<svelte:head>
	<title>Empire dashboard</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<main class="mx-auto max-w-[96rem] p-4">
	{#if data.setup}
		{@render children()}
	{:else}
		<nav
			class="mb-4 flex flex-wrap items-end gap-1 border-b border-gray-200 text-sm dark:border-gray-800"
		>
			{#each data.tabs as t (t.id)}
				<a class={tab(path === `/tab/${t.id}`)} href={tabHref(t.id)}>{t.name}</a>
			{/each}
			{#each fixed as t (t.name)}
				{@const settle = t.name === 'expansion' && data.settle.nomad}
				{@const dim =
					settle && data.settle.blocked
						? `not yet usable in game: settling needs ${data.settle.blocked}`
						: data.empty[t.name] && `nothing to show yet: ${data.empty[t.name]}`}
				<a class="{tab(t.active)} {dim ? 'opacity-50' : ''}" href={t.href} title={dim || undefined}
					>{settle ? 'settle' : t.name}{#if t.name === 'planner' && data.plan.alerts}<span
							class="ml-1 rounded bg-red-600 px-1 text-[11px] font-semibold text-white"
							title="goals no longer possible, or avoided ones that happened"
							>⚠ {data.plan.alerts}</span
						>{/if}</a
				>
			{/each}
			<button class={tab(false)} onclick={addTab} title="add a tab of your own">+</button>
			<a
				class={tab(path === '/settings')}
				href={node ? resolve(`/settings?node=${node}`) : resolve('/settings')}
				title="config: profiles and display">⚙ {data.profile.name}</a
			>
			{#if data.campaigns.length > 1}
				<label class="pb-1 text-gray-500"
					>game
					<select
						class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
						value={data.campaign}
						onchange={(e) => switchCampaign(e.currentTarget.value)}
					>
						{#each data.campaigns as c (c.campaign)}
							<option value={c.campaign}>{c.name} ({c.date})</option>
						{/each}
					</select>
				</label>
			{/if}
			<label class="pb-1 text-gray-500"
				>theme
				<select
					class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
					value={data.theme}
					onchange={(e) => setTheme(e.currentTarget.value as Theme)}
				>
					{#each THEMES as t (t)}<option value={t}>{t}</option>{/each}
				</select>
			</label>
			<a
				href="https://discord.gg/djHbcvHNeu"
				target="_blank"
				rel="noopener"
				class="pb-1 text-gray-400 hover:text-[#5865F2]"
				title="Bugs & feedback: the empire-dashboard forum on Discord"
				aria-label="Discord"
				><svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor" aria-hidden="true"
					><path
						d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"
					/></svg
				></a
			>
			<span class="pb-1 text-[11px] text-gray-400" title="dashboard version"
				>v{__APP_VERSION__}</span
			>
			{#if data.gameVersion}<span
					class="pb-1 text-[11px] text-gray-400"
					title="the game version and build the game data was read from (an open beta shares its version with the release, not its build)"
					>game {data.gameVersion.replace(/^\D*/, '')}</span
				>{/if}
			<!-- the difficulty and the dates alone on the right, also when they wrap onto a line of their own -->
			{#if data.dates?.difficulty}<span class="ml-auto pb-1 text-[11px] text-gray-400"
					>{#if data.dates.difficultyCard}<InfoPopup explanation={data.dates.difficultyCard}
							>{data.dates.difficulty}</InfoPopup
						>{:else}{data.dates.difficulty}{/if}</span
				>{/if}
			{#if data.dates}<span
					class="{data.dates.difficulty ? '' : 'ml-auto'} pb-1 text-[11px] text-gray-400"
					title="the game being played: its latest save the dashboard read, and its latest data — a save, the companion mod's month or its daily tick (without the mod, saves only)"
					>last save {data.dates.save ?? '—'} · last data {lastData ?? '—'}</span
				>{/if}
		</nav>
		{#if page.data.xExtent}<TimeWindow extent={page.data.xExtent as [number, number]} />{/if}
		{#if loaded}
			<p
				class="mb-2 flex flex-wrap items-center gap-2 rounded border border-sky-400 px-3 py-1 text-sm"
			>
				<span
					>The save of <b>{loaded.date}</b> was loaded in game — the dashboard switches to it with the
					next save or month.</span
				>
				<button class="rounded border px-2" onclick={() => showLoaded(loaded.node)}
					>show it now</button
				>
				<button class="rounded border px-2" onclick={() => (waved = loaded.node)}>not now</button>
			</p>
		{/if}
		{#if data.extracting}
			<p class="mb-2 rounded border border-sky-400 px-3 py-1 text-sm">
				Extracting the game data with this game's {data.extracting.mods} mods … until then, what they
				add shows as raw keys. The page reloads when it is done.
			</p>
		{/if}
		{#if data.feed}
			<p class="mb-2 rounded border border-amber-400 px-3 py-1 text-sm">
				The companion mod (Empire Dashboard Feed) writes log format {data.feed.format}; this
				dashboard reads formats {data.feed.min}–{data.feed.max}. Its lines are skipped and the
				dashboard works from the saves alone, as without the mod —
				{#if data.feed.newer}
					update the dashboard to read them.
				{:else}
					update the mod (Steam Workshop or Paradox Mods) to read them.
				{/if}
			</p>
		{/if}
		{#each data.gone as c (c.campaign)}
			<p
				class="mb-2 flex flex-wrap items-center gap-2 rounded border border-amber-400 px-3 py-1 text-sm"
			>
				<span
					>The saves of <b>{c.name || c.campaign}</b> (last {c.date}) are no longer on disk; its
					history is kept here only.</span
				>
				<button class="rounded border px-2" onclick={() => answerGone('keep', c)}>keep it</button>
				<button class="rounded border px-2 text-red-600" onclick={() => answerGone('delete', c)}
					>delete it</button
				>
			</p>
		{/each}
		{@render children()}
	{/if}
</main>
