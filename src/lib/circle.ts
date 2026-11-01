// Nodes on a circle, clockwise from 12 o'clock (SVG's y grows down), as the diplomacy and
// migration circles draw them: one slot per node in the given order, an empty slot after each
// group when there are several, and chords between nodes bent towards the centre.

export type Point = { x: number; y: number };
export type Slot = { id: number; group: number }; // id −1, group −1: the gap after a group

/** The slots for `groups` of node ids, each group in its own order. */
export function circleSlots(groups: number[][]): Slot[] {
	return groups.flatMap((ids, group) => [
		...ids.map((id) => ({ id, group })),
		...(groups.length > 1 ? [{ id: -1, group: -1 }] : [])
	]);
}

/** Slot `i` of `n`'s angle: 0 at 12 o'clock, growing clockwise. */
export const slotAngle = (i: number, n: number) => (i / n) * 2 * Math.PI - Math.PI / 2;

/** Each node's place on the circle round `c` of radius `r`, with its angle `t`. */
export function placeOnCircle(
	slots: Slot[],
	c: Point,
	r: number
): Map<number, Point & { t: number }> {
	return new Map(
		slots.flatMap((s, i) => {
			if (s.id === -1) return [];
			const t = slotAngle(i, slots.length);
			return [[s.id, { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t), t }]] as const;
		})
	);
}

/** A chord from `p` to `q` bent towards the centre `c`; `off` spreads parallel ones apart. */
export function chord(p: Point, q: Point, c: Point, off = 0): string {
	const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
	const k = 0.45 + off * 0.08;
	return `M${p.x},${p.y} Q${m.x + (c.x - m.x) * k},${m.y + (c.y - m.y) * k} ${q.x},${q.y}`;
}
