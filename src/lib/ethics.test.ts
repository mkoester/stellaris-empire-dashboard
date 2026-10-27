import { describe, expect, it } from 'vitest';
import {
	ethicDistance,
	ethicMark,
	federationPenalty,
	opposingAxes,
	profile,
	sortEthics
} from './ethics.ts';

// as the data DB has them (4.5.2): category_value − 2
const AXES = {
	ethic_fanatic_authoritarian: { axis: 'col', pos: -2 },
	ethic_authoritarian: { axis: 'col', pos: -1 },
	ethic_egalitarian: { axis: 'col', pos: 1 },
	ethic_fanatic_egalitarian: { axis: 'col', pos: 2 },
	ethic_xenophobe: { axis: 'xen', pos: -1 },
	ethic_xenophile: { axis: 'xen', pos: 1 },
	ethic_militarist: { axis: 'mil', pos: -1 },
	ethic_fanatic_militarist: { axis: 'mil', pos: -2 },
	ethic_pacifist: { axis: 'mil', pos: 1 },
	ethic_spiritualist: { axis: 'spi', pos: -1 },
	ethic_materialist: { axis: 'spi', pos: 1 },
	ethic_gestalt_consciousness: { axis: 'hive', pos: 0 }
};
const DEFINES = {
	FEDERATION_BASE_ETHICS: 3,
	FEDERATION_ETHICS_PENALTY: -0.15,
	FEDERATION_OPPOSING_ETHICS_PENALTY: -0.5
};
const p = (...ethics: string[]) => profile(ethics, AXES);

describe('ethicDistance', () => {
	it('counts the steps apart on every axis', () => {
		expect(ethicDistance(p('ethic_xenophile'), p('ethic_xenophile'))).toBe(0);
		// authoritarian → fanatic egalitarian: 3 steps; an axis held by one side only: 1
		expect(
			ethicDistance(
				p('ethic_authoritarian', 'ethic_xenophile'),
				p('ethic_fanatic_egalitarian', 'ethic_xenophile', 'ethic_militarist')
			)
		).toBe(4);
		// three opposed fanatic-free axes
		expect(
			ethicDistance(
				p('ethic_authoritarian', 'ethic_xenophobe', 'ethic_militarist'),
				p('ethic_egalitarian', 'ethic_xenophile', 'ethic_pacifist')
			)
		).toBe(6);
	});

	it('has no scale between gestalts and the others', () => {
		expect(ethicDistance(p('ethic_gestalt_consciousness'), p('ethic_xenophile'))).toBeNull();
		expect(ethicDistance(p('ethic_gestalt_consciousness'), p('ethic_gestalt_consciousness'))).toBe(
			0
		);
	});

	it('names the opposed axes', () => {
		expect(
			opposingAxes(
				p('ethic_authoritarian', 'ethic_xenophile', 'ethic_spiritualist'),
				p('ethic_egalitarian', 'ethic_xenophile', 'ethic_materialist')
			)
		).toEqual(['col', 'spi']);
	});
});

describe('federationPenalty', () => {
	it('is free up to three unique ethics, a fanatic counting as its regular one', () => {
		expect(
			federationPenalty(
				[
					['ethic_militarist', 'ethic_xenophobe', 'ethic_authoritarian'],
					['ethic_fanatic_militarist', 'ethic_authoritarian']
				],
				AXES,
				DEFINES
			)
		).toBe(0);
	});

	it('costs per extra ethic and per opposed axis', () => {
		// 6 unique (3 extra), 3 axes opposed
		expect(
			federationPenalty(
				[
					['ethic_authoritarian', 'ethic_xenophobe', 'ethic_militarist'],
					['ethic_egalitarian', 'ethic_xenophile', 'ethic_pacifist']
				],
				AXES,
				DEFINES
			)
		).toBeCloseTo(-1.95);
		// 4 unique, nothing opposed
		expect(
			federationPenalty(
				[
					['ethic_xenophile', 'ethic_pacifist', 'ethic_materialist'],
					['ethic_xenophile', 'ethic_egalitarian']
				],
				AXES,
				DEFINES
			)
		).toBeCloseTo(-0.15);
	});
});

describe('marks', () => {
	it('shortens and colours by pole, fanatic in capitals', () => {
		expect(ethicMark('ethic_fanatic_militarist', AXES)).toEqual({
			short: 'MI',
			fanatic: true,
			color: 'ethic-mil-0'
		});
		expect(ethicMark('ethic_materialist', AXES)?.short).toBe('Ma');
		expect(ethicMark('ethic_gestalt_consciousness', AXES)?.short).toBe('Ge');
		expect(ethicMark('ethic_unknown', AXES)).toBeNull();
	});

	it('sorts by axis', () => {
		expect(
			sortEthics(['ethic_materialist', 'ethic_xenophile', 'ethic_authoritarian'], AXES)
		).toEqual(['ethic_authoritarian', 'ethic_xenophile', 'ethic_materialist']);
	});
});
