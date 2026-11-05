import { describe, expect, it } from "vite-plus/test";
import { locales } from "./config";
import { getTranslator, messageKeys, translate } from "./messages";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).toSorted();

describe("messages", () => {
	it("translates every key into every locale with the same placeholders", () => {
		for (const key of messageKeys) {
			const english = translate("en", key);
			for (const locale of locales) {
				const text = translate(locale, key);
				expect(text.trim(), `${locale} ${key}`).not.toBe("");
				expect(placeholders(text), `${locale} ${key}`).toEqual(placeholders(english));
			}
		}
	});

	it("fills placeholders and leaves unknown ones visible", () => {
		expect(getTranslator("id")("post.readingTime", { minutes: 4 })).toBe("4 menit baca");
		expect(translate("en", "post.readingTime")).toBe("{minutes} min read");
	});
});
