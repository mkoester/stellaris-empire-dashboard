<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();

	// what the form starts with: the last attempt, the stored folders, else the best guess; then
	// it is the player's to edit
	const initial = (field: 'gameDir' | 'userDir') =>
		form?.[field] ??
		data.config[field] ??
		(field === 'gameDir' ? data.found.games : data.found.users)[0]?.dir ??
		'';
	let gameDir = $state(initial('gameDir'));
	let userDir = $state(initial('userDir'));
	let busy = $state(false);

	const date = (ms: number | null) => (ms === null ? 'no saves' : new Date(ms).toLocaleString());
	const choice = (picked: boolean) =>
		`flex w-full flex-col items-start rounded border px-3 py-2 text-left ${picked ? 'border-blue-500' : 'border-gray-300 hover:border-gray-500 dark:border-gray-700'}`;
	const field =
		'w-full rounded border border-gray-300 bg-transparent px-2 py-1 font-mono dark:border-gray-700';
</script>

<svelte:head><title>Setup · Empire dashboard</title></svelte:head>

<div class="flex max-w-3xl flex-col gap-6 text-sm">
	<section>
		<h1 class="mb-1 text-2xl font-semibold">Set up the dashboard</h1>
		<p class="text-gray-500">
			The dashboard reads two folders: the game's install, for names, costs and modifiers, and the
			folder the game writes your saves to. Pick what it found or type a path. It only reads them;
			everything it stores stays in <code>{data.appDir}</code>.
		</p>
		{#if data.status === 'running'}
			<p class="mt-2">
				Running. New folders apply at the next start. <a class="underline" href={resolve('/')}
					>Back to the dashboard</a
				>
			</p>
		{/if}
		{#if form?.restart}
			<p class="mt-2 font-semibold">Saved. Restart the dashboard to use the new folders.</p>
		{/if}
		{#if form?.error ?? data.error}
			<p class="mt-2 rounded border border-red-500 p-2 whitespace-pre-wrap text-red-600">
				Could not start: {form?.error ?? data.error}
			</p>
		{/if}
	</section>

	<form
		method="POST"
		class="flex flex-col gap-6"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		<section class="flex flex-col gap-2">
			<h2 class="text-xl font-semibold">Game install</h2>
			{#each data.found.games as g (g.dir)}
				<button type="button" class={choice(g.dir === gameDir)} onclick={() => (gameDir = g.dir)}>
					<span class="font-mono">{g.dir}</span>
					<span class="text-gray-500">{g.source} · {g.version ?? 'unknown version'}</span>
				</button>
			{:else}
				<p class="text-gray-500">
					None found. Steam: <code>…\steamapps\common\Stellaris</code>; GOG and the Microsoft Store
					have their own game folders.
				</p>
			{/each}
			<label class="flex flex-col gap-1"
				>folder
				<input class={field} name="gameDir" bind:value={gameDir} required />
			</label>
			{#if form?.errors?.gameDir}<p class="text-red-600">{form.errors.gameDir}</p>{/if}
		</section>

		<section class="flex flex-col gap-2">
			<h2 class="text-xl font-semibold">Saves (user folder)</h2>
			{#each data.found.users as u (u.dir)}
				<button type="button" class={choice(u.dir === userDir)} onclick={() => (userDir = u.dir)}>
					<span class="font-mono">{u.dir}</span>
					<span class="text-gray-500"
						>{u.source} · {u.saves} saves · newest {date(u.newestSave)}</span
					>
				</button>
			{:else}
				<p class="text-gray-500">
					None found. Usually <code>Documents\Paradox Interactive\Stellaris</code> on Windows.
				</p>
			{/each}
			<label class="flex flex-col gap-1"
				>folder (the one holding <code>save games</code>)
				<input class={field} name="userDir" bind:value={userDir} required />
			</label>
			{#if form?.errors?.userDir}<p class="text-red-600">{form.errors.userDir}</p>{/if}
		</section>

		<div class="flex items-center gap-3">
			<button
				class="rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
				disabled={busy}>{data.status === 'running' ? 'Save' : 'Start'}</button
			>
			{#if busy}
				<span class="text-gray-500"
					>Starting — the first start reads the game data and every save, which can take a minute.</span
				>
			{/if}
		</div>
	</form>
</div>
