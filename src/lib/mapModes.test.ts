import { describe, expect, it } from 'vitest';
import type { DiploEdge, DiploNode, Diplomacy } from './diplomacy.ts';
import {
	CLAIM,
	claimFill,
	hsv,
	modeData,
	parseMapMode,
	recolor,
	type ModeCountry,
	type ModeData
} from './mapModes.ts';
import type { Territory } from './territories.ts';
import type { Relation } from './types.ts';

const known = <T>(value: T, asOf = '2210.01.01', stale = false) => ({ value, asOf, stale });

const node = (id: number, n: Partial<DiploNode> = {}): DiploNode => ({
	id,
	name: `E${id}`,
	type: 'default',
	kind: 'empires',
	color: '#123456',
	us: false,
	nomadic: false,
	communications: true,
	intel: 50,
	government: null,
	capital: null,
	federation: null,
	origin: null,
	overlord: null,
	unmet: 0,
	...n
});
const edge = (kind: string, from: number, to: number, stale = false): DiploEdge => ({
	kind,
	from,
	to,
	asOf: stale ? '2208.01.01' : '2210.01.01',
	stale
});
const relation = (countryId: number, r: Partial<Relation> = {}): Relation => ({
	countryId,
	name: `E${countryId}`,
	contact: true,
	communications: true,
	hostile: false,
	opinion: null,
	trust: 0,
	threat: 0,
	borderRange: null,
	agreements: [],
	...r
});
const diplomacy = (d: Partial<Diplomacy>): Diplomacy => ({
	date: '2210.01.01',
	nodes: [node(0, { us: true, intel: null })],
	edges: [],
	opinions: {},
	wars: [],
	...d
});
const territory = (id: number | string): Territory => ({
	key: typeof id === 'number' ? `country:${id}` : id,
	label: `T${id}`,
	color: '#000000',
	guess: typeof id !== 'number',
	systems: [typeof id === 'number' ? id * 10 : 99]
});
const country = (id: number, c: Partial<ModeCountry> = {}): ModeCountry => ({
	id,
	color: '#123456',
	communications: true,
	intel: 50,
	federation: null,
	overlord: null,
	opinion: null,
	attitude: null,
	trust: null,
	threat: null,
	readings: true,
	links: [],
	oldest: null,
	...c
});
const data = (countries: ModeCountry[], d: Partial<ModeData> = {}): ModeData => ({
	us: 0,
	date: '2210.01.01',
	federation: null,
	countries,
	...d
});
const one = (mode: Parameters<typeof recolor>[0], c: ModeCountry, d: Partial<ModeData> = {}) =>
	recolor(mode, [territory(c.id)], data([c], d))[0];

describe('hsv', () => {
	it('converts the game’s hsv', () => {
		expect(hsv(0, 1, 1)).toBe('#ff0000');
		expect(hsv(1 / 3, 1, 1)).toBe('#00ff00');
		expect(hsv(0, 0, 0.8)).toBe('#cccccc');
	});
});

describe('parseMapMode', () => {
	it('keeps a known mode, else empire', () => {
		expect(parseMapMode('claims')).toBe('claims');
		expect(parseMapMode('storms')).toBe('empire');
	});
});

describe('modeData', () => {
	it('collects our links, their opinion of us, attitude and the oldest unverified reading', () => {
		const d = modeData(
			diplomacy({
				nodes: [
					node(0, { us: true, intel: null }),
					node(1, { capital: known(5, '2207.01.01', true) }),
					node(2, { communications: false })
				],
				edges: [edge('defensive_pact', 0, 1), edge('is_rival', 1, 2, true)],
				opinions: { '1:0': known(42), '0:1': known(-5) }
			}),
			[relation(1, { trust: 30, threat: 12 }), relation(2, { trust: 99 })],
			[
				{
					countryId: 1,
					attitude: 'cordial',
					nomadic: false,
					personality: null,
					opinion: 42,
					trust: 30,
					opinionModifiers: [],
					stockpile: {},
					net: {},
					income: {}
				}
			]
		)!;
		const [a, b] = d.countries;
		expect(a.links).toEqual([
			{ kind: 'defensive_pact', mine: true, stale: false, asOf: '2210.01.01' }
		]);
		expect(a.opinion?.value).toBe(42);
		expect(a).toMatchObject({ attitude: 'cordial', trust: 30, threat: 12 });
		expect(a.oldest).toBe('2207.01.01'); // the capital before the rivalry's 2208
		// without communications: no trust, threat or attitude, whatever the save holds
		expect(b).toMatchObject({ attitude: null, trust: null, threat: null, oldest: '2208.01.01' });
	});

	it('is null without a diplomacy reading', () => {
		expect(modeData(null, [], [])).toBeNull();
	});
});

