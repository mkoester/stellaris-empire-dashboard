import { describe, expect, it } from 'vitest';
import { DEFAULT_POP_WINDOW, parsePopWindow, windowMonths, windowStrip } from './popWindow.ts';

describe('pops charts window', () => {
	it('keeps whole months from 0 to 6, else the default', () => {
		expect(parsePopWindow({ back: 6, ahead: 0 })).toEqual({ back: 6, ahead: 0 });
		expect(parsePopWindow({ back: 7, ahead: -1 })).toEqual(DEFAULT_POP_WINDOW);
		expect(parsePopWindow({ back: 1.5 })).toEqual(DEFAULT_POP_WINDOW);
		expect(parsePopWindow(undefined)).toEqual({ back: 3, ahead: 2 });
	});

	it('counts the month itself and marks the strip from −6 to +6', () => {
		expect(windowMonths(DEFAULT_POP_WINDOW)).toBe(6);
		const strip = windowStrip(DEFAULT_POP_WINDOW);
		expect(strip).toHaveLength(13);
		expect(strip.filter((m) => m.in).map((m) => m.offset)).toEqual([-3, -2, -1, 0, 1, 2]);
	});
});
