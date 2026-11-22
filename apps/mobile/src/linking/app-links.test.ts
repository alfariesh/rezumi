// The pages the system hands to the app (iOS: the server's apple-app-site-association; Android: `intentFilters` in
// app.config.ts) and the deep-link map must agree: every such page opens an app screen, every settings page the map
// can show is handed over, and billing and admin stay on the web.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import config from "../../app.config";
import { parseDeepLink } from "./parse";
import { DEFAULT_SERVER } from "@/auth/session";

type IntentData = { path?: string; pathPrefix?: string };

const serverSource = readFileSync(join(__dirname, "../../../server/src/http/app-links.ts"), "utf8");
const strings = (source: string | undefined) =>
	[...(source ?? "").matchAll(/"([^"]+)"/g)].flatMap((match) => (match[1] ? [match[1]] : []));
/** APP_LINK_PREFIXES, read from the server's source (the server is not a dependency of the app). */
const serverPrefixes = strings(/const APP_LINK_PREFIXES = \[([^\]]*)\]/.exec(serverSource)?.[1]);
/** The other patterns before the NOT rules: exact paths and `/builder/*`. */
const serverPaths = strings(/paths: \[([^\]]*)\]/.exec(serverSource)?.[1]).filter((path) => !path.startsWith("NOT "));

const data = (config.android?.intentFilters?.[0]?.data ?? []) as IntentData[];
const androidPrefixes = data.flatMap((entry) => (entry.pathPrefix?.startsWith("/dashboard") ? [entry.pathPrefix] : []));
const androidPaths = data.flatMap((entry) => (entry.path ? [entry.path] : []));

const opens = (path: string) => parseDeepLink(`${DEFAULT_SERVER}${path}`, DEFAULT_SERVER)?.kind === "target";

describe("app links", () => {
	it("hands the same pages to the app on iOS and Android", () => {
		expect(serverPrefixes.length).toBeGreaterThan(0);
		expect(androidPrefixes).toEqual(serverPrefixes);
		expect(serverPaths.filter((path) => !path.endsWith("*")).toSorted()).toEqual(androidPaths.toSorted());
		expect(serverPaths).toContain("/builder/*");
		expect(data).toContainEqual(expect.objectContaining({ pathPrefix: "/builder/" }));
	});

	it.each(serverPrefixes)("%s opens an app screen", (prefix) => {
		expect(opens(prefix)).toBe(true);
	});

	it("hands over every settings page the app has a screen for, and leaves billing and admin to the web", () => {
		const pages = [
			"account",
			"profile",
			"authentication",
			"preferences",
			"app",
			"job-search",
			"ai",
			"api-keys",
			"integrations",
		];
		for (const page of pages) {
			const path = `/dashboard/settings/${page}`;
			expect({ path, opens: opens(path), listed: serverPrefixes.includes(path) }).toEqual({
				path,
				opens: true,
				listed: true,
			});
		}
		for (const path of ["/dashboard/settings/billing", "/dashboard/admin"])
			expect(serverPrefixes.some((prefix) => path.startsWith(prefix))).toBe(false);
	});
});
