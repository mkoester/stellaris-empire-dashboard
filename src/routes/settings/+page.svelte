<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ROW_LINES, type RowLine } from '#lib/profiles.ts';
	import { profileAction, putSettings } from '#lib/settings.ts';

	let { data } = $props();

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
	</section>
</div>
