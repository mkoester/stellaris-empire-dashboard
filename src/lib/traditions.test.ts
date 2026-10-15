import { describe, expect, it } from 'vitest';
import { adoptedTrees } from './traditions.ts';

describe('adoptedTrees', () => {
	const t = (key: string, name: string, role: string) => ({ key, name, role });
	const data = {
		traditionTrees: {
			tradition_discovery: {
				name: 'Discovery',
				traditions: [
					t('tr_discovery_adopt', 'Discovery Traditions', 'adopt'),
					t('tr_discovery_to_boldly_go', 'To Boldly Go', 'normal'),
					t('tr_discovery_databank_uplinks', 'Databank Uplinks', 'normal'),
					t('tr_discovery_finish', 'Discovery Traditions Finished', 'finish')
				]
			},
			tradition_expansion: {
				name: 'Expansion',
				traditions: [t('tr_expansion_adopt', 'Expansion Traditions', 'adopt')]
			}
		}
	};

	it('lists adopted trees with their picks (UNE 3, 2202.05)', () => {
		expect(adoptedTrees(['tr_discovery_adopt', 'tr_discovery_to_boldly_go'], data)).toEqual([
			{
				key: 'tradition_discovery',
				name: 'Discovery',
				picked: [{ key: 'tr_discovery_to_boldly_go', name: 'To Boldly Go' }],
				total: 2,
				finished: false
			}
		]);
	});
});
