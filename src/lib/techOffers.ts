import type { Snapshot } from './types.ts';

// What the game offered when — pure. Each save holds the cards on offer per field
// (`tech_status.alternatives`); the game redraws them once the field's tech is done, so a run of
// saves with the same cards is one offer. The pick is the tech that field researched meanwhile.

export type Offer = {
	area: string;
	cards: string[];
	from: string; // first save showing it
	to: string; // last save showing it
	picked: string | null; // researched from it: the field's tech in the queue while on offer
};

const same = (a: string[], b: string[]) =>
	a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Per field, each offer along the branch, oldest first. */
export function techOffers(history: Snapshot[]): Offer[] {
	const out: Offer[] = [];
	const open = new Map<string, Offer>();
	for (const s of history.filter((x) => x.techOptions !== null)) {
		for (const [area, cards] of Object.entries(s.techOptions!)) {
			const researching = s.progress?.research.find((r) => r.area === area)?.tech ?? null;
			const last = open.get(area);
			if (last && same(last.cards, cards)) {
				last.to = s.date;
				if (researching && cards.includes(researching)) last.picked = researching;
				continue;
			}
			const offer = {
				area,
				cards,
				from: s.date,
				to: s.date,
				picked: researching && cards.includes(researching) ? researching : null
			};
			out.push(offer);
			open.set(area, offer);
		}
	}
	return out;
}
