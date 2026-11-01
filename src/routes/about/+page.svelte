<script lang="ts">
	// Thanks: the mods, projects and libraries this dashboard learned from or builds on.
	type Credit = {
		name: string;
		href?: string; // without https://
		by?: string;
		what: string;
	};

	const MODS: Credit[] = [
		{
			name: 'Quadrant Fixed',
			what: 'the rings and quadrants on the galaxy maps'
		},
		{
			name: 'In-Game Settings View',
			what: 'showing the galaxy settings the game was created with (galaxy tab)'
		},
		{
			name: 'Branch Office Expansion Planner',
			what: 'the idea of planning a MegaCorp’s branch offices (planned)'
		}
	];

	const PROJECTS: Credit[] = [
		{
			name: 'stellaris-dashboard',
			by: 'eliasdoehne',
			href: 'github.com/eliasdoehne/stellaris-dashboard',
			what: 'its save parser, the reference for save shapes not yet seen in our own saves'
		},
		{
			name: 'stellaris-dashboard-test-saves',
			by: 'chennin',
			href: 'github.com/chennin/stellaris-dashboard-test-saves',
			what: 'late-game saves to test against'
		},
		{
			name: 'stellaris-data-extraction',
			href: 'github.com/mkoester/stellaris-data-extraction',
			what: 'the sister project that reads the game files into the data this dashboard names things with'
		}
	];

	const LIBRARIES: Credit[] = [
		{
			name: 'jomini',
			by: 'Nick Babcock',
			href: 'github.com/nickbabcock/jomini',
			what: 'reading the saves'
		},
		{
			name: 'uPlot',
			by: 'Leon Sorokin',
			href: 'github.com/leeoniya/uPlot',
			what: 'the charts'
		},
		{ name: 'Svelte and SvelteKit', href: 'svelte.dev', what: 'the app itself' },
		{ name: 'Tailwind CSS', href: 'tailwindcss.com', what: 'its looks' }
	];

	const GROUPS = [
		{ title: 'Mods that inspired features', items: MODS },
		{ title: 'Projects', items: PROJECTS },
		{ title: 'Libraries', items: LIBRARIES }
	];
</script>

<div class="max-w-3xl space-y-6">
	<h1 class="text-xl font-semibold">About</h1>
	<p class="text-sm text-gray-500">
		Thanks to everyone whose work this dashboard learned from or builds on — and to the Stellaris
		modding community, whose notes made sense of what the game files leave unsaid.
	</p>

	{#each GROUPS as g (g.title)}
		<section class="space-y-2">
			<h2 class="font-semibold">{g.title}</h2>
			<ul class="space-y-1 text-sm">
				{#each g.items as c (c.name)}
					<li>
						{#if c.href}<a
								class="underline"
								href="https://{c.href}"
								rel="noreferrer"
								target="_blank">{c.name}</a
							>{:else}<span class="font-medium">{c.name}</span>{/if}{#if c.by}<span
								class="text-gray-500"
							>
								by {c.by}</span
							>{/if} — {c.what}
					</li>
				{/each}
			</ul>
		</section>
	{/each}

	<section class="space-y-1 text-sm">
		<h2 class="font-semibold">Licence</h2>
		<p>
			The code is free software under the
			<a
				class="underline"
				href="https://github.com/mkoester/stellaris-empire-dashboard/blob/main/LICENSE"
				rel="noreferrer"
				target="_blank">GNU Affero General Public License v3.0</a
			>
			(<a
				class="underline"
				href="https://github.com/mkoester/stellaris-empire-dashboard"
				rel="noreferrer"
				target="_blank">source</a
			>).
		</p>
		<p class="text-gray-500">
			Unofficial fan project, not affiliated with Paradox Interactive. Stellaris and all game data
			and text © Paradox Interactive AB.
		</p>
	</section>
</div>
