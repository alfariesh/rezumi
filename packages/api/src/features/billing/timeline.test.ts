import type { ScheduleChanges, ScheduledPeriod } from "./timeline";
import type { PaidPlanId } from "@rezumi/schema/billing";
import { describe, expect, it } from "vite-plus/test";
import { DAY_MS, revokePeriod, schedulePurchase } from "./timeline";

type Row = ScheduledPeriod & { revokedAt?: Date };

const D = 30 * DAY_MS;
const t0 = new Date("2026-11-02T07:00:00.000Z");
const at = (ms: number) => new Date(t0.getTime() + ms);
const days = (n: number) => n * DAY_MS;

let nextId = 0;
function row(planId: PaidPlanId, startsAt: Date, endsAt: Date, createdAt = startsAt): Row {
	nextId += 1;
	return { id: `p${String(nextId).padStart(3, "0")}`, planId, startsAt, endsAt, createdAt };
}

/** Applies changes the way periods.ts writes them: updates in place, new rows for the purchase and any rest. */
function apply(rows: Row[], changes: ScheduleChanges<Row>, now: Date, revoked?: { id: string; endsAt: Date }): Row[] {
	const result = rows.map((item) => {
		const update = changes.updates.find((change) => change.id === item.id);
		if (revoked?.id === item.id) return { ...item, endsAt: revoked.endsAt, revokedAt: now };
		return update ? { ...item, startsAt: update.startsAt, endsAt: update.endsAt } : item;
	});
	for (const insert of changes.inserts)
		result.push(row(insert.planId, insert.startsAt, insert.endsAt, insert.restOf?.createdAt ?? now));
	return result;
}

const scheduled = (rows: Row[], now: Date) => rows.filter((item) => !item.revokedAt && item.endsAt > now);

function buy(rows: Row[], planId: PaidPlanId, now: Date, durationMs = D) {
	return apply(rows, schedulePurchase(scheduled(rows, now), { planId, durationMs }, now), now);
}

/** The schedule from now on, as plan and day offsets from t0, for readable expectations. */
function timeline(rows: Row[], now: Date) {
	return scheduled(rows, now)
		.toSorted((a, b) => +a.startsAt - +b.startsAt)
		.map((item) => [item.planId, (+item.startsAt - +t0) / DAY_MS, (+item.endsAt - +t0) / DAY_MS]);
}

/** Unrevoked periods never overlap and the remaining ones run back to back from now. */
function expectConsistent(rows: Row[], now: Date) {
	const active = rows.filter((item) => !item.revokedAt).toSorted((a, b) => +a.startsAt - +b.startsAt);
	for (const [index, item] of active.entries()) {
		expect(+item.endsAt).toBeGreaterThan(+item.startsAt);
		const next = active[index + 1];
		if (next) expect(+next.startsAt).toBeGreaterThanOrEqual(+item.endsAt);
	}
	const upcoming = scheduled(rows, now).toSorted((a, b) => +a.startsAt - +b.startsAt);
	let cursor = upcoming[0] && upcoming[0].startsAt < now ? upcoming[0].endsAt : now;
	for (const item of upcoming.slice(upcoming[0] && upcoming[0].startsAt < now ? 1 : 0)) {
		expect(+item.startsAt).toBe(+cursor);
		cursor = item.endsAt;
	}
}

/** Paid time the account has had or still has, in days. */
const paidDays = (rows: Row[]) =>
	rows.filter((item) => !item.revokedAt).reduce((total, item) => total + (+item.endsAt - +item.startsAt), 0) / DAY_MS;

