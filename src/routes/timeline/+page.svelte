<script lang="ts">
	import { resolve } from '$app/paths';
	let { data, form } = $props();

	const label = (r: { id: number; date: string; campaign: string }) =>
		`#${r.id} ${r.date} (${r.campaign})`;
</script>

<header class="mb-4 flex items-baseline gap-4">
	<h1 class="text-2xl font-bold">Save graph</h1>
	<a class="underline" href={resolve('/')}>dashboard</a>
</header>

{#if form?.error}
	<p class="mb-2 text-red-600">{form.error}</p>
{/if}

<p class="mb-4 text-sm">
	Every ingested save is a node. Loading an older save starts a branch. A parent marked
	<span class="text-amber-600">guessed</span> was inferred from dates — correct it if it is wrong.
</p>

<ul class="font-mono text-sm">
	{#each data.rows as r (r.id)}
		<li class="flex flex-wrap items-center gap-2 py-0.5" style:padding-left="{r.depth * 1.5}rem">
			<a class="underline" href={resolve(`/?node=${r.id}`)}>{label(r)}</a>
			{#if r.id === data.head}<span class="font-bold">← current</span>{/if}
			{#if r.ambiguous}
				<span class="text-amber-600">guessed</span>
				<form method="POST" class="flex gap-1">
					<input type="hidden" name="node" value={r.id} />
					<select name="parent" class="border">
						<option value="">(no parent)</option>
						{#each data.rows.filter((o) => o.campaign === r.campaign && o.date <= r.date && o.id !== r.id) as o (o.id)}
							<option value={o.id} selected={o.id === r.parentId}>{label(o)}</option>
						{/each}
					</select>
					<button class="border px-1">set parent</button>
				</form>
			{/if}
		</li>
	{/each}
</ul>
