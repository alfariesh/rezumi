/**
 * The page the browser opens when the extension is removed (`chrome.runtime.setUninstallURL`; aturan turunan #10, plan
 * `.agents/docs/plans/plugin-browser/00-keputusan.md`). It is a short "Why did you stop?" page on the Rezumi site. The
 * address carries only the page's language (so it matches the extension's) and the extension version: nothing about the
 * person, their account or the pages they visited.
 */
export function uninstallUrl(origin: string, language: "en" | "id", version: string): string {
	const url = new URL("/extension/removed", origin);
	url.searchParams.set("locale", language === "id" ? "id-ID" : "en-US");
	url.searchParams.set("v", version);
	return url.toString();
}
