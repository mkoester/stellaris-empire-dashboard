// Where a popup card goes, in viewport coordinates — pure. Below its anchor, left-aligned; above
// when it does not fit below and there is more room above; kept inside the viewport with a margin.

type Rect = { top: number; bottom: number; left: number };
type Size = { width: number; height: number };

const GAP = 4;
const MARGIN = 8;

export function placePopup(
	anchor: Rect,
	card: Size,
	viewport: Size
): { top: number; left: number } {
	const below = viewport.height - anchor.bottom - GAP;
	const above = anchor.top - GAP;
	const top =
		card.height <= below || below >= above
			? anchor.bottom + GAP
			: Math.max(MARGIN, anchor.top - GAP - card.height);
	const left = Math.max(MARGIN, Math.min(anchor.left, viewport.width - card.width - MARGIN));
	return { top: Math.min(top, Math.max(MARGIN, viewport.height - card.height - MARGIN)), left };
}
