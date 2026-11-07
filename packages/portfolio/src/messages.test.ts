import { describe, expect, it } from "vite-plus/test";
import { fillPortfolioMessage, PORTFOLIO_SOURCE_MESSAGES, portfolioMessages, portfolioViewMessages } from "./messages";
import portfolioCatalog from "./portfolio-catalog.json";

const placeholders = (message: string) => [...message.matchAll(/\{\w+\}/g)].map(([name]) => name).sort();

describe("fillPortfolioMessage", () => {
	it("puts a person's text in exactly as written", () => {
		const text = "Logo $& brand $$ kit $' {service}";
		expect(fillPortfolioMessage("Interested in: {service}", { service: text })).toBe(`Interested in: ${text}`);
	});

	it("fills every placeholder it has a value for and leaves the rest", () => {
		expect(fillPortfolioMessage("{count} of {count} by {owner}", { count: 3 })).toBe("3 of 3 by {owner}");
		expect(fillPortfolioMessage("{toString}", {})).toBe("{toString}");
	});
});

describe("portfolio page text", () => {
	it("asks about a service by its own name, whatever it contains", () => {
		const messages = portfolioViewMessages(portfolioMessages("en-US"));
		expect(messages.serviceInquiry("Logo $& kit")).toBe("Hello, I'm interested in your service: Logo $& kit");
	});

	it("shows a PDF's page count as a label and a number, without English plurals", () => {
		expect(fillPortfolioMessage(portfolioMessages("en-US").pages, { count: 1 })).toBe("Pages: 1");
		expect(fillPortfolioMessage(portfolioMessages("en-US").pages, { count: 12 })).toBe("Pages: 12");
	});

	it("keeps every placeholder of the English text in each translation", () => {
		for (const locale of Object.keys(portfolioCatalog)) {
			const messages = Object.values(portfolioMessages(locale));
			PORTFOLIO_SOURCE_MESSAGES.forEach((english, index) =>
				expect(placeholders(messages[index] ?? ""), `${locale}: ${english}`).toEqual(placeholders(english)),
			);
		}
	});
});
