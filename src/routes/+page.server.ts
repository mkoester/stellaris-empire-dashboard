import { empireData } from '#lib/server/empire.ts';

export function load({ url }) {
	return empireData(url);
}
