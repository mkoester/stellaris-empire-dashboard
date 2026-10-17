<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import EmpirePanel from '#lib/EmpirePanel.svelte';
	import { announceBranch, followGame, postBranch } from '#lib/live.ts';
	import { PICKABLE, panelInfo, putSettings, type CustomTab, type PanelId } from '#lib/settings.ts';

	let { data } = $props();
	const empire = $derived(data.empire);
	followGame(() => empire.empty || empire.isHead);

	// Like the `all` tab: colony pages in other panes follow the branch shown here.
	const shown = () => (empire.empty || empire.isHead ? null : empire.tip);
	announceBranch(shown);
	$effect(() => postBranch(shown()));

	// The editor works on a copy; a new tab (no panels yet) opens in it. Moving to another tab
	// (same page component) drops the draft.
	let draft: CustomTab | null = $state(null);
	const edit = () => (draft = structuredClone($state.snapshot(data.tab)));
	let editedId = '';
	$effect.pre(() => {
		if (data.tab.id === editedId) return;
		editedId = data.tab.id;
		draft = null;
		if (data.tab.panels.length === 0) edit();
	});
	const unused = $derived(draft ? PICKABLE.filter((p) => !draft!.panels.includes(p.id)) : []);

	const move = (i: number, by: number) => {
		const p = draft!.panels;
		[p[i], p[i + by]] = [p[i + by], p[i]];
	};
	const others = () => data.tabs.filter((t) => t.id !== data.tab.id);
	const at = () => data.tabs.findIndex((t) => t.id === data.tab.id);
	const shift = async (by: number) => {
		const list = [...data.tabs];
		const i = at();
		[list[i], list[i + by]] = [list[i + by], list[i]];
		await putSettings({ tabs: list });
		await invalidateAll();
	};

	async function save() {
		await putSettings({ tabs: data.tabs.map((t) => (t.id === draft!.id ? draft! : t)) });
		await invalidateAll();
		draft = null;
	}
	async function remove() {
		if (!confirm(`Delete the tab "${data.tab.name}"?`)) return;
		await putSettings({ tabs: others() });
		await goto(resolve('/'), { invalidateAll: true });
	}

	const button =
		'rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40 dark:border-gray-700';
</script>

{#if draft}
	<section class="mb-6 flex max-w-xl flex-col gap-3 text-sm">
		<label class="flex items-center gap-2"
			>name
			<input
				class="flex-1 rounded border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
				bind:value={draft.name}
				maxlength="40"
			/>
		</label>
		<label class="flex items-center gap-2"
			><input type="checkbox" bind:checked={draft.header} /> show the header (rank, date, research and
			agenda progress) on top</label
		>
		<ol class="flex flex-col gap-1">
			{#each draft.panels as id, i (id)}
				<li class="flex items-center gap-2">
					<span class="flex-1">{panelInfo(id).label}</span>
					<button class={button} disabled={i === 0} onclick={() => move(i, -1)} aria-label="up"
						>↑</button
					>
					<button
						class={button}
						disabled={i === draft.panels.length - 1}
						onclick={() => move(i, 1)}
						aria-label="down">↓</button
					>
					<button
						class={button}
						onclick={() => draft!.panels.splice(i, 1)}
						aria-label="remove {panelInfo(id).label}">✕</button
					>
				</li>
			{:else}
				<li class="text-gray-500">No panels yet — add some below.</li>
			{/each}
		</ol>
		<select
			class="rounded border border-gray-300 bg-transparent px-1 py-1 dark:border-gray-700"
			value=""
			onchange={(e) => {
				draft!.panels.push(e.currentTarget.value as PanelId);
				e.currentTarget.value = '';
			}}
		>
			<option value="" disabled>add a panel …</option>
			{#each unused as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
		</select>
		<div class="flex flex-wrap gap-2">
			<button class="{button} font-semibold" onclick={save}>save</button>
			<button class={button} onclick={() => (draft = null)}>cancel</button>
			<button class={button} disabled={at() === 0} onclick={() => shift(-1)}>move tab left</button>
			<button class={button} disabled={at() === data.tabs.length - 1} onclick={() => shift(1)}
				>move tab right</button
			>
			<button class="{button} ml-auto text-red-600" onclick={remove}>delete tab</button>
		</div>
	</section>
{:else}
	<div class="mb-2 flex justify-end text-sm">
		<button class="underline" onclick={edit}>edit tab</button>
	</div>
{/if}

{#if empire.empty}
	<p>Waiting for the first save.</p>
{:else}
	{#if (draft ?? data.tab).header}
		<div class="mb-6"><EmpirePanel id="header" data={empire} /></div>
	{/if}
	<div class="grid items-start gap-6 xl:grid-cols-2">
		{#each (draft ?? data.tab).panels as id (id)}
			<div class={panelInfo(id).wide ? 'xl:col-span-2' : ''}>
				<EmpirePanel {id} data={empire} />
			</div>
		{/each}
	</div>
{/if}
