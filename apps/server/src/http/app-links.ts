import { env } from "@rezumi/env/server";

/** Web pages under /dashboard that open their app screen in the mobile app. */
const APP_LINK_PREFIXES = [
	"/dashboard/career",
	"/dashboard/documents",
	"/dashboard/resumes",
	"/dashboard/cover-letters",
	"/dashboard/trash",
	"/dashboard/applications",
	"/dashboard/jobs",
	"/dashboard/coach",
	"/dashboard/profile",
	"/dashboard/portfolio",
	"/dashboard/settings/account",
	"/dashboard/settings/profile",
	"/dashboard/settings/preferences",
	"/dashboard/settings/app",
	"/dashboard/settings/ai",
];

export function handleAppleAppSiteAssociation() {
	if (!env.MOBILE_IOS_APP_IDS.length) return new Response(null, { status: 404 });
	return Response.json({
		applinks: {
			apps: [],
			details: env.MOBILE_IOS_APP_IDS.map((appID) => ({
				appID,
				// The pages with an app screen (plans/mobile 02-teknis 7), in step with `intentFilters` in
				// apps/mobile/app.config.ts. Billing and admin stay on the web: a checkout returning to
				// /dashboard/settings/billing must not open the app.
				paths: [
					"/auth/native-callback",
					"/auth/reset-password",
					"/builder/*",
					"/dashboard",
					"/dashboard/",
					...APP_LINK_PREFIXES.map((prefix) => `${prefix}*`),
					"NOT /auth/*",
					"NOT /api/*",
					"NOT /mcp/*",
					"NOT /uploads/*",
					"NOT /dashboard/*",
					"NOT /.well-known/*",
					"NOT /templates/*",
					"NOT /agent/*",
				],
			})),
		},
		webcredentials: { apps: env.MOBILE_IOS_APP_IDS },
	});
}

export function handleAndroidAssetLinks() {
	if (!env.MOBILE_ANDROID_PACKAGES.length || !env.MOBILE_ANDROID_CERT_SHA256.length)
		return new Response(null, { status: 404 });
	return Response.json(
		env.MOBILE_ANDROID_PACKAGES.map((packageName) => ({
			relation: ["delegate_permission/common.handle_all_urls"],
			target: {
				namespace: "android_app",
				package_name: packageName,
				sha256_cert_fingerprints: env.MOBILE_ANDROID_CERT_SHA256,
			},
		})),
	);
}
