import { describe, expect, it } from "vite-plus/test";
import { assertExtensionVersion, isOlderVersion } from "./extension-version";

describe("isOlderVersion", () => {
	it.each([
		["0.1.9", "0.2.0", true],
		["0.2.0", "0.2.0", false],
		["0.10.0", "0.9.9", false],
		["1.0.0", "0.9.9", false],
		["0.2.0", "0.2.1", true],
		["nonsense", "0.2.0", true],
	])("%s against %s → %s", (version, minimum, older) => {
		expect(isOlderVersion(version, minimum)).toBe(older);
	});
});

describe("assertExtensionVersion", () => {
	const extension = (version: string) => new Headers({ "x-rezumi-extension": version });

	it("refuses an extension older than the minimum with EXTENSION_OUTDATED", () => {
		expect(() => assertExtensionVersion(extension("0.1.0"), "0.2.0")).toThrow(
			expect.objectContaining({ code: "EXTENSION_OUTDATED", status: 426, data: { minimumVersion: "0.2.0" } }),
		);
	});

	it("serves current extensions, every version without a minimum, and requests without the header", () => {
		expect(() => assertExtensionVersion(extension("0.2.0"), "0.2.0")).not.toThrow();
		expect(() => assertExtensionVersion(extension("0.1.0"), undefined)).not.toThrow();
		expect(() => assertExtensionVersion(new Headers(), "9.9.9")).not.toThrow();
	});
});
