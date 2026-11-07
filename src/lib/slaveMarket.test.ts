import { describe, expect, it } from 'vitest';
import {
	allowsSlavery,
	citizenSpecies,
	offerHistory,
	othersSale,
	sales,
	slaveTabShown
} from './slaveMarket.ts';
import type { LogEvent, SlaveOffer, Snapshot } from './types.ts';

const offer = (popGroup: number, species = 'Quenti', seller = 'Fangnaur'): SlaveOffer => ({
	popGroup,
	species,
	pops: 100,
	groupSize: 802,
	seller: 0,
	sellerName: seller
});
const sold = (date: string, species = 'Quenti', seller = 'Fangnaur'): LogEvent => ({
	date,
	kind: 'slave-sold',
	fields: [species, '100', 'Roaming Beldroan', seller]
});
const snap = (
	date: string,
	slaveMarket: SlaveOffer[] | null,
	logEvents: LogEvent[] | null = null
): Snapshot => ({ date, slaveMarket, logEvents }) as Snapshot;

const empire = (policy: string, citizenship: string, market: SlaveOffer[] = []) => ({
	policies: { slavery: policy },
	species: [{ id: '0', name: 'Fangnaur', cls: 'AVI', traits: [], pops: 10 }],
	speciesRights: { '0': { citizenship } },
	slaveMarket: market
});

describe('allowsSlavery / citizenSpecies', () => {
	it('reads the policy and full citizenship (machine too)', () => {
		expect(allowsSlavery({ policies: { slavery: 'slavery_allowed' } })).toBe(true);
		expect(allowsSlavery({ policies: { slavery: 'slavery_not_allowed' } })).toBe(false);
		expect(allowsSlavery({ policies: null })).toBe(false);
		expect(citizenSpecies(empire('x', 'citizenship_full_machine'))).toEqual(new Set(['Fangnaur']));
		expect(citizenSpecies(empire('x', 'citizenship_slavery')).size).toBe(0);
	});
});

describe('slaveTabShown', () => {
	it('always shows where slavery is allowed', () => {
		expect(slaveTabShown(empire('slavery_allowed', 'citizenship_full'), 'hide')).toBe(true);
	});
	it('follows the mode elsewhere', () => {
		const none = empire('slavery_not_allowed', 'citizenship_full');
		expect(slaveTabShown(none, 'all')).toBe(true);
		expect(slaveTabShown(none, 'hide')).toBe(false);
		expect(slaveTabShown(none, 'mine')).toBe(false);
		const ours = empire('slavery_not_allowed', 'citizenship_full', [offer(1, 'Fangnaur', 'Other')]);
		expect(slaveTabShown(ours, 'mine')).toBe(true);
		expect(slaveTabShown(ours, 'hide')).toBe(false);
	});
	it('counts only species with full citizenship as ours', () => {
		const slaves = empire('slavery_not_allowed', 'citizenship_slavery', [offer(1, 'Fangnaur')]);
		expect(slaveTabShown(slaves, 'mine')).toBe(false);
	});
	it('hides without a reading', () => {
		expect(slaveTabShown(undefined, 'all')).toBe(false);
	});
});

describe('sales', () => {
	it('reads each line once, oldest first', () => {
		const a = sold('2200.07.01');
		const b = sold('2200.03.01', 'Humans');
		expect(sales([{ logEvents: [a, b] }, { logEvents: [a] }])).toEqual([
			{
				date: '2200.03.01',
				species: 'Humans',
				pops: 100,
				buyer: 'Roaming Beldroan',
				seller: 'Fangnaur'
			},
			{
				date: '2200.07.01',
				species: 'Quenti',
				pops: 100,
				buyer: 'Roaming Beldroan',
				seller: 'Fangnaur'
			}
		]);
	});
	it('tells sales between other empires', () => {
		const [s] = sales([{ logEvents: [sold('2200.07.01')] }]);
		expect(othersSale(s, 'Fangnaur')).toBe(false);
		expect(othersSale(s, 'Someone')).toBe(true);
	});
});

describe('offerHistory', () => {
	// Fangnaur 2200: group 71 offered from 02.09, sold 07.01 (mod line), group 74 offered after
	const history = [
		snap('2200.02.06', []),
		snap('2200.02.09', [offer(71)]),
		snap('2200.06.01', [offer(71)]),
		snap('2200.07.01', [], [sold('2200.07.01')]),
		snap('2200.08.01', [offer(74)])
	];
	it('tracks offers, their end and their sale', () => {
		const [now, before] = offerHistory(history);
		expect(now).toMatchObject({ firstSeen: '2200.08.01', active: true, gone: null, sale: null });
		expect(before).toMatchObject({
			firstSeen: '2200.02.09',
			lastSeen: '2200.06.01',
			active: false,
			gone: '2200.07.01',
			sale: { buyer: 'Roaming Beldroan', date: '2200.07.01' }
		});
	});
	it('leaves an offer without a sale when the line is too late or of another seller', () => {
		const late = [snap('2200.02.09', [offer(71)]), snap('2200.03.01', [], [sold('2200.06.01')])];
		expect(offerHistory(late)[0].sale).toBeNull();
		const other = [
			snap('2200.02.09', [offer(71)]),
			snap('2200.03.01', [], [sold('2200.03.01', 'Quenti', 'X')])
		];
		expect(offerHistory(other)[0].sale).toBeNull();
	});
	it('skips mod months (no reading of the market)', () => {
		expect(offerHistory([snap('2200.01.01', null)])).toEqual([]);
	});
});
