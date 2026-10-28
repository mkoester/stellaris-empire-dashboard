import { DEFAULT_WINDOW, type TimeWindow } from './series.ts';

// The x-axis window every history chart shares, on every page, while the dashboard is open:
// zooming or panning one chart moves them all. Never stored — a reload starts at the default.
let current: TimeWindow = $state(DEFAULT_WINDOW);

export const timeWindow = {
	get value() {
		return current;
	},
	set(w: TimeWindow) {
		current = w;
	}
};
