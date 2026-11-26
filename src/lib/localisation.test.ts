import { describe, expect, it } from 'vitest';
import { mergeLocalisation, parseLocalisation } from './localisation.ts';

describe('parseLocalisation', () => {
	it('reads keys with and without a number, after a BOM and the language line', () => {
		const text = '﻿l_english:\n ahw_node_40_1:0 "Ashkara Node 0"\n AHW_LINK: "Highway Gate"\n';
		expect(parseLocalisation(text)).toEqual({
			ahw_node_40_1: 'Ashkara Node 0',
			AHW_LINK: 'Highway Gate'
		});
	});
	it('drops colour codes, unescapes quotes, skips comments', () => {
		const text = [
			'l_english:',
			' # a comment',
			' a:0 "§YSealed§! for \\"friends\\"" # trailing',
			' b:0 "line one\\nline two"'
		].join('\r\n');
		expect(parseLocalisation(text)).toEqual({ a: 'Sealed for "friends"', b: 'line one line two' });
	});
});

describe('mergeLocalisation', () => {
	it('lets later files win and fills references once, engine placeholders kept', () => {
		const merged = mergeLocalisation([
			{ gate: 'Gate', x: 'old' },
			{ x: 'new', title: '$gate$ of $NAME$', self: '$self$' }
		]);
		expect(merged).toEqual({ gate: 'Gate', x: 'new', title: 'Gate of $NAME$', self: '$self$' });
	});
});
