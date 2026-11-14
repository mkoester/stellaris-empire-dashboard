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
			name: 'Ideal System Locator (formerly Arc Furnace System Locator +)',
			what: 'large portions of the megastructures tab'
		},
		{
			name: 'In-Game Settings View',
			what: 'showing the galaxy settings the game was created with (galaxy tab)'
		},
		{
			name: 'Branch Office Expansion Planner',
			what: 'the branch office planner on the subjects tab'
		},
		{
			name: 'Stop Guessing What AI Will Trade You (formerly Global Trade Opinions)',
			what: 'who can be offered a trade deal, and checks still to run on the trade tab'
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

	<section class="space-y-2 text-sm">
		<h2 class="font-semibold">Why this exists</h2>
		<p>
			The game starts in the year 2200, yet whoever runs a space empire or a megacorporation there
			has less information at hand than a company today gets from its business intelligence tools. I
			wanted more overview than the game's panels give, and as a bit of a min-maxer its own tools
			kept limiting me. Some things a player should simply know — which ships and stations I have
			seen in a system is memory, not cheating. Some systems are abstract or act only indirectly
			(the focus system, amenities → happiness → stability → job output) and deserve to be explained
			and shown. And I always liked the timelapse at the end of a Civilization match.
		</p>
		<p>
			Some of what the dashboard shows makes the game easier, and that may take the fun away for
			some players. What the game hides until found (spoilers) or never tells a player (cheats) is
			off by default and labelled in ⚙.
		</p>
		<p>
			<span class="font-medium">Multiplayer and Ironman:</span> nothing in the game can tell that a player
			runs the dashboard, so it could spoil a multiplayer game for everyone else, and Ironman is meant
			to be played as it comes. It recognises both by their saves and switches every cheat off there,
			along with the spoilers that reveal other empires or space you have not explored. That guards against
			using it by accident, not against someone set on cheating: please don't use it against other people.
		</p>
	</section>

	<section class="space-y-2 text-sm">
		<h2 class="font-semibold">Known limitations</h2>
		<ul class="list-disc space-y-1 pl-5">
			<li>
				It sees the game only as often as it saves: monthly autosaves give the smoothest history,
				and what happens between two saves is missed unless the companion mod logs it.
			</li>
			<li>
				Without the companion mod, where a reloaded save's branch starts is a guess (marked, and
				correctable on the timeline).
			</li>
			<li>
				Multiplayer and Ironman detection are new: checked against two multiplayer saves, each with
				one human, and one Ironman save.
			</li>
			<li>
				Game versions 4.3–4.5; numbers are checked against the game's own screens, not all of them
				yet, and mostly on Linux.
			</li>
			<li>English game texts only.</li>
		</ul>
	</section>

	<h2 class="font-semibold">Thanks</h2>
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
								class="text-gray-500">{` by ${c.by}`}</span
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
