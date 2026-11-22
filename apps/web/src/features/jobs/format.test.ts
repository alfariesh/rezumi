import { beforeAll, describe, expect, it } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { salaryLabel, sourceLabel } from "./format";

beforeAll(() => i18n.loadAndActivate({ locale: "en-US", messages: {} }));

describe("salaryLabel", () => {
	it("shows the listed range in its own currency and period", () => {
		expect(salaryLabel({ min: 70_000, max: 85_000, currency: "GBP", period: "year" }, "en-GB")).toBe(
			"£70k–£85k a year",
		);
		expect(salaryLabel({ min: 25, currency: "USD", period: "hour" }, "en-US")).toBe("$25 an hour");
		expect(salaryLabel({ max: 4_000, currency: "EUR", period: "month" }, "en-US")).toBe("€4,000 a month");
	});

	it("shows nothing for a listing without pay", () => {
		expect(salaryLabel(undefined, "en-US")).toBeNull();
		expect(salaryLabel({ currency: "USD", period: "year" }, "en-US")).toBeNull();
	});
});

describe("sourceLabel", () => {
	it("says where the listing was found", () => {
		expect(sourceLabel({ source: "greenhouse" })).toBe("via the company's careers site");
		expect(sourceLabel({ source: "linkedin" })).toBe("via LinkedIn");
		expect(sourceLabel({})).toBeNull();
	});
});
