import {
	campaignDataState,
	campaignsOnDisk,
	dataVersion,
	gameWarning,
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
	nodeById,
	nodes
} from '#lib/server/db.ts';
import { difficultyLabel } from '#lib/events.ts';
import { difficulties, difficultyCard } from '#lib/server/difficulty.ts';
import {
	activeProfile,
	campaignAt,
	chartEvents,
	display,
	setting,
	tabs,
	theme
} from '#lib/server/settings.ts';
import { campaignTips } from '#lib/timeline.ts';
import { planSummary } from '#lib/server/planner.ts';
import { updateAvailable } from '#lib/server/updates.ts';
import { isRelease } from '#lib/updates.ts';
import type { Release } from '#lib/updates.ts';
import { shownNode } from '#lib/server/branch.ts';
import { settleTab } from '#lib/server/settle.ts';
import { slaveTab } from '#lib/server/slaveTab.ts';
import { highwayTab } from '#lib/server/highwayTab.ts';
import { emptyTabsAt } from '#lib/server/tabData.ts';
import { galaxyRings } from '#lib/server/quadrants.ts';
import { ownMapAt } from '#lib/server/ownMap.ts';
import type { MapOwn } from '#lib/mapLayers.ts';
import type { MapFit, MapWidth } from '#lib/mapView.ts';
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
			mapDefaults: { fit: 'explored' as MapFit, width: 'normal' as MapWidth, stars: true },
			highway: false,
			loaded: null,
			feed: null,
			gameNote: null as string | null,
			head: null,
			gameVersion: null,
			update: null as Release | null,
			dates: null,
			plan: {
				keys: [] as string[],
				ids: {} as Record<string, string>,
				alerts: 0,
				unavailable: [] as string[]
			},
			settle: { nomad: false, blocked: null as string | null },
			empty: {} as Record<string, string>,
			quadrants: null as { view: QuadrantView; inner: number; outer: number } | null,
			ownMap: null as ReturnType<typeof ownMapAt>,
			mapOwn: null as MapOwn | null
		};
	const db = getDb();
	const head = headId(db);
	// the node the page shows: `?node=` when it exists, else the head
	const shown = shownNode(db, url);
	const { id, name } = activeProfile(db);
	// the campaigns to switch between, each named after its empire
	const campaigns = campaignTips(nodes(db), head).map((c) => ({
		...c,
		name: campaignName(db, c.campaign) || c.campaign
	}));
	const campaign = campaignAt(db, shown);
	// another campaign's saves are read again by a newer reader once it is viewed
	if (campaign !== null && campaign !== headCampaign(db)) refreshCampaign(campaign);
	// a save just loaded in game: shown at once if the player wants, else with the next save or month
	const load = pendingLoad();
	const loadedNode = nodeById(db, load);
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
		slaveMarket: slaveTab(shown, display().slaveMarket),
		// every map's start: what it fits, and its width until this browser's buttons pick one
		mapDefaults: {
			fit: display().mapFit,
			width: display().mapWidth,
			stars: display().mapStars
		},
		// the Ancient Highway mod's tab: only in a campaign with the mod
		highway: highwayTab(shown),
		loaded: loadedNode ? { node: loadedNode.id, date: loadedNode.date } : null,
		// the companion mod writes a log format this build skips: which side to update
		feed: (() => {
			const f = unsupportedFeed();
			return f && { ...f, ...FEED_FORMATS };
		})(),
		// a game version or Steam beta the release was not built for (`#lib/gameNote.ts`); a dev
		// checkout of `open-beta` is built for its beta, so only release builds say so
		gameNote: isRelease(__APP_VERSION__) ? gameWarning() : null,
		// the save being played, so a page pinned to it keeps following the game
		head,
		// the planner's goals at the node shown (for "+ goal" buttons) and how many need attention
		plan: planSummary(shown),
		// a nomad's expansion tab is "roaming": waylines, and settling down (what it still needs)
		settle: settleTab(shown),
		// tabs with nothing to show yet along the branch: dimmed, their title saying why
		empty: emptyTabsAt(shown),
		// every map's rings and sectors (GalaxyMap reads them from the page data)
		quadrants: (() => {
			const r = galaxyRings(campaign);
			return r && { view: setting('quadrants'), ...r };
		})(),
		// our own on every map (GalaxyMap reads them from the page data), and which of it to draw
		ownMap: ownMapAt(shown),
		mapOwn: setting('mapOwn'),
		// the game build the data is from: an open beta shares its version with the release
		gameVersion: dataVersion(),
		// a newer release on GitHub (`server/updates.ts`; release builds only)
		update: updateAvailable(),
		// the viewed campaign's own game data (its mods) still being extracted: pages show older data
		extracting: (() => {
			const d = campaignDataState();
			return d?.extracting ? { mods: d.mods } : null;
		})(),
		// the game being played: its latest save, and its latest data (a save, month or daily tick)
		dates: (() => {
			const node = nodeById(db, head);
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
