import { describe, expect, it } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { PORTFOLIO_CHECK_IDS } from "@rezumi/portfolio/checkup";
import { describeFinding, findingPlace } from "./page-check";

i18n.loadAndActivate({ locale: "en", messages: {} });

describe("the page check's words and places", () => {
	it("has a title and a reason for every finding", () => {
		for (const id of PORTFOLIO_CHECK_IDS) {
			const { title, description } = describeFinding({ id, count: 2 });
			expect(title, id).not.toBe("");
			expect(description, id).not.toBe("");
		}
	});

	it("counts works and pictures in the title", () => {
		expect(describeFinding({ id: "work-cover", count: 1 }).title).toBe("1 work has no cover");
		expect(describeFinding({ id: "image-alt", count: 3 }).title).toBe("3 pictures have no description");
	});

	it("opens Contact for contact gaps, Work for a first work, and Content otherwise", () => {
		expect(findingPlace("contact")).toEqual({ tab: "write", section: "contact" });
		expect(findingPlace("whatsapp-number")).toEqual({ tab: "write", section: "contact" });
		expect(findingPlace("works")).toEqual({ tab: "work" });
		expect(findingPlace("headline")).toEqual({ tab: "write" });
	});
});
