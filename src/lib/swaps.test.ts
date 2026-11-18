import { describe, expect, it } from 'vitest';
import { activeSwap, swapExplanations, swapLookup, type Swap } from './swaps.ts';
import type { Facts } from './triggers.ts';

// 4.5.4 data DB `tradition_swap`: Mastery of Nature's two swaps, wilderness (inherits) first
const nomadic = (v: 'yes' | 'no') => ({ leaf: 'is_nomadic', value: v });
const mastery: Swap[] = [
	{
		id: 'ap_mastery_of_nature#0',
		name: 'Mastery of Nature',
		trigger: { leaf: 'is_wilderness_empire', value: 'yes' },
		inherit: true
	},
	{
		id: 'ap_mastery_of_nature#1',
		name: 'Mastery of Nature',
		trigger: nomadic('yes'),
		inherit: false
	}
];
const settled = { government: [], countryType: 'default', nomadic: false } as unknown as Facts;
const nomad = { ...settled, nomadic: true } as unknown as Facts;

describe('activeSwap', () => {
	it('takes the first swap whose trigger holds', () => {
		expect(activeSwap(mastery, nomad)?.id).toBe('ap_mastery_of_nature#1');
		expect(activeSwap(mastery, settled)).toBeNull();
		expect(activeSwap(undefined, nomad)).toBeNull();
	});
	it('cannot tell past a swap it cannot answer', () => {
		const unknown: Swap = {
			id: 'x#0',
			name: null,
			trigger: { leaf: 'nope', value: 'yes' },
			inherit: false
		};
		expect(activeSwap([unknown, ...mastery], nomad)).toBeNull();
	});
});

describe('swapLookup', () => {
	const all = { ap_mastery_of_nature: mastery };
	it('shows the swap and counts its own modifiers unless it inherits', () => {
		const s = swapLookup(all, nomad);
		expect(s.shown('ap_mastery_of_nature')).toBe('ap_mastery_of_nature#1');
		expect(s.source('ap_mastery_of_nature')).toBe('ap_mastery_of_nature#1');
		expect(s.shown('ap_other')).toBe('ap_other');
		const wild = swapLookup(all, { ...settled, origin: 'origin_wilderness' } as unknown as Facts);
		expect(wild.shown('ap_mastery_of_nature')).toBe('ap_mastery_of_nature#0');
		expect(wild.source('ap_mastery_of_nature')).toBe('ap_mastery_of_nature');
	});
	it('replaces a picked explanation by its swap’s', () => {
		const base = { title: 'Mastery of Nature', text: 'Unlocks Decision' };
		const swap = { title: 'Mastery of Nature', text: null };
		const all2 = { 'perk:ap_mastery_of_nature': base, 'perk:ap_mastery_of_nature#1': swap };
		const picked = { 'perk:ap_mastery_of_nature': base };
		expect(swapExplanations(picked, all2, swapLookup(all, nomad))).toEqual({
			'perk:ap_mastery_of_nature': swap
		});
		expect(swapExplanations(picked, all2, swapLookup(all, settled))).toEqual(picked);
	});
});
