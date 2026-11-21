import { describe, expect, it } from "vite-plus/test";
import { analyticsLocation } from "./analytics";

describe("analyticsLocation", () => {
	const origin = "https://rezumi.app";

	it("records the route pattern, not the ids in the path", () => {
		expect(analyticsLocation(origin, "/builder/$resumeId/", "")).toBe("https://rezumi.app/builder/$resumeId");
	});

	it("drops pathless layout segments and keeps the home page as /", () => {
		expect(analyticsLocation(origin, "/_home/", "")).toBe("https://rezumi.app/");
		expect(analyticsLocation(origin, "/_home/ats-checker", "")).toBe("https://rezumi.app/ats-checker");
	});

	it("keeps only campaign parameters from the query", () => {
		expect(analyticsLocation(origin, "/_home/", "?utm_source=blog&email=a%40b.c&gclid=x")).toBe(
			"https://rezumi.app/?utm_source=blog&gclid=x",
		);
	});
});
