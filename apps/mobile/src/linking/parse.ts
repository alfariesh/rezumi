import type { AccountPane, AppHref, BuilderPane } from "../routes";
import { WORKSPACE_TABS } from "@rezumi/schema/career";
import { routes } from "../routes";
import { DEFAULT_SERVER } from "@/auth/session";

export type DeepLink =
	| { kind: "callback" }
	| { kind: "root" }
	| { kind: "target"; server: string | null; href: AppHref };

// Matches the server's public-resume exclusions.
const reserved = new Set([
	"api",
	"mcp",
	".well-known",
	"uploads",
	"auth",
	"dashboard",
	"builder",
	"agent",
	"templates",
	"ats-checker",
]);
const nativeReserved = new Set([
	"home",
	"documents",
	"applications",
	"portfolio",
	"profile",
	"account",
	"coach",
	"career",
	"settings",
	"server",
	"sign-in",
	"new",
	"search",
	"dev",
	"letter",
	"r",
]);
const panes = new Set<string>(["write", "page", "design", "check", "share"]);
const workspaceTabs = new Set<string>(WORKSPACE_TABS);
// Web settings pages and the app screen holding the same settings. Billing has no app page (K6): the settings index.
const settingsPanes: Record<string, AccountPane | undefined> = {
	account: "account",
	profile: "account",
	authentication: "account",
	preferences: "preferences",
	app: "preferences",
	"job-search": "preferences",
	ai: "ai",
	"api-keys": "ai",
	integrations: "ai",
};
// A schedule id, or "new" / "new:<kind>" from the web's schedule links.
const schedulePattern = /^[A-Za-z0-9_-]{1,128}$|^new(?::(?:discovery|prepare|follow-up))?$/;

/** One query parameter, decoded; undefined when absent or malformed. */
function queryParam(path: string, key: string): string | undefined {
	for (const pair of path.split("#", 1)[0]?.split("?", 2)[1]?.split("&") ?? []) {
		const separator = pair.indexOf("=");
		if (separator < 0 || pair.slice(0, separator) !== key) continue;
		try {
			return decodeURIComponent(pair.slice(separator + 1).replaceAll("+", " "));
		} catch {
			return undefined;
		}
	}
	return undefined;
}

/**
 * The web app's `/dashboard/...` pages (and the paths of in-app notifications) mapped to the app screen that shows
 * the same thing (02-teknis 7). Pages the app has no screen for yet land on the tab that will hold them.
 */
function dashboardHref(rest: readonly string[], path: string): AppHref | null {
	const [section, second, third] = rest;
	if (!section || (section === "career" && !second)) {
		const schedule = queryParam(path, "schedule");
		return routes.home(schedule && schedulePattern.test(schedule) ? schedule : undefined);
	}
	switch (section) {
		case "documents":
		case "resumes":
		case "cover-letters":
			return rest.length === 1 ? routes.documents() : null;
		case "trash":
			return rest.length === 1 ? routes.trash() : null;
		case "portfolio":
			return routes.portfolio();
		case "profile":
			return routes.profile();
		case "jobs":
			return routes.applications();
		case "coach":
			return rest.length <= 2 ? routes.coach() : null;
		case "career":
			if (second === "knowledge") return routes.profile();
			if (second === "offers") return rest.length === 2 ? routes.offers() : null;
			if (second === "coach") return rest.length <= 3 ? routes.coach() : null;
			return null;
		case "applications":
			if (!second) return routes.applications();
			if (rest.length === 2 && second === "jobs") return routes.applications();
			if (rest.length === 2 && second === "offers") return routes.offers();
			if (rest.length === 2) return routes.application(second);
			if (rest.length === 3 && third && workspaceTabs.has(third))
				return routes.application(second, third as (typeof WORKSPACE_TABS)[number]);
			return null;
		case "settings": {
			if (!second) return routes.account();
			if (second === "billing") return routes.account();
			const pane = settingsPanes[second];
			return pane ? routes.account(pane) : null;
		}
		default:
			return null;
	}
}

