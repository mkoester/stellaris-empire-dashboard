import { error, json } from '@sveltejs/kit';
import { parsePlanRequest } from '#lib/planner/ops.ts';
import { getDb } from '#lib/server/app.ts';
import { addPlanEvents, history, nodeById } from '#lib/server/db.ts';
import { systemGoals } from '#lib/server/planner.ts';
import { nodeParam } from '#lib/server/request.ts';
import { campaignAt } from '#lib/server/settings.ts';

// The planner's changes (#lib/planner/ops.ts), made at the node the page shows: the body names
// it, so a reload in game between loading the page and the click cannot put a change on another
// branch.
export async function POST({ request, url }) {
	const body = await request.json().catch(() => error(400, 'not JSON'));
	const req = parsePlanRequest(body);
	if (!req) error(400, 'malformed request');
	const db = getDb();
	const node = nodeById(db, req.node);
	if (!node) error(404, 'no such node');
	if (node.campaign !== campaignAt(db, nodeParam(url)))
		error(409, 'the node is not in the viewed campaign');
	const ids = addPlanEvents(db, node.campaign, node.id, req.changes);
	return json({ ids });
}

// The goals that fit one system at a node, for the map's right-click menu.
export function GET({ url }) {
	const node = Number(url.searchParams.get('node'));
	const system = Number(url.searchParams.get('system'));
	if (!Number.isInteger(node) || !Number.isInteger(system)) error(400, 'malformed request');
	const db = getDb();
	if (!nodeById(db, node)) error(404, 'no such node');
	return json({ goals: systemGoals(history(db, node), system) });
}
