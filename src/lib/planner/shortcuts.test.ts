import { describe, expect, it } from 'vitest';
import { SHORTCUTS, shortcutRows, type Shortcut } from './shortcuts.ts';

const list: Shortcut[] = [
	{
		id: 'a',
		name: 'A',
		why: '',
		techs: [
			{ tech: 'tech_x', why: 'x' },
			{ tech: 'tech_y', why: 'y' }
		]
	},
	{ id: 'b', name: 'B', why: '', techs: [{ tech: 'tech_z', why: 'z' }] }
];

describe('shortcutRows', () => {
	it('leaves out planned techs and those offer() rejects, and empty bundles', () => {
		const rows = shortcutRows(
			list,
			(t) => t === 'tech_x',
			(t) => (t === 'tech_z' ? null : { label: t.toUpperCase() })
		);
		expect(rows).toEqual([
			{ id: 'a', name: 'A', why: '', techs: [{ tech: 'tech_y', why: 'y', label: 'TECH_Y' }] }
		]);
	});

	it('keeps one hull line when the other is blocked by the shipset', () => {
		const bio = (t: string) => (t === 'tech_battleships' ? null : {});
		const military = shortcutRows(SHORTCUTS, () => false, bio).find((s) => s.id === 'military');
		const techs = military!.techs.map((t) => t.tech);
		expect(techs).toContain('tech_stingers');
		expect(techs).not.toContain('tech_battleships');
	});

	it('names every tech once', () => {
		const all = SHORTCUTS.flatMap((s) => s.techs.map((t) => t.tech));
		expect(new Set(all).size).toBe(all.length);
	});
});
