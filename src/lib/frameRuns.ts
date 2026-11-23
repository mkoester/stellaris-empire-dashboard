/**
 * The runs of consecutive marked entries, as [first, last] indices: what a slider's lane draws as
 * one band each (FrameSlider). Pure.
 */
export function runs(on: boolean[]): [number, number][] {
	const out: [number, number][] = [];
	on.forEach((x, i) => {
		if (!x) return;
		const r = out.at(-1);
		if (r && r[1] === i - 1) r[1] = i;
		else out.push([i, i]);
	});
	return out;
}
