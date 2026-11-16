import { describe, expect, it } from "vite-plus/test";
import { workModeStep } from "./work-mode";

const base = { openWorkId: null, lastWorkId: null, workIds: ["a", "b"] };

describe("workModeStep", () => {
	it("closes the work when Work is left", () => {
		expect(workModeStep({ ...base, before: "work", mode: "design", openWorkId: "a" })).toEqual({
			kind: "open",
			workId: null,
		});
	});

	it("opens the work open last on arriving in Work, else the first", () => {
		expect(workModeStep({ ...base, before: "write", mode: "work", lastWorkId: "b" })).toEqual({
			kind: "open",
			workId: "b",
		});
		expect(workModeStep({ ...base, before: "write", mode: "work", lastWorkId: "gone" })).toEqual({
			kind: "open",
			workId: "a",
		});
		// The editor opened on Work.
		expect(workModeStep({ ...base, before: null, mode: "work" })).toEqual({ kind: "open", workId: "a" });
	});

	it("opens nothing in Work without works, or with one already open", () => {
		expect(workModeStep({ ...base, workIds: [], before: "write", mode: "work" })).toEqual({ kind: "none" });
		expect(workModeStep({ ...base, before: "write", mode: "work", openWorkId: "b" })).toEqual({ kind: "none" });
	});

	it("brings Work up when a work is opened from another tab", () => {
		expect(workModeStep({ ...base, before: "write", mode: "write", openWorkId: "a" })).toEqual({
			kind: "switch-to-work",
		});
	});

	it("leaves Work alone when its work is closed there (All works, a deleted work)", () => {
		expect(workModeStep({ ...base, before: "work", mode: "work" })).toEqual({ kind: "none" });
	});
});
