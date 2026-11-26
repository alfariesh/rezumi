// Typed hrefs for every screen under app/. Navigate with these instead of writing paths by hand, so a route move
// is one change here. Ids and slugs are URL-encoded.
import type { WorkspaceTab } from "@rezumi/schema/career";

export type BuilderPane = "write" | "page" | "design" | "check" | "share";
export type LetterPane = "write" | "page" | "design";
/** Design's pushed screens inside the builder (`app/builder/[id]/design/*`). */
export type DesignScreen = "templates" | "typography" | "colors" | "page" | "layout";
/** Screens of the account stack (`app/account/*`), opened from the avatar menu. Omitted: the stack's index. */
export type AccountPane =
	| "account"
	| "preferences"
	| "ai"
	| "ai-providers"
	| "ai-mcp"
	| "ai-report"
	| "ai-privacy"
	| "notifications"
	| "storage"
	| "membership"
	| "licences";
/** The sections of `app/(tabs)` (the phone drawer and the tablet sidebar). */
export type AppTab = "home" | "documents" | "applications" | "portfolio" | "profile";

/** The Profile's sections, in the order of its tab row. */
export const PROFILE_TABS = ["details", "career", "facts", "stories", "preferences"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];
export type PortfolioPane = "edit" | "create" | "publish" | "card" | "statistics" | "messages" | "preview";
export type ApplicationTab = WorkspaceTab;
/** The Applications tab's views; List is the tab's index. Jobs searches current listings (Phase 09). */
export type ApplicationsView = "list" | "board" | "calendar" | "insights" | "jobs" | "offers";

const segment = (value: string) => encodeURIComponent(value);

export const routes = {
	// (auth)
	/** The three intro pages, before Welcome on a fresh install. */
	intro: () => "/intro" as const,
	/** Development builds only: pick another server. */
	server: () => "/server" as const,
	/** Welcome: Apple, Google, email, Create account, other ways. */
	signIn: () => "/sign-in" as const,
	emailSignIn: (email?: string) =>
		email ? (`/sign-in/email?email=${segment(email)}` as const) : ("/sign-in/email" as const),
	createAccount: () => "/create-account" as const,
	checkEmail: (email: string) => `/check-email?email=${segment(email)}` as const,
	forgotPassword: (email?: string) =>
		email ? (`/forgot-password?email=${segment(email)}` as const) : ("/forgot-password" as const),
	/** From the reset email (`/auth/reset-password?token=`, an app link). */
	resetPassword: (token?: string) =>
		token ? (`/auth/reset-password?token=${segment(token)}` as const) : ("/auth/reset-password" as const),
	twoFactor: () => "/two-factor" as const,

	// (tabs)
	/** `schedule`: a schedule id or "new" opens the schedule sheet (links from notifications and `/dashboard?schedule=`). */
	home: (schedule?: string) => (schedule ? (`/home?schedule=${segment(schedule)}` as const) : ("/home" as const)),
	documents: () => "/documents" as const,
	trash: () => "/documents?segment=trash" as const,
	applications: (view: ApplicationsView = "list") =>
		view === "list" ? ("/applications" as const) : (`/applications/${view}` as const),
	offers: () => "/applications/offers" as const,
	/** An application's detail sheet over List, Board or Calendar (`?open=`); tablets show it beside the list. */
	applicationOpen: (id: string, view: "list" | "board" | "calendar" = "list") =>
		`${view === "list" ? "/applications" : `/applications/${view}`}?open=${segment(id)}` as const,
	portfolio: (pane?: PortfolioPane) => (pane ? (`/portfolio/${pane}` as const) : ("/portfolio" as const)),
	/** `tab`: the Profile section to open (Details by default). */
	profile: (tab?: ProfileTab) => (tab && tab !== "details" ? (`/profile?tab=${tab}` as const) : ("/profile" as const)),
	/** One Profile entry (Career), full screen. */
	profileEntry: (section: string, item: string) => `/profile/entry/${segment(section)}/${segment(item)}` as const,
	profileSummary: () => "/profile/summary" as const,
	/** Bring what you have: a file, LinkedIn, GitHub or a website fills the Profile after a review. */
	profileBring: () => "/profile/bring" as const,

	// Account stack, opened from the avatar menu
	account: (pane?: AccountPane) => (pane ? (`/account/${pane}` as const) : ("/account" as const)),

	// Modals and full-screen flows
	/** The first run of a new account: sources, two questions, review, first resume. */
	onboarding: () => "/onboarding" as const,
	new: () => "/new" as const,
	/** New → Copy a resume for a job, with the application picked (Jobs' Tailor resume). */
	newCopyForJob: (applicationId: string) => `/new?step=copy&applicationId=${segment(applicationId)}` as const,
	search: () => "/search" as const,
	/** Coach full screen. `offers`: saved offer ids picked in Offers → Plan what to ask. */
	coach: (offers?: readonly string[]) =>
		offers?.length ? (`/coach?offers=${offers.map(segment).join(",")}` as const) : ("/coach" as const),
	coachQuestion: (question: string) => `/coach?question=${segment(question)}` as const,
	coachThread: (id: string) => `/coach?thread=${segment(id)}` as const,
	atsChecker: () => "/ats-checker" as const,
	/** An application's workspace; without a part it opens the one its stage needs (`default`). */
	application: (id: string, tab: ApplicationTab | "default" = "default") =>
		`/applications/${segment(id)}/${tab}` as const,
	/** The application detail: its sheet over the list. */
	applicationDetails: (id: string) => `/applications?open=${segment(id)}` as const,
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
	/** One of Design's screens (the template gallery, typography, colors, page, layout). */
	design: (id: string, screen: DesignScreen) => `/builder/${segment(id)}/design/${screen}` as const,
	/** The pages full screen, over the builder. */
	preview: (id: string) => `/builder/${segment(id)}/preview` as const,

	letterAssistant: (id: string) => `/letter/${segment(id)}/assistant` as const,
	/** The letter full screen, over its editor. */
	letterPreview: (id: string) => `/letter/${segment(id)}/preview` as const,

	// Cover letter editor
	/** `version` opens Share & export's History on that version, read-only (Applications' "What you sent"). */
	letter: (id: string, pane: LetterPane = "write", version?: string) =>
		version
			? (`/letter/${segment(id)}/${pane}?version=${segment(version)}` as const)
			: (`/letter/${segment(id)}/${pane}` as const),
};

export type AppHref = ReturnType<(typeof routes)[keyof typeof routes]>;
