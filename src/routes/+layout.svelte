<script lang="ts">
	import './layout.css';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { campaignAction, putSettings, THEMES, type Theme } from '#lib/settings.ts';
	import { applyTheme } from '#lib/theme.ts';
	import favicon from '#lib/assets/favicon.svg';

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
				class="ml-auto {tab(path === '/settings')}"
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
		</nav>
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
