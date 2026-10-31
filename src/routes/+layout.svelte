<script lang="ts">
	import './layout.css';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { campaignAction, putSettings, THEMES, type Theme } from '#lib/settings.ts';
	import { applyTheme } from '#lib/theme.ts';
	import favicon from '#lib/assets/favicon.svg';
	import { followLoads, followTicks } from '#lib/live.ts';
	import TimeWindow from '#lib/TimeWindow.svelte';

	let { data, children } = $props();

	// Tabs keep the branch being looked at (`?node=`).
	const node = $derived(page.url.searchParams.get('node'));
	const path = $derived(page.url.pathname);
	const tabsAt = (node: string | null) => [
		{ name: 'all', href: node ? resolve(`/?node=${node}`) : resolve('/'), active: path === '/' },
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
			name: 'trade',
			href: node ? resolve(`/trade?node=${node}`) : resolve('/trade'),
			active: path === '/trade'
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
			name: 'megastructures',
			href: node ? resolve(`/megastructures?node=${node}`) : resolve('/megastructures'),
			active: path === '/megastructures'
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

	// A save loaded in game: the dashboard follows it with the next save or month; until then the
	// player may look at it at once, on the same tab — or wave the question away.
	// A page pinned (`?node=`) to the save being played — the head, or the save just loaded — goes
	// on following the game when the next save or month arrives; pinned elsewhere, it stays.
	followLoads(
		() => invalidateAll(),
		async () => {
			if (node === null || ![data.head, data.loaded?.node].includes(Number(node))) return;
			// the same page, unpinned (?node is its only query)
			const here = [page.route.id ?? '/', page.params] as Parameters<typeof resolve>;
			await goto(resolve(...here), { invalidateAll: true });
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
	async function showLoaded(n: number) {
		const same = tabsAt(String(n)).find((t) => t.active && t.name !== 'colony');
		await goto(same?.href ?? resolve(`/?node=${n}`));
	}

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
				<a class={tab(t.active)} href={t.href}>{t.name}</a>
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
			<span class="pb-1 text-[11px] text-gray-400" title="dashboard version"
				>v{__APP_VERSION__}</span
			>
			{#if data.gameVersion}<span
					class="pb-1 text-[11px] text-gray-400"
					title="the game version and build the game data was read from (an open beta shares its version with the release, not its build)"
					>game {data.gameVersion.replace(/^\D*/, '')}</span
				>{/if}
			<!-- the dates alone on the right, also when they wrap onto a line of their own -->
			{#if data.dates}<span
					class="ml-auto pb-1 text-[11px] text-gray-400"
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
