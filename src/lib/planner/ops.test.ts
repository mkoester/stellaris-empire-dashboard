import { describe, expect, it } from 'vitest';
import { parsePlanRequest } from './ops.ts';

const req = (...changes: unknown[]) => ({ node: 7, changes });

describe('parsePlanRequest', () => {
	it('accepts well-formed changes and keeps only known fields', () => {
		expect(
			parsePlanRequest(
				req(
					{
						goal: 'g1',
						op: 'add',
						data: { kind: 'tech', target: { tech: 'tech_lasers_1' }, polarity: 'want', junk: 1 }
					},
					{
						goal: 'g2',
						op: 'add',
						data: {
							kind: 'district',
							target: { planet: 3, district: 'district_city', count: 4 },
							polarity: 'avoid',
							note: 'n'
						}
					},
					{
						goal: 'g3',
						op: 'add',
						data: { kind: 'free', target: {}, polarity: 'want', title: 'spy on them' }
					},
					{ goal: 'group:research', op: 'order', data: { ids: ['g1'] } },
					{ goal: 'g1', op: 'edit', data: { note: 'x' } },
					{ goal: 'g1', op: 'park' }
				)
			)
		).toEqual({
			node: 7,
			changes: [
				{
					goal: 'g1',
					op: 'add',
					data: { kind: 'tech', target: { tech: 'tech_lasers_1' }, polarity: 'want' }
				},
				{
					goal: 'g2',
					op: 'add',
					data: {
						kind: 'district',
						target: { planet: 3, district: 'district_city', count: 4 },
						polarity: 'avoid',
						note: 'n'
					}
				},
				{
					goal: 'g3',
					op: 'add',
					data: { kind: 'free', target: {}, polarity: 'want', title: 'spy on them' }
				},
				{ goal: 'group:research', op: 'order', data: { ids: ['g1'] } },
				{ goal: 'g1', op: 'edit', data: { note: 'x' } },
				{ goal: 'g1', op: 'park', data: {} }
			]
		});
	});

	it.each([
		['no node', { changes: [{ goal: 'g', op: 'park' }] }],
		['no changes', req()],
		['an unknown op', req({ goal: 'g', op: 'explode' })],
		['a bad goal id', req({ goal: 'g g', op: 'park' })],
		[
			'an unknown kind',
			req({ goal: 'g', op: 'add', data: { kind: 'nope', target: {}, polarity: 'want' } })
		],
		[
			'a target missing a field',
			req({
				goal: 'g',
				op: 'add',
				data: { kind: 'district', target: { planet: 3 }, polarity: 'want' }
			})
		],
		[
			'an id as a string',
			req({
				goal: 'g',
				op: 'add',
				data: { kind: 'survey', target: { system: '3' }, polarity: 'want' }
			})
		],
		['no polarity', req({ goal: 'g', op: 'add', data: { kind: 'tech', target: { tech: 't' } } })],
		[
			'a free goal without text',
			req({
				goal: 'g',
				op: 'add',
				data: { kind: 'free', target: {}, polarity: 'want', title: ' ' }
			})
		],
		['an order of an unknown group', req({ goal: 'group:nope', op: 'order', data: { ids: [] } })],
		['an empty edit', req({ goal: 'g', op: 'edit', data: {} })],
		['a note too long', req({ goal: 'g', op: 'edit', data: { note: 'x'.repeat(2001) } })],
		['one bad change among good ones', req({ goal: 'g', op: 'park' }, { goal: 'g', op: 'bad' })]
	])('refuses %s', (_, body) => {
		expect(parsePlanRequest(body)).toBeNull();
	});
});
