// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, hash, className }: { children: unknown; to: string; hash?: string; className?: string }) => (
		<a href={hash ? `${to}#${hash}` : to} className={className}>
			{children as never}
		</a>
	),
}));

i18n.loadAndActivate({ locale: "en", messages: {} });
const { ExtensionInstallButton, ExtensionInstallHint } = await import("./install-links");
const { ExtensionRemovedPage } = await import("./removed-page");
const { BrowserExtensionSection } = await import("../settings/ai/browser-extension");

const chromeAgent =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const edgeAgent = `${chromeAgent} Edg/131.0.0.0`;
const firefoxAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0";
const published = {
	chrome: "https://chromewebstore.google.com/detail/rezumi/fiogmglhgeiaaeajahbpmmehgmojbjjo",
	edge: "https://microsoftedge.microsoft.com/addons/detail/rezumi/0RDCKG7TD477",
};
const unpublished = { chrome: "", edge: "" };

function withBrowser(userAgent: string) {
	vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
}

const view = (node: React.ReactNode) => render(<I18nProvider i18n={i18n}>{node}</I18nProvider>);

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("while the extension isn't published (empty store addresses)", () => {
	it("shows no invitation anywhere", () => {
		withBrowser(chromeAgent);
		view(
			<>
				<ExtensionInstallButton urls={unpublished} />
				<ExtensionInstallHint urls={unpublished} />
				<BrowserExtensionSection urls={unpublished} />
			</>,
		);

		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.queryByText(/browser extension/i)).toBeNull();
	});

	it("is the real default: both addresses in the shipped constant are empty until Phase 07", async () => {
		const { EXTENSION_STORE_URLS } = await import("./install");
		expect(EXTENSION_STORE_URLS).toEqual({ chrome: "", edge: "" });
	});
});

describe("once published", () => {
	it("gives Chrome the Chrome Web Store button", () => {
		withBrowser(chromeAgent);
		view(<ExtensionInstallButton urls={published} />);

		const link = screen.getByRole("link", { name: "Add to Chrome" });
		expect(link.getAttribute("href")).toBe(published.chrome);
		expect(link.getAttribute("rel")).toContain("noopener");
	});

	it("gives Edge the Edge Add-ons button", () => {
		withBrowser(edgeAgent);
		view(<ExtensionInstallButton urls={published} />);

		expect(screen.getByRole("link", { name: "Add to Edge" }).getAttribute("href")).toBe(published.edge);
	});

	it("offers the hint link only where the browser can install it", () => {
		withBrowser(chromeAgent);
		const { unmount } = view(<ExtensionInstallHint urls={published} />);
		expect(
			screen.getByRole("link", { name: /Save in one click with the browser extension/ }).getAttribute("href"),
		).toBe(published.chrome);
		unmount();

		withBrowser(firefoxAgent);
		view(<ExtensionInstallHint urls={published} />);
		expect(screen.queryByRole("link")).toBeNull();
	});

	it("tells a browser that can't install it where to go, in Settings", () => {
		withBrowser(firefoxAgent);
		view(<BrowserExtensionSection urls={published} />);

		expect(screen.getByText(/Open Rezumi in Chrome or Edge on a computer/)).toBeTruthy();
		expect(screen.getByRole("link", { name: /Chrome Web Store/ }).getAttribute("href")).toBe(published.chrome);
		expect(screen.getByRole("link", { name: /Edge Add-ons/ }).getAttribute("href")).toBe(published.edge);
		expect(screen.queryByRole("link", { name: /Add to/ })).toBeNull();
	});

	it("shows the store button and the guide in Settings", () => {
		withBrowser(edgeAgent);
		view(<BrowserExtensionSection urls={published} />);

		expect(screen.getByRole("link", { name: "Add to Edge" })).toBeTruthy();
		expect(screen.getByRole("link", { name: /How saving from your browser works/ }).getAttribute("href")).toBe(
			"/docs/guides/saving-jobs-from-your-browser",
		);
	});
});

describe("the page after the extension is removed", () => {
	it("asks for nothing: no form, no field, an email link and the way to revoke access", () => {
		withBrowser(chromeAgent);
		const { container } = view(<ExtensionRemovedPage urls={unpublished} />);

		expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("The Rezumi extension was removed");
		expect(container.querySelector("form, input, textarea, select")).toBeNull();
		expect(screen.getByRole("link", { name: /Email hi@rezumi\.app/ }).getAttribute("href")).toBe(
			"mailto:hi@rezumi.app?subject=Rezumi%20browser%20extension%20feedback",
		);
		expect(screen.getByRole("link", { name: "Open Connected applications" }).getAttribute("href")).toBe(
			"/dashboard/settings/app#connected-apps",
		);
		// Not published yet: no reinstall button either.
		expect(screen.queryByRole("link", { name: /Add to/ })).toBeNull();
	});

	it("offers to reinstall once published", () => {
		withBrowser(chromeAgent);
		view(<ExtensionRemovedPage urls={published} />);

		expect(screen.getByRole("link", { name: "Add to Chrome" }).getAttribute("href")).toBe(published.chrome);
	});
});
