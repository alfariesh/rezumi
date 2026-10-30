import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const serverRequire = createRequire(new URL("../../server/package.json", import.meta.url));
const { transformSync } = createRequire(serverRequire.resolve("tsx"))("esbuild");
const utilsRequire = createRequire(new URL("../../../packages/utils/package.json", import.meta.url));

function load(url, mocks = {}) {
	const module = { exports: {} };
	const code = transformSync(readFileSync(url, "utf8"), { loader: "ts", format: "cjs" }).code;
	new Function("require", "module", "exports", code)(
		(name) => {
			assert.ok(name in mocks, "Missing boundary: " + name);
			return mocks[name];
		},
		module,
		module.exports,
	);
	return module.exports;
}

// The real timezone maths: week and day views place interviews by wall clock on the user's timezone.
const timezone = load(new URL("../../../packages/utils/src/timezone.ts", import.meta.url), {
	zod: utilsRequire("zod"),
});
const schedule = load(new URL("../src/features/reminders/schedule.ts", import.meta.url), {
	"@rezumi/utils/timezone": timezone,
});
const calendar = load(new URL("../src/features/applications-board/calendar.ts", import.meta.url), {
	"../reminders/schedule.ts": schedule,
});

const interview = (id, at, durationMinutes = 60) => ({
	id,
	type: "interview",
	at,
	kind: "technical",
	durationMinutes,
	location: "",
	notes: "",
	timezone: "Europe/Berlin",
});
const application = (id, activity) => ({ id, status: "interview", company: id, role: "Engineer", activity });

test("visibleDays: a 7-day week starts on the locale's first day; shorter spans start on the anchor", () => {
	// 2026-10-21 is a Wednesday.
	assert.deepEqual(calendar.visibleDays("2026-10-21", 7, 1), [
		"2026-10-19",
		"2026-10-20",
		"2026-10-21",
		"2026-10-22",
		"2026-10-23",
		"2026-10-24",
		"2026-10-25",
	]);
	assert.equal(calendar.visibleDays("2026-10-21", 7, 0)[0], "2026-10-18");
	assert.deepEqual(calendar.visibleDays("2026-10-31", 3, 1), ["2026-10-31", "2026-11-01", "2026-11-02"]);
	assert.deepEqual(calendar.visibleDays("2026-10-21", 1, 1), ["2026-10-21"]);
	assert.equal(calendar.addDays("2026-12-31", 1), "2027-01-01");
	assert.equal(calendar.addDays("2026-03-01", -1), "2026-02-28");
});

test("placeDay: interviews sit at their wall-clock minute on the user's timezone and overlaps share lanes", () => {
	const apps = [
		application("a", [interview("i1", "2026-10-21T07:00:00Z", 60), interview("i2", "2026-10-21T07:30:00Z", 30)]),
		application("b", [interview("i3", "2026-10-21T08:15:00Z", 45), interview("i4", "2026-10-21T12:00:00Z", 30)]),
	];
	const events = calendar.collectEvents(apps, "Europe/Berlin");
	const placed = calendar.placeDay(events, "2026-10-21", "Europe/Berlin");
	const byId = Object.fromEntries(placed.map((item) => [item.event.interview.id, item]));
	// Berlin is UTC+2 on 21 October: 07:00Z is 09:00 (540).
	assert.deepEqual(
		{ top: byId.i1.top, bottom: byId.i1.bottom, lane: byId.i1.lane, lanes: byId.i1.lanes },
		{ top: 540, bottom: 600, lane: 0, lanes: 2 },
	);
	assert.deepEqual({ lane: byId.i2.lane, lanes: byId.i2.lanes }, { lane: 1, lanes: 2 });
	// 10:15 starts after both have ended: a new cluster with one lane.
	assert.deepEqual({ top: byId.i3.top, lane: byId.i3.lane, lanes: byId.i3.lanes }, { top: 615, lane: 0, lanes: 1 });
	assert.equal(byId.i4.top, 14 * 60);
	assert.equal(calendar.placeDay(events, "2026-10-22", "Europe/Berlin").length, 0);
});

