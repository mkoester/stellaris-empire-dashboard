// The months the Pops charts average the monthly change over (a profile setting, ⚙). Pure.
//
// The game books whole pops each month and turns a fractional rate into a chance of one more
// (4.0 patch notes: "Fractional growth is not retained from month to month"), so one month is off
// the rate by up to 1. A mean over six months cuts that to about ± 0.2. Looking ahead as far as
// back keeps the line level with the month it stands for (a trailing six lag three months); the
// last `ahead` points of a chart have fewer months to average and change as later saves arrive.

/** Months before and after the month itself (always counted) that its mean takes in. */
export type PopWindow = { back: number; ahead: number };

export const DEFAULT_POP_WINDOW: PopWindow = { back: 3, ahead: 2 };
export const MAX_POP_WINDOW = 6;

const months = (v: unknown, fallback: number) =>
	typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_POP_WINDOW ? v : fallback;

export function parsePopWindow(v: unknown): PopWindow {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<PopWindow>;
	return {
		back: months(o.back, DEFAULT_POP_WINDOW.back),
		ahead: months(o.ahead, DEFAULT_POP_WINDOW.ahead)
	};
}

/** The months it takes in, the month itself included. */
export const windowMonths = (w: PopWindow) => w.back + 1 + w.ahead;

/** −MAX…+MAX, each offset in the window or not: the settings page draws this strip. */
export const windowStrip = (w: PopWindow) =>
	Array.from({ length: 2 * MAX_POP_WINDOW + 1 }, (_, i) => {
		const offset = i - MAX_POP_WINDOW;
		return { offset, in: offset >= -w.back && offset <= w.ahead };
	});
