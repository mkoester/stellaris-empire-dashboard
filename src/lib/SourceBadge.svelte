<script lang="ts">
	import type { EffectKind } from './effects.ts';

	// Where an effect comes from, as a small badge in EmpireBadges' style: origin, civic, ethic,
	// gestalt (the gestalt consciousness ethic), species, GalCom resolution, event, situation, …
	let { kind }: { kind: EffectKind } = $props();

	const gray = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
	const KIND: Record<EffectKind, { label: string; tone: string; title?: string }> = {
		origin: {
			label: 'origin',
			tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
		},
		civic: { label: 'civic', tone: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200' },
		ethic: {
			label: 'ethic',
			tone: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200'
		},
		gestalt: {
			label: 'gestalt',
			tone: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200',
			title: 'the Gestalt Consciousness ethic'
		},
		authority: { label: 'authority', tone: gray },
		species: {
			label: 'species',
			tone: 'bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-200'
		},
		tradition: {
			label: 'tradition',
			tone: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200'
		},
		perk: {
			label: 'perk',
			tone: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
			title: 'ascension perk'
		},
		edict: { label: 'edict', tone: gray },
		policy: { label: 'policy', tone: gray },
		resolution: {
			label: 'GalCom',
			tone: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200',
			title: 'Galactic Community resolution'
		},
		event: {
			label: 'event',
			tone: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
			title: 'a timed or permanent modifier from an event, relic, …'
		},
		agenda: { label: 'agenda', tone: gray, title: 'council agenda' },
		situation: {
			label: 'situation',
			tone: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200'
		},
		tech: { label: 'tech', tone: gray }
	};
	const k = $derived(KIND[kind]);
</script>

<span class="rounded px-1 text-[0.7rem] leading-tight whitespace-nowrap {k.tone}" title={k.title}
	>{k.label}</span
>
