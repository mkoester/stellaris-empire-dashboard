import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import InfoPopupInParagraph from './fixtures/InfoPopupInParagraph.svelte';
import type { Explanation, Modifier } from './types.ts';

const mod: Modifier = { key: 'pop_growth_speed', value: 0.1, label: null, positiveIsGood: true };
// every optional part filled, so each branch of ExplanationCard renders
const full: Explanation = {
	title: 'Title',
	description: 'Description',
	modifiers: [mod],
	text: 'Text',
	after: { label: 'After', modifiers: [mod] },
	facts: ['Cost 100']
};

describe('InfoPopup', () => {
	afterEach(() => vi.restoreAllMocks());

	// Svelte's dev SSR reports invalid nesting (a <ul> or <div> in a <p>) with console.error only;
	// the browser would repair the HTML and the hydration mismatches.
	it('renders only phrasing content, valid inside a <p>', () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { body } = render(InfoPopupInParagraph, { props: { explanation: full } });
		expect(body).toContain('Title'); // the card rendered at all
		expect(error.mock.calls.flat().join('\n')).not.toContain('node_invalid_placement');
	});
});
