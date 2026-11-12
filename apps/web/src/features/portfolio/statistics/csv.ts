import type { RouterOutput } from "@/libs/orpc/client";
import { PORTFOLIO_CLICK_KINDS, PORTFOLIO_VISIT_SOURCES } from "@rezumi/schema/portfolio/statistics";

export type PortfolioStatisticsResult = NonNullable<RouterOutput["portfolio"]["statistics"]>;

/** What a CSV download holds (Phase 13 3.7): the days, the works, or the breakdown (Plus). */
export type StatisticsCsvKind = "daily" | "works" | "details";

/** Characters a spreadsheet reads as the start of a formula when a cell begins with one. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One cell: numbers as they are; text with a leading `'` when a spreadsheet would read it as a formula (a work
 * titled "=HYPERLINK(…)" stays text), and quoted when it holds a comma, a quote or a line break.
 */
export function csvCell(value: string | number): string {
	if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
	const text = FORMULA_START.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** A CSV file's text: UTF-8 byte order mark (Excel then reads accents and other scripts), commas, CRLF line ends. */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
	return `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** Every day of the range: visits, messages, works opened, each click kind and each source. */
export function dailyCsv(statistics: PortfolioStatisticsResult): string {
	const header = [
		"date",
		"views",
		"messages",
		"work_opens",
		...PORTFOLIO_CLICK_KINDS.map((kind) => `click_${kind}`),
		...PORTFOLIO_VISIT_SOURCES.map((source) => `source_${source}`),
	];
	const rows = statistics.days.map((day) => [
		day.date,
		day.views,
		day.messages,
		day.workOpens,
		...PORTFOLIO_CLICK_KINDS.map((kind) => day.clicks[kind]),
		...PORTFOLIO_VISIT_SOURCES.map((source) => day.sources[source]),
	]);
	return toCsv([header, ...rows]);
}

/** Every work opened in the range, most opened first. */
export function worksCsv(statistics: PortfolioStatisticsResult): string {
	return toCsv([["work_id", "title", "opens"], ...statistics.works.map((work) => [work.id, work.title, work.opens])]);
}

/** The breakdown (countries, devices, linking sites, works by day) as section, key, value; null without one. */
export function detailsCsv(statistics: PortfolioStatisticsResult): string | null {
	const { details } = statistics;
	if (details.state !== "ready") return null;
	return toCsv([
		["section", "key", "value"],
		...details.countries.map((row) => ["countries", row.code, row.views]),
		...details.devices.map((row) => ["devices", row.device, row.views]),
		...details.referrers.map((row) => ["referrers", row.domain, row.views]),
		...details.workDays.map((row) => ["work_days", `${row.date} ${row.workId}`, row.opens]),
	]);
}

/** `portfolio-<username>-<from>-<to>-<kind>.csv`, the username as letters, digits and dashes. */
export function statisticsCsvName(
	username: string,
	range: PortfolioStatisticsResult["range"],
	kind: StatisticsCsvKind,
) {
	const who =
		username
			.toLowerCase()
			.replace(/[^\da-z-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "me";
	return `portfolio-${who}-${range.from}-${range.to}-${kind}.csv`;
}
