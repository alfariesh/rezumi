import type { PortfolioStatisticsResult } from "./csv";
import { describe, expect, it } from "vite-plus/test";
import { PORTFOLIO_CLICK_KINDS, PORTFOLIO_VISIT_SOURCES } from "@rezumi/schema/portfolio/statistics";
import { csvCell, dailyCsv, detailsCsv, statisticsCsvName, toCsv, worksCsv } from "./csv";

const counts = <K extends string>(keys: readonly K[], value = 0) =>
	Object.fromEntries(keys.map((key) => [key, value])) as Record<K, number>;

const statistics = (details: PortfolioStatisticsResult["details"]): PortfolioStatisticsResult => ({
	range: { days: 7, from: "2026-11-06", to: "2026-11-12" },
	days: [
		{
			date: "2026-11-12",
			views: 4,
			messages: 1,
			workOpens: 2,
			clicks: { ...counts(PORTFOLIO_CLICK_KINDS), vcard: 3 },
			sources: { ...counts(PORTFOLIO_VISIT_SOURCES), qr: 2 },
		},
	],
	totals: { views: 4, clicks: counts(PORTFOLIO_CLICK_KINDS), messages: 1 },
	sources: counts(PORTFOLIO_VISIT_SOURCES),
	works: [{ id: "w1", title: '=HYPERLINK("x"), "quoted"', opens: 2 }],
	details,
});

describe("statistics as CSV", () => {
	it("starts with a byte order mark, ends lines with CRLF", () => {
		const text = toCsv([
			["a", "b"],
			[1, 2],
		]);
		expect(text.startsWith("﻿")).toBe(true);
		expect(text).toBe("﻿a,b\r\n1,2\r\n");
	});

	it("keeps text that looks like a formula as text, and quotes what needs it", () => {
		expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
		expect(csvCell("+62 812")).toBe("'+62 812");
		expect(csvCell("-1")).toBe("'-1");
		expect(csvCell("@me")).toBe("'@me");
		expect(csvCell("\tTab")).toBe("'\tTab");
		expect(csvCell("a,b")).toBe('"a,b"');
		expect(csvCell('say "hi"')).toBe('"say ""hi"""');
		expect(csvCell("two\nlines")).toBe('"two\nlines"');
		expect(csvCell(42)).toBe("42");
		expect(csvCell(Number.NaN)).toBe("");
	});

	it("writes a column for every click kind and source", () => {
		const [header, row] = dailyCsv(statistics({ state: "locked" }))
			.slice(1)
			.split("\r\n");
		const columns = header?.split(",") ?? [];
		expect(columns.slice(0, 4)).toEqual(["date", "views", "messages", "work_opens"]);
		expect(columns).toContain("click_vcard");
		expect(columns).toContain("source_qr");
		expect(columns).toHaveLength(4 + PORTFOLIO_CLICK_KINDS.length + PORTFOLIO_VISIT_SOURCES.length);
		const values = row?.split(",") ?? [];
		expect(values[columns.indexOf("click_vcard")]).toBe("3");
		expect(values[columns.indexOf("source_qr")]).toBe("2");
	});

	it("writes the works with their titles made safe", () => {
		expect(worksCsv(statistics({ state: "locked" }))).toBe(
			'﻿work_id,title,opens\r\nw1,"\'=HYPERLINK(""x""), ""quoted""",2\r\n',
		);
	});

	it("writes the breakdown only when there is one", () => {
		expect(detailsCsv(statistics({ state: "locked" }))).toBeNull();
		const text = detailsCsv(
			statistics({
				state: "ready",
				countries: [{ code: "ID", views: 3 }],
				devices: [{ device: "mobile", views: 2 }],
				referrers: [{ domain: "linkedin.com", views: 1 }],
				workDays: [{ date: "2026-11-12", workId: "w1", title: "Kopi", opens: 1 }],
			}),
		);
		expect(text).toBe(
			"﻿section,key,value\r\ncountries,ID,3\r\ndevices,mobile,2\r\nreferrers,linkedin.com,1\r\nwork_days,2026-11-12 w1,1\r\n",
		);
	});

	it("names the files after the account and the days", () => {
		const range = { days: 7, from: "2026-11-06", to: "2026-11-12" } as const;
		expect(statisticsCsvName("Nadia.R", range, "daily")).toBe("portfolio-nadia-r-2026-11-06-2026-11-12-daily.csv");
	});
});
