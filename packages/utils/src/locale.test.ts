import { describe, expect, it } from "vite-plus/test";
import { getLocaleAlternates, localizedUrl } from "./locale";

describe("locale URLs", () => {
	it("keeps the default locale on the plain address and puts others in the locale parameter", () => {
		expect(localizedUrl("https://rezumi.app/?locale=de-DE", "en-US")).toBe("https://rezumi.app/");
		expect(localizedUrl("https://rezumi.app/", "de-DE")).toBe("https://rezumi.app/?locale=de-DE");
	});

	it("lists valid hreflang alternates without the pseudo-locale", () => {
		const alternates = getLocaleAlternates("https://rezumi.app/");

		expect(alternates).toContainEqual({ hreflang: "x-default", href: "https://rezumi.app/" });
		expect(alternates).toContainEqual({ hreflang: "sr", href: "https://rezumi.app/?locale=sr-SP" });
		expect(alternates.map((alternate) => alternate.hreflang)).not.toContain("zu-ZA");
	});
});
