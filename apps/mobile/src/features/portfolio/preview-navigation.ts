type PreviewPage = { origin: string; homePath: string; works: { id: string; path: string }[] };

type Navigation =
	| { kind: "load" }
	| { kind: "ignore" }
	| { kind: "preview"; workId?: string }
	| { kind: "external"; url: string };

export function previewNavigation(address: string, base: string, page: PreviewPage): Navigation {
	if (address === "about:blank" || address === base) return { kind: "load" };
	let url: URL;
	try {
		url = new URL(address);
	} catch {
		return { kind: "ignore" };
	}
	if (url.username || url.password) return { kind: "ignore" };
	if (url.protocol === "mailto:" || url.protocol === "tel:") return { kind: "external", url: url.href };
	if (!["https:", "http:"].includes(url.protocol)) return { kind: "ignore" };
	if (url.origin === new URL(base).origin) return { kind: "ignore" };
	if (url.origin === page.origin) {
		// Owner-only media URLs belong to the preview. Never hand them to a browser or another app.
		if (url.searchParams.has("preview")) return { kind: "ignore" };
		if (!url.search && !url.hash) {
			if (url.pathname === page.homePath) return { kind: "preview" };
			const work = page.works.find((item) => item.path === url.pathname);
			if (work) return { kind: "preview", workId: work.id };
		}
	}
	return { kind: "external", url: url.href };
}
