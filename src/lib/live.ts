import { onMount } from 'svelte';
import { invalidateAll } from '$app/navigation';

/** Reload the page whenever the server ingests a save — but only while `follow()` holds. */
export function followGame(follow: () => boolean) {
	onMount(() => {
		const events = new EventSource('/api/events');
		events.onmessage = () => {
			if (follow()) invalidateAll();
		};
		return () => events.close();
	});
}
