import type { TimelineNode } from './types.ts';

// The save graph. Every observed state is a node; loading an older save makes the next
// observation a child of an older node, i.e. a branch. Pure functions over the node list.

export type Observation = { campaign: string; date: string; fingerprint: string };

export type Placement =
	| { kind: 'duplicate'; nodeId: number }
	| { kind: 'child'; parentId: number | null; ambiguous: boolean };

/**
 * Where a new observation goes, given the campaign's nodes and the current head.
 * `loadedFrom` is the node of the save the player is known to have loaded, if anything says so.
 */
export function place(
	nodes: TimelineNode[],
	headId: number | null,
	obs: Observation,
	loadedFrom: number | null = null
): Placement {
	const same = nodes.find((n) => n.fingerprint === obs.fingerprint && n.campaign === obs.campaign);
	if (same) return { kind: 'duplicate', nodeId: same.id };

	if (loadedFrom !== null) return { kind: 'child', parentId: loadedFrom, ambiguous: false };

	const head = nodes.find((n) => n.id === headId && n.campaign === obs.campaign);
	if (!head) {
		// First observation of this campaign, or a switch from another one: attach to its newest
		// earlier node, if any — the player continued that campaign from somewhere.
		const prior = latestBefore(nodes, obs);
		return { kind: 'child', parentId: prior?.id ?? null, ambiguous: false };
	}
	if (obs.date > head.date) return { kind: 'child', parentId: head.id, ambiguous: false };

	// Time went backwards: the player loaded an older save. Prefer a node on the current branch,
	// but nothing here proves which save it was — flag it so the UI can offer a correction.
	const onBranch = new Set(path(nodes, head.id).map((n) => n.id));
	const candidates = nodes.filter((n) => n.campaign === obs.campaign && n.date < obs.date);
	const pick = latest(candidates.filter((n) => onBranch.has(n.id))) ?? latest(candidates) ?? null;
	return { kind: 'child', parentId: pick?.id ?? null, ambiguous: true };
}

/** Root → node, following parent links. */
export function path(nodes: TimelineNode[], nodeId: number): TimelineNode[] {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const out: TimelineNode[] = [];
	const seen = new Set<number>();
	for (let n = byId.get(nodeId); n && !seen.has(n.id); n = byId.get(n.parentId ?? -1)) {
		seen.add(n.id);
		out.push(n);
	}
	return out.reverse();
}

function latestBefore(nodes: TimelineNode[], obs: Observation) {
	return latest(nodes.filter((n) => n.campaign === obs.campaign && n.date < obs.date));
}

// Game dates are zero-padded "YYYY.MM.DD", so string order is date order.
function latest(nodes: TimelineNode[]): TimelineNode | undefined {
	return nodes.reduce<TimelineNode | undefined>(
		(best, n) =>
			!best || n.date > best.date || (n.date === best.date && n.id > best.id) ? n : best,
		undefined
	);
}
