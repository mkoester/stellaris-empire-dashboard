import {
	campaignDataState,
	campaignsOnDisk,
	dataVersion,
	getDb,
	lastDataDate,
	pendingLoad,
	refreshCampaign,
	status,
	unsupportedFeed
} from '#lib/server/app.ts';
import { FEED_FORMATS } from '#lib/server/feed.ts';
import { askGone } from '#lib/server/campaigns.ts';
import {
	campaignDifficulty,
	campaignName,
	headCampaign,
	headId,
	latestSaveDate,
	nodes
} from '#lib/server/db.ts';
import { difficultyLabel } from '#lib/events.ts';
import { difficulties, difficultyCard } from '#lib/server/difficulty.ts';
import {
	activeProfile,
	chartEvents,
	display,
	quadrantView,
	tabs,
	theme,
	viewedCampaign
} from '#lib/server/settings.ts';
import { campaignTips } from '#lib/timeline.ts';
import { planSummary } from '#lib/server/planner.ts';
import { settleTab } from '#lib/server/settle.ts';
import { slaveTab } from '#lib/server/slaveTab.ts';
import { emptyTabsAt } from '#lib/server/tabData.ts';
import { galaxyRings } from '#lib/server/quadrants.ts';
import type { QuadrantView } from '#lib/quadrants.ts';
import type { ChartEvents, CustomTab } from '#lib/settings.ts';

export function load({ url }) {
	// /setup runs before there is a DB: the layout then shows no tab bar
	if (status() !== 'running')
		return {
			setup: true,
			theme: 'system' as const,
			tabs: [] as CustomTab[],
			chartEvents: {} as ChartEvents,
			profile: { id: '', name: '' },
			campaigns: [],
			campaign: null,
			gone: [],
			tradeoffs: false,
			slaveMarket: false,
			loaded: null,
			feed: null,
			head: null,
			gameVersion: null,
			dates: null,
			plan: { keys: [] as string[], alerts: 0, unavailable: [] as string[] },
			settle: { nomad: false, blocked: null as string | null },
			empty: {} as Record<string, string>,
			quadrants: null as { view: QuadrantView; inner: number; outer: number } | null
		};
	const db = getDb();
	// the node the page shows: `?node=` when it exists, else the head
	const shownNode = () => {
		const requested = Number(url.searchParams.get('node'));
		return nodes(db).some((n) => n.id === requested) ? requested : headId(db);
	};
	const { id, name } = activeProfile(db);
	// the campaigns to switch between, each named after its empire
	const campaigns = campaignTips(nodes(db), headId(db)).map((c) => ({
		...c,
		name: campaignName(db, c.campaign) || c.campaign
	}));
	const campaign = viewedCampaign(db);
	// another campaign's saves are read again by a newer reader once it is viewed
	if (campaign !== null && campaign !== headCampaign(db)) refreshCampaign(campaign);
	// a save just loaded in game: shown at once if the player wants, else with the next save or month
	const load = pendingLoad();
	const loadedNode = load === null ? undefined : nodes(db).find((n) => n.id === load);
	return {
		setup: false,
		theme: theme(),
		tabs: tabs(),
		chartEvents: chartEvents(),
		profile: { id, name },
		campaigns,
		campaign,
		// campaigns whose saves are all gone: delete their history? asked once
		gone: askGone(db, campaignsOnDisk()),
		// the exploratory trade-offs tab, a display switch
		tradeoffs: display().tradeoffs,
		// the slave market tab: where slavery is allowed, else as ⚙ says
		slaveMarket: slaveTab(shownNode(), display().slaveMarket),
		loaded: loadedNode ? { node: loadedNode.id, date: loadedNode.date } : null,
		// the companion mod writes a log format this build skips: which side to update
		feed: (() => {
			const f = unsupportedFeed();
			return f && { ...f, ...FEED_FORMATS };
		})(),
		// the save being played, so a page pinned to it keeps following the game
		head: headId(db),
		// the planner's goals at the node shown (for "+ goal" buttons) and how many need attention
		plan: planSummary(shownNode()),
		// a nomad's expansion tab is "settle", dimmed (naming what is missing) until it can
		settle: settleTab(shownNode()),
		// tabs with nothing to show yet along the branch: dimmed, their title saying why
		empty: emptyTabsAt(shownNode()),
		// every map's rings and sectors (GalaxyMap reads them from the page data)
		quadrants: (() => {
			const r = galaxyRings(campaign);
			return r && { view: quadrantView(), ...r };
		})(),
		// the game build the data is from: an open beta shares its version with the release
		gameVersion: dataVersion(),
		// the viewed campaign's own game data (its mods) still being extracted: pages show older data
		extracting: (() => {
			const d = campaignDataState();
			return d?.extracting ? { mods: d.mods } : null;
		})(),
		// the game being played: its latest save, and its latest data (a save, month or daily tick)
		dates: (() => {
			const head = headId(db);
			const node = head === null ? undefined : nodes(db).find((n) => n.id === head);
			return node
				? {
						...(() => {
							const d = campaignDifficulty(db, node.campaign);
							const card = d && difficulties(d.scale).find((x) => x.key === d.difficulty);
							return {
								difficulty: d && difficultyLabel(d.difficulty),
								difficultyCard: card ? difficultyCard(card) : null
							};
						})(),
						save: latestSaveDate(db, node.campaign),
						data: lastDataDate(node.date),
						at: Date.now() // ticks the page hears after this are newer
					}
				: null;
		})()
	};
}
