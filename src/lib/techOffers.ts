import type { Upcoming } from './events.ts';
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

/** How a planned tech is meant: wanted now, wanted later (not yet), or avoided. */
export type Stance = 'want' | 'later' | 'avoid';

const STANCE: Record<Stance, { sub: string; hint: string }> = {
	want: { sub: 'planned tech', hint: '' },
	// the user's ask 2026-11-16: "I might want to delay some tech options"
	later: { sub: 'later', hint: 'planned for later: pick another card for now' },
	avoid: { sub: 'avoided tech', hint: 'planned to avoid: pick another card' }
};

/**
 * The saves along a branch, with the research options the companion mod logged since (on the 2nd
 * of each month, `liveTechOptions()`) as one more reading after the last save: the cards grouped
 * by field (`areaOf`), everything else the last save's. Unchanged when no newer list came. Pure.
 */
export function withLiveOptions(
	history: Snapshot[],
	live: { date: string; techs: string[] } | null,
	areaOf: (tech: string) => string | undefined
): Snapshot[] {
	const last = history.findLast((s) => s.techOptions !== null);
	if (!live || !last || live.date <= last.date) return history;
	const techOptions: Record<string, string[]> = {};
	for (const t of live.techs) (techOptions[areaOf(t) ?? 'unknown'] ??= []).push(t);
	// A save's cards hold the tech under research (2213.08.02, all three fields); whether
	// `has_tech_option` does is not checked yet. Without it, every 2nd would read as a new draw and
	// bring dismissed rows back — so it is added, as the last save names it.
	for (const r of last.progress?.research ?? [])
		if (!techOptions[r.area]?.includes(r.tech)) (techOptions[r.area] ??= []).push(r.tech);
	return [...history, { ...last, date: live.date, techOptions }];
}

/**
 * Planned techs among the cards on offer now — the user's ask 2026-11-06: "when I planned some
 * tech, I want to get notified once it pops up in my current list of available tech options". The
 * game does not point it out. A row stays until the tech is picked (the field's research), the
 * cards move on without it, or the player dismisses it: the id ends with the offer's first save, so
 * a later draw offering it again is a new row. `planned`: tech → its goal's stance and note; a tech
 * for later or to avoid gets a row too, saying to pick another card (2026-11-16). Pure.
 */
export function plannedOnOffer(
	history: Snapshot[],
	planned: Map<string, { stance: Stance; note: string }>,
	names: Record<string, { name: string }>,
	dismissed: Set<string>
): Upcoming[] {
	const last = history.findLast((s) => s.techOptions !== null);
	if (!last) return [];
	const current = new Map(techOffers(history).map((o) => [o.area, o]));
	return Object.entries(last.techOptions!).flatMap(([area, cards]) => {
		const researching = last.progress?.research.find((r) => r.area === area)?.tech;
		const offer = current.get(area)!;
		return cards
			.filter((t) => planned.has(t) && t !== researching)
			.map((t): Upcoming => {
				const { stance, note } = planned.get(t)!;
				const { sub, hint } = STANCE[stance];
				const detail = [area, `on offer since ${offer.from}`, hint, note].filter(Boolean);
				return {
					date: last.date,
					months: 0,
					kind: 'offer',
					sub,
					act: true,
					what: names[t]?.name ?? t,
					tint: `${area}_research`,
					ref: `tech:${t}`,
					detail: detail.join(' · '),
					exact: true,
					dismiss: `country:offer:${t}:${offer.from}`
				};
			})
			.filter((u) => !dismissed.has(u.dismiss!));
	});
}
