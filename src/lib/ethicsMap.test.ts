import { describe, expect, it } from 'vitest';
import {
	ETHIC_BASES,
	NONE,
	UNKNOWN,
	ethicBase,
	ethicCounts,
	ethicStrength,
	ethicTerritories,
	lighter,
	type EthicBase
} from './ethicsMap.ts';
import type { Territory } from './territories.ts';

const colors = Object.fromEntries(ETHIC_BASES.map((b, i) => [b, `#0000${i}0`])) as Record<
	EthicBase,
	string
>;
const territory = (id: number, guess = false): Territory => ({
	key: `country:${id}`,
	label: `E${id}`,
	color: '#123456',
	guess,
	systems: [id * 10]
});
const all = new Set<EthicBase>(ETHIC_BASES);

describe('ethic keys', () => {
	it('base and strength', () => {
		expect(ethicBase('ethic_fanatic_militarist')).toBe('militarist');
		expect(ethicBase('ethic_absolute_xenophile')).toBe('xenophile');
		expect(ethicBase('ethic_gestalt_consciousness')).toBe('gestalt_consciousness');
		expect(ethicBase('something_else')).toBe(null);
		expect(ethicStrength('ethic_absolute_xenophile')).toBe(3);
		expect(ethicStrength('ethic_fanatic_militarist')).toBe(2);
		expect(ethicStrength('ethic_pacifist')).toBe(1);
		expect(ethicStrength('ethic_gestalt_consciousness')).toBe(3);
	});
	it('lighter mixes towards white', () => {
		expect(lighter('#000000', 0.5)).toBe('#808080');
		expect(lighter('#ffffff')).toBe('#ffffff');
	});
});

describe('ethicTerritories', () => {
	const empires = [
		{
			id: 1,
			ethics: ['ethic_pacifist', 'ethic_fanatic_militarist'],
			asOf: '2300.01.01',
			stale: false
		},
		{ id: 2, ethics: ['ethic_xenophile', 'ethic_materialist'], asOf: '2290.01.01', stale: true },
		{ id: 3, ethics: null, asOf: null, stale: false }
	];
	const names = { ethic_fanatic_militarist: 'Fanatic Militarist', ethic_pacifist: 'Pacifist' };
	const run = (
		ticked: Set<EthicBase>,
		ts = [territory(1), territory(2), territory(3), territory(4)]
	) => ethicTerritories(ts, empires, ticked, colors, names);

	it('the strongest ticked ethic colours: fanatic in full, plain lighter', () => {
		const [a, b] = run(all);
		expect(a.color).toBe(colors.militarist);
		expect(a.label).toBe('E1 — Fanatic Militarist, Pacifist');
		expect(run(new Set<EthicBase>(['pacifist']))[0].color).toBe(lighter(colors.pacifist));
		// a tie by strength goes by the axis order: xenophile before materialist
		expect(b.color).toBe(lighter(colors.xenophile));
	});
	it('stale ethics are dashed and say since when', () => {
		const b = run(all)[1];
		expect(b.guess).toBe(true);
		expect(b.label).toContain('unverified since 2290.01.01');
	});
	it('none of the ticked: dark grey; unknown, unlisted or guessed: light grey', () => {
		expect(run(new Set<EthicBase>(['spiritualist']))[0].color).toBe(NONE);
		const [, , c, d] = run(all);
		expect([c.color, d.color]).toEqual([UNKNOWN, UNKNOWN]);
		expect(run(all, [territory(1, true)])[0].color).toBe(UNKNOWN);
	});
	it('counts each ethic once per empire, the known ones', () => {
		const n = ethicCounts([
			...empires,
			{ id: 5, ethics: ['ethic_fanatic_militarist', 'ethic_militarist'], asOf: null, stale: false }
		]);
		expect(n.militarist).toBe(2);
		expect(n.xenophile).toBe(1);
		expect(n.gestalt_consciousness).toBe(0);
	});
});
