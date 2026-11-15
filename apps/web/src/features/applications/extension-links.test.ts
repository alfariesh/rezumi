import { describe, expect, it } from "vite-plus/test";
import { prepareDialogData } from "./extension-links";

describe("prepareDialogData", () => {
	it("opens Copy for a job for the application, from the resume the extension names", () => {
		expect(prepareDialogData({ prepare: "resume", from: "resume-1" }, "app-1")).toEqual({
			step: "copy",
			applicationId: "app-1",
			sourceResumeId: "resume-1",
		});
		expect(prepareDialogData({ prepare: "resume" }, "app-1")).toEqual({ step: "copy", applicationId: "app-1" });
	});

	it("asks for nothing without the parameter", () => {
		expect(prepareDialogData({}, "app-1")).toBeNull();
		expect(prepareDialogData({ from: "resume-1" }, "app-1")).toBeNull();
	});
});
