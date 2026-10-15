import { DatabaseSync } from 'node:sqlite';
import type { GameData } from '#lib/events.ts';

// Names and base costs from stellaris-data-extraction's SQLite (STELLARIS_DATA_DB), read once at
// start. It must match the game version being played — regenerate it after a game update.

export function loadGameData(file: string): GameData {
	const db = new DatabaseSync(file, { readOnly: true });
	try {
		const rows = <T>(sql: string) => db.prepare(sql).all() as T[];
		return {
			techs: Object.fromEntries(
				rows<{ key: string; label: string | null; cost: number | null }>(
					'SELECT key, label, cost FROM technology'
				).map((r) => [r.key, { name: r.label ?? r.key, cost: r.cost }])
			),
			agendas: Object.fromEntries(
				rows<{ key: string; name: string | null; cost: number | null }>(
					'SELECT key, name, cost FROM council_agenda'
				).map((r) => [r.key, { name: r.name ?? r.key, cost: r.cost }])
			),
			defines: Object.fromEntries(
				rows<{ key: string; value: number }>('SELECT key, value FROM game_define').map((r) => [
					r.key,
					r.value
				])
			)
		};
	} finally {
		db.close();
	}
}
