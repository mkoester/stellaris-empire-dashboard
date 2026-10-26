import { onMount } from 'svelte';
import { invalidateAll } from '$app/navigation';
import type { Tick } from './types.ts';

/**
 * Reload the page whenever the server ingests a save — but only while `follow()` holds and the
 * page is not pinned to a save (`?node=`: the layout decides then, `followLoads`) — and whenever
 * it has read stored saves again (`refreshed`), which may be the ones shown.
 */
export function followGame(follow: () => boolean) {
	onMount(() => {
		const events = new EventSource('/api/events');
		events.onmessage = (e) => {
			const pinned = new URL(location.href).searchParams.has('node');
			if (e.data === 'refreshed' || (follow() && !pinned)) invalidateAll();
		};
		return () => events.close();
	});
}

/** Calls `onTick` with each day's stockpile the companion mod logs (the `tick` server event). */
export function followTicks(onTick: (t: Tick) => void) {
	onMount(() => {
		const events = new EventSource('/api/events');
		events.addEventListener('tick', (e) => onTick(JSON.parse(e.data)));
		return () => events.close();
	});
}

/**
 * Calls `onLoaded` when the player loads a save the dashboard knows (the `loaded` server event),
 * and `onSave` with each save or month the server ingests.
 */
export function followLoads(onLoaded: () => void, onSave: () => void) {
	onMount(() => {
		const events = new EventSource('/api/events');
		events.addEventListener('loaded', onLoaded);
		events.onmessage = (e) => {
			if (e.data !== 'refreshed') onSave();
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
