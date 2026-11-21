import type { AuthSession } from "@rezumi/auth/types";
import type { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";
import { sessionQueryKey } from "./root-context";

type Gtag = (command: "event", name: string, params: Record<string, unknown>) => void;

/** The tag's `gtag`, when the server put it on the page (apps/server/src/static/web.ts → `analyticsTag`). */
function getGtag() {
	const gtag = (globalThis as { gtag?: Gtag }).gtag;
	return typeof gtag === "function" ? gtag : undefined;
}

/**
 * Sends a Google Analytics event when the tag is on the page; nothing otherwise. Never pass names, emails, resume text or
 * ids that identify a person: Google's terms forbid it and the privacy policy promises it.
 */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
	getGtag()?.("event", name, params);
}

// An account this recent, seen for the first time in this browser, has just signed up (time to confirm the email included).
const NEW_ACCOUNT_MS = 60 * 60_000;

/**
 * Sends `sign_up` once for an account created in the last hour, whichever way it signed up (email, a social
 * provider or a passkey all land on the app signed in). Remembered per account in this browser, so a reload or a second
 * tab doesn't count it again; only the time decides, so a sign-up on another device isn't counted here.
 */
export function trackSignUp(session: AuthSession | null | undefined, now = Date.now()) {
	const user = session?.user;
	if (!user || now - new Date(user.createdAt).getTime() > NEW_ACCOUNT_MS) return;
	const key = `rezumi:analytics:signed-up:${user.id}`;
	try {
		if (localStorage.getItem(key)) return;
		localStorage.setItem(key, "1");
	} catch {
		// Without storage a reload could count it twice; that's rarer than losing every sign-up.
	}
	trackEvent("sign_up");
}

// Query parameters that say where a visit came from; everything else in the address stays out of analytics.
const CAMPAIGN_PARAMS = /^(utm_[a-z_]+|gclid|gbraid|wbraid|ref)$/;

/**
 * The address analytics records for a page: the matched route's pattern (`/builder/$resumeId`), never the resume ids,
 * usernames or slugs in the real path, plus only the campaign parameters of the query.
 */
export function analyticsLocation(origin: string, routeId: string, search: string) {
	const path =
		routeId
			.replace(/^\/__root__/, "")
			.replace(/\/_[^/]+/g, "")
			.replace(/(.)\/$/, "$1") || "/";
	const params = new URLSearchParams(search);
	const kept = new URLSearchParams([...params].filter(([key]) => CAMPAIGN_PARAMS.test(key)));
	const query = kept.toString();
	return `${origin}${path}${query ? `?${query}` : ""}`;
}

/**
 * Sends a Google Analytics page view after each navigation that changes the path, when the server put the tag on the
 * page (apps/server/src/static/web.ts → `analyticsTag`). The title is the route pattern too, since page titles carry
 * resume names.
 */
export function trackPageViews(router: AnyRouter) {
	const gtag = getGtag();
	if (!gtag) return;
	const queryClient = (router.options.context as { queryClient?: QueryClient }).queryClient;

	let lastPath: string | undefined;
	// The first page's referrer is the site the visitor came from; after that, the page before inside the app.
	let referrer = document.referrer;
	const send = () => {
		const { location, matches } = router.state;
		if (location.pathname === lastPath) return;
		lastPath = location.pathname;
		const routeId = matches.at(-1)?.routeId ?? location.pathname;
		const pageLocation = analyticsLocation(window.location.origin, routeId, window.location.search);
		gtag("event", "page_view", {
			page_location: pageLocation,
			page_title: new URL(pageLocation).pathname,
			page_referrer: referrer,
		});
		referrer = pageLocation;
		trackSignUp(queryClient?.getQueryData<AuthSession | null>(sessionQueryKey));
	};

	router.subscribe("onResolved", send);
	if (router.state.status === "idle" && router.state.matches.length > 0) send();
}
