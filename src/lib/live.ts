import { onMount } from 'svelte';
import { invalidateAll } from '$app/navigation';
import type { LiveEvent } from './eventsWorker.ts';
import type { Tick } from './types.ts';

type Handler = (data: string) => void;
type Connect = (dispatch: (e: LiveEvent) => void) => () => void;

/**
 * The tab's subscriptions to the server events, over one connection that opens with the first
 * and closes with the last. `on` returns the unsubscribe.
 */
export function createHub(connect: Connect) {
	const handlers = new Map<LiveEvent['type'], Set<Handler>>();
	let close: (() => void) | null = null;
	const dispatch = (e: LiveEvent) => {
		for (const h of handlers.get(e.type) ?? []) h(e.data);
	};
	return (type: LiveEvent['type'], h: Handler) => {
		const set = handlers.get(type) ?? new Set();
		handlers.set(type, set.add(h));
		close ??= connect(dispatch);
		return () => {
			set.delete(h);
			if ([...handlers.values()].every((s) => s.size === 0)) {
				close?.();
				close = null;
			}
		};
	};
}

// One stream for the whole browser (`eventsWorker.ts`); where SharedWorker is missing (Chrome on
// Android), one per tab. Never `new EventSource('/api/events')` in a page: two tabs of three
// streams each once held all 6 connections a browser gives a host.
const browserConnect: Connect = (dispatch) => {
	if (typeof SharedWorker === 'undefined') {
		const events = new EventSource('/api/events');
		events.onmessage = (e) => dispatch({ type: 'message', data: e.data });
		for (const type of ['tick', 'loaded'] as const)
			events.addEventListener(type, (e) => dispatch({ type, data: e.data }));
		return () => events.close();
	}
	const worker = new SharedWorker(new URL('./eventsWorker.ts', import.meta.url), {
		type: 'module',
		name: 'dashboard-events'
	});
	const port = worker.port;
	port.onmessage = (e: MessageEvent<LiveEvent>) => dispatch(e.data);
	port.start();
	// a tab going away for good stops getting events (one kept for back/forward still listens)
	const bye = (e: PageTransitionEvent) => {
		if (!e.persisted) port.postMessage('close');
	};
	addEventListener('pagehide', bye);
	return () => {
		removeEventListener('pagehide', bye);
		port.postMessage('close');
		port.close();
	};
};

const on = createHub(browserConnect);

/**
 * Reload the page whenever the server ingests a save — but only while `follow()` holds and the
 * page is not pinned to a save (`?node=`: the layout decides then, `followLoads`) — and whenever
 * it has read stored saves again (`refreshed`), which may be the ones shown.
 */
export function followGame(follow: () => boolean) {
	onMount(() =>
		on('message', (data) => {
			const pinned = new URL(location.href).searchParams.has('node');
			if (data === 'refreshed' || (follow() && !pinned)) void invalidateAll();
		})
	);
}

/** Calls `onTick` with each day's stockpile the companion mod logs (the `tick` server event). */
export function followTicks(onTick: (t: Tick) => void) {
	onMount(() => on('tick', (data) => onTick(JSON.parse(data) as Tick)));
}

/**
 * Calls `onLoaded` when the player loads a save the dashboard knows (the `loaded` server event),
 * and `onSave` with each save or month the server ingests.
 */
export function followLoads(onLoaded: () => void, onSave: () => void) {
	onMount(() => {
		const offLoaded = on('loaded', () => onLoaded());
		const offSave = on('message', (data) => {
			if (data !== 'refreshed') onSave();
		});
		return () => {
			offLoaded();
			offSave();
		};
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
