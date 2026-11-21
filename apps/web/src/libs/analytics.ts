import type { AnyRouter } from "@tanstack/react-router";

type Gtag = (command: "event", name: string, params: Record<string, string>) => void;

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
	const gtag = (globalThis as { gtag?: Gtag }).gtag;
	if (typeof gtag !== "function") return;

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
	};

	router.subscribe("onResolved", send);
	if (router.state.status === "idle" && router.state.matches.length > 0) send();
}
