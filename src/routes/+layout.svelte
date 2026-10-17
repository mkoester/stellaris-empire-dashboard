<script lang="ts">
	import './layout.css';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { putSettings, THEMES, type Theme } from '#lib/settings.ts';
	import { applyTheme } from '#lib/theme.ts';

	let { data, children } = $props();

	// Tabs keep the branch being looked at (`?node=`).
	const node = $derived(page.url.searchParams.get('node'));
	const path = $derived(page.url.pathname);
	const fixed = $derived([
		{ name: 'all', href: node ? resolve(`/?node=${node}`) : resolve('/'), active: path === '/' },
		{
			name: 'colonies',
			href: node ? resolve(`/colonies?node=${node}`) : resolve('/colonies'),
			active: path.startsWith('/colon')
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
			name: 'events',
			href: node ? resolve(`/events?node=${node}`) : resolve('/events'),
			active: path === '/events'
		}
	]);
	const tabHref = (id: string) =>
		node ? resolve(`/tab/[id]?node=${node}`, { id }) : resolve('/tab/[id]', { id });
	const tab = (active: boolean) =>
		`rounded-t border-b-2 px-3 py-1 ${active ? 'border-blue-500 font-semibold' : 'border-transparent text-gray-500 hover:text-current'}`;

	async function addTab() {
		const id = crypto.randomUUID().slice(0, 8);
		await putSettings({ tabs: [...data.tabs, { id, name: 'new tab', header: true, panels: [] }] });
		await goto(tabHref(id), { invalidateAll: true });
	}

	async function setTheme(theme: Theme) {
		applyTheme(theme);
		await putSettings({ theme });
	}
</script>

<svelte:head>
	<title>Empire dashboard</title>
</svelte:head>

<main class="mx-auto max-w-[96rem] p-4">
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
		<label class="ml-auto pb-1 text-gray-500"
			>theme
			<select
				class="rounded border border-gray-300 bg-transparent px-1 dark:border-gray-700"
				value={data.theme}
				onchange={(e) => setTheme(e.currentTarget.value as Theme)}
			>
				{#each THEMES as t (t)}<option value={t}>{t}</option>{/each}
			</select>
		</label>
	</nav>
	{@render children()}
</main>
