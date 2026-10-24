<script lang="ts">
	import type { ContactKind } from './contacts.ts';

	// Badges after an empire's name: what kind of country it is, and nomadic. Regular empires and
	// `other` get no kind badge.
	let { kind, nomadic = false }: { kind?: ContactKind | null; nomadic?: boolean } = $props();

	const KIND: Partial<Record<ContactKind, { label: string; tone: string; title?: string }>> = {
		fallen: {
			label: 'fallen',
			tone: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200'
		},
		enclaves: {
			label: 'enclave',
			tone: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200'
		},
		traders: {
			label: 'traders',
			tone: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200'
		},
		preFtl: {
			label: 'pre-FTL',
			tone: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
		},
		fauna: {
			label: 'fauna',
			tone: 'bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-200'
		},
		marauders: {
			label: 'marauders',
			tone: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
		}
	};
	const k = $derived(kind ? KIND[kind] : undefined);
</script>

{#if k}<span class="ml-1 rounded px-1 text-xs {k.tone}">{k.label}</span>{/if}{#if nomadic}<span
		class="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
		title="Nomadic: takes energy and minerals, never gives them (its operational reserves)"
		>nomadic</span
	>{/if}
