import { getSetting, setSetting, type Db } from './db.ts';

// The campaigns in the history, and cleaning them up: any can be deleted by hand (the config tab),
// and one whose saves are all gone from disk is offered for deletion once (the layout's banner) —
// its history is then the only copy left, so it is never deleted unasked.

export type CampaignRow = {
	campaign: string;
	/** the empire, from its latest save ('' when only game.log knows it) */
	name: string;
	/** the latest game date */
	date: string;
	nodes: number;
	onDisk: boolean;
};

/** Every campaign in the history, most recently observed first. */
export function campaignRows(db: Db, onDisk: Set<string>): CampaignRow[] {
	const rows = db
		.prepare(
			`SELECT n.campaign, count(*) AS nodes, max(n.date) AS date, max(n.id) AS last,
				(SELECT json_extract(s.json, '$.empireName') FROM node m JOIN snapshot s ON s.node_id = m.id
				 WHERE m.campaign = n.campaign AND m.kind = 'save' ORDER BY m.id DESC LIMIT 1) AS name
			FROM node n GROUP BY n.campaign ORDER BY last DESC`
		)
		.all() as { campaign: string; nodes: number; date: string; name: string | null }[];
	return rows.map((r) => ({
		campaign: r.campaign,
		name: r.name ?? '',
		date: r.date,
		nodes: r.nodes,
		onDisk: onDisk.has(r.campaign)
	}));
}

const kept = (db: Db) => (getSetting(db, 'keptCampaigns') ?? []) as string[];

/** The campaigns without saves on disk that the player has not been asked about yet. */
export const goneToAsk = (rows: CampaignRow[], keptOnes: string[]): CampaignRow[] =>
	rows.filter((r) => !r.onDisk && !keptOnes.includes(r.campaign));

export const askGone = (db: Db, onDisk: Set<string>) =>
	goneToAsk(campaignRows(db, onDisk), kept(db));

/** The answer "keep it": never asked about this campaign again. */
export function keepCampaign(db: Db, campaign: string) {
	if (!kept(db).includes(campaign)) setSetting(db, 'keptCampaigns', [...kept(db), campaign]);
}

// Cooldowns that ran out and were dismissed on the upcoming list, per campaign
// (`timedOut()` ids, `<scope>:<kind>:<key>:<until>`); the newest 500 kept.
const dismissedKey = (campaign: string) => `dismissed:${campaign}`;

export const dismissed = (db: Db, campaign: string): Set<string> =>
	new Set((getSetting(db, dismissedKey(campaign)) ?? []) as string[]);

export function dismiss(db: Db, campaign: string, id: string) {
	const ids = [...dismissed(db, campaign)].filter((d) => d !== id);
	setSetting(db, dismissedKey(campaign), [...ids, id].slice(-500));
}
