import { describe, expect, it } from "vite-plus/test";
import { shouldAdoptDeviceTimeZone } from "./timezone";

const now = Date.parse("2026-11-12T08:00:00Z");
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000);

describe("adopting the device's timezone", () => {
	it("happens for a new account still on the default UTC, on a device elsewhere", () => {
		expect(shouldAdoptDeviceTimeZone({ id: "u", timezone: "UTC", createdAt: minutesAgo(2) }, "Asia/Jakarta", now)).toBe(
			true,
		);
		expect(shouldAdoptDeviceTimeZone({ id: "u", createdAt: minutesAgo(2).toISOString() }, "Asia/Jakarta", now)).toBe(
			true,
		);
	});

	it("leaves older accounts, chosen zones and UTC devices alone", () => {
		expect(
			shouldAdoptDeviceTimeZone({ id: "u", timezone: "UTC", createdAt: minutesAgo(45) }, "Asia/Jakarta", now),
		).toBe(false);
		expect(
			shouldAdoptDeviceTimeZone({ id: "u", timezone: "Europe/Berlin", createdAt: minutesAgo(2) }, "Asia/Jakarta", now),
		).toBe(false);
		expect(shouldAdoptDeviceTimeZone({ id: "u", timezone: "UTC", createdAt: minutesAgo(2) }, "UTC", now)).toBe(false);
		expect(shouldAdoptDeviceTimeZone({ id: "u", timezone: "UTC", createdAt: minutesAgo(2) }, null, now)).toBe(false);
	});
});
