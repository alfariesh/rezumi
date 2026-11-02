import type { CreditHistoryEntry } from "./credits";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";

vi.mock("@/libs/orpc/client", () => ({ orpc: {} }));
i18n.loadAndActivate({ locale: "en", messages: {} });

const { creditCount, describeCreditEntry } = await import("./credits");

const now = new Date("2026-11-10T00:00:00.000Z");
const day = (date: Date) => date.toISOString().slice(0, 10);
const grant = (extra: Partial<Extract<CreditHistoryEntry, { type: "grant" }>> = {}): CreditHistoryEntry => ({
	type: "grant",
	id: "g",
	at: new Date("2026-11-01T00:00:00.000Z"),
	source: "plan",
	amount: 100,
	remaining: 100,
	expiresAt: new Date("2026-12-01T00:00:00.000Z"),
	revokedAt: null,
	...extra,
});
const usage = (extra: Partial<Extract<CreditHistoryEntry, { type: "usage" }>> = {}): CreditHistoryEntry => ({
	type: "usage",
	id: "u",
	at: new Date("2026-11-05T00:00:00.000Z"),
	action: "tailor-resume",
	credits: 5,
	status: "committed",
	...extra,
});

describe("credit history lines", () => {
	it("counts credits in words", () => {
		expect(creditCount(1)).toBe("1 credit");
		expect(creditCount(100)).toBe("100 credits");
	});

	it("describes grants by where they came from and where they stand", () => {
		expect(describeCreditEntry(grant(), day, now)).toEqual({
			icon: "plus-circle",
			title: "Pro AI credits",
			detail: "Expires on 2026-12-01",
			amount: "+100",
		});
		expect(describeCreditEntry(grant({ source: "trial", amount: 5, remaining: 2 }), day, now).detail).toBe(
			"2 left, expires on 2026-12-01",
		);
		expect(describeCreditEntry(grant({ expiresAt: new Date("2026-11-09T00:00:00.000Z") }), day, now).detail).toBe(
			"Expired on 2026-11-09",
		);
		expect(describeCreditEntry(grant({ source: "admin", revokedAt: now }), day, now)).toMatchObject({
			title: "Added by Rezumi",
			detail: "Taken back on 2026-11-10",
		});
	});

	it("describes usage by the kind of work, and says when credits came back", () => {
		expect(describeCreditEntry(usage(), day, now)).toEqual({
			icon: "sparkle",
			title: "Resume tailoring",
			detail: "Used on 2026-11-05",
			amount: "−5",
		});
		expect(describeCreditEntry(usage({ status: "reserved" }), day, now).detail).toBe("In progress");
		expect(describeCreditEntry(usage({ status: "released" }), day, now).detail).toBe("Returned: no usable result");
		expect(describeCreditEntry(usage({ action: "admin-adjustment" }), day, now)).toMatchObject({
			icon: "minus",
			title: "Correction by Rezumi",
			detail: "Taken away on 2026-11-05",
		});
		expect(describeCreditEntry(usage({ action: "something-new" }), day, now).title).toBe("Rezumi AI");
	});
});
