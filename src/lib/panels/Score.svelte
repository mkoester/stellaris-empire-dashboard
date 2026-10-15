<script lang="ts">
	import { fmt } from '../format.ts';
	import type { Score } from '../types.ts';
	import Panel from './Panel.svelte';

	// The victory screen's rank and score, and the power ratings (economy, technology, military).
	// The score breakdown itself (economy +541, pops +104, …) is not in the save.
	let { score }: { score: Score } = $props();
</script>

<Panel title="Score">
	<div>rank <b>{score.rank}</b> · score <b>{fmt(score.score)}</b></div>
	<div>
		power: economy <b>{fmt(score.economy)}</b> · technology <b>{fmt(score.tech)}</b> · military
		<b>{fmt(score.military)}</b>
	</div>
</Panel>
