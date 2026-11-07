import type { PortfolioPlaceContext } from "./save-problem";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { ORPCError } from "@orpc/client";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { describeSaveProblem, pathOfValue, problemPlace } from "./save-problem";

const key = "uploads/u1/pictures/portfolio/cover.webp";

const context: PortfolioPlaceContext = {
	data: parsePortfolioData({
		works: {
			items: [
				{ id: "w1", slug: "kopi", title: "Kopi Senja" },
				{
					id: "w2",
					slug: "toko",
					title: "",
					cover: { key, width: 1200, height: 800, alt: "" },
				},
			],
		},
		services: { items: [{ id: "s1", title: "Logo design", description: "", cta: { kind: "contact" } }] },
		custom: [{ id: "c1", title: "How I work", content: "", hidden: false }],
		sections: { titles: { contact: "Say hello" } },
	}),
	resume: null,
	messages: portfolioViewMessages(portfolioMessages("en-US")),
};

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

describe("the place of a save problem", () => {
	it("names the part of the editor and what to open", () => {
		expect(problemPlace(["hero", "greeting"], context)).toEqual({
			label: "Intro → Greeting",
			reveal: { tab: "write" },
		});
		expect(problemPlace(["hero", "effect", "phrases", 0], context)).toEqual({
			label: "Intro → Intro effect",
			reveal: { tab: "design" },
		});
		expect(problemPlace(["works", "items", 0, "blocks", 3, "html"], context)).toEqual({
			label: "Work → Kopi Senja",
			reveal: { tab: "write", section: "work", workId: "w1" },
		});
		expect(problemPlace(["services", "items", 0, "title"], context)?.label).toBe("Services → Logo design");
		expect(problemPlace(["custom", 0, "content"], context)).toEqual({
			label: "How I work",
			reveal: { tab: "write", section: "custom:c1" },
		});
		expect(problemPlace(["contact", "note"], context)?.label).toBe("Say hello");
		expect(problemPlace(["location", "timezone"], context)?.label).toBe("Say hello → Location");
		expect(problemPlace(["seo", "title"], context)).toEqual({ label: "Search engines", reveal: { tab: "share" } });
		expect(problemPlace(["version"], context)).toBeNull();
	});
});

describe("save problems in words", () => {
	it("say where a refused value is", () => {
		expect(describeSaveProblem({ kind: "field", path: ["hero", "greeting"] }, context)).toEqual({
			message: "Something in Intro → Greeting can't be saved as it is. Change or remove it, or undo your last change.",
			place: { label: "Intro → Greeting", reveal: { tab: "write" } },
		});
	});

	it("find the work that uses a missing file", () => {
		const { message, place } = describeSaveProblem({ kind: "file-missing", key }, context);
		expect(message).toBe(
			"A picture or file in your portfolio isn't available anymore. Remove it, then upload it again.",
		);
		expect(place).toEqual({
			label: "Work → Untitled work",
			reveal: { tab: "write", section: "work", workId: "w2" },
		});
		expect(pathOfValue(context.data, key)).toEqual(["works", "items", 1, "cover", "key"]);
	});

	it("give the sizes of data that's too large, and word other refusals without the server's English", () => {
		expect(describeSaveProblem({ kind: "too-large", bytes: 300 * 1024, max: 256 * 1024 }, context).message).toBe(
			"Your portfolio is too large to save (300 KB of 256 KB). Shorten some text or remove a few blocks.",
		);
		const refusal = new ORPCError("SOMETHING_NEW", { status: 403, message: "Server English" });
		expect(describeSaveProblem({ kind: "refused", error: refusal }, context).message).not.toContain("Server English");
		expect(describeSaveProblem({ kind: "gone", code: "NOT_FOUND" }, context).message).toBe(
			"This portfolio doesn't exist anymore. It may have been deleted in another tab.",
		);
	});
});
