import { describe, expect, it } from 'vitest';
import { archiveMults, archives } from './save.ts';

describe('archives', () => {
	// shaped like roamingcybergang 2226.08.01: the top-level `exhibits` database, each country's
	// exhibitions in modules.standard_grand_archive_module.exhibits
	const raw = {
		date: '2226.08.01',
		exhibits: {
			3: {
				exhibit_state: 'locked',
				specimen: { specimen: 'carnivorous_megaflora', origin: 'x', date_added: '2203.07.05' },
				owner: 0
			},
			5: {
				exhibit_state: 'unlocked',
				activated: 'yes',
				specimen: {
					specimen: 'castaway_robot',
					date_added: '2213.01.04',
					exhibition_date: '2214.01.01'
				},
				owner: 0
			},
			7: { exhibit_state: 'locked', specimen: { specimen: 'ancient_bust' }, owner: 0 },
			9: {
				exhibit_state: 'locked',
				specimen: { specimen: 'sullebaster_control_column' },
				owner: 1
			},
			10: 'none'
		},
		countryBlocks: {
			0: {
				modules: { standard_grand_archive_module: { exhibits: { xeno_geology: [3, 5] } } }
			},
			1: {
				modules: { standard_grand_archive_module: { exhibits: { historical_item: [9] } } },
				flags: { has_already_traded_specimens: { flag_date: 62808000, flag_days: 30 } }
			},
			2: { modules: { standard_grand_archive_module: { exhibits: {} } } }
		}
	};

	it('places each exhibit with its holder, in an exhibition or in storage', () => {
		const [us, them] = archives(raw);
		expect(us.countryId).toBe(0);
		expect(us.exhibits.map((e) => [e.id, e.category, e.unlocked, e.active])).toEqual([
			[3, 'xeno_geology', false, false],
			[5, 'xeno_geology', true, true]
		]);
		expect(us.exhibits[1].exhibited).toBe('2214.01.01');
		expect(us.storage.map((e) => e.specimen)).toEqual(['ancient_bust']);
		expect(them.exhibits[0].category).toBe('historical_item');
	});

	it('reads the specimen trade flag, and leaves out empires holding nothing', () => {
		const all = archives(raw);
		expect(all.map((a) => a.countryId)).toEqual([0, 1]);
		expect(all[0].tradeUntil).toBeNull();
		expect(all[1].tradeUntil).toBe('2226.09.01'); // 30-day months;
	});

	it('reads the exhibitions’ multipliers from companion mod 0.15.0', () => {
		expect(archiveMults({ sdash_sp: 0.1, sdash_sp_xg: 0.25 })).toEqual({
			aesthetic_wonder: 1.1,
			historical_item: 1.1,
			xeno_geology: 1.35
		});
		expect(archiveMults({})).toBeNull();
		expect(archiveMults(undefined)).toBeNull();
	});
});