describe('recolor', () => {
	it('leaves the empire and system modes alone', () => {
		const ts = [territory(1)];
		expect(recolor('empire', ts, data([country(1)]))).toBe(ts);
		expect(recolor('claims', ts, data([country(1)]))).toBe(ts);
	});

	it('takes the diplomatic relation that comes first in the game’s order', () => {
		const c = country(1, {
			links: [
				{ kind: 'commercial_pact', mine: true, stale: false, asOf: '2210.01.01' },
				{ kind: 'defensive_pact', mine: false, stale: false, asOf: '2210.01.01' }
			]
		});
		expect(one('diplomatic', c)).toMatchObject({
			color: hsv(0.37, 0.8, 1),
			label: 'T1 — defensive pact'
		});
	});

	it('names who rivals whom and who is whose subject', () => {
		const link = (kind: string, mine: boolean) => ({
			kind,
			mine,
			stale: false,
			asOf: '2210.01.01'
		});
		expect(one('diplomatic', country(1, { links: [link('is_rival', false)] })).label).toBe(
			'T1 — rivals us'
		);
		expect(one('diplomatic', country(1, { links: [link('subject', true)] })).label).toBe(
			'T1 — our subject'
		);
	});

	it('puts a shared federation first and marks an unverified one dashed', () => {
		const c = country(1, {
			federation: known('Union', '2208.01.01', true),
			links: [{ kind: 'war', mine: false, stale: false, asOf: '2210.01.01' }]
		});
		const t = one('diplomatic', c, { federation: known('Union') });
		expect(t.label).toBe('T1 — in our federation, unverified since 2208.01.01');
		expect(t.guess).toBe(true);
	});

	it('shows grey where we have no communications', () => {
		const t = one('diplomatic', country(1, { communications: false }));
		expect(t).toMatchObject({ color: hsv(0, 0, 0.8), label: 'T1 — no communications' });
		expect(one('opinion', country(1, { communications: false })).color).toBe(hsv(0, 0, 0.8));
	});

	it('colours opinion red to green, clamped at ±140', () => {
		const at = (v: number) => one('opinion', country(1, { opinion: known(v) })).color;
		expect(at(-500)).toBe(at(-140));
		expect(at(140)).toBe('hsl(120 70% 45%)');
		expect(at(-140)).toBe('hsl(0 70% 45%)');
		expect(one('opinion', country(1, { opinion: known(62) })).label).toBe('T1 — opinion of us +62');
	});

	it('colours threat the other way round from trust', () => {
		expect(one('threat', country(1, { threat: 100 })).color).toBe('hsl(0 70% 45%)');
		expect(one('trust', country(1, { trust: 100 })).color).toBe('hsl(120 70% 45%)');
	});

	it('names the attitude, grey where the game has no colour for it', () => {
		const names = { cordial: { name: 'Cordial' }, wary: { name: 'Wary' } };
		const at = (a: string) =>
			recolor('attitude', [territory(1)], data([country(1, { attitude: a })]), names)[0];
		expect(at('cordial')).toMatchObject({ color: hsv(0.2, 0.8, 0.75), label: 'T1 — Cordial' });
		expect(at('wary').color).toBe(hsv(0, 0, 0.8));
	});

	it('ages the oldest unverified reading, green while all is current', () => {
		expect(one('freshness', country(1, { readings: false })).label).toBe('T1 — nothing known');
		expect(one('freshness', country(1)).color).toBe('hsl(120 70% 45%)');
		const old = one('freshness', country(1, { oldest: '2208.01.01' }));
		expect(old).toMatchObject({ color: 'hsl(0 70% 45%)', guess: true });
		expect(old.label).toBe('T1 — oldest reading unverified since 2208.01.01 (24 months)');
	});

	it('gives a federation one colour, a subject its overlord’s', () => {
		const ts = recolor(
			'union',
			[territory(1), territory(2), territory(3)],
			data([
				country(1, { federation: known('A') }),
				country(2, { federation: known('A') }),
				country(3, { overlord: 1, color: '#ffffff' })
			])
		);
		expect(ts[0].color).toBe(ts[1].color);
		expect(ts[2].color).toBe('#123456'); // empire 1's map colour
		expect(ts[2].label).toBe('T3 — a subject');
	});

	it('draws us in the own-empire colour, without sectors; unknown territories grey', () => {
		const ours: Territory = { ...territory(0), parts: [territory(0)] };
		const [us, guess] = recolor('opinion', [ours, territory('guess:x:1')], data([]));
		expect(us).toMatchObject({ color: hsv(0.58, 1, 0.8), label: 'T0 — us', parts: undefined });
		expect(guess).toMatchObject({ color: hsv(0, 0, 0.8), label: 'Tguess:x:1 — unknown' });
	});
});

describe('claimFill', () => {
	it('fills our claims, others’ on ours, and both', () => {
		const claim = (systemId: number, ours: boolean) => ({
			systemId,
			system: `S${systemId}`,
			holder: ours ? 'Them' : 'us',
			claimant: ours ? 'us' : 'Them',
			ours,
			claims: 2,
			since: null
		});
		const { fill, titles } = claimFill([
			claim(1, true),
			claim(2, false),
			claim(3, true),
			claim(3, false)
		]);
		expect(fill).toEqual({ 1: CLAIM.ours, 2: CLAIM.theirs, 3: CLAIM.both });
		expect(titles[1]).toBe('we claim it (2×, held by Them)');
		expect(titles[2]).toBe('claimed by Them (2×)');
	});
});
