// Share's short time since, written with Lingui rather than `Intl.NumberFormat` units (wrong on Hermes).
import { i18n } from "@lingui/core";
import { formatTimeSince } from "./time-since";

const now = Date.UTC(2026, 10, 22, 12, 0, 0);
const ago = (ms: number) => new Date(now - ms);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

i18n.loadAndActivate({ locale: "en", messages: {} });

describe("formatTimeSince", () => {
	it("writes each unit short", () => {
		expect(formatTimeSince(ago(45 * MINUTE), now)).toBe("45m");
		expect(formatTimeSince(ago(2 * HOUR), now)).toBe("2h");
		expect(formatTimeSince(ago(3 * DAY), now)).toBe("3d");
		expect(formatTimeSince(ago(6 * 7 * DAY), now)).toBe("6w");
		expect(formatTimeSince(ago(400 * DAY), now)).toBe("1y");
	});

	it("says 0m for just now", () => {
		expect(formatTimeSince(ago(10_000), now)).toBe("0m");
	});
});
