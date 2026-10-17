import { describe, expect, it } from 'vitest';
import { byExpiry, timeLeft } from './countryModifiers.ts';
import { addGameDays } from './series.ts';

describe('addGameDays', () => {
	it('counts 30-day months and 360-day years', () => {
		expect(addGameDays('2207.03.10', 30)).toBe('2207.04.10');
		expect(addGameDays('2207.03.10', 3535)).toBe('2217.01.05');
		expect(addGameDays('2207.12.30', 1)).toBe('2208.01.01');
	});
});

describe('timeLeft', () => {
	it('gives years and months, rounded down', () => {
		expect(timeLeft('2207.03.10', '2217.01.05')).toBe('9 y 9 m');
		expect(timeLeft('2207.03.10', '2207.08.09')).toBe('4 m');
		expect(timeLeft('2207.03.10', '2209.03.10')).toBe('2 y');
		expect(timeLeft('2207.03.10', '2207.03.25')).toBe('< 1 m');
	});
});

describe('byExpiry', () => {
	it('puts the soonest-expiring first, permanent ones last by name', () => {
		const m = (name: string, until: string | null) => ({ key: name, name, until });
		expect(
			byExpiry([
				m('Zeta', null),
				m('Late', '2230.01.01'),
				m('Alpha', null),
				m('Soon', '2210.01.01')
			]).map((x) => x.name)
		).toEqual(['Soon', 'Late', 'Alpha', 'Zeta']);
	});
});