describe("schedulePurchase", () => {
	it("starts a pass now when there is none", () => {
		const changes = schedulePurchase([], { planId: "plus", durationMs: D }, t0);
		expect(changes.updates).toEqual([]);
		expect(changes.inserts).toEqual([{ planId: "plus", startsAt: t0, endsAt: at(D), restOf: null }]);
	});

	it("adds the same plan's days after the running pass", () => {
		const now = at(days(10));
		const plus = row("plus", t0, at(D));
		const rows = buy([plus], "plus", now);
		expect(timeline(rows, now)).toEqual([
			["plus", 0, 30],
			["plus", 30, 60],
		]);
		expect(rows[0]).toBe(plus);
		expectConsistent(rows, now);
	});

	it("starts a higher plan now and freezes the rest of the lower one until it ends", () => {
		const now = at(days(10));
		const plus = row("plus", t0, at(D));
		const changes = schedulePurchase([plus], { planId: "pro-ai", durationMs: D }, now);
		expect(changes.updates).toEqual([{ id: plus.id, startsAt: t0, endsAt: now }]);
		expect(changes.inserts).toEqual([
			{ planId: "pro-ai", startsAt: now, endsAt: at(days(40)), restOf: null },
			{ planId: "plus", startsAt: at(days(40)), endsAt: at(days(60)), restOf: plus },
		]);
		const rows = apply([plus], changes, now);
		expect(timeline(rows, now)).toEqual([
			["pro-ai", 10, 40],
			["plus", 40, 60],
		]);
		expect(paidDays(rows)).toBe(60);
		expectConsistent(rows, now);
	});

	it("queues a lower plan after the running higher one", () => {
		const now = at(days(20));
		const pro = row("pro-ai", t0, at(D));
		const changes = schedulePurchase([pro], { planId: "plus", durationMs: D }, now);
		expect(changes.updates).toEqual([]);
		expect(changes.inserts).toEqual([{ planId: "plus", startsAt: at(D), endsAt: at(days(60)), restOf: null }]);
	});

	it("puts a second Pro AI before queued Plus days", () => {
		const now = at(days(20));
		const pro = row("pro-ai", t0, at(D), t0);
		const plus = row("plus", at(D), at(days(50)), at(days(5)));
		const changes = schedulePurchase([pro, plus], { planId: "pro-ai", durationMs: D }, now);
		expect(changes.updates).toEqual([{ id: plus.id, startsAt: at(days(60)), endsAt: at(days(80)) }]);
		expect(changes.inserts).toEqual([{ planId: "pro-ai", startsAt: at(D), endsAt: at(days(60)), restOf: null }]);
		const rows = apply([pro, plus], changes, now);
		expect(timeline(rows, now)).toEqual([
			["pro-ai", 0, 30],
			["pro-ai", 30, 60],
			["plus", 60, 80],
		]);
		expectConsistent(rows, now);
	});

	it("keeps every paid day across three purchases in a row", () => {
		let rows = buy([], "plus", t0);
		rows = buy(rows, "plus", at(days(1)));
		rows = buy(rows, "pro-ai", at(days(2)));
		const now = at(days(2));
		expect(timeline(rows, now)).toEqual([
			["pro-ai", 2, 32],
			["plus", 32, 60],
			["plus", 60, 90],
		]);
		expect(paidDays(rows)).toBe(90);
		expectConsistent(rows, now);
		// The rest of the first pass keeps its purchase time, so it still comes before the second pass.
		const [rest, second] = scheduled(rows, now)
			.filter((item) => item.planId === "plus")
			.toSorted((a, b) => +a.startsAt - +b.startsAt);
		expect(rest?.createdAt).toEqual(t0);
		expect(second?.createdAt).toEqual(at(days(1)));
	});

	it("keeps passes in order through mixed purchases while time passes", () => {
		let rows: Row[] = [];
		const purchases: [PaidPlanId, number][] = [
			["plus", 0],
			["pro-ai", 3],
			["plus", 5],
			["pro-ai", 40],
			["plus", 41],
		];
		for (const [planId, day] of purchases) {
			rows = buy(rows, planId, at(days(day)));
			expectConsistent(rows, at(days(day)));
		}
		expect(paidDays(rows)).toBe(purchases.length * 30);
	});

	it("moves a pass that starts exactly now instead of cutting it", () => {
		const plus = row("plus", t0, at(D));
		const changes = schedulePurchase([plus], { planId: "pro-ai", durationMs: D }, t0);
		expect(changes.updates).toEqual([{ id: plus.id, startsAt: at(D), endsAt: at(days(60)) }]);
		expect(changes.inserts).toEqual([{ planId: "pro-ai", startsAt: t0, endsAt: at(D), restOf: null }]);
	});

	it("ignores periods that are already over", () => {
		const old = row("pro-ai", at(-days(60)), at(-days(30)));
		const changes = schedulePurchase([old], { planId: "plus", durationMs: D }, t0);
		expect(changes).toEqual({ updates: [], inserts: [{ planId: "plus", startsAt: t0, endsAt: at(D), restOf: null }] });
	});

	it("rejects a pass without a positive whole duration", () => {
		expect(() => schedulePurchase([], { planId: "plus", durationMs: 0 }, t0)).toThrow(RangeError);
		expect(() => schedulePurchase([], { planId: "plus", durationMs: 1.5 }, t0)).toThrow(RangeError);
	});
});

describe("revokePeriod", () => {
	it("ends a running pass now and moves the queued ones up", () => {
		const now = at(days(10));
		const pro = row("pro-ai", t0, at(D));
		const plus = row("plus", at(D), at(days(50)));
		const changes = revokePeriod([pro, plus], pro.id, now);
		expect(changes?.revoked).toEqual({ id: pro.id, startsAt: t0, endsAt: now });
		expect(changes?.updates).toEqual([{ id: plus.id, startsAt: now, endsAt: at(days(30)) }]);
		expect(changes?.inserts).toEqual([]);
		const rows = apply([pro, plus], changes ?? { updates: [], inserts: [] }, now, changes?.revoked);
		expect(timeline(rows, now)).toEqual([["plus", 10, 30]]);
		expectConsistent(rows, now);
	});

	it("drops a queued pass and moves the ones after it up", () => {
		const now = at(days(10));
		const pro = row("pro-ai", t0, at(D), t0);
		const queuedPro = row("pro-ai", at(D), at(days(60)), at(days(1)));
		const plus = row("plus", at(days(60)), at(days(80)), at(days(2)));
		const changes = revokePeriod([pro, queuedPro, plus], queuedPro.id, now);
		expect(changes?.revoked).toEqual({ id: queuedPro.id, startsAt: at(D), endsAt: at(days(60)) });
		expect(changes?.updates).toEqual([{ id: plus.id, startsAt: at(D), endsAt: at(days(50)) }]);
		const rows = apply([pro, queuedPro, plus], changes ?? { updates: [], inserts: [] }, now, changes?.revoked);
		expect(timeline(rows, now)).toEqual([
			["pro-ai", 0, 30],
			["plus", 30, 50],
		]);
		expectConsistent(rows, now);
	});

	it("returns null for a period that is over or not in the schedule", () => {
		const old = row("plus", at(-D), t0);
		expect(revokePeriod([old], old.id, t0)).toBeNull();
		expect(revokePeriod([], "missing", t0)).toBeNull();
	});
});
