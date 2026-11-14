import { describe, expect, it } from 'vitest';
import { SPECIAL_STARS, STAR_LEGEND, specialStar, starTitle } from './stars.ts';

describe('specialStar', () => {
	it('knows the stars with a combat modifier, not the ordinary ones', () => {
		expect(specialStar('sc_pulsar')?.effect).toBe('shields');
		expect(specialStar('sc_black_hole')?.effect).toBe('escape');
		for (const ordinary of [
			'sc_g',
			'sc_m_giant',
			'sc_binary_3',
			'sc_trinary_1',
			'sc_rift_star',
			''
		])
			expect(specialStar(ordinary)).toBeNull();
		expect(specialStar(undefined)).toBeNull();
	});

	it('gives the X-ray binaries their companion’s effect, the crisis variants the same', () => {
		expect(specialStar('sc_binary_1')).toMatchObject({ effect: 'shields', binary: true });
		expect(specialStar('sc_crisis_binary_2')).toEqual(specialStar('sc_binary_2'));
		expect(specialStar('sc_binary_2')?.effects).toEqual(specialStar('sc_neutron_star')?.effects);
	});

	it('has a legend entry for every effect it draws', () => {
		const drawn = new Set(Object.values(SPECIAL_STARS).map((s) => s.effect));
		expect(new Set(STAR_LEGEND.map((l) => l.effect))).toEqual(drawn);
	});

	it('reads as a tooltip line', () => {
		expect(starTitle(SPECIAL_STARS.sc_neutron_star)).toBe(
			'Neutron Star: Sublight speed −50 % in this system'
		);
	});
});
