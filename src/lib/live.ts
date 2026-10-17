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

// Split view: the empire page announces the branch it shows (null = following the game), colony
// pages in other tabs or panes follow it. A colony page opened later asks for the current one.
type BranchMessage = { node: number | null } | 'ask';
const CHANNEL = 'dashboard-branch';

/** Announces `node()` now and whenever another page asks. */
export function announceBranch(node: () => number | null) {
	onMount(() => {
		const channel = new BroadcastChannel(CHANNEL);
		channel.onmessage = (e: MessageEvent<BranchMessage>) => {
			if (e.data === 'ask') channel.postMessage({ node: node() } satisfies BranchMessage);
		};
		return () => channel.close();
	});
}

/** Calls `follow` with every branch the empire page announces. */
export function followBranch(follow: (node: number | null) => void) {
	onMount(() => {
		const channel = new BroadcastChannel(CHANNEL);
		channel.onmessage = (e: MessageEvent<BranchMessage>) => {
			if (e.data !== 'ask') follow(e.data.node);
		};
		channel.postMessage('ask' satisfies BranchMessage);
		return () => channel.close();
	});
}

/** Sends one announcement, for when the empire page's branch changes. */
export function postBranch(node: number | null) {
	const channel = new BroadcastChannel(CHANNEL);
	channel.postMessage({ node } satisfies BranchMessage);
	channel.close();
}
