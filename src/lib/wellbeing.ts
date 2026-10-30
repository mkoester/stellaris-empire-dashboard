// A colony's amenities, happiness and stability, and what each does. Pure. The ends come from the
// game files (4.5.2): the defines (`MIN|MAX_PLANET_AMENITIES` 0.25 / 2, `LOW|HIGH_HAPPINESS_
// STABILITY_EFFECT` −50 / +30, `BASE_HAPPINESS` 0.5, `BASE|MIN|MAX_PLANET_STABILITY` 50 / 0 / 100)
// and the static modifiers the engine scales between them (`00_static_modifiers.txt`):
// `planet_amenities_low` −50 % happiness at 25 % of the need, `planet_amenities_high` +20 %
// citizen happiness at 200 % (gestalt: `planet_amenities_no_happiness_*`, −50 / +20 stability),
// `planet_stability_low|high` −50 % / +30 % job output at stability 0 / 100. **The scaling between
// the ends is assumed linear** — the game's tooltips settle it (docs/open-checks.md 17).

export type WellbeingRules = {
	minAmenities: number; // 0.25: amenities count from a quarter of the need …
	maxAmenities: number; // 2: … up to twice it; more does nothing
	amenityLow: number; // happiness at the low end (−0.5)
	amenityHigh: number; // citizens' happiness at the high end (+0.2)
	amenityLowGestalt: number; // a gestalt's: stability at the low end (−50) …
	amenityHighGestalt: number; // … and at the high end (+20)
	baseHappiness: number; // 0.5: where happiness moves stability neither way
	happinessLow: number; // stability at 0 % happiness (−50)
	happinessHigh: number; // stability at 100 % happiness (+30)
	baseStability: number; // 50
	minStability: number; // 0
	maxStability: number; // 100
	lowStability: number; // 25: the game's alert
	outputLow: number; // job output at stability 0 (−0.5)
	outputHigh: number; // job output at stability 100 (+0.3)
};

export type Amenities = {
	ratio: number; // provided ÷ needed
	effect: number; // happiness (0.18 = +18 %), or for a gestalt stability points
	on: 'happiness' | 'stability';
	short: number; // missing to the need: below it the penalty grows
	useful: number; // more that still raises the effect, up to twice the need
	wasted: number; // beyond twice the need: does nothing
};

const lerp = (from: number, to: number, at: number) => from + (to - from) * at;

/** What a colony's amenities do: below the need a penalty, above it a bonus up to twice the need. */
export function amenities(
	have: number,
	need: number,
	gestalt: boolean,
	r: WellbeingRules
): Amenities | null {
	if (!(need > 0)) return null;
	const ratio = have / need;
	const clamped = Math.min(Math.max(ratio, r.minAmenities), r.maxAmenities);
	const low = gestalt ? r.amenityLowGestalt : r.amenityLow;
	const high = gestalt ? r.amenityHighGestalt : r.amenityHigh;
	const effect =
		clamped < 1
			? lerp(0, low, (1 - clamped) / (1 - r.minAmenities))
			: lerp(0, high, (clamped - 1) / (r.maxAmenities - 1));
	const cap = need * r.maxAmenities;
	return {
		ratio,
		effect,
		on: gestalt ? 'stability' : 'happiness',
		short: Math.max(0, need - have),
		useful: Math.max(0, cap - Math.max(have, need)),
		wasted: Math.max(0, have - cap)
	};
}

/** Stability from the Pop Approval Rating: −50 at 0 %, nothing at 50 %, +30 at 100 %. */
export function happinessStability(approval: number, r: WellbeingRules): number {
	return approval >= r.baseHappiness
		? lerp(0, r.happinessHigh, (approval - r.baseHappiness) / (1 - r.baseHappiness))
		: lerp(0, r.happinessLow, (r.baseHappiness - approval) / r.baseHappiness);
}

/** Job output from stability: −50 % at 0, nothing at 50, +30 % at 100. */
export function stabilityOutput(stability: number, r: WellbeingRules): number {
	const s = Math.min(Math.max(stability, r.minStability), r.maxStability);
	return s >= r.baseStability
		? lerp(0, r.outputHigh, (s - r.baseStability) / (r.maxStability - r.baseStability))
		: lerp(0, r.outputLow, (r.baseStability - s) / (r.baseStability - r.minStability));
}

/** The rules from the data DB: its defines and the static modifiers' values, by `key:modifier`. */
export function wellbeingRules(
	defines: Record<string, number>,
	modifier: (key: string, modifier: string) => number | undefined
): WellbeingRules {
	const d = (k: string, fallback: number) => defines[k] ?? fallback;
	const m = (k: string, mod: string, fallback: number) => modifier(k, mod) ?? fallback;
	return {
		minAmenities: d('MIN_PLANET_AMENITIES', 0.25),
		maxAmenities: d('MAX_PLANET_AMENITIES', 2),
		amenityLow: m('planet_amenities_low', 'pop_happiness', -0.5),
		amenityHigh: m('planet_amenities_high', 'pop_citizen_happiness', 0.2),
		amenityLowGestalt: m('planet_amenities_no_happiness_low', 'planet_stability_add', -50),
		amenityHighGestalt: m('planet_amenities_no_happiness_high', 'planet_stability_add', 20),
		baseHappiness: d('BASE_HAPPINESS', 0.5),
		happinessLow: d('LOW_HAPPINESS_STABILITY_EFFECT', -50),
		happinessHigh: d('HIGH_HAPPINESS_STABILITY_EFFECT', 30),
		baseStability: d('BASE_PLANET_STABILITY', 50),
		minStability: d('MIN_PLANET_STABILITY', 0),
		maxStability: d('MAX_PLANET_STABILITY', 100),
		lowStability: d('LOW_PLANET_STABILITY', 25),
		outputLow: m('planet_stability_low', 'planet_jobs_produces_mult', -0.5),
		outputHigh: m('planet_stability_high', 'planet_jobs_produces_mult', 0.3)
	};
}
