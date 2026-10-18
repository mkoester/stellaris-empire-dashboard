import { describe, expect, it } from 'vitest';
import { bypassLinks, distances, graph, type Bypass } from './galaxyGraph.ts';

// A line 1-2-3-4-5-6, plus 10 off on its own.
const lanes: [number, number][] = [
	[1, 2],
	[2, 3],
	[3, 4],
	[4, 5],
	[5, 6]
];
const none = {
	researched: [],
	visited: [],
	globalFlags: [],
	lgateSystems: [],
	lclusterSystems: []
};
const hole = (id: number, system: number, to: number): Bypass => ({
	id,
	type: 'wormhole',
	active: true,
	system,
	links: [to]
});
const wormholes = [hole(0, 1, 1), hole(1, 6, 0)];

describe('distances', () => {
	it('counts hyperlane jumps from the nearest source', () => {
		const d = distances(graph(lanes, []), [1, 6]);
		expect([1, 2, 3, 4, 5, 6].map((s) => d.jumps.get(s))).toEqual([0, 1, 2, 2, 1, 0]);
		expect(d.jumps.has(10)).toBe(false); // unreachable
		expect(d.via(3)).toEqual([]);
	});
	it('takes a usable wormhole as one jump and says so', () => {
		const links = bypassLinks({
			...none,
			bypasses: wormholes,
			researched: ['tech_wormhole_stabilization'],
			visited: [1]
		});
		expect(links).toEqual([
			{ from: 1, to: 6, via: 'wormhole' },
			{ from: 6, to: 1, via: 'wormhole' }
		]);
		const d = distances(graph(lanes, links), [1]);
		expect(d.jumps.get(5)).toBe(2); // 1 → 6 → 5
		expect(d.via(5)).toEqual(['wormhole']);
	});
	it('ignores a wormhole without the tech or unexplored', () => {
		expect(bypassLinks({ ...none, bypasses: wormholes, visited: [1] })).toEqual([]);
		expect(
			bypassLinks({ ...none, bypasses: wormholes, researched: ['tech_wormhole_stabilization'] })
		).toEqual([]);
	});
});

describe('gateways and L-Gates', () => {
	const gate = (id: number, system: number, active: boolean, links: number[]): Bypass => ({
		id,
		type: 'gateway',
		active,
		system,
		links
	});
	const researched = ['tech_gateway_activation'];
	it('links active gateways only', () => {
		const gates = [gate(0, 1, true, [1, 2]), gate(1, 4, false, [0, 2]), gate(2, 6, true, [0, 1])];
		const links = bypassLinks({ ...none, bypasses: gates, researched });
		expect(links.map((l) => [l.from, l.to])).toEqual([
			[1, 6],
			[6, 1]
		]);
		expect(bypassLinks({ ...none, bypasses: gates })).toEqual([]); // no tech
	});
	it('opens L-Gates to the L-Cluster only once they are activated', () => {
		const p = { ...none, bypasses: [], lgateSystems: [2, 5], lclusterSystems: [99] };
		expect(bypassLinks(p)).toEqual([]);
		const links = bypassLinks({ ...p, globalFlags: ['lgates_activated_globally'] });
		expect(links).toEqual([
			{ from: 2, to: 99, via: 'lgate' },
			{ from: 5, to: 99, via: 'lgate' }
		]);
		// 2 → 99 → 5: two jumps through the cluster instead of three lanes
		expect(distances(graph(lanes, links), [2]).jumps.get(5)).toBe(2);
	});
	it('skips types ships do not path through', () => {
		const tunnel: Bypass = { id: 0, type: 'shroud_tunnel', active: true, system: 1, links: [1] };
		expect(
			bypassLinks({ ...none, bypasses: [tunnel, { ...tunnel, id: 1, system: 6, links: [0] }] })
		).toEqual([]);
	});
});