/** Only known screens, with decoded segments checked before WHATWG URL can erase traversal. */
export function parseDeepLink(input: string, currentServer: string): DeepLink | null {
	if (input.length > 8192) return null;
	let path: string;
	let server: string | null = null;
	let native = false;
	if (/^app\.rezumi:/i.test(input)) {
		native = true;
		path = `/${input.slice("app.rezumi:".length).replace(/^\/+/, "")}`;
	} else if (input.startsWith("/") && !input.startsWith("//")) {
		native = true;
		path = input;
	} else {
		const match = /^https:\/\/([^/?#]+)([^?#]*)(.*)$/i.exec(input);
		if (!match) return null;
		path = `${match[2] || "/"}${match[3]}`;
		try {
			const url = new URL(input);
			if (url.username || url.password || !url.hostname) return null;
			server = url.origin;
		} catch {
			return null;
		}
	}

	const pathname = path.split(/[?#]/, 1)[0];
	// AuthSession owns this response. Never inspect its query, authenticate, or remap it as a public resume.
	if (pathname === "/auth/native-callback")
		return server === null || server === DEFAULT_SERVER ? { kind: "callback" } : null;
	if (server !== null && server !== DEFAULT_SERVER && server !== currentServer) return null;
	if (!pathname || /[\s\\]/.test(input)) return null;
	if (native && pathname === "/") return { kind: "root" };
	let segments: string[];
	try {
		segments = pathname.replace(/\/$/, "").slice(1).split("/").map(decodeURIComponent);
	} catch {
		return null;
	}
	if (
		segments.some(
			(part) =>
				!part ||
				part === "." ||
				part === ".." ||
				/[/\\%?#\s]/.test(part) ||
				Array.from(part).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
		)
	)
		return null;
	const [first, second, third, fourth, fifth] = segments;
	const target = (href: AppHref): DeepLink => ({ kind: "target", server, href });
	if (first === "dashboard") {
		const href = dashboardHref(segments.slice(1), path);
		return href ? target(href) : null;
	}
	if (!first || !second) return null;

	if (__DEV__ && native && pathname === "/builder/preview-sample/page") {
		for (const pair of path.split("#", 1)[0]?.split("?", 2)[1]?.split("&") ?? []) {
			const separator = pair.indexOf("=");
			if (separator < 0) continue;
			const key = pair.slice(0, separator);
			if (key !== "parity" && key !== "smoke") continue;
			let origin: string;
			try {
				origin = decodeURIComponent(pair.slice(separator + 1).replaceAll("+", " "));
			} catch {
				return target(routes.builder("preview-sample", "page"));
			}
			const match = origin.match(/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/?$/);
			if (match && Number(match[1]) <= 65535)
				return target(
					`${routes.builder("preview-sample", "page")}?${key}=${encodeURIComponent(origin.replace(/\/$/, ""))}` as AppHref,
				);
		}
	}

	// Development builds only: the design-system gallery (app/dev/ui.tsx), with one known group parameter.
	if (__DEV__ && native && first === "dev" && second === "ui" && segments.length === 2) {
		const group = /[?&]group=([a-z]+)(?:&|#|$)/.exec(path)?.[1];
		return target((group ? `/dev/ui?group=${group}` : "/dev/ui") as AppHref);
	}

	// The portfolio editor (`/builder/portfolio?mode=`) is not in the app yet: its tab (Phase 12–13 add the editor).
	if (first === "builder" && second === "portfolio" && segments.length === 2) return target(routes.portfolio());
	if (first === "builder") {
		// Web editor mode is a query parameter. Never forward arbitrary queries (e.g. assistant auto-send prompts).
		let mode: BuilderPane = "write";
		for (const pair of path.split("#", 1)[0]?.split("?", 2)[1]?.split("&") ?? []) {
			const [key, value] = pair.split("=", 2);
			if (key === "mode" && value && panes.has(value)) mode = value as BuilderPane;
		}
		if (second === "letter" && third && segments.length === 3)
			return target(routes.letter(third, mode === "design" ? "design" : "write"));
		if (segments.length === 2) return target(routes.builder(second, mode));
		if (segments.length === 3) {
			if (third && panes.has(third)) return target(routes.builder(second, third as BuilderPane));
			if (third === "export") return target(routes.export(second));
			if (third === "history") return target(routes.history(second));
			if (third === "assistant") return target(routes.assistant(second));
		}
		if (segments.length === 5 && third === "entry" && fourth && fifth)
			return target(routes.entry(second, fourth, fifth));
		return null;
	}
	if (native && first === "r" && third && segments.length === 3) return target(routes.publicResume(second, third));
	if (
		segments.length === 2 &&
		!reserved.has(first.toLowerCase()) &&
		!(native && nativeReserved.has(first.toLowerCase()))
	)
		return target(routes.publicResume(first, second));
	return null;
}
