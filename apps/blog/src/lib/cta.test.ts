import { describe, expect, it } from "vite-plus/test";
import { resolveCta } from "./cta";

describe("resolveCta", () => {
	it("keeps a known call to action and hides `none`", () => {
		expect(resolveCta("ats-checker")).toBe("ats-checker");
		expect(resolveCta("templates")).toBe("templates");
		expect(resolveCta("none")).toBeNull();
	});

	it("falls back to building a resume", () => {
		expect(resolveCta(undefined)).toBe("build-resume");
		expect(resolveCta("retired-option")).toBe("build-resume");
	});
});