test("placeDay: a late interview is cut at midnight and a closed application stays off the grid", () => {
	const events = calendar.collectEvents(
		[
			application("a", [interview("late", "2026-10-21T21:30:00Z", 90)]),
			{ ...application("closed", [interview("gone", "2026-10-21T08:00:00Z")]), status: "closed" },
		],
		"Europe/Berlin",
	);
	const [late, ...rest] = calendar.placeDay(events, "2026-10-21", "Europe/Berlin");
	assert.equal(rest.length, 0);
	assert.deepEqual({ top: late.top, bottom: late.bottom }, { top: 23 * 60 + 30, bottom: 24 * 60 });
});

test("movedSlot snaps to 15 minutes and keeps the interview inside its new day", () => {
	const placed = { top: 9 * 60, bottom: 10 * 60 };
	assert.deepEqual(calendar.movedSlot(placed, "2026-10-21", 0, 37), { date: "2026-10-21", time: "09:30" });
	assert.deepEqual(calendar.movedSlot(placed, "2026-10-21", 2, -7), { date: "2026-10-23", time: "09:00" });
	assert.deepEqual(calendar.movedSlot(placed, "2026-10-21", -1, -600), { date: "2026-10-20", time: "00:00" });
	assert.deepEqual(calendar.movedSlot(placed, "2026-10-21", 0, 900), { date: "2026-10-21", time: "23:00" });
});

test("resizedLength snaps, keeps at least one snap and stops at midnight", () => {
	const placed = { top: 9 * 60, bottom: 10 * 60 };
	assert.equal(calendar.resizedLength(placed, 22), 75);
	assert.equal(calendar.resizedLength(placed, -200), 15);
	assert.equal(calendar.resizedLength({ top: 23 * 60, bottom: 23 * 60 + 30 }, 120), 60);
});

test("tappedSlot picks the half hour under the finger, leaving room before midnight", () => {
	assert.equal(calendar.tappedSlot(9 * 60 + 44), "09:30");
	assert.equal(calendar.tappedSlot(0), "00:00");
	assert.equal(calendar.tappedSlot(24 * 60 - 1), "23:30");
	assert.equal(calendar.minutesOf("17:45"), 1065);
	assert.equal(calendar.timeOf(1065), "17:45");
});

test("withInterviewTime moves only the matching interview of the matching application", () => {
	const app = application("a", [
		interview("i1", "2026-10-21T07:00:00Z"),
		{ id: "n1", type: "note", at: "2026-10-20T12:00:00Z" },
	]);
	const at = new Date("2026-10-22T10:00:00Z");
	const moved = calendar.withInterviewTime(app, { id: "a", entryId: "i1", at, durationMinutes: 45 });
	assert.deepEqual(
		{ at: moved.activity[0].at, durationMinutes: moved.activity[0].durationMinutes },
		{ at, durationMinutes: 45 },
	);
	assert.equal(moved.activity[1], app.activity[1]);
	assert.equal(moved.activity[0].timezone, "Europe/Berlin");
	assert.equal(calendar.withInterviewTime(app, { id: "other", entryId: "i1", at, durationMinutes: 45 }), app);
	assert.equal(
		calendar.withInterviewTime(app, { id: "a", entryId: "n1", at, durationMinutes: 45 }).activity[1].at,
		app.activity[1].at,
	);
});

test("a dragged interview lands on the user's wall clock, across a DST change", () => {
	// Berlin leaves summer time on 25 October 2026: 09:00 is 07:00Z the day before and 08:00Z after.
	const placed = { top: 9 * 60, bottom: 10 * 60 };
	const slot = calendar.movedSlot(placed, "2026-10-24", 2, 0);
	assert.equal(
		timezone.fromZonedDateTime(slot.date, slot.time, "Europe/Berlin").toISOString(),
		"2026-10-26T08:00:00.000Z",
	);
	// 02:30 on 29 March 2026 doesn't exist in Berlin: the drop is refused rather than moved to another hour.
	assert.equal(timezone.fromZonedDateTime("2026-03-29", "02:30", "Europe/Berlin"), null);
});
