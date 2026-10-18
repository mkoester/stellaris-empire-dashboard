import type { GameData } from './types.ts';

// A planet class's climate group, for its colour as the game's climate-preference icons show it:
// the starting climates (`initial = yes`) by climate — volcanic its own —, other colonizable
// classes (Gaia, ring world, habitat, city, relic …) as special, toxic worlds apart (they can be
// detoxed), the rest uninhabitable.

export type Climate = 'dry' | 'wet' | 'cold' | 'volcanic' | 'special' | 'toxic' | 'uninhabitable';

export function climateOf(planetClass: string, classes: GameData['planetClasses']): Climate {
	const c = classes[planetClass];
	if (planetClass === 'pc_toxic') return 'toxic';
	if (!c?.colonizable) return 'uninhabitable';
	if (planetClass === 'pc_volcanic') return 'volcanic';
	if (c.standard && (c.climate === 'dry' || c.climate === 'wet' || c.climate === 'cold'))
		return c.climate;
	return 'special';
}
