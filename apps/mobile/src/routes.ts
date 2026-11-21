// Typed hrefs for every screen under app/. Navigate with these instead of writing paths by hand, so a route move
// is one change here. Ids and slugs are URL-encoded.
import type { WorkspaceTab } from "@rezumi/schema/career";

export type BuilderPane = "write" | "page" | "design" | "check" | "share";
export type LetterPane = "write" | "page" | "design";
/** Screens of the account stack (`app/account/*`), opened from the avatar menu. Omitted: the stack's index. */
export type AccountPane =
	| "account"
	| "preferences"
	| "ai"
	| "ai-providers"
	| "ai-mcp"
	| "ai-report"
	| "membership"
	| "licences";
/** The bottom tabs of `app/(tabs)`, in tab-bar order. */
export type AppTab = "home" | "documents" | "applications" | "portfolio" | "profile";
export type ApplicationTab = WorkspaceTab;
/** The Applications tab's views; List is the tab's index. */
export type ApplicationsView = "list" | "board" | "calendar" | "insights";

const segment = (value: string) => encodeURIComponent(value);

export const routes = {
	// (auth)
	server: () => "/server" as const,
	signIn: () => "/sign-in" as const,

	// (tabs)
	/** `schedule`: a schedule id or "new" opens the schedule sheet (links from notifications and `/dashboard?schedule=`). */
	home: (schedule?: string) => (schedule ? (`/home?schedule=${segment(schedule)}` as const) : ("/home" as const)),
	documents: () => "/documents" as const,
	trash: () => "/documents/trash" as const,
	applications: (view: ApplicationsView = "list") =>
		view === "list" ? ("/applications" as const) : (`/applications/${view}` as const),
	offers: () => "/applications/offers" as const,
	portfolio: () => "/portfolio" as const,
	profile: () => "/profile" as const,
	/** The Knowledge screen kept from before the rebuild, under Profile until Phase 06 replaces it. */
	knowledge: () => "/profile/knowledge" as const,

	// Account stack, opened from the avatar menu
	account: (pane?: AccountPane) => (pane ? (`/account/${pane}` as const) : ("/account" as const)),

	// Modals and full-screen flows
	new: () => "/new" as const,
	search: () => "/search" as const,
	/** Coach full screen. `offers`: saved offer ids picked in Offers → Plan what to ask. */
	coach: (offers?: readonly string[]) =>
		offers?.length ? (`/coach?offers=${offers.map(segment).join(",")}` as const) : ("/coach" as const),
	atsChecker: () => "/ats-checker" as const,
	application: (id: string, tab: ApplicationTab = "fit") => `/applications/${segment(id)}/${tab}` as const,
	/** The application detail; it shares the dynamic `[tab]` route with the workspace tabs. */
	applicationDetails: (id: string) => `/applications/${segment(id)}/details` as const,
	publicResume: (username: string, slug: string) => `/r/${segment(username)}/${segment(slug)}` as const,

	// Resume builder
	builder: (id: string, pane: BuilderPane = "write") => `/builder/${segment(id)}/${pane}` as const,
	/** `section` is a built-in section key or a custom section id; `item` is the entry id. */
	entry: (id: string, section: string, item: string) =>
		`/builder/${segment(id)}/entry/${segment(section)}/${segment(item)}` as const,
	/** Download & history, over the builder. */
	export: (id: string) => `/builder/${segment(id)}/export` as const,
	/** `version` opens History on that version, read-only (Applications' "What you sent"). */
	history: (id: string, version?: string) =>
		version
			? (`/builder/${segment(id)}/history?version=${segment(version)}` as const)
			: (`/builder/${segment(id)}/history` as const),
	assistant: (id: string) => `/builder/${segment(id)}/assistant` as const,

	letterAssistant: (id: string) => `/letter/${segment(id)}/assistant` as const,

	// Cover letter editor
	/** `version` opens Share & export's History on that version, read-only (Applications' "What you sent"). */
	letter: (id: string, pane: LetterPane = "write", version?: string) =>
		version
			? (`/letter/${segment(id)}/${pane}?version=${segment(version)}` as const)
			: (`/letter/${segment(id)}/${pane}` as const),
};

export type AppHref = ReturnType<(typeof routes)[keyof typeof routes]>;
