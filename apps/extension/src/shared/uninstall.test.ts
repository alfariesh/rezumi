import { describe, expect, it } from "vite-plus/test";
import { uninstallUrl } from "./uninstall";

describe("uninstallUrl (aturan turunan #10)", () => {
	it("opens the Why-did-you-stop page in the extension's language, with the version only", () => {
		expect(uninstallUrl("https://rezumi.app", "id", "1.0.0")).toBe(
			"https://rezumi.app/extension/removed?locale=id-ID&v=1.0.0",
		);
		expect(uninstallUrl("https://rezumi.app", "en", "1.2.3")).toBe(
			"https://rezumi.app/extension/removed?locale=en-US&v=1.2.3",
		);
	});

	it("follows the build's server, so development builds never send anyone to production", () => {
		expect(uninstallUrl("http://localhost:3000", "en", "0.1.0")).toBe(
			"http://localhost:3000/extension/removed?locale=en-US&v=0.1.0",
		);
	});
});
