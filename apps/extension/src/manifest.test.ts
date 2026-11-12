import { describe, expect, it } from "vite-plus/test";
import { buildManifest, JOB_BOARD_MATCHES, MINIMUM_CHROME_VERSION } from "../manifest.config";

describe("buildManifest", () => {
	const manifest = buildManifest({ version: "1.2.3", rezumiUrl: "https://rezumi.app" });

	it("is a Manifest V3 extension with a side panel, a module worker and localized texts", () => {
		expect(manifest).toMatchObject({
			manifest_version: 3,
			version: "1.2.3",
			name: "__MSG_extName__",
			default_locale: "en",
			minimum_chrome_version: MINIMUM_CHROME_VERSION,
			side_panel: { default_path: "sidepanel.html" },
			background: { service_worker: "background.js", type: "module" },
		});
	});

	it("asks only for the permissions with a written reason (02-teknis.md §12)", () => {
		expect(manifest.permissions).toEqual([
			"sidePanel",
			"storage",
			"identity",
			"activeTab",
			"scripting",
			"contextMenus",
			"alarms",
		]);
		expect(manifest.optional_permissions).toEqual(["notifications"]);
		expect(manifest.host_permissions).toEqual([...JOB_BOARD_MATCHES, "https://rezumi.app/*"]);
		expect(JSON.stringify(manifest)).not.toMatch(
			/externally_connectable|web_accessible_resources|<all_urls>|"tabs"|history|webNavigation/,
		);
	});

	it("runs the content script on the four boards only", () => {
		expect(manifest.content_scripts).toEqual([
			{ matches: [...JOB_BOARD_MATCHES], js: ["content.js"], run_at: "document_idle" },
		]);
	});

	it("follows the build's server and carries the store key only when given", () => {
		const dev = buildManifest({ version: "1.2.3", rezumiUrl: "http://localhost:3000", key: "MIIB" });
		expect(dev.host_permissions).toContain("http://localhost:3000/*");
		expect(dev.key).toBe("MIIB");
		expect(manifest).not.toHaveProperty("key");
	});
});
