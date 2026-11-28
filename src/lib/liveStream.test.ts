import { describe, expect, it, vi } from 'vitest';
import { followStream, RETRY_MS, type Source } from './liveStream.ts';

const msg = (data: string) => ({ data }) as MessageEvent<string>;
const event = {} as Event;

class FakeSource implements Source {
	readyState = 0;
	onopen: Source['onopen'] = null;
	onerror: Source['onerror'] = null;
	onmessage: Source['onmessage'] = null;
	listeners = new Map<string, (e: MessageEvent<string>) => void>();
	close = vi.fn();
	addEventListener(type: 'tick' | 'loaded', h: (e: MessageEvent<string>) => void) {
		this.listeners.set(type, h);
	}
	opened() {
		this.readyState = 1;
		this.onopen?.(event);
	}
	/** a network error: the browser reconnects by itself (`CONNECTING`) */
	dropped() {
		this.readyState = 0;
		this.onerror?.(event);
	}
	/** an answer that is not an event stream: the browser gives up (`CLOSED`) */
	refused() {
		this.readyState = 2;
		this.onerror?.(event);
	}
}

const setup = () => {
	const sources: FakeSource[] = [];
	const deliver = vi.fn();
	const timers: (() => void)[] = [];
	const later = vi.fn((f: () => void, ms: number) => {
		expect(ms).toBe(RETRY_MS);
		return timers.push(f);
	});
	const cancel = vi.fn();
	const stop = followStream(
		() => {
			const s = new FakeSource();
			sources.push(s);
			return s;
		},
		deliver,
		later,
		cancel
	);
	return { sources, deliver, timers, later, cancel, stop };
};

describe('followStream', () => {
	it('hands on every event with its type, and nothing at the first open', () => {
		const { sources, deliver } = setup();
		sources[0].opened();
		sources[0].onmessage?.(msg('12'));
		sources[0].listeners.get('tick')?.(msg('{}'));
		sources[0].listeners.get('loaded')?.(msg(''));
		expect(deliver.mock.calls.map((c) => c[0])).toEqual([
			{ type: 'message', data: '12' },
			{ type: 'tick', data: '{}' },
			{ type: 'loaded', data: '' }
		]);
	});

	it('leaves a dropped connection to the browser, and reloads the pages once it is back', () => {
		const { sources, deliver, later } = setup();
		sources[0].opened();
		sources[0].dropped();
		expect(later).not.toHaveBeenCalled();
		sources[0].opened();
		expect(deliver).toHaveBeenCalledExactlyOnceWith({ type: 'message', data: 'refreshed' });
		sources[0].opened();
		expect(deliver).toHaveBeenCalledOnce();
	});

	it('opens a new source when the browser gave up on one (a restart still starting)', () => {
		const { sources, deliver, timers } = setup();
		sources[0].opened();
		sources[0].refused();
		expect(sources).toHaveLength(1);
		timers[0]();
		expect(sources).toHaveLength(2);
		sources[1].onmessage?.(msg('7'));
		sources[1].opened();
		expect(deliver.mock.calls.map((c) => c[0])).toEqual([
			{ type: 'message', data: '7' },
			{ type: 'message', data: 'refreshed' }
		]);
	});

	it('stops: closes the source in use and the pending retry', () => {
		const { sources, timers, cancel, stop } = setup();
		sources[0].refused();
		timers[0]();
		stop();
		expect(sources[0].close).not.toHaveBeenCalled();
		expect(sources[1].close).toHaveBeenCalledOnce();
		expect(cancel).toHaveBeenCalledWith(1);
	});
});
