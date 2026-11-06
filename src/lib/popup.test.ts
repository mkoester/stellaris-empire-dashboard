import { describe, expect, it } from 'vitest';
import { placePopup } from './popup.ts';

const viewport = { width: 1000, height: 800 };
const card = { width: 320, height: 200 };

describe('placePopup', () => {
	it('goes below the name, left-aligned with it', () => {
		expect(placePopup({ top: 100, bottom: 120, left: 50 }, card, viewport)).toEqual({
			top: 124,
			left: 50
		});
	});

	it('goes above when it does not fit below and there is more room above', () => {
		expect(placePopup({ top: 700, bottom: 720, left: 50 }, card, viewport)).toEqual({
			top: 496,
			left: 50
		});
	});

	it('stays inside the viewport at the right edge and when neither side fits', () => {
		expect(placePopup({ top: 100, bottom: 120, left: 900 }, card, viewport).left).toBe(672);
		const tall = { width: 320, height: 790 };
		expect(placePopup({ top: 400, bottom: 420, left: 50 }, tall, viewport).top).toBe(8);
	});
});
