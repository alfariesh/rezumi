import type { ApplicationRecord } from "./applications";
import { describe, expect, it } from "vite-plus/test";
import {
	applicationTags,
	boardColumns,
	daysInStage,
	filterApplications,
	getNextStage,
	getNextStep,
	groupApplications,
	keepPending,
	pendingAfterError,
	visibleSelection,
} from "./applications";

const now = new Date("2026-11-20T12:00:00Z");

const app = (id: string, patch: Partial<ApplicationRecord> = {}): ApplicationRecord => ({
	id,
	role: `Role ${id}`,
	company: `Company ${id}`,
	status: "applied",
	closedReason: null,
	activity: [],
	appliedAt: "2026-11-01T09:00:00Z",
	updatedAt: "2026-11-10T09:00:00Z",
	followUpAt: null,
	followUpNote: null,
	tags: [],
	contacts: [],
	resumeId: null,
	source: null,
	...patch,
});

const interview = (id: string, at: string, durationMinutes = 60) =>
	({
		id,
		type: "interview",
		at: new Date(at),
		kind: "technical",
		durationMinutes,
		location: "Remote",
		notes: "",
		participants: [],
		audience: "other",
		timezone: "UTC",
	}) as unknown as ApplicationRecord["activity"][number];

describe("getNextStep", () => {
	it("picks the next interview that hasn't ended", () => {
		const step = getNextStep(
			app("a", {
				activity: [interview("old", "2026-11-19T09:00:00Z"), interview("next", "2026-11-22T09:00:00Z")],
				followUpAt: "2026-11-21T09:00:00Z",
			}),
			now,
		);
		expect(step.kind === "interview" && step.interview.id).toBe("next");
	});

	it("keeps an interview under way as the next step", () => {
		const step = getNextStep(app("a", { activity: [interview("now", "2026-11-20T11:30:00Z")] }), now);
		expect(step.kind).toBe("interview");
	});

	it("falls back to the follow-up, marked overdue once past", () => {
		expect(getNextStep(app("a", { followUpAt: "2026-11-19T09:00:00Z", followUpNote: "Ping" }), now)).toMatchObject({
			kind: "follow-up",
			note: "Ping",
			overdue: true,
		});
	});

	it("suggests a follow-up after ten days without a reply", () => {
		expect(getNextStep(app("a", { appliedAt: "2026-11-05T09:00:00Z" }), now)).toEqual({ kind: "no-reply", days: 15 });
		expect(getNextStep(app("a", { appliedAt: "2026-11-15T09:00:00Z" }), now)).toEqual({ kind: "waiting", days: 5 });
	});

	it("says saved and closed applications need nothing to wait for", () => {
		expect(getNextStep(app("a", { status: "saved" }), now).kind).toBe("not-applied");
		expect(getNextStep(app("a", { status: "closed" }), now).kind).toBe("closed");
	});

	it("counts days from the latest entry into the current stage", () => {
		const activity = [
			{ id: "s1", type: "stage", stage: "screening", at: new Date("2026-11-02T09:00:00Z") },
			{ id: "s2", type: "stage", stage: "screening", at: new Date("2026-11-18T09:00:00Z") },
		] as unknown as ApplicationRecord["activity"];
		expect(daysInStage(app("a", { status: "screening", activity }), now)).toBe(2);
	});
});

describe("the list", () => {
	const items = [
		app("a", { role: "Designer", status: "interview", contacts: [{ name: "Ana", email: "ana@acme.test" }] }),
		app("b", { status: "closed", tags: ["remote"] }),
		app("c", { status: "applied", tags: ["remote", "dream"] }),
	];

	it("searches role, company and contacts, hides closed unless asked", () => {
		expect(filterApplications(items, { search: "ACME", tag: "", showClosed: false }).map((a) => a.id)).toEqual(["a"]);
		expect(filterApplications(items, { search: "", tag: "remote", showClosed: false }).map((a) => a.id)).toEqual(["c"]);
		expect(filterApplications(items, { search: "", tag: "remote", showClosed: true }).map((a) => a.id)).toEqual([
			"b",
			"c",
		]);
	});

	it("filters by stage, and a closed stage shows closed ones", () => {
		expect(filterApplications(items, { search: "", tag: "", showClosed: false, stage: "closed" })).toHaveLength(1);
		expect(filterApplications(items, { search: "", tag: "", showClosed: true, stage: "applied" })).toHaveLength(1);
	});

	it("groups in list order and sorts by next step", () => {
		const groups = groupApplications(
			[
				app("late", { followUpAt: "2026-11-30T09:00:00Z" }),
				app("soon", { followUpAt: "2026-11-21T09:00:00Z" }),
				app("i", { status: "interview" }),
			],
			"next",
			"asc",
			now,
		);
		expect(groups.map((group) => [group.status, group.data.map((a) => a.id)])).toEqual([
			["interview", ["i"]],
			["applied", ["soon", "late"]],
		]);
	});

	it("drops collapsed groups from the selection and lists tags once", () => {
		const groups = groupApplications(items, "updated", "desc", now);
		expect(visibleSelection(groups, new Set(["interview"]), new Set(["a", "c"]))).toEqual(["c"]);
		expect(applicationTags(items)).toEqual(["dream", "remote"]);
	});
});

describe("the Board", () => {
	it("moves the card to its pending column until the list catches up", () => {
		const items = [app("a", { status: "saved" }), app("b", { status: "offer" })];
		const pending = { id: "a", from: "saved", to: "applied" } as const;
		const columns = boardColumns(items, pending);
		expect(columns.find((column) => column.status === "applied")?.data.map((a) => a.id)).toEqual(["a"]);
		expect(columns.map((column) => column.status)).toEqual([
			"saved",
			"applied",
			"screening",
			"interview",
			"offer",
			"closed",
		]);
		expect(keepPending(pending, items)).toBe(pending);
		expect(keepPending(pending, [app("a", { status: "applied" })])).toBeNull();
		expect(pendingAfterError(pending, "a", "applied")).toBeNull();
		expect(pendingAfterError(pending, "a", "offer")).toBe(pending);
	});

	it("names the next stage, none after Offer", () => {
		expect(getNextStage("screening")).toBe("interview");
		expect(getNextStage("offer")).toBeNull();
		expect(getNextStage("closed")).toBeNull();
	});
});
